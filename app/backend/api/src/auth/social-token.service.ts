import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { createRemoteJWKSet, JWTPayload, jwtVerify } from 'jose';
import { SocialProvider } from '../users/user.schema';

export interface SocialIdentity {
  provider: SocialProvider;
  subject: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  locale?: string;
}

const microsoftKeys = createRemoteJWKSet(new URL('https://login.microsoftonline.com/common/discovery/v2.0/keys'));
const linkedInKeys = createRemoteJWKSet(new URL('https://www.linkedin.com/oauth/openid/jwks'));
const linkedInIssuers = ['https://www.linkedin.com/oauth', 'https://www.linkedin.com'];

@Injectable()
export class SocialTokenService {
  private readonly googleClient = new OAuth2Client();

  constructor(private readonly config: ConfigService) {}

  async verify(provider: SocialProvider, idToken: string, expectedNonce?: string): Promise<SocialIdentity> {
    try {
      switch (provider) {
        case 'google': return await this.verifyGoogle(idToken);
        case 'microsoft': return await this.verifyMicrosoft(idToken, expectedNonce);
        case 'linkedin': return await this.verifyLinkedIn(idToken);
      }
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof InternalServerErrorException) throw error;
      if (provider === 'linkedin') {
        throw new UnauthorizedException(this.linkedinVerificationFailure(error));
      }
      throw new UnauthorizedException('The identity token is invalid or expired');
    }
  }

  private linkedinVerificationFailure(error: unknown): string {
    const details = error && typeof error === 'object'
      ? error as { code?: unknown; claim?: unknown }
      : {};
    const code = typeof details.code === 'string' ? details.code : undefined;
    const claim = typeof details.claim === 'string' ? details.claim : undefined;

    if (code === 'ERR_JWT_EXPIRED') return 'LinkedIn identity token expired. Please start sign-in again.';
    if (code === 'ERR_JWT_CLAIM_VALIDATION_FAILED' && claim === 'aud') {
      return 'LinkedIn token audience does not match LINKEDIN_CLIENT_ID. Check that the API uses the client ID for the same LinkedIn app.';
    }
    if (code === 'ERR_JWT_CLAIM_VALIDATION_FAILED' && claim === 'iss') {
      return 'LinkedIn returned an unexpected token issuer. Confirm the app has OpenID Connect sign-in enabled.';
    }
    if (code === 'ERR_JWKS_NO_MATCHING_KEY' || code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
      return 'LinkedIn token signature could not be verified. Confirm the token came from the configured LinkedIn app and retry.';
    }
    if (code?.startsWith('ERR_JWKS_')) {
      return 'The API could not retrieve LinkedIn signing keys. Check the API server network connection and retry.';
    }
    return code
      ? `LinkedIn identity token validation failed (${code}). Please retry sign-in.`
      : 'LinkedIn identity token is invalid or expired. Please retry sign-in.';
  }

  async authenticateLinkedIn(code: string, redirectUri: string): Promise<SocialIdentity> {
    const tokens = await this.exchangeLinkedInTokens(code, redirectUri);
    if (typeof tokens.id_token === 'string') return this.verifyLinkedIn(tokens.id_token);
    if (typeof tokens.access_token === 'string') return this.fetchLinkedInUserInfo(tokens.access_token);
    throw new UnauthorizedException('LinkedIn did not return an ID token');
  }

  private async exchangeLinkedInTokens(code: string, redirectUri: string) {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: this.required('LINKEDIN_CLIENT_ID'),
      client_secret: this.required('LINKEDIN_CLIENT_SECRET'),
    });
    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const tokens = await this.parseOAuthTokenResponse(response);
    if (!response.ok) {
      const errorCode = typeof tokens.error === 'string' ? tokens.error : 'token_exchange_failed';
      throw new UnauthorizedException(`LinkedIn authorization could not be completed (${errorCode})`);
    }
    return tokens;
  }

  private async parseOAuthTokenResponse(response: Response) {
    const raw = await response.text();
    try {
      return JSON.parse(raw) as { id_token?: unknown; access_token?: unknown; error?: unknown };
    } catch {
      const params = new URLSearchParams(raw);
      return {
        id_token: params.get('id_token') ?? undefined,
        access_token: params.get('access_token') ?? undefined,
        error: params.get('error') ?? undefined,
      };
    }
  }

  private async fetchLinkedInUserInfo(accessToken: string): Promise<SocialIdentity> {
    const response = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new UnauthorizedException('LinkedIn identity could not be retrieved');
    const payload = await response.json() as JWTPayload;
    if (typeof payload.sub !== 'string' || !payload.sub) throw new UnauthorizedException('Invalid LinkedIn identity');
    return this.identityFromClaims('linkedin', payload);
  }

  async exchangeGoogleCode(code: string, redirectUri: string): Promise<string> {
    const body = new URLSearchParams({
      code,
      client_id: this.required('GOOGLE_CLIENT_ID'),
      client_secret: this.required('GOOGLE_CLIENT_SECRET'),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new UnauthorizedException('Google authorization could not be completed');
    const tokens = await response.json() as { id_token?: unknown };
    if (typeof tokens.id_token !== 'string') throw new UnauthorizedException('Google did not return an ID token');
    return tokens.id_token;
  }

  async exchangeMicrosoftCode(code: string, redirectUri: string, codeVerifier: string): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.required('MICROSOFT_CLIENT_ID'),
      client_secret: this.required('MICROSOFT_CLIENT_SECRET'),
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: 'openid profile email',
    });
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const tokens = await response.json() as { id_token?: unknown; error?: unknown; error_description?: unknown };
    if (!response.ok) {
      const errorCode = typeof tokens.error === 'string' ? tokens.error : 'token_exchange_failed';
      throw new UnauthorizedException(`Microsoft authorization could not be completed (${errorCode})`);
    }
    if (typeof tokens.id_token !== 'string') throw new UnauthorizedException('Microsoft did not return an ID token');
    return tokens.id_token;
  }

  private async verifyGoogle(idToken: string): Promise<SocialIdentity> {
    const audience = this.required('GOOGLE_CLIENT_ID');
    const ticket = await this.googleClient.verifyIdToken({ idToken, audience });
    const payload = ticket.getPayload();
    if (!payload?.sub || payload.email_verified !== true) throw new UnauthorizedException('A verified Google account is required');
    return {
      provider: 'google',
      subject: payload.sub,
      email: payload.email?.toLowerCase(),
      emailVerified: payload.email_verified === true,
      name: payload.name,
      givenName: payload.given_name,
      familyName: payload.family_name,
      picture: payload.picture,
      locale: payload.locale,
    };
  }

  private async verifyMicrosoft(idToken: string, expectedNonce?: string): Promise<SocialIdentity> {
    const audience = this.required('MICROSOFT_CLIENT_ID');
    const { payload } = await jwtVerify(idToken, microsoftKeys, { audience });
    if (expectedNonce && payload.nonce !== expectedNonce) {
      throw new UnauthorizedException('Microsoft sign-in could not be verified. Please restart sign-in.');
    }
    const issuerTenant = typeof payload.iss === 'string'
      ? /^https:\/\/login\.microsoftonline\.com\/([0-9a-f-]{36})\/v2\.0$/i.exec(payload.iss)?.[1]
      : undefined;
    if (!issuerTenant || typeof payload.tid !== 'string' || issuerTenant.toLowerCase() !== payload.tid.toLowerCase()) {
      throw new UnauthorizedException('Invalid Microsoft token issuer');
    }
    if (typeof payload.tid !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.tid) || !payload.sub) throw new UnauthorizedException('Invalid Microsoft identity');
    return this.identityFromClaims('microsoft', payload);
  }

  private async verifyLinkedIn(idToken: string): Promise<SocialIdentity> {
    const audience = this.required('LINKEDIN_CLIENT_ID');
    // LinkedIn docs and the live discovery document disagree on issuer; accept both.
    const { payload } = await jwtVerify(idToken, linkedInKeys, {
      audience,
      issuer: linkedInIssuers,
      clockTolerance: 60,
    });
    if (!payload.sub) throw new UnauthorizedException('Invalid LinkedIn identity');
    return this.identityFromClaims('linkedin', payload);
  }

  private identityFromClaims(provider: SocialProvider, payload: JWTPayload): SocialIdentity {
    const verifiedClaim = payload.email_verified as unknown;
    const emailVerified = verifiedClaim === true || verifiedClaim === 'true';
    const emailClaim = typeof payload.email === 'string' ? payload.email : undefined;
    const microsoftUsername = provider === 'microsoft' && typeof payload.preferred_username === 'string'
      ? payload.preferred_username
      : undefined;
    const emailCandidate = emailClaim ?? (microsoftUsername && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(microsoftUsername)
      ? microsoftUsername
      : undefined);
    const email = emailCandidate?.trim().toLowerCase() || undefined;
    const name = typeof payload.name === 'string' ? payload.name.trim() : undefined;
    const picture = typeof payload.picture === 'string' ? payload.picture : undefined;
    const locale = typeof payload.locale === 'string'
      ? payload.locale
      : payload.locale && typeof payload.locale === 'object' && 'language' in payload.locale
        ? String((payload.locale as { language: unknown }).language)
        : undefined;
    return {
      provider,
      subject: payload.sub!,
      email,
      emailVerified,
      name: name || undefined,
      givenName: typeof payload.given_name === 'string' ? payload.given_name : undefined,
      familyName: typeof payload.family_name === 'string' ? payload.family_name : undefined,
      picture,
      locale,
    };
  }

  private required(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) throw new InternalServerErrorException(`Server configuration is missing ${key}`);
    return value;
  }
}
