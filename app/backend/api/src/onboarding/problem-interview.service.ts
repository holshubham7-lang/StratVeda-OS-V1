import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CompanyDetails } from './company-details.schema';
import { ProblemInterview, ProblemInterviewMessage } from './problem-interview.schema';

const INTERVIEW_GUIDANCE = [
  'Continue a thoughtful business discovery interview using the company context and problem statement already provided.',
  'Ask one concise, relevant follow-up question at a time. Decide dynamically when you have enough detail; there is no fixed question count.',
  'Acknowledge the user naturally and avoid repeating questions they have answered.',
  'When you have gathered enough information, finish with a concise recap and put the exact marker [[INTERVIEW_COMPLETE]] on its own final line.',
].join(' ');

type AgentResult = { content: string; responseId: string; agentSessionId: string; complete: boolean };

@Injectable()
export class ProblemInterviewService {
  private readonly timeoutMs: number;

  constructor(
    private readonly config: ConfigService,
    @InjectModel(CompanyDetails.name) private readonly companyDetails: Model<CompanyDetails>,
    @InjectModel(ProblemInterview.name) private readonly interviews: Model<ProblemInterview>,
  ) {
    this.timeoutMs = Number(this.config.get('AZURE_FOUNDRY_TIMEOUT_MS', '60000'));
  }

  async get(userId: string) {
    const interview = await this.interviews.findOne({ userId: new Types.ObjectId(userId) }).lean().exec();
    return { status: true, data: interview ? this.toClient(interview) : null };
  }

  async start(userId: string, problemStatement: string, role?: string) {
    const owner = new Types.ObjectId(userId);
    const company = await this.companyDetails.findOne({ userId: owner }).lean().exec();
    if (!company) throw new BadRequestException('Save your company details before starting the interview.');

    const details = {
      companyName: company.companyName,
      website: company.website,
      industry: company.industry,
      teamSize: company.teamSize,
      annualRevenue: company.revenueRange,
      companyStage: company.companyStage,
      location: [company.city, company.state, company.country].filter(Boolean).join(', '),
      role: role || undefined,
    };
    const input = [
      'Begin the discovery interview. Use this saved company context and problem statement as the starting point.',
      `Company context: ${JSON.stringify(details)}`,
      `Problem statement: ${problemStatement}`,
      `Interview guidance: ${INTERVIEW_GUIDANCE}`,
    ].join('\n\n');

    const result = await this.invoke(input);
    const messages: ProblemInterviewMessage[] = [
      { role: 'user', content: problemStatement, createdAt: new Date() },
      { role: 'assistant', content: result.content, createdAt: new Date() },
    ];
    await this.interviews.findOneAndUpdate(
      { userId: owner },
      {
        $set: {
          problemStatement,
          status: result.complete ? 'complete' : 'active',
          responseId: result.responseId,
          agentSessionId: result.agentSessionId,
          messages,
        },
        $setOnInsert: { userId: owner },
      },
      { upsert: true, new: true, runValidators: true },
    );
    return { status: true, data: { status: result.complete ? 'complete' : 'active', messages } };
  }

  async reply(userId: string, message: string) {
    const owner = new Types.ObjectId(userId);
    const interview = await this.interviews.findOne({ userId: owner }).exec();
    if (!interview) throw new NotFoundException('Start the discovery interview before sending an answer.');
    if (interview.status === 'complete') throw new BadRequestException('This interview is complete. Continue to the next setup step.');

    const result = await this.invoke(message, interview.responseId, interview.agentSessionId);
    interview.messages.push(
      { role: 'user', content: message, createdAt: new Date() } as ProblemInterviewMessage,
      { role: 'assistant', content: result.content, createdAt: new Date() } as ProblemInterviewMessage,
    );
    interview.responseId = result.responseId;
    interview.agentSessionId = result.agentSessionId;
    interview.status = result.complete ? 'complete' : 'active';
    await interview.save();
    return { status: true, data: this.toClient(interview.toObject()) };
  }

  private toClient(interview: Pick<ProblemInterview, 'status' | 'messages'>) {
    return {
      status: interview.status,
      messages: interview.messages.map(({ role, content, createdAt }) => ({ role, content, createdAt })),
    };
  }

  private async invoke(input: string, previousResponseId?: string, agentSessionId?: string): Promise<AgentResult> {
    const endpoint = (this.config.get<string>('AZURE_FOUNDRY_INTERVIEW_AGENT_ENDPOINT')
      ?? 'https://stratvedaos-v1-resource.services.ai.azure.com/api/projects/stratvedaos-v1/agents/discovery-agent/endpoint/protocols/openai/responses').trim();

    const token = await this.getAccessToken();
    const url = new URL(endpoint);
    if (!url.searchParams.has('api-version')) url.searchParams.set('api-version', 'v1');
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        input: previousResponseId ? `${input}\n\nInterview guidance: ${INTERVIEW_GUIDANCE}` : input,
        max_output_tokens: 800,
        stream: false,
        ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
        ...(agentSessionId ? { agent_session_id: agentSessionId } : {}),
      }),
      signal: AbortSignal.timeout(Number.isFinite(this.timeoutMs) && this.timeoutMs > 0 ? this.timeoutMs : 60000),
    });

    const text = await response.text();
    let payload: Record<string, unknown> = {};
    try { payload = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { /* Report a bounded error below. */ }
    if (!response.ok) {
      const error = payload.error as Record<string, unknown> | string | undefined;
      const message = typeof error === 'string' ? error : typeof error?.message === 'string' ? error.message : text.slice(0, 240);
      throw new ServiceUnavailableException(`The discovery interview agent returned ${response.status}: ${message}`.slice(0, 500));
    }

    const rawContent = this.extractOutputText(payload);
    if (!rawContent) throw new ServiceUnavailableException('The discovery interview agent returned an empty response.');
    const complete = /^\s*\[\[INTERVIEW_COMPLETE\]\]\s*$/im.test(rawContent);
    const content = rawContent.replace(/^\s*\[\[INTERVIEW_COMPLETE\]\]\s*$/im, '').trim();
    const responseId = typeof payload.id === 'string' ? payload.id : '';
    const sessionId = typeof payload.agent_session_id === 'string' ? payload.agent_session_id : agentSessionId ?? '';
    if (!responseId || !sessionId) throw new ServiceUnavailableException('The discovery agent response did not include its conversation identifiers.');

    return { content, responseId, agentSessionId: sessionId, complete };
  }

  private async getAccessToken() {
    const override = this.config.get<string>('AZURE_FOUNDRY_ACCESS_TOKEN')?.trim();
    if (override) return override;

    const identityEndpoint = process.env.IDENTITY_ENDPOINT;
    const identityHeader = process.env.IDENTITY_HEADER;
    if (!identityEndpoint || !identityHeader) {
      throw new ServiceUnavailableException('The API host needs an Azure managed identity with access to the Foundry project.');
    }
    const url = new URL(identityEndpoint);
    url.searchParams.set('api-version', '2019-08-01');
    url.searchParams.set('resource', 'https://ai.azure.com/');
    const response = await fetch(url, {
      headers: { 'X-IDENTITY-HEADER': identityHeader, 'Metadata': 'true' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok || typeof payload.access_token !== 'string') {
      throw new ServiceUnavailableException('The API host could not get a token for Microsoft Foundry.');
    }
    return payload.access_token;
  }

  private extractOutputText(payload: Record<string, unknown>) {
    if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim();
    const output = Array.isArray(payload.output) ? payload.output : [];
    const chunks: string[] = [];
    for (const item of output) {
      if (!item || typeof item !== 'object') continue;
      const message = item as Record<string, unknown>;
      if (message.type !== 'message' || !Array.isArray(message.content)) continue;
      for (const part of message.content) {
        if (part && typeof part === 'object') {
          const content = part as Record<string, unknown>;
          if ((content.type === 'output_text' || content.type === 'text') && typeof content.text === 'string') chunks.push(content.text);
        }
      }
    }
    return chunks.join('\n').trim();
  }
}
