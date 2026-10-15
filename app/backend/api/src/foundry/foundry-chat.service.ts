import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type FoundryMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type FoundryReply = {
  content: string;
  model: string;
  responseId?: string;
};

/**
 * Talks to the Foundry project's OpenAI-compatible chat route. The project
 * endpoint carries the credential, so the browser never sees it, and every
 * per-environment value stays in configuration. Both the executive brief and
 * the Decision Workspace agent go through here so there is one auth path.
 */
@Injectable()
export class FoundryChatService {
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.timeoutMs = Number(this.config.get('AZURE_FOUNDRY_TIMEOUT_MS', '60000'));
  }

  async complete(messages: FoundryMessage[], maxCompletionTokens = 8192): Promise<FoundryReply> {
    const endpoint = (this.config.get<string>('AZURE_FOUNDRY_PROJECT_ENDPOINT') ?? '').replace(/\/+$/, '');
    const model = this.config.get<string>('AZURE_FOUNDRY_MODEL', '').trim();
    const apiKey = this.config.get<string>('AZURE_FOUNDRY_API_KEY', '').trim();
    const accessToken = this.config.get<string>('AZURE_FOUNDRY_ACCESS_TOKEN', '').trim();

    if (!endpoint || !model) {
      throw new ServiceUnavailableException('The decision agent model is not configured yet.');
    }
    if (!apiKey && !accessToken) {
      throw new ServiceUnavailableException('The decision agent has no credentials configured.');
    }

    // This route takes no api-version; the /v1 path rejects requests that carry one.
    const url = this.config.get<string>('AZURE_FOUNDRY_CHAT_URL')?.trim()
      || `${endpoint}/openai/v1/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { 'api-key': apiKey } : {}),
        ...(accessToken || apiKey ? { authorization: `Bearer ${accessToken || apiKey}` } : {}),
      },
      body: JSON.stringify({ model, messages, max_completion_tokens: maxCompletionTokens, stream: false }),
      signal: AbortSignal.timeout(Number.isFinite(this.timeoutMs) && this.timeoutMs > 0 ? this.timeoutMs : 60000),
    });

    const text = await response.text();
    let result: Record<string, unknown> = {};
    try { result = text ? JSON.parse(text) : {}; } catch { /* Keep the raw text below as the failure reason. */ }

    if (!response.ok) {
      const reason = this.firstString(result, ['message', 'error', 'detail']) ?? text.slice(0, 300);
      throw new Error(`Model responded ${response.status}: ${reason}`.slice(0, 500));
    }

    const content = this.extractText(result);
    if (!content) throw new Error('The model replied, but the response contained no text.');

    return {
      content,
      model,
      responseId: typeof result.id === 'string' ? result.id : undefined,
    };
  }

  private extractText(payload: Record<string, unknown>): string | undefined {
    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const message = (choices[0] as Record<string, unknown> | undefined)?.message as Record<string, unknown> | undefined;
    return typeof message?.content === 'string' && message.content.trim() ? message.content.trim() : undefined;
  }

  private firstString(payload: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (value && typeof value === 'object') {
        const nested = (value as Record<string, unknown>).message;
        if (typeof nested === 'string' && nested.trim()) return nested.trim();
      }
    }
    return undefined;
  }
}
