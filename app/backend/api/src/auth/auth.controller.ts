import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthenticatedRequest, JwtAuthGuard } from './jwt-auth.guard';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { SocialSignupDto } from './dto/social-signup.dto';
import { ActivityRequestMetadata, AuthService } from './auth.service';
import { authCookieBaseOptions, authCookieOptions } from './auth-cookie-options';
import { LinkedInCodeDto } from './dto/linkedin-code.dto';
import { GoogleCodeDto } from './dto/google-code.dto';
import { MicrosoftCodeDto } from './dto/microsoft-code.dto';

const PROVIDERS = ['google', 'microsoft', 'linkedin'] as const;
type Provider = (typeof PROVIDERS)[number];

function requestMetadata(request: Request): ActivityRequestMetadata {
  const userAgent = request.get('user-agent')?.slice(0, 1024);
  const clientBrands = request.get('sec-ch-ua');
  const platform = request.get('sec-ch-ua-platform')?.replace(/^"|"$/g, '').slice(0, 120);
  const deviceModel = request.get('sec-ch-ua-model')?.replace(/^"|"$/g, '').slice(0, 120);
  const mobileHint = request.get('sec-ch-ua-mobile');
  const browser = clientBrands
    ? clientBrands.includes('Microsoft Edge') ? 'Microsoft Edge'
      : clientBrands.includes('Google Chrome') ? 'Google Chrome'
      : clientBrands.includes('Chromium') ? 'Chromium'
      : undefined
    : userAgent?.includes('Edg/') ? 'Microsoft Edge'
      : userAgent?.includes('OPR/') ? 'Opera'
      : userAgent?.includes('Firefox/') ? 'Firefox'
      : userAgent?.includes('Chrome/') ? 'Google Chrome'
      : userAgent?.includes('Safari/') ? 'Safari'
      : undefined;
  const operatingSystem = platform
    ?? (userAgent?.includes('Windows') ? 'Windows'
      : userAgent?.includes('Mac OS') ? 'macOS'
      : userAgent?.includes('Android') ? 'Android'
      : userAgent?.includes('iPhone') || userAgent?.includes('iPad') ? 'iOS'
      : userAgent?.includes('Linux') ? 'Linux'
      : undefined);

  return {
    // Express uses the socket address unless a trusted proxy is configured.
    ipAddress: request.ip?.slice(0, 64),
    userAgent,
    browser,
    operatingSystem,
    devicePlatform: platform,
    deviceModel: deviceModel || undefined,
    deviceHint: mobileHint === '?1' ? 'mobile' : mobileHint === '?0' ? 'desktop' : undefined,
  };
}

@Controller('auth/social')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly config: ConfigService) {}

  private completeLogin(result: { accessToken: string; expiresIn: number }, response: Response) {
    response.cookie('ri_access_token', result.accessToken, authCookieOptions(result.expiresIn * 1000));
    return { status: true, message: 'Logged in successfully' };
  }

  private assertTrustedOrigin(origin: string | undefined) {
    const allowedOrigins = (this.config.get<string>('FRONTEND_ORIGIN', 'http://localhost:3000'))
      .split(',')
      .map((value) => value.trim());
    if (!origin || !allowedOrigins.includes(origin)) {
      throw new ForbiddenException('Sign-in request origin could not be verified');
    }
  }

  @Get('config')
  getPublicConfig() {
    return {
      googleClientId: this.config.get<string>('GOOGLE_CLIENT_ID'),
      microsoftClientId: this.config.get<string>('MICROSOFT_CLIENT_ID'),
      linkedinClientId: this.config.get<string>('LINKEDIN_CLIENT_ID'),
      linkedinRedirectUri: this.config.get<string>('LINKEDIN_REDIRECT_URI', 'http://localhost:3000/api/auth/oauth/linkedin/callback'),
    };
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  async getSession(@Req() request: AuthenticatedRequest) {
    const user = await this.auth.getSessionProfile(request.auth!.sub);
    return { status: true, message: 'Session is active', user };
  }

  @Post('linkedin/exchange')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async signupWithLinkedInCode(
    @Body() body: LinkedInCodeDto,
    @Req() request: Request,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedOrigin(origin);
    const redirectUri = `${origin}/api/auth/oauth/linkedin/callback`;
    return this.completeLogin(
      await this.auth.signupWithLinkedInCode(body.code, redirectUri, requestMetadata(request), body.acceptedTerms),
      response,
    );
  }

  @Post('microsoft/exchange')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async signupWithMicrosoftCode(
    @Body() body: MicrosoftCodeDto,
    @Req() request: Request,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedOrigin(origin);
    const redirectUri = `${origin}/api/auth/oauth/microsoft/callback`;
    return this.completeLogin(
      await this.auth.signupWithMicrosoftCode(
        body.code,
        redirectUri,
        body.codeVerifier,
        body.nonce,
        requestMetadata(request),
        body.acceptedTerms,
      ),
      response,
    );
  }

  @Post('google/exchange')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async signupWithGoogleCode(
    @Body() body: GoogleCodeDto,
    @Req() request: Request,
    @Headers('x-requested-with') requestedWith: string | undefined,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (requestedWith !== 'XmlHttpRequest') {
      throw new ForbiddenException('Google authorization request could not be verified');
    }
    this.assertTrustedOrigin(origin);
    return this.completeLogin(await this.auth.signupWithGoogleCode(body.code, origin!, requestMetadata(request), body.acceptedTerms), response);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(
    @Req() request: AuthenticatedRequest,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedOrigin(origin);
    const auth = request.auth!;
    response.clearCookie('ri_access_token', authCookieBaseOptions());
    return this.auth.logout(auth.jti, auth.exp).then(() => ({ status: true, message: 'Logged out successfully' }));
  }

  @Post(':provider/signup')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async signup(
    @Param('provider') provider: string,
    @Body() body: SocialSignupDto,
    @Req() request: Request,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!PROVIDERS.includes(provider as Provider)) {
      throw new BadRequestException('Provider must be google, microsoft, or linkedin');
    }
    this.assertTrustedOrigin(origin);
    return this.completeLogin(await this.auth.signup(provider as Provider, body.idToken, requestMetadata(request), undefined, body.acceptedTerms), response);
  }
}
