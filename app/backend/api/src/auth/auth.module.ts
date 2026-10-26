import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/user.schema';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SocialTokenService } from './social-token.service';
import { RevokedToken, RevokedTokenSchema } from './revoked-token.schema';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UserActivity, UserActivitySchema } from './user-activity.schema';
import { ManualAuthController } from './manual-auth.controller';
import { CompanyDetails, CompanyDetailsSchema } from '../onboarding/company-details.schema';
import { DecisionProfile, DecisionProfileSchema } from '../onboarding/decision-profile.schema';
import { EvidenceItem, EvidenceItemSchema } from '../onboarding/evidence-item.schema';
import { StrategicContext, StrategicContextSchema } from '../onboarding/strategic-context.schema';
import { ExecutiveBrief, ExecutiveBriefSchema } from '../onboarding/executive-brief.schema';
import { ProblemInterview, ProblemInterviewSchema } from '../onboarding/problem-interview.schema';
import { DataIntakeSession, DataIntakeSessionSchema } from '../data-intake/data-intake.schema';
import { BriefAgentService } from '../onboarding/brief-agent.service';
import { ProblemInterviewService } from '../onboarding/problem-interview.service';
import { OnboardingController } from '../onboarding/onboarding.controller';
import { OnboardingService } from '../onboarding/onboarding.service';

@Module({
  imports: [MongooseModule.forFeature([
    { name: User.name, schema: UserSchema },
    { name: RevokedToken.name, schema: RevokedTokenSchema },
    { name: UserActivity.name, schema: UserActivitySchema },
    { name: CompanyDetails.name, schema: CompanyDetailsSchema },
    { name: StrategicContext.name, schema: StrategicContextSchema },
    { name: DecisionProfile.name, schema: DecisionProfileSchema },
    { name: EvidenceItem.name, schema: EvidenceItemSchema },
    { name: ExecutiveBrief.name, schema: ExecutiveBriefSchema },
    { name: ProblemInterview.name, schema: ProblemInterviewSchema },
    { name: DataIntakeSession.name, schema: DataIntakeSessionSchema },
  ])],
  controllers: [AuthController, ManualAuthController, OnboardingController],
  providers: [AuthService, SocialTokenService, JwtAuthGuard, OnboardingService, BriefAgentService, ProblemInterviewService],
})
export class AuthModule {}
