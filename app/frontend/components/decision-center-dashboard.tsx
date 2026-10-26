"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "./icon";
import { AgentOutput } from "./agent-output";
import { DecisionCenterSidebar } from "./decision-center-sidebar";
import { WelcomeCopyrightFooter, WelcomeHeader } from "./site-chrome";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

type BriefAnswer = { question: string; answer: string };

type BriefGeneration = {
  status?: string;
  content?: string;
  error?: string;
  agent?: string;
  generatedAt?: string;
};

type CenterData = {
  companyName: string;
  industry: string;
  objective: string;
  constraint: string;
  domains: string[];
  evidenceCount: number;
  answers: BriefAnswer[];
  generation: BriefGeneration | null;
  masterResponse: string;
};

const emptyData: CenterData = {
  companyName: "your business",
  industry: "",
  objective: "Not set yet",
  constraint: "Not set yet",
  domains: [],
  evidenceCount: 0,
  answers: [],
  generation: null,
  masterResponse: "",
};

async function apiJson(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include", cache: "no-store", ...init });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(result.message) ? result.message.join(" ") : result.message;
    throw new Error(message || "Request failed.");
  }
  return result;
}

/** A step can be missing (skipped, or the user signed up on another device) without the page losing the rest. */
async function settle<T>(promise: Promise<T>): Promise<T | null> {
  return promise.catch(() => null);
}

function toStringArray(source: unknown): string[] {
  return Array.isArray(source) ? source.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function toBriefAnswers(source: unknown): BriefAnswer[] {
  if (!Array.isArray(source)) return [];
  const answers: BriefAnswer[] = [];
  for (const entry of source) {
    const record = (entry ?? {}) as { question?: unknown; answer?: unknown };
    if (typeof record.question === "string" && typeof record.answer === "string") answers.push({ question: record.question, answer: record.answer });
  }
  return answers;
}

const BRIEF_PREVIEW_CHARS = 300;

/** Markdown with its structural markers removed, for the short preview line on the card. */
function plainBriefText(source: string): string {
  return source
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line
      .replace(/^\s*(?:#{1,6}|[-*+]|\d+[.)])\s+/, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*([^*\n]+)\*/g, "$1")
      .replace(/`(.+?)`/g, "$1")
      .trim())
    .filter((line) => line && !/^(?:---|___|\*\*\*)$/.test(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateBriefText(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/[,;:.\s]+$/, "")}…`;
}

export function DecisionCenterDashboard({ showChatPanel = false }: { showChatPanel?: boolean }) {
  const [data, setData] = useState(emptyData);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [briefMessage, setBriefMessage] = useState("");
  const [isBriefOpen, setIsBriefOpen] = useState(false);

  const load = useCallback(async () => {
    const [business, context, profile, evidence, brief, intake] = await Promise.all([
      settle(apiJson("/onboarding/business-details")),
      settle(apiJson("/onboarding/strategic-context")),
      settle(apiJson("/onboarding/decision-profile")),
      settle(apiJson("/onboarding/evidence-library")),
      settle(apiJson("/onboarding/executive-brief")),
      settle(apiJson("/data-intake")),
    ]);

    const company = (business?.data ?? {}) as { companyName?: string; industry?: string };
    const strategic = (context?.data ?? {}) as { primaryObjective?: string; biggestConstraint?: string };
    const decisionProfile = (profile?.data ?? {}) as { decisionDomains?: unknown };
    const files = Array.isArray(evidence?.data) ? evidence.data : [];
    const savedBrief = (brief?.data ?? {}) as { answers?: unknown; generation?: BriefGeneration };
    const dataIntake = (intake?.data ?? {}) as { masterResponse?: unknown };

    setData({
      companyName: company.companyName?.trim() || emptyData.companyName,
      industry: company.industry || "",
      objective: strategic.primaryObjective || emptyData.objective,
      constraint: strategic.biggestConstraint || emptyData.constraint,
      domains: toStringArray(decisionProfile.decisionDomains),
      evidenceCount: files.length,
      answers: toBriefAnswers(savedBrief.answers),
      generation: savedBrief.generation ?? null,
      masterResponse: typeof dataIntake.masterResponse === "string" ? dataIntake.masterResponse.trim() : "",
    });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const generateBrief = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setBriefMessage("");
    try {
      const generation = (await apiJson("/onboarding/executive-brief/generate", { method: "POST" })) as BriefGeneration;
      setData((current) => ({ ...current, generation }));
      if (generation.status !== "ok") setBriefMessage(generation.error || "The brief agent did not return a result.");
    } catch (error) {
      setBriefMessage(error instanceof Error ? error.message : "The brief agent could not be reached.");
    } finally {
      setIsGenerating(false);
    }
  };

  const generation = data.generation;
  // The Master Agent's onboarding handover is the brief once it exists; the brief
  // agent's generation is the fallback for users who have not reached it.
  const briefFromMaster = Boolean(data.masterResponse);
  const briefIsReady = briefFromMaster || (generation?.status === "ok" && Boolean(generation.content));
  const briefSource = briefFromMaster ? data.masterResponse : generation?.content ?? "";
  const briefAgentLabel = briefFromMaster ? "GENERATED BY YOUR MASTER AGENT" : "GENERATED BY YOUR BRIEF AGENT";
  const briefPlain = plainBriefText(briefSource);
  const briefNeedsExpansion = briefPlain.length > BRIEF_PREVIEW_CHARS;

  return (
    <>
      <a className="skip-link" href="#decision-center-main">Skip to content</a>
      <WelcomeHeader />
      <div className={`decision-center-layout${showChatPanel ? " has-chat-panel" : ""}`}>
        <DecisionCenterSidebar />

        <main id="decision-center-main" className="decision-center-main">
          <div className="decision-center-heading">
            <div>
              <p className="decision-center-eyebrow">STRATVEDA <span>·</span> DECISION CENTER</p>
              <h1>Welcome to your Decision Center</h1>
              <p>{isLoading ? "Loading your saved context…" : `Your business context is ready. Start with what matters most to ${data.companyName}.`}</p>
            </div>
            <Link className="decision-center-edit" href="/business-fingerprint"><Icon name="brain" size={16} /> Review your profile</Link>
          </div>

          <section className="decision-center-agent-brief" aria-labelledby="decision-agent-brief-title">
            <div className="decision-center-panel-heading">
              <div><span><Icon name="sparkles" size={14} /> {briefIsReady ? briefAgentLabel : "BRIEF AGENT"}</span><h2 id="decision-agent-brief-title">Your decision brief</h2></div>
              {briefIsReady
                ? <span className="decision-center-saved-badge"><Icon name="check" size={13} /> {briefFromMaster ? "MASTER AGENT" : generation?.agent || "AGENT OUTPUT"}</span>
                : <button className="decision-center-agent-retry" type="button" onClick={generateBrief} disabled={isGenerating}>{isGenerating ? "Generating…" : generation?.status === "failed" ? "Retry brief" : "Generate brief" }</button>}
            </div>
            {isLoading ? (
              <p className="decision-center-empty-note">Checking whether your brief has already been generated.</p>
            ) : briefIsReady ? (
              briefNeedsExpansion ? (
                <div className="decision-center-agent-preview">
                  <p>{truncateBriefText(briefPlain, BRIEF_PREVIEW_CHARS)}</p>
                  <button className="decision-center-agent-read-more" type="button" onClick={() => setIsBriefOpen(true)}>
                    Read more <Icon name="arrow-right" size={14} />
                  </button>
                </div>
              ) : (
                <AgentOutput source={briefSource} />
              )
            ) : (
              <p className="decision-center-agent-fallback">
                {briefMessage
                  || generation?.error
                  || "Your brief agent has not produced an overview yet. Answer the four questions on your first decision brief, then generate it here."}
              </p>
            )}
          </section>

          <section className="decision-center-focus" aria-labelledby="decision-focus-title">
            <div className="decision-center-focus-copy">
              <span className="decision-center-focus-label"><Icon name="sparkles" size={15} /> YOUR CURRENT FOCUS</span>
              <h2 id="decision-focus-title">{data.objective}</h2>
              <p>{data.constraint === "Not set yet" ? "Your priorities will guide the insights in this workspace." : `We’ll keep your biggest constraint in view: ${data.constraint}.`}</p>
            </div>
            <div className="decision-center-focus-mark" aria-hidden="true"><Icon name="trend" size={28} /></div>
          </section>

          <section className="decision-center-metrics" aria-label="Workspace summary">
            <article className="decision-center-metric"><span className="decision-center-metric-icon metric-green"><Icon name="dashboard" size={18} /></span><div><span>DECISION AREAS</span><strong>{data.domains.length}</strong><small>Chosen for your business</small></div></article>
            <article className="decision-center-metric"><span className="decision-center-metric-icon metric-blue"><Icon name="report" size={18} /></span><div><span>EVIDENCE FILES</span><strong>{data.evidenceCount}</strong><small>{data.evidenceCount ? "Available in your library" : "You can add these any time"}</small></div></article>
            <article className="decision-center-metric"><span className="decision-center-metric-icon metric-gold"><Icon name="check" size={18} /></span><div><span>SETUP</span><strong>{data.answers.length ? "Complete" : "In progress"}</strong><small>{data.answers.length ? "Your Decision Center is ready" : "Finish your first decision brief to complete it"}</small></div></article>
          </section>

          <div className="decision-center-content-grid">
            <section className="decision-center-panel decision-center-areas" aria-labelledby="decision-areas-title">
              <div className="decision-center-panel-heading"><div><span>YOUR PRIORITIES</span><h2 id="decision-areas-title">Decision areas</h2></div><Link href="/decision-profile">Edit <Icon name="arrow-right" size={15} /></Link></div>
              {data.domains.length ? (
                <ul>{data.domains.map((domain, index) => <li key={domain}><span className="decision-center-area-number">{String(index + 1).padStart(2, "0")}</span><span>{domain}</span><Icon name="arrow-right" size={16} /></li>)}</ul>
              ) : <p className="decision-center-empty-note">Your selected decision areas will appear here.</p>}
              {data.industry && <p className="decision-center-industry">Built around your work in <strong>{data.industry}</strong></p>}
            </section>

            <section className="decision-center-panel decision-center-brief" aria-labelledby="decision-brief-title">
              <div className="decision-center-panel-heading"><div><span>FROM YOUR FIRST DECISION BRIEF</span><h2 id="decision-brief-title">Questions to explore</h2></div><span className="decision-center-saved-badge"><Icon name="check" size={13} /> SAVED</span></div>
              {data.answers.length ? (
                <ol>{data.answers.slice(0, 4).map((item, index) => <li key={`${index}-${item.question}`}><span>{index + 1}</span><p><strong>{item.question}</strong>{item.answer}</p></li>)}</ol>
              ) : <p className="decision-center-empty-note">Your saved questions will appear here.</p>}
              <Link className="decision-center-brief-link" href="/executive-brief">Open Your First Decision Brief <Icon name="arrow-right" size={15} /></Link>
            </section>
          </div>

          <section className="decision-center-data-note" aria-label="Revenue data connection status">
            <span className="decision-center-data-icon" aria-hidden="true"><Icon name="trend" size={20} /></span>
            <div><strong>Your revenue overview will grow with you</strong><p>As you connect revenue data, this space can bring your trends and priorities together. Your setup is saved and ready whenever you are.</p></div>
            <span className="decision-center-data-status"><i /> CONTEXT READY</span>
          </section>
        </main>
        {showChatPanel && (
          <aside className="decision-center-chat-panel" aria-label="Decision chat preview">
            <div className="decision-center-chat-head">
              <div><span>STRATVEDA ASSISTANT</span><h2>Decision chat</h2></div>
              <span className="decision-center-chat-availability"><i /> Coming soon</span>
            </div>
            <div className="decision-center-chat-conversation" aria-live="polite">
              <div className="decision-center-chat-agent-mark" aria-hidden="true">S</div>
              <div className="decision-center-chat-message">
                <span>STRATVEDA</span>
                <p>Your workspace is ready. When chat is connected, bring a business question here and work through it with your company context in view.</p>
              </div>
              <div className="decision-center-chat-context"><span>YOUR CONTEXT</span><p>{data.companyName}{data.industry ? ` · ${data.industry}` : ""}</p></div>
            </div>
            <div className="decision-center-chat-compose">
              <label className="sr-only" htmlFor="decision-chat-message">Write a message</label>
              <textarea id="decision-chat-message" rows={4} disabled placeholder="Chat will be available here soon…" />
              <div><span>Context stays with your workspace</span><button type="button" disabled aria-label="Send message">↑</button></div>
            </div>
          </aside>
        )}
      </div>
      <WelcomeCopyrightFooter />

      {isBriefOpen && briefIsReady && (
        <div className="decision-center-brief-overlay" role="presentation">
          <div className="decision-center-brief-modal" role="dialog" aria-modal="true" aria-labelledby="decision-brief-modal-title">
            <div className="decision-center-brief-modal-head">
              <div>
                <span><Icon name="sparkles" size={14} /> {briefAgentLabel}</span>
                <h2 id="decision-brief-modal-title">Your decision brief</h2>
              </div>
              <button className="decision-center-brief-modal-close" type="button" onClick={() => setIsBriefOpen(false)} aria-label="Close brief" autoFocus>
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="decision-center-brief-modal-body">
              <AgentOutput source={briefSource} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
