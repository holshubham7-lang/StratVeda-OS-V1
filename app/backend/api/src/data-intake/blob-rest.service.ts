import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AzureTokenService } from './azure-token.service';

const apiVersion = '2023-11-03';

/** Keeps Azure's status and error code for logs; the message never carries the raw XML body. */
export class BlobStorageError extends ServiceUnavailableException {
  constructor(
    readonly operation: string,
    readonly httpStatus: number,
    readonly code: string,
  ) {
    super(`Azure Blob Storage ${operation} failed (${httpStatus}${code ? ` ${code}` : ''}).`);
  }
}

@Injectable()
export class BlobRestService {
  private readonly endpoint: string;
  private readonly sas: string;

  constructor(
    private readonly config: ConfigService,
    private readonly tokens: AzureTokenService,
  ) {
    const account = this.config.get<string>('AZURE_STORAGE_ACCOUNT', 'excelfilereader661745').trim();
    this.endpoint = (this.config.get<string>('AZURE_STORAGE_BLOB_ENDPOINT')
      ?? `https://${account}.blob.core.windows.net`).replace(/\/+$/, '');
    this.sas = this.readSas();
  }

  async upload(container: string, blob: string, buffer: Buffer, mimeType: string) {
    await this.request('upload', 'PUT', container, blob, undefined, buffer, {
      'content-type': mimeType || 'application/octet-stream',
      'x-ms-blob-type': 'BlockBlob',
    });
  }

  async download(container: string, blob: string) {
    const response = await this.request('download', 'GET', container, blob);
    return Buffer.from(await response.arrayBuffer());
  }

  async delete(container: string, blob: string) {
    await this.request('delete', 'DELETE', container, blob);
  }

  async tags(container: string, blob: string) {
    const response = await this.request('read tags', 'GET', container, blob, { comp: 'tags' });
    const xml = await response.text();
    const tags: Record<string, string> = {};
    for (const match of xml.matchAll(/<Tag>\s*<Key>([\s\S]*?)<\/Key>\s*<Value>([\s\S]*?)<\/Value>\s*<\/Tag>/g)) {
      tags[this.decodeXml(match[1])] = this.decodeXml(match[2]);
    }
    return tags;
  }

  private async request(
    operation: string,
    method: string,
    container: string,
    blob: string,
    query?: Record<string, string>,
    body?: Buffer,
    extraHeaders?: Record<string, string>,
  ) {
    const url = new URL(`${this.endpoint}/${encodeURIComponent(container)}/${blob.split('/').map(encodeURIComponent).join('/')}`);
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
    if (this.sas) {
      for (const [key, value] of new URLSearchParams(this.sas)) url.searchParams.set(key, value);
    }

    const headers = new Headers(extraHeaders);
    headers.set('x-ms-version', apiVersion);
    headers.set('x-ms-date', new Date().toUTCString());
    headers.set('accept', 'application/xml,application/json');
    if (!this.sas) {
      headers.set('authorization', `Bearer ${await this.tokens.get('https://storage.azure.com/')}`);
    }
    if (body) headers.set('content-length', String(body.length));

    const response = await fetch(url, {
      method,
      headers,
      body: body ? new Uint8Array(body) : undefined,
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const code = response.headers.get('x-ms-error-code') ?? detail.match(/<Code>([^<]+)<\/Code>/)?.[1] ?? '';
      throw new BlobStorageError(operation, response.status, code);
    }
    return response;
  }

  private readSas() {
    const configured = this.config.get<string>('AZURE_STORAGE_SAS')
      ?? this.config.get<string>('AZURE_STORAGE_SAS_URL')
      ?? '';
    const value = configured.trim();
    if (!value) return '';
    if (!value.includes('?')) return value.replace(/^\?/, '');
    return new URL(value).search.replace(/^\?/, '');
  }

  private decodeXml(value: string) {
    return value
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  }
}
