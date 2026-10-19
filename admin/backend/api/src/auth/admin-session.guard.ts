import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export interface AdminRequest extends Request {
  admin?: { email: string; jti: string; exp: number };
}

@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const token = request.headers.cookie?.split(';').map((part) => part.trim())
      .find((part) => part.startsWith('revops_admin_session='))?.slice('revops_admin_session='.length);
    if (!token) throw new UnauthorizedException('Sign in to continue');
    try {
      const claims = await this.jwt.verifyAsync<Record<string, unknown>>(decodeURIComponent(token), {
        algorithms: ['HS256'], issuer: 'revops-admin-api', audience: 'revops-admin-app',
      });
      if (claims.role !== 'admin' || typeof claims.sub !== 'string' || typeof claims.jti !== 'string' || typeof claims.exp !== 'number') {
        throw new Error('Invalid admin session');
      }
      request.admin = { email: claims.sub, jti: claims.jti, exp: claims.exp };
      return true;
    } catch {
      throw new UnauthorizedException('Your session expired. Sign in again');
    }
  }
}
