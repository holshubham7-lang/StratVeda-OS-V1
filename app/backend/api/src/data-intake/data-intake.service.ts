import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { CompanyDetails } from '../onboarding/company-details.schema';
import { ProblemInterview } from '../onboarding/problem-interview.schema';
import { AgentHandoffService } from './agent-handoff.service';
import { BlobRestService, BlobStorageError } from './blob-rest.service';
import {
  maxDataIntakeFiles,
  maxDataIntakeTextChars,
  isTerminalDataIntakeFileStatus,
} from './data-intake.constants';
import { DataIntakeFile, DataIntakeSession } from './data-intake.schema';
import { DocumentIntelligenceService } from './document-intelligence.service';
import { PreparedDataFile, UploadedDataFile, prepareUpload } from './file-validation';
import { PromptShieldsService } from './prompt-shields.service';

type FileRow = DataIntakeFile & { _id: Types.ObjectId };
type SessionRow = DataIntakeSession & { _id: Types.ObjectId };

@Injectable()
export class DataIntakeService {
  private readonly logger = new Logger(DataIntakeService.name);
  private readonly quarantineContainer: string;
  private readonly cleanContainer: string;
  private readonly scanTimeoutMs: number;

  constructor(
    private readonly config: ConfigService,
    private readonly blobs: BlobRestService,
    private readonly documents: DocumentIntelligenceService,
    private readonly shields: PromptShieldsService,
    private readonly handoff: AgentHandoffService,
    @InjectModel(DataIntakeFile.name) private readonly files: Model<DataIntakeFile>,
    @InjectModel(DataIntakeSession.name) private readonly sessions: Model<DataIntakeSession>,
    @InjectModel(CompanyDetails.name) private readonly companies: Model<CompanyDetails>,
    @InjectModel(ProblemInterview.name) private readonly interviews: Model<ProblemInterview>,
  ) {
    this.quarantineContainer = this.config.get<string>('AZURE_STORAGE_QUARANTINE_CONTAINER', 'data-intake-quarantine');
    this.cleanContainer = this.config.get<string>('AZURE_STORAGE_CLEAN_CONTAINER', 'data-intake-clean');
    this.scanTimeoutMs = Number(this.config.get('DATA_INTAKE_SCAN_TIMEOUT_MS', String(10 * 60_000)));
  }

  async get(userId: string) {
    const owner = new Types.ObjectId(userId);
    const [session, files] = await Promise.all([
      this.sessions.findOne({ userId: owner }).lean<SessionRow | null>().exec(),
      this.files.find({ userId: owner }).sort({ createdAt: 1 }).lean<FileRow[]>().exec(),
    ]);
    return { status: true, data: this.toClient(session, files) };
  }

  async upload(userId: string, uploads: UploadedDataFile[]) {
    if (!uploads.length) throw new BadRequestException('Choose at least one file to add.');
    if (uploads.length > maxDataIntakeFiles) {
      throw new BadRequestException(`Add up to ${maxDataIntakeFiles} files at a time.`);
    }

    const owner = new Types.ObjectId(userId);
    const session = await this.sessions.findOne({ userId: owner }).select('status').lean().exec();
    if (session?.status === 'processing') {
      throw new BadRequestException('Your files are being handed over. Wait for it to finish before adding more.');
    }
    const existing = await this.files.countDocuments({ userId: owner });
    if (existing + uploads.length > maxDataIntakeFiles) {
      throw new BadRequestException(`You can add up to ${maxDataIntakeFiles} data files in this stage.`);
    }

    const prepared = uploads.map(prepareUpload);
    for (const upload of prepared) await this.storeInQuarantine(owner, upload);

    // Uploading only stages files; scanning and extraction run per file in the
    // background, and the agent handover waits for an explicit complete().
    await this.sessions.findOneAndUpdate(
      { userId: owner },
      {
        $set: {
          status: 'collecting',
          dataAgentStatus: 'pending',
          masterStatus: 'pending',
          handoverRequested: false,
        },
        // The previous package and Master Agent response stay until a new handover
        // replaces them, so the Decision Center brief never goes blank in between.
        $unset: { error: 1, completedAt: 1 },
        $inc: { generation: 1 },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );

    return this.get(userId);
  }

  async removeFile(userId: string, fileId: string) {
    if (!Types.ObjectId.isValid(fileId)) throw new NotFoundException('That file was not found.');
    const owner = new Types.ObjectId(userId);
    const file = await this.files.findOne({ _id: fileId, userId: owner }).lean<FileRow | null>().exec();
    if (!file) throw new NotFoundException('That file was not found.');
    if (file.status !== 'blocked' && file.status !== 'failed') {
      throw new BadRequestException('Only blocked or failed files can be removed.');
    }

    await this.files.deleteOne({ _id: file._id, userId: owner });
    if (file.quarantineBlob) {
      await this.blobs.delete(this.quarantineContainer, file.quarantineBlob).catch(() => undefined);
    }
    if (file.cleanBlob) {
      await this.blobs.delete(this.cleanContainer, file.cleanBlob).catch(() => undefined);
    }
    return this.get(userId);
  }

  async complete(userId: string) {
    const owner = new Types.ObjectId(userId);
    await this.sessions.findOneAndUpdate(
      { userId: owner },
      {
        $set: {
          status: 'processing',
          dataAgentStatus: 'pending',
          masterStatus: 'pending',
          handoverRequested: true,
        },
        // The previous package and Master Agent response stay until a new handover
        // replaces them, so the Decision Center brief never goes blank in between.
        $unset: { error: 1, completedAt: 1 },
        $inc: { generation: 1 },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    return this.get(userId);
  }

  async skip(userId: string) {
    const owner = new Types.ObjectId(userId);
    await this.sessions.findOneAndUpdate(
      { userId: owner },
      {
        $set: {
          status: 'skipped',
          dataAgentStatus: 'pending',
          masterStatus: 'pending',
          handoverRequested: false,
          completedAt: new Date(),
        },
        $unset: { error: 1 },
        $inc: { generation: 1 },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    return this.get(userId);
  }

  async recoverStaleSessions() {
    const filter = {
      status: 'processing',
      updatedAt: { $lt: new Date(Date.now() - 15 * 60_000) },
      $or: [{ dataAgentStatus: 'running' }, { masterStatus: 'running' }],
    } as FilterQuery<DataIntakeSession>;
    await this.sessions.updateMany(filter, {
      $set: {
        status: 'failed',
        error: 'The previous handover stopped before it finished. Retry the handover.',
      },
    });
  }

  async processPending() {
    const pendingFiles = await this.files
      .find({ status: { $in: ['quarantined', 'scanning', 'clean', 'extracting'] } })
      .sort({ createdAt: 1 })
      .limit(12)
      .select('_id')
      .lean<{ _id: Types.ObjectId }[]>()
      .exec();
    for (const file of pendingFiles) await this.advanceFile(file._id.toString());

    const pendingSessions = await this.sessions
      .find({ status: 'processing', handoverRequested: true, dataAgentStatus: { $ne: 'running' }, masterStatus: { $ne: 'running' } })
      .sort({ createdAt: 1 })
      .limit(8)
      .select('_id')
      .lean<{ _id: Types.ObjectId }[]>()
      .exec();
    for (const session of pendingSessions) await this.advanceHandover(session._id.toString());
  }

  private async storeInQuarantine(owner: Types.ObjectId, upload: PreparedDataFile) {
    const blob = `${owner.toString()}/${randomUUID()}${upload.extension}`;
    await this.blobs.upload(this.quarantineContainer, blob, upload.buffer, upload.mimeType);
    await this.files.create({
      userId: owner,
      name: upload.name,
      size: upload.size,
      mimeType: upload.mimeType,
      extension: upload.extension,
      quarantineBlob: blob,
      status: 'quarantined',
    });
  }

  private async advanceFile(fileId: string) {
    const file = await this.files.findById(fileId).exec();
    if (!file) return;
    if (file.status === 'ready' || file.status === 'blocked' || file.status === 'failed') return;

    try {
      if (file.status === 'quarantined' || file.status === 'scanning') {
        await this.scanFile(file);
        return;
      }
      if (file.status === 'clean' || file.status === 'extracting') {
        await this.extractFile(file);
      }
    } catch (error) {
      const attempts = (file.attempts ?? 0) + 1;
      const retryStatus = file.status === 'clean' || file.status === 'extracting' ? 'clean' : 'scanning';
      this.logger.warn(`Data-intake file ${file._id.toString()} attempt ${attempts} failed: ${error instanceof Error ? error.message : String(error)}`);
      await this.files.updateOne(
        { _id: file._id },
        {
          $set: {
            status: attempts < 3 ? retryStatus : 'failed',
            attempts,
            ...(attempts < 3 ? {} : { processedAt: new Date() }),
            error: attempts < 3 ? undefined : this.fileErrorText(error, retryStatus),
          },
        },
      );
    }
  }

  private async scanFile(file: FileRow) {
    await this.files.updateOne(
      { _id: file._id, status: { $in: ['quarantined', 'scanning'] } },
      { $set: { status: 'scanning', scanCheckedAt: new Date() } },
    );
    const tags = await this.blobs.tags(this.quarantineContainer, file.quarantineBlob);
    const result = this.scanResult(tags);
    const scanResult = this.scanTagText(tags);

    if (result === 'clean') {
      const cleanBlob = file.cleanBlob || file.quarantineBlob;
      const buffer = await this.blobs.download(this.quarantineContainer, file.quarantineBlob);
      await this.blobs.upload(this.cleanContainer, cleanBlob, buffer, file.mimeType);
      await this.files.updateOne(
        { _id: file._id },
        { $set: { status: 'clean', cleanBlob, scanResult, attempts: 0, error: undefined } },
      );
      await this.blobs.delete(this.quarantineContainer, file.quarantineBlob).catch(() => undefined);
      return;
    }

    if (result === 'malicious') {
      await this.files.updateOne(
        { _id: file._id },
        { $set: { status: 'blocked', scanResult, error: 'Defender found malware in this file.', processedAt: new Date() } },
      );
      return;
    }

    if (result === 'error') {
      await this.files.updateOne(
        { _id: file._id },
        { $set: { status: 'failed', scanResult, error: 'Defender could not scan this file.', processedAt: new Date() } },
      );
      return;
    }

    const age = Date.now() - (file.createdAt?.getTime() ?? Date.now());
    if (age > this.scanTimeoutMs) {
      await this.files.updateOne(
        { _id: file._id },
        { $set: { status: 'failed', scanResult, error: 'Defender did not finish scanning this file in time.', processedAt: new Date() } },
      );
      return;
    }
    await this.files.updateOne({ _id: file._id }, { $set: { status: 'quarantined', scanResult } });
  }

  private async extractFile(file: FileRow) {
    await this.files.updateOne(
      { _id: file._id, status: { $in: ['clean', 'extracting'] } },
      { $set: { status: 'extracting' } },
    );
    const cleanBlob = file.cleanBlob || file.quarantineBlob;
    const buffer = await this.blobs.download(this.cleanContainer, cleanBlob);
    const extracted = await this.documents.extract(buffer, file.extension, file.mimeType);
    const text = extracted.text.slice(0, maxDataIntakeTextChars);
    const shield = await this.shields.check(`${file.name}\n${text}`);
    if (shield.flagged) {
      await this.files.updateOne(
        { _id: file._id },
        {
          $set: {
            status: 'blocked',
            promptShieldFlagged: true,
            text: '',
            error: 'Prompt Shields blocked this file because it may contain instructions aimed at the agent.',
            processedAt: new Date(),
          },
        },
      );
      return;
    }

    await this.files.updateOne(
      { _id: file._id },
      {
        $set: {
          status: 'ready',
          text: text || '',
          textTruncated: extracted.truncated || extracted.text.length > maxDataIntakeTextChars,
          promptShieldFlagged: false,
          error: undefined,
          processedAt: new Date(),
        },
      },
    );
  }

  private async advanceHandover(sessionId: string) {
    const session = await this.sessions.findById(sessionId).exec();
    if (!session || session.status !== 'processing' || !session.handoverRequested) return;

    const owner = session.userId;
    const files = await this.files.find({ userId: owner }).sort({ createdAt: 1 }).lean<FileRow[]>().exec();
    if (files.some((file) => !isTerminalDataIntakeFileStatus(file.status))) return;

    const claimed = await this.sessions.findOneAndUpdate(
      {
        _id: session._id,
        status: 'processing',
        generation: session.generation ?? 0,
        handoverRequested: true,
        dataAgentStatus: { $ne: 'running' },
        masterStatus: { $ne: 'running' },
      },
      { $set: { dataAgentStatus: 'running' } },
      { new: true },
    ).exec();
    if (!claimed) return;

    const generation = claimed.generation ?? 0;
    let stage: 'data' | 'master' = 'data';

    try {
      const [company, interview] = await Promise.all([
        this.companies.findOne({ userId: owner }).lean().exec(),
        this.interviews.findOne({ userId: owner }).lean().exec(),
      ]);
      if (!company) throw new BadRequestException('Save your company details before running the handover.');
      if (!interview || interview.status !== 'complete') {
        throw new BadRequestException('Finish the discovery interview before running the handover.');
      }

      const readyFiles = files.filter((file) => file.status === 'ready');
      const dataAgentInput = this.dataAgentInput(company, interview, readyFiles);
      const evidencePackageText = await this.handoff.callDataAgent(dataAgentInput);
      const dataSaved = await this.sessions.findOneAndUpdate(
        { _id: session._id, generation, status: 'processing', dataAgentStatus: 'running' },
        {
          $set: {
            dataAgentStatus: 'completed',
            evidencePackageText: evidencePackageText.slice(0, 50000),
            masterStatus: 'running',
          },
        },
        { new: true },
      ).exec();
      if (!dataSaved) return;

      stage = 'master';
      const masterResponse = await this.handoff.callMasterAgent(
        this.masterAgentInput(company, interview, evidencePackageText),
      );
      await this.sessions.updateOne(
        { _id: session._id, generation, status: 'processing', masterStatus: 'running' },
        {
          $set: {
            masterStatus: 'completed',
            masterResponse: masterResponse.slice(0, 12000),
            status: 'ready',
            handoverRequested: false,
            completedAt: new Date(),
            error: undefined,
          },
        },
      );
    } catch (error) {
      await this.sessions.updateOne(
        { _id: session._id, generation },
        {
          $set: {
            status: 'failed',
            ...(stage === 'data' ? { dataAgentStatus: 'failed' } : { masterStatus: 'failed' }),
            error: this.errorText(error),
          },
        },
      );
    }
  }

  private dataAgentInput(company: Record<string, unknown>, interview: Record<string, unknown>, files: FileRow[]) {
    const step1 = this.companyPayload(company);
    const step2 = this.discoveryPayload(interview);
    let budget = 40000;
    const evidence = files.map((file) => {
      const room = Math.min(12000, budget);
      budget -= room;
      const text = file.text ? file.text.slice(0, room) : null;
      return {
        name: file.name,
        mime_type: file.mimeType,
        size: file.size,
        text,
        truncated: Boolean(file.textTruncated) || Boolean(file.text && text && file.text.length > text.length),
      };
    });

    return [
      'You are the Data Analyst Agent receiving a completed onboarding handover.',
      'Step 1 is the saved company profile. Step 2 is the completed discovery interview and is the Discovery Package; do not call the discovery agent because it is already included.',
      'Review the uploaded company data, format it, validate it, and return the standard evidence package as JSON only. Do not wrap the JSON in prose.',
      'If no files are attached, still produce the evidence package from Step 1 and Step 2 and state the limitation.',
      '',
      '## Step 1 - Company profile',
      JSON.stringify(step1),
      '',
      '## Step 2 - Discovery package',
      JSON.stringify(step2),
      '',
      '## Uploaded evidence files',
      JSON.stringify(evidence),
    ].join('\n');
  }

  private masterAgentInput(company: Record<string, unknown>, interview: Record<string, unknown>, evidencePackageText: string) {
    return [
      'Master Agent handover from onboarding.',
      'You are receiving Step 1 (company profile), Step 2 (completed discovery interview), and the Data Agent evidence package.',
      'Acknowledge the handover briefly and state the first decision focus you can support. Use only the supplied data.',
      '',
      '## Step 1 - Company profile',
      JSON.stringify(this.companyPayload(company)),
      '',
      '## Step 2 - Discovery package',
      JSON.stringify(this.discoveryPayload(interview)),
      '',
      '## Data Agent evidence package',
      evidencePackageText.slice(0, 30000),
    ].join('\n');
  }

  private companyPayload(company: Record<string, unknown>) {
    return {
      company_name: company.companyName,
      website: company.website,
      industry: company.industry,
      business_model: company.businessModel,
      team_size: company.teamSize,
      annual_revenue: company.revenueRange,
      company_stage: company.companyStage,
      location: [company.city, company.state, company.country].filter(Boolean).join(', '),
    };
  }

  private discoveryPayload(interview: Record<string, unknown>) {
    const messages = Array.isArray(interview.messages) ? interview.messages : [];
    return {
      problem_statement: interview.problemStatement,
      status: interview.status,
      interview: messages.map((message) => {
        const entry = message as Record<string, unknown>;
        return { role: entry.role, content: entry.content };
      }),
    };
  }

  private toClient(session: SessionRow | null, files: FileRow[]) {
    const evidence = this.parseJsonLoose(session?.evidencePackageText ?? '');
    return {
      sessionStatus: session?.status ?? 'empty',
      dataAgentStatus: session?.dataAgentStatus ?? 'pending',
      masterStatus: session?.masterStatus ?? 'pending',
      handoverRequested: session?.handoverRequested ?? false,
      error: session?.error,
      completedAt: session?.completedAt?.toISOString(),
      files: files.map((file) => ({
        id: file._id.toString(),
        name: file.name,
        size: file.size,
        mimeType: file.mimeType,
        status: file.status,
        scanResult: file.scanResult,
        extractedChars: file.text?.length ?? 0,
        textTruncated: Boolean(file.textTruncated),
        error: file.error,
      })),
      evidenceSummary: evidence ? this.evidenceSummary(evidence) : null,
      masterSummary: session?.masterResponse ? session.masterResponse.slice(0, 700) : null,
      masterResponse: session?.masterResponse ?? null,
    };
  }

  private evidenceSummary(evidence: Record<string, unknown>) {
    const packageStatus = this.firstText(evidence, ['package_status', 'packageStatus', 'status', 'readiness']);
    const summary = this.firstText(evidence, ['summary', 'executive_summary', 'evidence_summary', 'overview']);
    const limitations = Array.isArray(evidence.limitations)
      ? evidence.limitations.filter((item): item is string => typeof item === 'string').slice(0, 6)
      : [];
    return {
      packageStatus: packageStatus?.slice(0, 120),
      summary: summary?.slice(0, 600),
      limitations,
    };
  }

  private parseJsonLoose(text: string) {
    const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
    } catch {
      const start = trimmed.indexOf('{');
      const end = trimmed.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          const parsed = JSON.parse(trimmed.slice(start, end + 1));
          return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  private firstText(payload: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return undefined;
  }

  private scanResult(tags: Record<string, string>) {
    const value = this.scanTagText(tags).trim().toLowerCase();
    if (value.startsWith('no threats found')) return 'clean';
    if (value.includes('malicious') || value.includes('threat')) return 'malicious';
    if (value.includes('error') || value.includes('not scanned')) return 'error';
    return 'pending';
  }

  private scanTagText(tags: Record<string, string>) {
    return tags['Malware Scanning scan result']
      ?? tags['malwareScanningScanResult']
      ?? tags['Malware Scanning Scan Result']
      ?? '';
  }

  /** File errors are shown to the customer, so infrastructure detail stays in the logs. */
  private fileErrorText(error: unknown, stage: 'clean' | 'scanning') {
    if (error instanceof BlobStorageError) {
      if (error.httpStatus === 401 || error.httpStatus === 403) {
        return stage === 'scanning'
          ? 'The malware scan result could not be read because of a storage permission problem on our side. Remove the file and try again later.'
          : 'The scanned copy could not be read because of a storage permission problem on our side. Remove the file and try again later.';
      }
      return 'Secure storage was unavailable while processing this file. Remove it and try again.';
    }
    return stage === 'scanning'
      ? 'This file could not be scanned. Remove it and try again.'
      : 'Text could not be read from this file. Remove it and try again.';
  }

  private errorText(error: unknown) {
    const message = error instanceof Error ? error.message : 'The data intake pipeline could not finish.';
    return message.slice(0, 1000);
  }
}
