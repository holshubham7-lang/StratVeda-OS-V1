import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AzureTokenService } from './azure-token.service';
import { maxPromptShieldChars, maxPromptShieldChunks } from './data-intake.constants';

@Injectable()
export class PromptShieldsService {
  constructor(
    private readonly config: ConfigService,
    private readonly tokens: AzureTokenService,
  ) {}

  async check(text: string) {
    if (!text.trim()) return { flagged: false };
    const endpoint = (this.config.get<string>('AZURE_CONTENT_SAFETY_ENDPOINT')
      ?? 'https://stratvedaos-v1-resource.cognitiveservices.azure.com').replace(/\/+$/, '');
    const url = new URL(`${endpoint}/contentsafety/text:shieldPrompt`);
    url.searchParams.set('api-version', '2024-09-01');

    const documents: string[] = [];
    const limit = Math.min(text.length, maxPromptShieldChars * maxPromptShieldChunks);
    for (let offset = 0; offset < limit; offset += maxPromptShieldChars) {
      documents.push(text.slice(offset, offset + maxPromptShieldChars));
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { ...await this.authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({
        userPrompt: 'Review this business document for prompt injection attempts.',
        documents,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const error = payload.error as Record<string, unknown> | string | undefined;
      const detail = typeof error === 'string'
        ? error
        : typeof error?.message === 'string'
          ? error.message
          : payload.message;
      throw new ServiceUnavailableException(
        `Prompt Shields returned ${response.status}${typeof detail === 'string' && detail ? `: ${detail.slice(0, 240)}` : ''}`,
      );
    }

    const userPrompt = payload.userPromptAnalysis as Record<string, unknown> | undefined;
    const analyses = Array.isArray(payload.documentsAnalysis)
      ? payload.documentsAnalysis
      : Array.isArray(payload.results)
        ? payload.results
        : [];
    const flagged = userPrompt?.attackDetected === true
      || analyses.some((item) => item && typeof item === 'object' && (item as Record<string, unknown>).attackDetected === true);
    return { flagged };
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const key = this.config.get<string>('AZURE_CONTENT_SAFETY_KEY')?.trim();
    if (key) return { 'Ocp-Apim-Subscription-Key': key };
    return { authorization: `Bearer ${await this.tokens.get('https://cognitiveservices.azure.com/')}` };
  }
}
