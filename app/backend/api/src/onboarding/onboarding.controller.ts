import { Body, Controller, ForbiddenException, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BriefAgentService } from './brief-agent.service';
import { SaveCompanyDetailsDto } from './dto/save-company-details.dto';
import { SaveDecisionProfileDto } from './dto/save-decision-profile.dto';
import { SaveEvidenceLibraryDto } from './dto/save-evidence-library.dto';
import { SaveExecutiveBriefDto } from './dto/save-executive-brief.dto';
import { SaveStrategicContextDto } from './dto/save-strategic-context.dto';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly config: ConfigService,
    private readonly briefAgent: BriefAgentService,
  ) {}

  private assertTrustedOrigin(origin?: string) {
    const allowedOrigins = (this.config.get<string>('FRONTEND_ORIGIN', 'http://localhost:3000'))
      .split(',').map((value) => value.trim());
    if (!origin || !allowedOrigins.includes(origin)) throw new ForbiddenException('Request origin could not be verified');
  }

  @Get('business-details')
  getBusinessDetails(@Req() request: AuthenticatedRequest) {
    return this.onboarding.getCompanyDetails(request.auth!.sub);
  }

  @Post('business-details')
  saveBusinessDetails(
    @Body() body: SaveCompanyDetailsDto,
    @Req() request: AuthenticatedRequest,
    @Headers('origin') origin: string | undefined,
  ) {
    this.assertTrustedOrigin(origin);
    return this.onboarding.saveCompanyDetails(request.auth!.sub, body);
  }

  @Get('strategic-context')
  getStrategicContext(@Req() request: AuthenticatedRequest) {
    return this.onboarding.getStrategicContext(request.auth!.sub);
  }

  @Post('strategic-context')
  saveStrategicContext(
    @Body() body: SaveStrategicContextDto,
    @Req() request: AuthenticatedRequest,
    @Headers('origin') origin: string | undefined,
  ) {
    this.assertTrustedOrigin(origin);
    return this.onboarding.saveStrategicContext(request.auth!.sub, body);
  }

  @Get('decision-profile')
  getDecisionProfile(@Req() request: AuthenticatedRequest) {
    return this.onboarding.getDecisionProfile(request.auth!.sub);
  }

  @Post('decision-profile')
  saveDecisionProfile(
    @Body() body: SaveDecisionProfileDto,
    @Req() request: AuthenticatedRequest,
    @Headers('origin') origin: string | undefined,
  ) {
    this.assertTrustedOrigin(origin);
    return this.onboarding.saveDecisionProfile(request.auth!.sub, body);
  }

  @Get('evidence-library')
  getEvidenceLibrary(@Req() request: AuthenticatedRequest) {
    return this.onboarding.getEvidenceLibrary(request.auth!.sub);
  }

  @Post('evidence-library')
  saveEvidenceLibrary(
    @Body() body: SaveEvidenceLibraryDto,
    @Req() request: AuthenticatedRequest,
    @Headers('origin') origin: string | undefined,
  ) {
    this.assertTrustedOrigin(origin);
    return this.onboarding.saveEvidenceLibrary(request.auth!.sub, body);
  }

  @Get('executive-brief')
  getExecutiveBrief(@Req() request: AuthenticatedRequest) {
    return this.onboarding.getExecutiveBrief(request.auth!.sub);
  }

  @Post('executive-brief')
  saveExecutiveBrief(
    @Body() body: SaveExecutiveBriefDto,
    @Req() request: AuthenticatedRequest,
    @Headers('origin') origin: string | undefined,
  ) {
    this.assertTrustedOrigin(origin);
    return this.onboarding.saveExecutiveBrief(request.auth!.sub, body);
  }

  /** Long-running: the route declares its own throttle so one user cannot fan out agent calls. */
  @Throttle({ default: { limit: 4, ttl: 60_000 } })
  @Post('executive-brief/generate')
  generateExecutiveBrief(
    @Req() request: AuthenticatedRequest,
    @Headers('origin') origin: string | undefined,
  ) {
    this.assertTrustedOrigin(origin);
    return this.briefAgent.generate(request.auth!.sub);
  }

  @Get('progress')
  getProgress(@Req() request: AuthenticatedRequest) {
    return this.onboarding.getProgress(request.auth!.sub);
  }
}
