import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request } from 'express';
import { RevokedToken } from './revoked-token.schema';

export interface AuthenticatedRequest extends Request {
  auth?: { jti: string; exp: number; sub: string };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    @InjectModel(RevokedToken.name) private readonly revokedTokens: Model<RevokedToken>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const match = authorization && /^Bearer\s+(.+)$/i.exec(authorization);
    const cookieToken = request.headers.cookie
      ?.split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith('ri_access_token='))
      ?.slice('ri_access_token='.length);
    const rawToken = match?.[1] ?? cookieToken;
    if (!rawToken) throw new UnauthorizedException('A valid session is required');

    let claims: Record<string, unknown>;
    try {
      claims = await this.jwt.verifyAsync<Record<string, unknown>>(decodeURIComponent(rawToken), {
        algorithms: ['HS256'],
        issuer: 'revenue-intelligence-api',
        audience: 'revenue-intelligence-app',
      });
    } catch {
      throw new UnauthorizedException('The access token is invalid or expired');
    }

    if (typeof claims.sub !== 'string' || typeof claims.jti !== 'string' || typeof claims.exp !== 'number') {
      throw new UnauthorizedException('The access token is invalid or expired');
    }
    if (await this.revokedTokens.exists({ jti: claims.jti })) {
      throw new UnauthorizedException('The access token has been revoked');
    }

    request.auth = { sub: claims.sub, jti: claims.jti, exp: claims.exp };
    return true;
  }
}
