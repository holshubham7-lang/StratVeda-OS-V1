import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, HydratedDocument, Model, Types } from 'mongoose';
import { FoundryChatService, FoundryMessage } from '../foundry/foundry-chat.service';
import { CompanyDetails } from '../onboarding/company-details.schema';
import { DecisionProfile } from '../onboarding/decision-profile.schema';
import { EvidenceItem } from '../onboarding/evidence-item.schema';
import { ExecutiveBrief } from '../onboarding/executive-brief.schema';
import { StrategicContext } from '../onboarding/strategic-context.schema';
import { formatOnboardingContext } from '../onboarding/onboarding-context';
import { EvidenceStorageService } from './evidence-storage.service';
import {
  MAX_WORKSPACE_MESSAGES,
  WorkspaceMessage,
  WorkspaceThread,
  WorkspaceThreadContext,
} from './workspace-thread.schema';

const HISTORY_TURNS = 12;
const LIST_LIMIT = 20;

const agentInstruction = [
  'You are the StratVeda decision agent talking with a customer inside their Decision Workspace.',
  'Answer from the saved setup in the context block below. Address the reader as "you" and keep replies under 180 words.',
  'Attached evidence under UPLOADED EVIDENCE CONTENTS carries its real text — CSV/JSON rows, Excel sheets as tab-separated rows, and Word paragraphs. Answer from it when the question is about that file, quote the figures, and say which file and sheet you used.',
  'Excel sheets arrive tab-separated: a cell may itself contain a pipe or comma, so count columns from the header row rather than splitting on those.',
  'Legacy .xls/.doc, PDF and image attachments are recorded as names and sizes only, so you cannot read them: say so plainly and never quote, summarise or invent what such a document says.',
  'When the saved setup and the file contents do not cover the question, say so plainly and name the setup step that would fill the gap. Do not invent numbers.',
].join(' ');

type ThreadDoc = HydratedDocument<WorkspaceThread>;
type ThreadRow = WorkspaceThread & { _id: Types.ObjectId };

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly foundry: FoundryChatService,
    private readonly evidence: EvidenceStorageService,
    @InjectModel(WorkspaceThread.name) private readonly threads: Model<WorkspaceThread>,
    @InjectModel(CompanyDetails.name) private readonly companyDetails: Model<CompanyDetails>,
    @InjectModel(StrategicContext.name) private readonly strategicContexts: Model<StrategicContext>,
    @InjectModel(DecisionProfile.name) private readonly decisionProfiles: Model<DecisionProfile>,
    @InjectModel(EvidenceItem.name) private readonly evidenceItems: Model<EvidenceItem>,
    @InjectModel(ExecutiveBrief.name) private readonly executiveBriefs: Model<ExecutiveBrief>,
  ) {}

  async listThreads(userId: string) {
    const owner = new Types.ObjectId(userId);
    const found = await this.threads
      .find({ userId: owner })
      .sort({ updatedAt: -1 })
      .limit(LIST_LIMIT)
      .lean<ThreadRow[]>()
      .exec();

    return {
      status: true,
      data: found.map((thread) => {
        const messages = thread.messages ?? [];
        const lastQuestion = [...messages].reverse().find((message) => message.role === 'user');
        return {
          id: thread._id.toString(),
          title: thread.title,
          updatedAt: (thread.updatedAt ?? new Date()).toISOString(),
          questionCount: messages.filter((message) => message.role === 'user').length,
          preview: (lastQuestion?.content ?? '').slice(0, 90),
        };
      }),
    };
  }

  async getThread(userId: string, id: string) {
    const thread = await this.findOwned(userId, id);
    return { status: true, data: this.threadData(thread) };
  }

  /** `threadId` absent starts a new conversation; a model failure is stored, not thrown. */
  async send(userId: string, message: string, threadId?: string, attachmentIds: string[] = []) {
    const owner = new Types.ObjectId(userId);
    const existing = threadId ? await this.findOwned(userId, threadId) : null;

    const { contextBlock, snapshot } = await this.buildContext(userId);
    const { block, attached } = await this.evidence.prepare(userId, attachmentIds);
    const history = this.historyFor(existing?.messages ?? []);

    const next: WorkspaceMessage[] = [...(existing?.messages ?? []), {
      role: 'user',
      content: message,
      attachments: attached,
      createdAt: new Date(),
    } as WorkspaceMessage];

    let reply: WorkspaceMessage;
    try {
      const result = await this.foundry.complete(this.messagesFor(contextBlock, block, history, message));
      reply = {
        role: 'assistant',
        content: result.content,
        status: 'ok',
        model: result.model,
        responseId: result.responseId,
        createdAt: new Date(),
      } as WorkspaceMessage;
    } catch (error) {
      reply = {
        role: 'assistant',
        status: 'failed',
        error: (error instanceof Error ? error.message : 'The agent could not answer.').slice(0, 500),
        createdAt: new Date(),
      } as WorkspaceMessage;
    }
    next.push(reply);

    const messages = next.length > MAX_WORKSPACE_MESSAGES ? next.slice(-MAX_WORKSPACE_MESSAGES) : next;
    const saved = existing
      ? await this.append(existing, messages, snapshot)
      : await this.threads.create({ userId: owner, title: this.titleFor(message), messages, context: snapshot });

    return { status: true, data: this.threadData(saved) };
  }

  private async append(thread: ThreadDoc, messages: WorkspaceMessage[], context: WorkspaceThreadContext) {
    thread.messages = messages;
    thread.context = context;
    return thread.save();
  }

  private async findOwned(userId: string, id: string): Promise<ThreadDoc> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('That conversation was not found.');
    const query = { _id: id, userId: new Types.ObjectId(userId) } as FilterQuery<WorkspaceThread>;
    const thread = await this.threads.findOne(query).exec();
    if (!thread) throw new NotFoundException('That conversation was not found.');
    return thread;
  }

  private async buildContext(userId: string) {
    const owner = new Types.ObjectId(userId);
    const [company, context, profile, evidence, brief] = await Promise.all([
      this.companyDetails.findOne({ userId: owner }).lean().exec(),
      this.strategicContexts.findOne({ userId: owner }).lean().exec(),
      this.decisionProfiles.findOne({ userId: owner }).lean().exec(),
      this.evidenceItems.find({ userId: owner }).sort({ createdAt: 1 }).lean().exec(),
      this.executiveBriefs.findOne({ userId: owner }).lean().exec(),
    ]);

    const contextBlock = formatOnboardingContext({ company, context, profile, evidence, brief });
    const snapshot = {
      company: company?.companyName,
      objective: context?.primaryObjective,
      constraint: context?.biggestConstraint,
      domains: profile?.decisionDomains ?? [],
      evidenceCount: evidence.length,
      evidenceNames: evidence.map((item) => item.name).slice(0, 25),
      briefStatus: brief?.generation?.status,
    } as WorkspaceThreadContext;

    return { contextBlock, snapshot };
  }

  private historyFor(messages: WorkspaceMessage[]) {
    return messages
      .filter((entry) => Boolean(entry.content) && (entry.role === 'user' || entry.status === 'ok'))
      .slice(-HISTORY_TURNS)
      .map((entry) => ({ role: entry.role, content: entry.content! } as FoundryMessage));
  }

  private messagesFor(contextBlock: string, fileBlock: string, history: FoundryMessage[], message: string): FoundryMessage[] {
    return [
      { role: 'system', content: `${agentInstruction}\n\n${contextBlock}${fileBlock}` },
      ...history,
      { role: 'user', content: message },
    ];
  }

  private titleFor(message: string) {
    const collapsed = message.replace(/\s+/g, ' ').trim();
    return collapsed.length > 120 ? `${collapsed.slice(0, 117)}…` : collapsed;
  }

  private threadData(thread: ThreadDoc) {
    return {
      id: thread._id.toString(),
      title: thread.title,
      updatedAt: (thread.updatedAt ?? new Date()).toISOString(),
      context: {
        company: thread.context?.company,
        objective: thread.context?.objective,
        constraint: thread.context?.constraint,
        domains: thread.context?.domains ?? [],
        evidenceCount: thread.context?.evidenceCount ?? 0,
        evidenceNames: thread.context?.evidenceNames ?? [],
        briefStatus: thread.context?.briefStatus,
      },
      messages: thread.messages.map((entry) => ({
        role: entry.role,
        content: entry.content ?? '',
        status: entry.status,
        model: entry.model,
        responseId: entry.responseId,
        error: entry.error,
        attachments: (entry.attachments ?? []).map((file) => ({ name: file.name, size: file.size, readable: file.readable })),
        createdAt: entry.createdAt.toISOString(),
      })),
    };
  }
}
