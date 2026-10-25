import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CompanyDetails } from './company-details.schema';
import { DecisionProfile } from './decision-profile.schema';
import { EvidenceItem } from './evidence-item.schema';
import { ExecutiveBrief } from './executive-brief.schema';
import { StrategicContext } from './strategic-context.schema';
import { SaveCompanyDetailsDto } from './dto/save-company-details.dto';
import { SaveDecisionProfileDto } from './dto/save-decision-profile.dto';
import { SaveEvidenceLibraryDto } from './dto/save-evidence-library.dto';
import { SaveExecutiveBriefDto } from './dto/save-executive-brief.dto';
import { SaveStrategicContextDto } from './dto/save-strategic-context.dto';

const asObjectId = (userId: string) => new Types.ObjectId(userId);

/** Drops Mongo bookkeeping and exposes the document id to the client. */
function toData<T extends { _id?: Types.ObjectId }>(document: T | null) {
  if (!document) return null;
  const { _id, userId: _userId, createdAt: _createdAt, updatedAt: _updatedAt, __v, ...rest } = document as T & {
    _id?: Types.ObjectId; userId?: Types.ObjectId; createdAt?: Date; updatedAt?: Date; __v?: number;
  };
  return { id: _id?.toString(), ...rest };
}

@Injectable()
export class OnboardingService {
  constructor(
    @InjectModel(CompanyDetails.name) private readonly companyDetails: Model<CompanyDetails>,
    @InjectModel(StrategicContext.name) private readonly strategicContexts: Model<StrategicContext>,
    @InjectModel(DecisionProfile.name) private readonly decisionProfiles: Model<DecisionProfile>,
    @InjectModel(EvidenceItem.name) private readonly evidenceItems: Model<EvidenceItem>,
    @InjectModel(ExecutiveBrief.name) private readonly executiveBriefs: Model<ExecutiveBrief>,
  ) {}

  async getCompanyDetails(userId: string) {
    const details = await this.companyDetails.findOne({ userId: asObjectId(userId) }).lean().exec();
    return { status: true, data: toData(details) };
  }

  async saveCompanyDetails(userId: string, details: SaveCompanyDetailsDto) {
    await this.companyDetails.findOneAndUpdate(
      { userId: asObjectId(userId) },
      { $set: { ...details, businessModel: details.businessModel ?? null }, $setOnInsert: { userId: asObjectId(userId) } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    return { status: true, message: 'Company details saved successfully' };
  }

  async getStrategicContext(userId: string) {
    const context = await this.strategicContexts.findOne({ userId: asObjectId(userId) }).lean().exec();
    return { status: true, data: toData(context) };
  }

  async saveStrategicContext(userId: string, context: SaveStrategicContextDto) {
    await this.strategicContexts.findOneAndUpdate(
      { userId: asObjectId(userId) },
      { $set: { ...context }, $setOnInsert: { userId: asObjectId(userId) } },
      { upsert: true, new: true, runValidators: true },
    );
    return { status: true, message: 'Strategic context saved successfully' };
  }

  async getDecisionProfile(userId: string) {
    const profile = await this.decisionProfiles.findOne({ userId: asObjectId(userId) }).lean().exec();
    return { status: true, data: toData(profile) };
  }

  async saveDecisionProfile(userId: string, profile: SaveDecisionProfileDto) {
    await this.decisionProfiles.findOneAndUpdate(
      { userId: asObjectId(userId) },
      { $set: { ...profile }, $setOnInsert: { userId: asObjectId(userId) } },
      { upsert: true, new: true, runValidators: true },
    );
    return { status: true, message: 'Decision profile saved successfully' };
  }

  async getEvidenceLibrary(userId: string) {
    const items = await this.evidenceItems.find({ userId: asObjectId(userId) }).sort({ createdAt: 1 }).lean().exec();
    return { status: true, data: items.map((item) => toData(item)) };
  }

  /**
   * Replaces the whole set. Insert-first, then prune: a rejected insert leaves
   * the previous set untouched, whereas the reverse order could delete the
   * user's evidence and still fail to store the replacement.
   */
  async saveEvidenceLibrary(userId: string, { items }: SaveEvidenceLibraryDto) {
    const owner = asObjectId(userId);
    const created = items.length
      ? await this.evidenceItems.insertMany(
          items.map((item) => ({ ...item, userId: owner })),
          { ordered: true },
        )
      : [];
    await this.evidenceItems.deleteMany({ userId: owner, _id: { $nin: created.map((doc) => doc._id) } });
    return {
      status: true,
      message: 'Evidence library saved successfully',
      data: created.map((doc) => toData(doc.toObject())),
    };
  }

  /**
   * A persisted document is the only proof a step is done, so progress cannot
   * drift from the data it describes. Evidence is deliberately not a gate: the
   * step is optional and "Skip For Now" stores no rows, so gating on it would
   * bounce a user back to it on every sign-in.
   */
  async getExecutiveBrief(userId: string) {
    const brief = await this.executiveBriefs.findOne({ userId: asObjectId(userId) }).lean().exec();
    return { status: true, data: toData(brief) };
  }

  /**
   * Answers and agent output live in one document, so saving answers must not
   * touch `generation` — a re-save would otherwise discard a brief already won.
   */
  async saveExecutiveBrief(userId: string, { answers }: SaveExecutiveBriefDto) {
    await this.executiveBriefs.findOneAndUpdate(
      { userId: asObjectId(userId) },
      { $set: { answers }, $setOnInsert: { userId: asObjectId(userId) } },
      { upsert: true, new: true, runValidators: true },
    );
    return { status: true, message: 'Executive brief saved successfully' };
  }

  async getProgress(userId: string) {
    const owner = asObjectId(userId);
    const [hasCompany, hasStrategicContext, hasDecisionProfile] = await Promise.all([
      this.companyDetails.exists({ userId: owner }),
      this.strategicContexts.exists({ userId: owner }),
      this.decisionProfiles.exists({ userId: owner }),
    ]);
    const nextRoute = !hasCompany
      ? '/welcome'
      : !hasStrategicContext
        ? '/strategic-context'
        : !hasDecisionProfile
          ? '/decision-profile'
          : '/executive-brief';
    return { status: true, nextRoute };
  }
}
