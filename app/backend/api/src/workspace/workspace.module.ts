import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RevokedToken, RevokedTokenSchema } from '../auth/revoked-token.schema';
import { DataIntakeSession, DataIntakeSessionSchema } from '../data-intake/data-intake.schema';
import { CompanyDetails, CompanyDetailsSchema } from '../onboarding/company-details.schema';
import { DecisionProfile, DecisionProfileSchema } from '../onboarding/decision-profile.schema';
import { EvidenceItem, EvidenceItemSchema } from '../onboarding/evidence-item.schema';
import { ExecutiveBrief, ExecutiveBriefSchema } from '../onboarding/executive-brief.schema';
import { StrategicContext, StrategicContextSchema } from '../onboarding/strategic-context.schema';
import { EvidenceFile, EvidenceFileSchema } from './evidence-file.schema';
import { EvidenceStorageService } from './evidence-storage.service';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { WorkspaceThread, WorkspaceThreadSchema } from './workspace-thread.schema';

/** Reads the onboarding documents directly so a reply always reflects the setup saved at send time. */
@Module({
  imports: [MongooseModule.forFeature([
    { name: WorkspaceThread.name, schema: WorkspaceThreadSchema },
    { name: EvidenceFile.name, schema: EvidenceFileSchema },
    // JwtAuthGuard checks the deny-list, so the guard needs this model in the module context.
    { name: RevokedToken.name, schema: RevokedTokenSchema },
    { name: CompanyDetails.name, schema: CompanyDetailsSchema },
    { name: StrategicContext.name, schema: StrategicContextSchema },
    { name: DecisionProfile.name, schema: DecisionProfileSchema },
    { name: EvidenceItem.name, schema: EvidenceItemSchema },
    { name: ExecutiveBrief.name, schema: ExecutiveBriefSchema },
    { name: DataIntakeSession.name, schema: DataIntakeSessionSchema },
  ])],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, EvidenceStorageService],
})
export class WorkspaceModule {}
