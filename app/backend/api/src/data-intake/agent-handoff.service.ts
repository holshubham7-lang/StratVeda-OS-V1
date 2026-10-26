import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AzureTokenService } from './azure-token.service';

type JsonRecord = Record<string, unknown>;

@Injectable()
export class AgentHandoffService {
  private readonly dataAgentTimeoutMs: number;
  private readonly masterTimeoutMs: number;

  constructor(
    private readonly config: ConfigService,
    private readonly tokens: AzureTokenService,
  ) {
    this.dataAgentTimeoutMs = this.number('AZURE_DATA_AGENT_TIMEOUT_MS', 180_000);
    this.masterTimeoutMs = this.number('AZURE_MASTER_AGENT_TIMEOUT_MS', 90_000);
  }

  async callDataAgent(payload: string) {
    const endpoint = this.config.get<string>('AZURE_DATA_AGENT_A2A_ENDPOINT')
      ?? 'https://stratvedaos-v1-resource.services.ai.azure.com/api/projects/stratvedaos-v1/agents/data-analyst-agent/endpoint/protocols/a2a';
    const result = await this.rpc(endpoint, 'SendMessage', {
      message: {
        role: 'ROLE_USER',
        messageId: randomUUID(),
        parts: [{ text: payload }],
      },
    });
    let task = this.taskOf(result);
    if (!task) {
      const text = this.messageText(result);
      if (text) return text;
      throw new ServiceUnavailableException('The Data Agent did not return a task.');
    }

    let state = this.taskState(task);
    if (state !== 'TASK_STATE_COMPLETED') {
      if (state === 'TASK_STATE_FAILED' || state === 'TASK_STATE_CANCELED' || state === 'TASK_STATE_REJECTED') {
        throw new ServiceUnavailableException(`The Data Agent task ended with ${state}.`);
      }
      const taskId = typeof task.id === 'string' ? task.id : '';
      if (!taskId) throw new ServiceUnavailableException('The Data Agent did not return a task identifier.');
      const deadline = Date.now() + this.dataAgentTimeoutMs;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const current = await this.rpc(endpoint, 'GetTask', { id: taskId });
        task = this.taskOf(current);
        if (!task) continue;
        state = this.taskState(task);
        if (state === 'TASK_STATE_COMPLETED') break;
        if (state === 'TASK_STATE_FAILED' || state === 'TASK_STATE_CANCELED' || state === 'TASK_STATE_REJECTED') {
          throw new ServiceUnavailableException(`The Data Agent task ended with ${state}.`);
        }
      }
      if (state !== 'TASK_STATE_COMPLETED') {
        throw new ServiceUnavailableException('The Data Agent timed out before returning an evidence package.');
      }
    }

    if (!task) throw new ServiceUnavailableException('The Data Agent did not return a task.');
    const text = this.artifactText(task);
    if (!text) throw new ServiceUnavailableException('The Data Agent completed without an evidence package.');
    return text;
  }

  async callMasterAgent(input: string) {
    const endpoint = this.config.get<string>('AZURE_MASTER_AGENT_ENDPOINT')
      ?? 'https://stratvedaos-v1-resource.services.ai.azure.com/api/projects/stratvedaos-v1/agents/main-agent/endpoint/protocols/openai/responses';
    const url = new URL(endpoint);
    if (!url.searchParams.has('api-version')) url.searchParams.set('api-version', 'v1');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${await this.tokens.get('https://ai.azure.com/')}`,
      },
      body: JSON.stringify({ input, max_output_tokens: 1600, stream: false }),
      signal: AbortSignal.timeout(this.masterTimeoutMs),
    });
    const text = await response.text();
    let payload: JsonRecord = {};
    try { payload = text ? JSON.parse(text) as JsonRecord : {}; } catch { payload = {}; }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `The Master Agent returned ${response.status}: ${this.errorText(payload, text)}`.slice(0, 500),
      );
    }
    const content = this.outputText(payload);
    if (!content) throw new ServiceUnavailableException('The Master Agent returned an empty handover response.');
    return content;
  }

  private async rpc(endpoint: string, method: string, params: JsonRecord) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'A2A-Version': '1.0',
        authorization: `Bearer ${await this.tokens.get('https://ai.azure.com/')}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: randomUUID(), method, params }),
      signal: AbortSignal.timeout(this.dataAgentTimeoutMs),
    });
    const text = await response.text();
    let payload: JsonRecord = {};
    try { payload = text ? JSON.parse(text) as JsonRecord : {}; } catch { payload = {}; }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `The Data Agent returned ${response.status}: ${this.errorText(payload, text)}`.slice(0, 500),
      );
    }
    const error = payload.error as JsonRecord | undefined;
    if (error) {
      const message = typeof error.message === 'string' ? error.message : 'The Data Agent rejected the request.';
      throw new ServiceUnavailableException(message.slice(0, 500));
    }
    return (payload.result && typeof payload.result === 'object' ? payload.result : payload) as JsonRecord;
  }

  private taskOf(result: JsonRecord) {
    const task = result.task;
    return task && typeof task === 'object' ? task as JsonRecord : undefined;
  }

  private taskState(task: JsonRecord) {
    const status = task.status;
    const state = status && typeof status === 'object' ? String((status as JsonRecord).state ?? '').toUpperCase() : '';
    if (!state) return '';
    return state.startsWith('TASK_STATE_') ? state : `TASK_STATE_${state}`;
  }

  private artifactText(task: JsonRecord) {
    const artifacts = Array.isArray(task.artifacts) ? task.artifacts : [];
    const chunks: string[] = [];
    for (const artifact of artifacts) {
      if (!artifact || typeof artifact !== 'object') continue;
      const text = this.partsText((artifact as JsonRecord).parts);
      if (text) chunks.push(text);
    }
    if (!chunks.length) {
      const status = task.status;
      const message = status && typeof status === 'object' ? (status as JsonRecord).message : undefined;
      const text = message && typeof message === 'object' ? this.partsText((message as JsonRecord).parts) : '';
      if (text) chunks.push(text);
    }
    return chunks.join('\n').trim();
  }

  private messageText(result: JsonRecord) {
    const message = result.message;
    return message && typeof message === 'object' ? this.partsText((message as JsonRecord).parts) : '';
  }

  private partsText(parts: unknown) {
    if (!Array.isArray(parts)) return '';
    return parts
      .filter((part): part is JsonRecord => Boolean(part) && typeof part === 'object')
      .map((part) => typeof part.text === 'string' ? part.text : '')
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  private outputText(payload: JsonRecord) {
    if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim();
    const output = Array.isArray(payload.output) ? payload.output : [];
    const chunks: string[] = [];
    for (const item of output) {
      if (!item || typeof item !== 'object') continue;
      const message = item as JsonRecord;
      if (message.type !== 'message' || !Array.isArray(message.content)) continue;
      for (const part of message.content) {
        if (!part || typeof part !== 'object') continue;
        const content = part as JsonRecord;
        if ((content.type === 'output_text' || content.type === 'text') && typeof content.text === 'string') {
          chunks.push(content.text);
        }
      }
    }
    return chunks.join('\n').trim();
  }

  private errorText(payload: JsonRecord, raw: string) {
    const error = payload.error as JsonRecord | string | undefined;
    if (typeof error === 'string' && error.trim()) return error.trim();
    if (error && typeof error === 'object' && typeof error.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }
    return raw.slice(0, 300);
  }

  private number(key: string, fallback: number) {
    const value = Number(this.config.get(key, String(fallback)));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
