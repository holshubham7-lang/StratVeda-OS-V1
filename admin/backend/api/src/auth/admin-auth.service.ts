import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'crypto';

function deriveKey(password: string, salt: string, length: number, options: { N: number; r: number; p: number; maxmem: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, length, options, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

@Injectable()
export class AdminAuthService {
  private readonly email: string;
  private readonly passwordHash: string;

  constructor(private readonly config: ConfigService, private readonly jwt: JwtService) {
    this.email = config.getOrThrow<string>('ADMIN_LOGIN_EMAIL').trim().toLowerCase();
    this.passwordHash = config.getOrThrow<string>('ADMIN_PASSWORD_HASH');
    if (!this.passwordHash.startsWith('scrypt$')) {
      throw new Error('ADMIN_PASSWORD_HASH must be a scrypt encoded password hash');
    }
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const passwordValid = await this.verifyPassword(password, this.passwordHash);
    if (normalizedEmail !== this.email || !passwordValid) {
      throw new UnauthorizedException('Email or password is incorrect');
    }
    const accessToken = await this.jwt.signAsync({ sub: this.email, role: 'admin', jti: randomUUID() });
    return { accessToken, expiresIn: 15 * 60 };
  }

  private async verifyPassword(password: string, encoded: string): Promise<boolean> {
    const [, n, r, p, salt, expectedHex] = encoded.split('$');
    if (n !== '32768' || r !== '8' || p !== '1' || !salt || !/^[a-f0-9]{128}$/i.test(expectedHex ?? '')) return false;
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = await deriveKey(password, salt, expected.length, {
      N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
