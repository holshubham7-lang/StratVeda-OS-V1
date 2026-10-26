import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FoundryChatService } from '../foundry/foundry-chat.service';
import { DataIntakeSession } from '../data-intake/data-intake.schema';
import { CompanyDetails } from './company-details.schema';
import { DecisionProfile } from './decision-profile.schema';
import { EvidenceItem } from './evidence-item.schema';
import { ExecutiveBrief } from './executive-brief.schema';
import { formatOnboardingContext } from './onboarding-context';
import { StrategicContext } from './strategic-context.schema';

type BriefPayload = {
  status: 'ok' | 'failed';
  content?: string;
  error?: string;
  model?: string;
  responseId?: string;
  generatedAt: string;
};

const taskInstruction = [
  'You are producing the first decision brief that opens a new customer’s Decision Center.',
  'Use only the onboarding data below. Be concrete, plain-language, and address the reader as "you".',
  'Return short sections in this order: 1) Decision focus, 2) What we heard, 3) Where the friction is,',
  '4) Recommended first questions, 5) What would strengthen this picture next.',
  'Keep the whole answer under 300 words. Do not invent numbers the data does not contain.',
].join(' ');

@Injectable()
export class BriefAgentService {
  constructor(
    private readonly foundry: FoundryChatService,
    @InjectModel(CompanyDetails.name) private readonly companyDetails: Model<CompanyDetails>,
    @InjectModel(StrategicContext.name) private readonly strategicContexts: Model<StrategicContext>,
    @InjectModel(DecisionProfile.name) private readonly decisionProfiles: Model<DecisionProfile>,
    @InjectModel(EvidenceItem.name) private readonly evidenceItems: Model<EvidenceItem>,
    @InjectModel(ExecutiveBrief.name) private readonly executiveBriefs: Model<ExecutiveBrief>,
    @InjectModel(DataIntakeSession.name) private readonly dataIntakes: Model<DataIntakeSession>,
  ) {}

  /** A model failure is stored and returned as a saved failure, never thrown. */
  async generate(userId: string): Promise<BriefPayload> {
    const owner = new Types.ObjectId(userId);
    const [company, context, profile, evidence, brief, dataIntake] = await Promise.all([
      this.companyDetails.findOne({ userId: owner }).lean().exec(),
      this.strategicContexts.findOne({ userId: owner }).lean().exec(),
      this.decisionProfiles.findOne({ userId: owner }).lean().exec(),
      this.evidenceItems.find({ userId: owner }).sort({ createdAt: 1 }).lean().exec(),
      this.executiveBriefs.findOne({ userId: owner }).lean().exec(),
      this.dataIntakes.findOne({ userId: owner }).select('status evidencePackageText masterResponse').lean().exec(),
    ]);

    const input = formatOnboardingContext({ company, context, profile, evidence, brief, dataIntake });
    let payload: BriefPayload;
    try {
      const reply = await this.foundry.complete([
        { role: 'system', content: taskInstruction },
        { role: 'user', content: input },
      ]);
      payload = {
        status: 'ok',
        content: reply.content,
        model: reply.model,
        responseId: reply.responseId,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      payload = {
        status: 'failed',
        error: (error instanceof Error ? error.message : 'Agent request failed.').slice(0, 500),
        generatedAt: new Date().toISOString(),
      };
    }

    await this.executiveBriefs.findOneAndUpdate(
      { userId: owner },
      {
        $set: {
          generation: {
            status: payload.status,
            content: payload.content,
            model: payload.model,
            responseId: payload.responseId,
            error: payload.error,
            generatedAt: new Date(),
          },
        },
        $setOnInsert: { userId: owner },
      },
      { upsert: true, new: true, runValidators: true },
    );

    return payload;
  }
}
