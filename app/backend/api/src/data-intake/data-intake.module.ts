import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CompanyDetails, CompanyDetailsSchema } from '../onboarding/company-details.schema';
import { ProblemInterview, ProblemInterviewSchema } from '../onboarding/problem-interview.schema';
import { AgentHandoffService } from './agent-handoff.service';
import { AzureTokenService } from './azure-token.service';
import { BlobRestService } from './blob-rest.service';
import { DataIntakeController } from './data-intake.controller';
import { DataIntakeProcessor } from './data-intake.processor';
import { DataIntakeFile, DataIntakeFileSchema, DataIntakeSession, DataIntakeSessionSchema } from './data-intake.schema';
import { DataIntakeService } from './data-intake.service';
import { DocumentIntelligenceService } from './document-intelligence.service';
import { PromptShieldsService } from './prompt-shields.service';

@Module({
  imports: [MongooseModule.forFeature([
    { name: DataIntakeFile.name, schema: DataIntakeFileSchema },
    { name: DataIntakeSession.name, schema: DataIntakeSessionSchema },
    { name: CompanyDetails.name, schema: CompanyDetailsSchema },
    { name: ProblemInterview.name, schema: ProblemInterviewSchema },
  ])],
  controllers: [DataIntakeController],
  providers: [
    DataIntakeService,
    DataIntakeProcessor,
    BlobRestService,
    AzureTokenService,
    DocumentIntelligenceService,
    PromptShieldsService,
    AgentHandoffService,
  ],
})
export class DataIntakeModule {}
