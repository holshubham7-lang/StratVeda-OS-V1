import { Body, Controller, ForbiddenException, Headers, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ActivityRequestMetadata, AuthService } from './auth.service';
import { ManualSigninDto } from './dto/manual-signin.dto';
import { ManualSignupDto } from './dto/manual-signup.dto';

@Controller('auth/manual')
export class ManualAuthController {
  constructor(private readonly auth: AuthService, private readonly config: ConfigService) {}

  private assertTrustedOrigin(origin?: string) {
    const allowed = (this.config.get<string>('FRONTEND_ORIGIN', 'http://localhost:3000'))
      .split(',').map((value) => value.trim());
    if (!origin || !allowed.includes(origin)) throw new ForbiddenException('Sign-in request origin could not be verified');
  }

  private metadata(request: Request): ActivityRequestMetadata {
    return {
      ipAddress: request.ip?.slice(0, 64),
      userAgent: request.get('user-agent')?.slice(0, 1024),
    };
  }

  private completeLogin(result: { accessToken: string; expiresIn: number }, response: Response) {
    response.cookie('ri_access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: result.expiresIn * 1000,
    });
    return { status: true, message: 'Logged in successfully' };
  }

  @Post('signup')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async signup(
    @Body() body: ManualSignupDto,
    @Req() request: Request,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedOrigin(origin);
    const result = await this.auth.registerWithPassword(body.name, body.email, body.password, this.metadata(request));
    return this.completeLogin(result, response);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Body() body: ManualSigninDto,
    @Req() request: Request,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedOrigin(origin);
    const result = await this.auth.loginWithPassword(body.email, body.password, this.metadata(request));
    return this.completeLogin(result, response);
  }
}
