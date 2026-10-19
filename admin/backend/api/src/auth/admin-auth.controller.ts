import { Body, Controller, ForbiddenException, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AdminLoginDto } from './admin-login.dto';
import { AdminAuthService } from './admin-auth.service';
import { AdminRequest, AdminSessionGuard } from './admin-session.guard';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService, private readonly config: ConfigService) {}

  private trustedOrigin(origin?: string) {
    const allowed = (this.config.get<string>('ADMIN_FRONTEND_ORIGINS') ?? 'http://localhost:3001')
      .split(',').map((value) => value.trim());
    if (!origin || !allowed.includes(origin)) throw new ForbiddenException('This request origin is not allowed');
  }

  private cookieOptions(maxAge?: number) {
    return {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: this.config.get<string>('NODE_ENV') === 'production' ? 'none' as const : 'lax' as const,
      path: '/',
      ...(maxAge ? { maxAge } : {}),
    };
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(@Body() body: AdminLoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.trustedOrigin(request.get('origin'));
    const result = await this.auth.login(body.email, body.password);
    response.cookie('revops_admin_session', result.accessToken, this.cookieOptions(result.expiresIn * 1000));
    return { status: true, expiresIn: result.expiresIn };
  }

  @Post('logout')
  logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.trustedOrigin(request.get('origin'));
    response.clearCookie('revops_admin_session', this.cookieOptions());
    return { status: true };
  }

  @Get('session')
  @UseGuards(AdminSessionGuard)
  session(@Req() request: AdminRequest) {
    return { status: true, email: request.admin!.email };
  }
}
