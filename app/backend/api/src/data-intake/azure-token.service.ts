import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const storageScope = 'https://storage.azure.com/';
const cognitiveScope = 'https://cognitiveservices.azure.com/';
const foundryScope = 'https://ai.azure.com/';

@Injectable()
export class AzureTokenService {
  private readonly cache = new Map<string, { token: string; expiresAt: number }>();

  constructor(private readonly config: ConfigService) {}

  async get(resource: string, override?: string) {
    const fixed = override?.trim() || this.overrideFor(resource);
    if (fixed) return fixed;

    const cached = this.cache.get(resource);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

    const identityEndpoint = process.env.IDENTITY_ENDPOINT;
    const identityHeader = process.env.IDENTITY_HEADER;
    if (!identityEndpoint || !identityHeader) {
      throw new ServiceUnavailableException('The API host needs an Azure managed identity for this operation.');
    }

    const url = new URL(identityEndpoint);
    url.searchParams.set('api-version', '2019-08-01');
    url.searchParams.set('resource', resource);
    const response = await fetch(url, {
      headers: { 'X-IDENTITY-HEADER': identityHeader, Metadata: 'true' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok || typeof payload.access_token !== 'string') {
      throw new ServiceUnavailableException('The API host could not get the Azure token it needs.');
    }

    const expiresOn = Number(payload.expires_on);
    this.cache.set(resource, {
      token: payload.access_token,
      expiresAt: Number.isFinite(expiresOn) && expiresOn > 0 ? expiresOn * 1000 : Date.now() + 50 * 60_000,
    });
    return payload.access_token;
  }

  private overrideFor(resource: string) {
    if (resource === storageScope) {
      return this.config.get<string>('AZURE_STORAGE_ACCESS_TOKEN')
        ?? this.config.get<string>('AZURE_DATA_INTAKE_ACCESS_TOKEN');
    }
    if (resource === cognitiveScope) {
      return this.config.get<string>('AZURE_COGNITIVE_ACCESS_TOKEN')
        ?? this.config.get<string>('AZURE_DOCUMENT_INTELLIGENCE_ACCESS_TOKEN')
        ?? this.config.get<string>('AZURE_CONTENT_SAFETY_ACCESS_TOKEN');
    }
    if (resource === foundryScope) return this.config.get<string>('AZURE_FOUNDRY_ACCESS_TOKEN');
    return undefined;
  }
}
