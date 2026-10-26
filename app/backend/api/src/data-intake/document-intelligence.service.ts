import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readOfficeText } from '../workspace/office-text';
import { AzureTokenService } from './azure-token.service';
import { maxDataIntakeTextChars } from './data-intake.constants';

@Injectable()
export class DocumentIntelligenceService {
  constructor(
    private readonly config: ConfigService,
    private readonly tokens: AzureTokenService,
  ) {}

  async extract(buffer: Buffer, extension: string, mimeType: string) {
    if (extension === '.docx' || extension === '.xlsx') {
      const office = readOfficeText(buffer, extension);
      return { text: (office?.text ?? '').slice(0, maxDataIntakeTextChars), truncated: Boolean(office?.truncated) };
    }
    if (extension === '.csv' || extension === '.json' || extension === '.txt') {
      return this.extractPlainText(buffer, extension);
    }
    return this.extractWithDocumentIntelligence(buffer, mimeType);
  }

  private extractPlainText(buffer: Buffer, extension: string) {
    const raw = buffer.subarray(0, 512 * 1024).toString('utf8');
    if (raw.includes('\u0000')) throw new BadRequestException('This file is not readable text.');
    const lines = raw.split(/\r?\n/);
    const body = extension === '.csv'
      ? lines.slice(0, 1000).join('\n')
      : extension === '.json'
        ? this.compactJson(raw) ?? raw
        : raw;
    const text = body.trim().slice(0, maxDataIntakeTextChars);
    return {
      text,
      truncated: body.length > maxDataIntakeTextChars || (extension === '.csv' && lines.length > 1000),
    };
  }

  private compactJson(raw: string) {
    try {
      return JSON.stringify(JSON.parse(raw));
    } catch {
      return undefined;
    }
  }

  private async extractWithDocumentIntelligence(buffer: Buffer, mimeType: string) {
    const endpoint = (this.config.get<string>('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT')
      ?? 'https://doc-revops-dev.cognitiveservices.azure.com').replace(/\/+$/, '');
    const apiVersion = this.config.get<string>('AZURE_DOCUMENT_INTELLIGENCE_API_VERSION', '2024-11-30');
    const url = new URL(`${endpoint}/documentintelligence/documentModels/prebuilt-read:analyze`);
    url.searchParams.set('api-version', apiVersion);

    const auth = await this.authHeaders();
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...auth, 'content-type': mimeType || 'application/octet-stream' },
      body: new Uint8Array(buffer),
      signal: AbortSignal.timeout(30_000),
    });

    const initial = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok && response.status !== 202) {
      throw new ServiceUnavailableException(this.errorMessage('Document Intelligence', response.status, initial));
    }
    if (response.status === 200 && initial.analyzeResult) {
      return this.resultText(initial);
    }

    const operation = response.headers.get('operation-location');
    if (!operation) throw new ServiceUnavailableException('Document Intelligence did not return an operation URL.');

    const operationUrl = new URL(operation, endpoint);
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const poll = await fetch(operationUrl, {
        headers: await this.authHeaders(),
        cache: 'no-store',
        signal: AbortSignal.timeout(30_000),
      });
      const payload = await poll.json().catch(() => ({})) as Record<string, unknown>;
      if (!poll.ok) {
        throw new ServiceUnavailableException(this.errorMessage('Document Intelligence', poll.status, payload));
      }
      const status = String(payload.status ?? '').toLowerCase();
      if (status === 'succeeded') return this.resultText(payload);
      if (status === 'failed') {
        throw new ServiceUnavailableException(this.errorMessage('Document Intelligence', 500, payload));
      }
    }
    throw new ServiceUnavailableException('Document Intelligence timed out while reading this file.');
  }

  private resultText(payload: Record<string, unknown>) {
    const result = payload.analyzeResult as Record<string, unknown> | undefined;
    const content = typeof result?.content === 'string' ? result.content.trim() : '';
    return {
      text: content.slice(0, maxDataIntakeTextChars),
      truncated: content.length > maxDataIntakeTextChars,
    };
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const key = this.config.get<string>('AZURE_DOCUMENT_INTELLIGENCE_KEY')?.trim();
    if (key) return { 'Ocp-Apim-Subscription-Key': key };
    return { authorization: `Bearer ${await this.tokens.get('https://cognitiveservices.azure.com/')}` };
  }

  private errorMessage(service: string, status: number, payload: Record<string, unknown>) {
    const error = payload.error as Record<string, unknown> | string | undefined;
    const detail = typeof error === 'string'
      ? error
      : typeof error?.message === 'string'
        ? error.message
        : payload.message;
    return `${service} returned ${status}${typeof detail === 'string' && detail ? `: ${detail.slice(0, 240)}` : ''}`;
  }
}
