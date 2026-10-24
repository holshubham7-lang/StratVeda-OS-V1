import { ConflictException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { User, UserDocument } from '../users/user.schema';
import { SocialIdentity, SocialTokenService } from './social-token.service';
import { RevokedToken } from './revoked-token.schema';
import { UserActivity, UserActivityType } from './user-activity.schema';

function deriveKey(password: string, salt: string, length: number, options: { N: number; r: number; p: number; maxmem: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, length, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey as Buffer);
    });
  });
}

export interface ActivityRequestMetadata {
  ipAddress?: string;
  userAgent?: string;
  browser?: string;
  operatingSystem?: string;
  devicePlatform?: string;
  deviceModel?: string;
  deviceHint?: string;
}

const TERMS_VERSION = '2026-10-24';

function consentRecord(acceptedTerms?: boolean) {
  if (!acceptedTerms) return {};
  return { acceptedTerms: true, termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION };
}

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(RevokedToken.name) private readonly revokedTokens: Model<RevokedToken>,
    @InjectModel(UserActivity.name) private readonly activities: Model<UserActivity>,
    private readonly socialTokens: SocialTokenService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.activities.createCollection();
    } catch (error) {
      // NamespaceExists means the collection was already created by a prior run.
      if ((error as { code?: number }).code !== 48) throw error;
    }
  }

  async signup(
    provider: 'google' | 'microsoft' | 'linkedin',
    idToken: string,
    metadata?: ActivityRequestMetadata,
    expectedNonce?: string,
    acceptedTerms?: boolean,
  ) {
    const identity = await this.socialTokens.verify(provider, idToken, expectedNonce);
    return this.completeSocialSession(identity, metadata, acceptedTerms);
  }

  async signupWithLinkedInCode(code: string, redirectUri: string, metadata?: ActivityRequestMetadata, acceptedTerms?: boolean) {
    const identity = await this.socialTokens.authenticateLinkedIn(code, redirectUri);
    return this.completeSocialSession(identity, metadata, acceptedTerms);
  }

  private async completeSocialSession(identity: SocialIdentity, metadata?: ActivityRequestMetadata, acceptedTerms?: boolean) {
    let user = await this.users.findOne({ provider: identity.provider, providerSubject: identity.subject });

    const isNewUser = !user;
    if (!user) user = await this.createUser(identity, acceptedTerms);
    else user = await this.updateUserProfile(user, identity);
    if (!user.isActive) throw new UnauthorizedException('This account is disabled');

    await this.recordActivity(
      user.id,
      isNewUser ? 'signup' : 'login',
      identity.provider,
      metadata,
    );

    const accessToken = await this.jwt.signAsync({ sub: user.id, provider: user.provider, jti: randomUUID() });
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.expirationInSeconds(),
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name,
        givenName: user.givenName,
        familyName: user.familyName,
        picture: user.picture,
        locale: user.locale,
        provider: user.provider,
      },
    };
  }

  async registerWithPassword(name: string, email: string, password: string, metadata?: ActivityRequestMetadata, acceptedTerms?: boolean) {
    const normalizedEmail = email.trim().toLowerCase();
    if (await this.users.exists({ email: normalizedEmail })) {
      throw new ConflictException('An account with this email already exists. Sign in instead.');
    }
    const [givenName, ...familyParts] = name.trim().split(/\s+/);
    const salt = randomBytes(16).toString('hex');
    const key = await deriveKey(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    let user: UserDocument;
    try {
      user = await this.users.create({
        provider: 'password', providerSubject: normalizedEmail, email: normalizedEmail,
        emailVerified: false, name: name.trim(), givenName,
        familyName: familyParts.join(' ') || undefined,
        passwordHash: `scrypt$32768$8$1$${salt}$${key.toString('hex')}`,
        ...consentRecord(acceptedTerms),
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('An account with this email already exists. Sign in instead.');
      }
      throw error;
    }
    await this.recordActivity(user.id, 'signup', 'password', metadata);
    return this.issueSession(user);
  }

  async loginWithPassword(email: string, password: string, metadata?: ActivityRequestMetadata) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.users.findOne({ provider: 'password', email: normalizedEmail }).select('+passwordHash');
    if (!user?.passwordHash || !await this.verifyPassword(password, user.passwordHash) || !user.isActive) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }
    await this.recordActivity(user.id, 'login', 'password', metadata);
    return this.issueSession(user);
  }

  private async verifyPassword(password: string, encoded: string): Promise<boolean> {
    const [, n, r, p, salt, expectedHex] = encoded.split('$');
    if (!n || !r || !p || !salt || !/^[a-f0-9]{128}$/i.test(expectedHex ?? '')) return false;
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = await deriveKey(password, salt, expected.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private async issueSession(user: UserDocument) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, provider: user.provider, jti: randomUUID() });
    return { accessToken, tokenType: 'Bearer', expiresIn: this.expirationInSeconds() };
  }

  async signupWithGoogleCode(code: string, redirectUri: string, metadata?: ActivityRequestMetadata, acceptedTerms?: boolean) {
    const idToken = await this.socialTokens.exchangeGoogleCode(code, redirectUri);
    return this.signup('google', idToken, metadata, undefined, acceptedTerms);
  }

  async signupWithMicrosoftCode(
    code: string,
    redirectUri: string,
    codeVerifier: string,
    nonce: string,
    metadata?: ActivityRequestMetadata,
    acceptedTerms?: boolean,
  ) {
    const idToken = await this.socialTokens.exchangeMicrosoftCode(code, redirectUri, codeVerifier);
    return this.signup('microsoft', idToken, metadata, nonce, acceptedTerms);
  }

  async logout(jti: string, expiresAt: number) {
    await this.revokedTokens.updateOne(
      { jti },
      { $setOnInsert: { jti, expiresAt: new Date(expiresAt * 1000) } },
      { upsert: true },
    );
    return { success: true };
  }

  async getSessionProfile(userId: string) {
    const user = await this.users.findById(userId).select('name email picture').lean();
    if (!user) throw new UnauthorizedException('A valid session is required');
    return { name: user.name ?? '', email: user.email ?? '', picture: user.picture ?? '' };
  }

  private async recordActivity(
    userId: string,
    activity: UserActivityType,
    provider: string,
    metadata?: ActivityRequestMetadata,
  ): Promise<void> {
    await this.activities.create({
      userId,
      activity,
      provider,
      ...metadata,
    });
  }

  private expirationInSeconds(): number {
    const configured = this.config.get<string>('JWT_EXPIRES_IN', '15m');
    const match = /^(\d+)(s|m|h|d)$/.exec(configured);
    if (!match) return 900;
    const multipliers = { s: 1, m: 60, h: 3600, d: 86400 } as const;
    return Number(match[1]) * multipliers[match[2] as keyof typeof multipliers];
  }

  private async createUser(identity: SocialIdentity, acceptedTerms?: boolean): Promise<UserDocument> {
    let email = identity.email;
    if (identity.email) {
      const existingEmail = await this.users.exists({ email: identity.email });
      if (existingEmail) {
        throw new ConflictException('An account with this email already exists. Sign in with the original provider.');
      }
    }

    try {
      return await this.users.create({
        provider: identity.provider,
        providerSubject: identity.subject,
        email,
        emailVerified: identity.emailVerified,
        name: identity.name,
        givenName: identity.givenName,
        familyName: identity.familyName,
        picture: identity.picture,
        locale: identity.locale,
        ...consentRecord(acceptedTerms),
      });
    } catch (error) {
      // A concurrent first login may win the unique index between the lookup and insert.
      if ((error as { code?: number }).code === 11000) {
        const existing = await this.users.findOne({ provider: identity.provider, providerSubject: identity.subject });
        if (existing) return existing;
        throw new ConflictException('An account with this email already exists. Sign in with the original provider.');
      }
      throw error;
    }
  }

  private async updateUserProfile(user: UserDocument, identity: SocialIdentity): Promise<UserDocument> {
    const profile: Partial<User> = {};
    if (identity.email) {
      const emailOwner = await this.users.exists({ email: identity.email, _id: { $ne: user._id } });
      if (!emailOwner || identity.emailVerified) {
        profile.email = identity.email;
        profile.emailVerified = identity.emailVerified;
      }
    }
    if (identity.name) profile.name = identity.name;
    if (identity.givenName) profile.givenName = identity.givenName;
    if (identity.familyName) profile.familyName = identity.familyName;
    if (identity.picture) profile.picture = identity.picture;
    if (identity.locale) profile.locale = identity.locale;

    try {
      Object.assign(user, profile);
      return await user.save();
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('An account with this email already exists. Sign in with the original provider.');
      }
      throw error;
    }
  }
}
