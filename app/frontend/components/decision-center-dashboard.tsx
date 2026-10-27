"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { Icon } from "./icon";
import { AgentOutput } from "./agent-output";
import { DecisionCenterSidebar } from "./decision-center-sidebar";
import { WelcomeCopyrightFooter, WelcomeHeader } from "./site-chrome";
import styles from "./decision-center-dashboard.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";
const THREADS_EVENT = "workspace:threads-changed";
const MAX_MESSAGE_CHARS = 4000;
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
// Mirrors the Decision Workspace composer, which mirrors `acceptedEvidenceExtensions` on the API.
const acceptedExtensions = [".doc", ".docx", ".xls", ".xlsx", ".csv", ".json", ".pdf", ".jpg", ".jpeg", ".png"];
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const suggestedQuestions = [
  "What should I do first this week?",
  "What are the biggest risks in this plan?",
  "Which data would make this brief stronger?",
  "Explain the first decision focus in simple terms.",
];

type BriefGeneration = {
  status?: string;
  content?: string;
  error?: string;
  agent?: string;
  generatedAt?: string;
};

type SavedFile = { name: string; source: "data" | "library"; status: string };
type InterviewTurn = { question: string; answer: string };

type CenterData = {
  companyName: string;
  generation: BriefGeneration | null;
  masterResponse: string;
  masterCompletedAt: string;
  files: SavedFile[];
  problemStatement: string;
  interview: InterviewTurn[];
};

type Attachment = { id: string; name: string; size: number; readable: boolean };

type ChatMessage = {
  role: string;
  content: string;
  status?: string;
  error?: string;
  model?: string;
  attachments?: { name: string; size: number; readable: boolean }[];
  createdAt: string;
};

const emptyData: CenterData = {
  companyName: "your business",
  generation: null,
  masterResponse: "",
  masterCompletedAt: "",
  files: [],
  problemStatement: "",
  interview: [],
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

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/** Markdown reduced to one readable line for the saved-context list. */
function plain(source: string) {
  return source
    .replace(/\r\n/g, "\n")
    .replace(/^\s*(?:#{1,6}|[-*+]|\d+[.)])\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(value: string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function formatClock(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extensionOf(name: string) {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

function fileStatusLabel(file: SavedFile) {
  if (file.source === "library") return "Library";
  if (file.status === "ready") return "Ready";
  if (file.status === "blocked" || file.status === "failed") return "Excluded";
  return "Processing";
}

/** Pairs each interview-agent question with the answer that followed it. */
function interviewTurns(messages: unknown): { problemStatement: string; turns: InterviewTurn[] } {
  const list = Array.isArray(messages) ? messages as { role?: unknown; content?: unknown }[] : [];
  const firstUser = list.findIndex((entry) => entry.role === "user");
  const problemStatement = firstUser >= 0 ? text(list[firstUser].content) : "";
  const turns: InterviewTurn[] = [];
  list.forEach((entry, index) => {
    if (entry.role !== "assistant") return;
    const question = plain(text(entry.content));
    if (!question) return;
    const reply = list.slice(index + 1).find((next) => next.role === "user" || next.role === "assistant");
    turns.push({ question, answer: reply?.role === "user" ? text(reply.content) : "" });
  });
  return { problemStatement, turns };
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** `startWithChat` opens the ask panel straight away (the legacy /chat route). */
export function DecisionCenterDashboard({ startWithChat = false }: { startWithChat?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const renderedCount = useRef(0);
  const [data, setData] = useState(emptyData);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [briefMessage, setBriefMessage] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(startWithChat);
  const [isContextOpen, setIsContextOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState("");
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [chatNotice, setChatNotice] = useState("");

  const load = useCallback(async () => {
    const [business, brief, intake, evidence, interview] = await Promise.all([
      settle(apiJson("/onboarding/business-details")),
      settle(apiJson("/onboarding/executive-brief")),
      settle(apiJson("/data-intake")),
      settle(apiJson("/onboarding/evidence-library")),
      settle(apiJson("/onboarding/problem-interview")),
    ]);

    const company = (business?.data ?? {}) as { companyName?: string };
    const savedBrief = (brief?.data ?? {}) as { generation?: BriefGeneration };
    const dataIntake = (intake?.data ?? {}) as { masterResponse?: unknown; completedAt?: unknown; files?: unknown };
    const intakeFiles = Array.isArray(dataIntake.files) ? dataIntake.files as { name?: unknown; status?: unknown }[] : [];
    const libraryFiles = Array.isArray(evidence?.data) ? evidence.data as { name?: unknown }[] : [];
    const { problemStatement, turns } = interviewTurns((interview?.data as { messages?: unknown } | null)?.messages);

    setData({
      companyName: company.companyName?.trim() || emptyData.companyName,
      generation: savedBrief.generation ?? null,
      masterResponse: text(dataIntake.masterResponse),
      masterCompletedAt: text(dataIntake.completedAt),
      files: [
        ...intakeFiles.map((file) => ({ name: text(file.name), source: "data" as const, status: text(file.status) })),
        ...libraryFiles.map((file) => ({ name: text(file.name), source: "library" as const, status: "ready" })),
      ].filter((file) => file.name),
      problemStatement,
      interview: turns,
    });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useIsomorphicLayoutEffect(() => {
    if (!rootRef.current || prefersReducedMotion()) return;
    const context = gsap.context(() => {
      gsap.timeline({ defaults: { ease: "power3.out" } })
        .from("[data-center-heading] > *", { opacity: 0, y: 14, duration: 0.5, stagger: 0.07 })
        .from("[data-center-brief]", { opacity: 0, y: 20, duration: 0.6 }, "-=0.25");
    }, rootRef);
    return () => context.revert();
  }, []);

  // The brief text fades in once it arrives, so the card does not pop from a placeholder.
  useEffect(() => {
    if (isLoading || !rootRef.current || prefersReducedMotion()) return;
    const body = rootRef.current.querySelector("[data-center-brief-body]");
    if (body) gsap.from(body, { opacity: 0, y: 8, duration: 0.5, ease: "power2.out" });
  }, [isLoading]);

  // Opening the chat slides its panel in beside the brief (below it on narrow
  // screens), keeps any earlier conversation, and moves focus into the composer.
  useIsomorphicLayoutEffect(() => {
    if (!isChatOpen) {
      renderedCount.current = 0;
      return;
    }
    const panel = chatRef.current;
    const stacked = window.matchMedia("(max-width: 1180px)").matches;
    renderedCount.current = messages.length + (isSending ? 1 : 0);
    if (threadRef.current) threadRef.current.scrollTop = messages.length ? threadRef.current.scrollHeight : 0;
    if (panel && !prefersReducedMotion() && !startWithChat) {
      gsap.fromTo(panel, stacked ? { opacity: 0, y: 18 } : { opacity: 0, x: 40 }, { opacity: 1, x: 0, y: 0, duration: 0.55, ease: "power3.out" });
      gsap.from(panel.querySelectorAll("[data-chat-reveal]"), { opacity: 0, y: 8, duration: 0.35, stagger: 0.05, delay: 0.2, ease: "power2.out" });
    }
    if (stacked) panel?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    inputRef.current?.focus({ preventScroll: true });
  }, [isChatOpen]);

  // New messages slide in; ones already on screen stay still.
  useIsomorphicLayoutEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    const items = thread.querySelectorAll("[data-chat-message]");
    const fresh = Array.from(items).slice(renderedCount.current);
    renderedCount.current = items.length;
    if (fresh.length && !prefersReducedMotion()) {
      gsap.from(fresh, { opacity: 0, y: 12, duration: 0.4, stagger: 0.08, ease: "power2.out" });
    }
    if (items.length) thread.scrollTo({ top: thread.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [messages, isSending]);

  // Saved context steps aside once the conversation starts, to give the thread room.
  useEffect(() => {
    if (messages.length === 1) setIsContextOpen(false);
  }, [messages.length]);

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

  const uploadFiles = async (fileList: FileList | File[]) => {
    const picked = [...fileList];
    if (!picked.length || isUploading) return;
    const rejected: string[] = [];
    const valid: File[] = [];
    for (const file of picked) {
      if (!acceptedExtensions.includes(extensionOf(file.name))) rejected.push(`${file.name} isn’t a supported file type.`);
      else if (file.size > MAX_ATTACHMENT_BYTES) rejected.push(`${file.name} is larger than 25 MB.`);
      else if (!file.size) rejected.push(`${file.name} is empty.`);
      else valid.push(file);
    }
    const room = MAX_ATTACHMENTS - attachments.length;
    if (valid.length > room) rejected.push(`Only ${Math.max(room, 0)} more file${room === 1 ? "" : "s"} can be attached to one question.`);
    const accepted = valid.slice(0, Math.max(room, 0));
    if (rejected.length && !accepted.length) {
      setChatNotice(rejected.join(" "));
      return;
    }

    setIsUploading(true);
    setChatNotice("");
    try {
      const form = new FormData();
      for (const file of accepted) form.append("files", file);
      const result = await apiJson("/workspace/files", { method: "POST", body: form });
      const stored = (Array.isArray(result?.data) ? result.data : []) as Attachment[];
      setAttachments((current) => [...current, ...stored].slice(0, MAX_ATTACHMENTS));
      setChatNotice(rejected.length ? `${rejected.join(" ")} The rest was attached.` : "");
      // Attached files also join the evidence library, so the saved context re-reads.
      void load();
    } catch (error) {
      setChatNotice(error instanceof Error ? error.message : "Those files could not be attached.");
    } finally {
      setIsUploading(false);
    }
  };

  const sendMessage = async (preset?: string) => {
    const message = (preset ?? draft).trim();
    if (message.length < 2 || isSending || isUploading) return;
    const attached = preset ? [] : attachments;
    setIsSending(true);
    setChatNotice("");
    const pending: ChatMessage = {
      role: "user",
      content: message,
      attachments: attached.map((file) => ({ name: file.name, size: file.size, readable: file.readable })),
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, pending]);
    if (!preset) {
      setDraft("");
      setAttachments([]);
    }
    try {
      const path = threadId ? `/workspace/threads/${threadId}/messages` : "/workspace/threads";
      const result = await apiJson(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, attachmentIds: attached.map((file) => file.id) }),
      });
      const thread = result?.data as { id?: string; messages?: ChatMessage[] } | undefined;
      setThreadId(typeof thread?.id === "string" ? thread.id : "");
      if (Array.isArray(thread?.messages)) {
        // Keep already-rendered messages so only the reply animates in.
        renderedCount.current = Math.min(renderedCount.current, thread.messages.length - 1);
        setMessages(thread.messages);
      }
      window.dispatchEvent(new Event(THREADS_EVENT));
    } catch (error) {
      setMessages((current) => current.filter((entry) => entry !== pending));
      renderedCount.current = Math.max(0, renderedCount.current - 1);
      if (!preset) {
        setDraft(message);
        setAttachments(attached);
      }
      setChatNotice(error instanceof Error ? error.message : "The agent could not answer just now.");
    } finally {
      setIsSending(false);
      inputRef.current?.focus({ preventScroll: true });
    }
  };

  const startNewChat = () => {
    if (isSending) return;
    renderedCount.current = 0;
    setMessages([]);
    setThreadId("");
    setDraft("");
    setAttachments([]);
    setChatNotice("");
    setIsContextOpen(true);
    inputRef.current?.focus();
  };

  const generation = data.generation;
  // The Master Agent's onboarding handover is the brief once it exists; the brief
  // agent's generation is the fallback for users who have not reached it.
  const briefFromMaster = Boolean(data.masterResponse);
  const briefIsReady = briefFromMaster || (generation?.status === "ok" && Boolean(generation.content));
  const briefSource = briefFromMaster ? data.masterResponse : generation?.content ?? "";
  const briefDate = formatDate(briefFromMaster ? data.masterCompletedAt : generation?.generatedAt);
  const questionCount = messages.filter((entry) => entry.role === "user").length;
  const hasSavedContext = Boolean(data.files.length || data.interview.length || data.problemStatement || briefIsReady);

  return (
    <>
      <a className="skip-link" href="#decision-center-main">Skip to content</a>
      <WelcomeHeader />
      <div className="decision-center-layout">
        <DecisionCenterSidebar />

        <main id="decision-center-main" className={`decision-center-main ${styles.main}${isChatOpen ? ` ${styles.isWide}` : ""}`} ref={rootRef}>
          <div className="decision-center-heading" data-center-heading>
            <div>
              <p className="decision-center-eyebrow">STRATVEDA <span>·</span> DECISION CENTER</p>
              <h1>Welcome to your Decision Center</h1>
              <p>{isLoading ? "Loading your saved context…" : `Here is your decision brief for ${data.companyName}. Ask your agent anything about it.`}</p>
            </div>
            <Link className="decision-center-edit" href="/business-fingerprint"><Icon name="brain" size={16} /> Review your profile</Link>
          </div>

          <div className={isChatOpen ? styles.split : styles.single}>
            <section className={styles.briefCard} aria-labelledby="decision-agent-brief-title" data-center-brief>
              <header className={styles.briefHeader}>
                <span className={styles.briefMark} aria-hidden="true"><Icon name="sparkles" size={18} /></span>
                <div className={styles.briefTitle}>
                  <span className={styles.kicker}>{briefIsReady ? (briefFromMaster ? "GENERATED BY YOUR MASTER AGENT" : "GENERATED BY YOUR BRIEF AGENT") : "BRIEF AGENT"}</span>
                  <h2 id="decision-agent-brief-title">Your decision brief</h2>
                </div>
                <div className={styles.briefHeaderActions}>
                  {briefIsReady
                    ? <span className={styles.badge}><Icon name="check" size={13} /> {briefDate ? `Ready · ${briefDate}` : "Ready"}</span>
                    : <button className={styles.secondaryButton} type="button" onClick={generateBrief} disabled={isGenerating || isLoading}>{isGenerating ? "Generating…" : generation?.status === "failed" ? "Retry brief" : "Generate brief"}</button>}
                  {!isChatOpen && (
                    <button className={styles.primaryButton} type="button" onClick={() => setIsChatOpen(true)}>
                      <Icon name="sparkles" size={16} /> Ask your agent
                    </button>
                  )}
                </div>
              </header>

              <div className={styles.briefBody} data-center-brief-body>
                {isLoading ? (
                  <div className={styles.skeleton} aria-label="Loading your brief">
                    <span style={{ width: "92%" }} /><span style={{ width: "84%" }} /><span style={{ width: "88%" }} /><span style={{ width: "62%" }} />
                  </div>
                ) : briefIsReady ? (
                  <AgentOutput source={briefSource} />
                ) : (
                  <p className={styles.fallback}>
                    {briefMessage
                      || generation?.error
                      || "Your decision brief is not ready yet. Finish your company data step so the Master Agent can prepare it, or generate one here."}
                  </p>
                )}
              </div>

              {!isChatOpen && (
                <div className={styles.askCta}>
                  <span className={styles.askIcon} aria-hidden="true"><Icon name="chat" size={20} /></span>
                  <div className={styles.askCopy}>
                    <h2>Have a question about your brief?</h2>
                    <p>Open a workspace beside your brief. Ask follow-ups, attach files, and see the saved context your agent reasons over.</p>
                  </div>
                  <button className={styles.ghostButton} type="button" onClick={() => setIsChatOpen(true)}>
                    Ask your agent <Icon name="arrow-right" size={14} />
                  </button>
                </div>
              )}
            </section>

            {isChatOpen && (
              <section className={styles.chatPanel} ref={chatRef} aria-labelledby="ask-chat-title">
                <header className={styles.chatHeader}>
                  <div className={styles.chatHeading}>
                    <p className="decision-center-eyebrow">STRATVEDA <span>·</span> DECISION WORKSPACE</p>
                    <h2 id="ask-chat-title">Ask your decision brief</h2>
                    <p>Keep the thread going on anything from your saved business context.</p>
                  </div>
                  <div className={styles.chatActions}>
                    <span className={questionCount ? "decision-workspace-status is-live" : "decision-workspace-status"}>
                      <i /> {questionCount ? `${questionCount} QUESTION${questionCount === 1 ? "" : "S"} SAVED` : "READY TO ASK"}
                    </span>
                    <div className={styles.chatButtons}>
                      {(questionCount > 0 || threadId) && (
                        <button className="decision-workspace-new" type="button" onClick={startNewChat} disabled={isSending}>
                          <Icon name="plus" size={13} /> New conversation
                        </button>
                      )}
                      {threadId && <Link className={styles.iconButton} href="/decision-workspace" aria-label="Open in Decision Workspace" title="Open in Decision Workspace"><Icon name="arrow-up-right" size={15} /></Link>}
                      <button className={styles.iconButton} type="button" onClick={() => setIsChatOpen(false)} aria-label="Close workspace panel" title="Close">
                        <Icon name="close" size={15} />
                      </button>
                    </div>
                  </div>
                </header>

                <section className={`${styles.context}${isContextOpen ? ` ${styles.isOpen}` : ""}`} aria-labelledby="saved-context-title" data-chat-reveal>
                  <button className={styles.contextToggle} type="button" onClick={() => setIsContextOpen((open) => !open)} aria-expanded={isContextOpen} aria-controls="saved-context-body">
                    <span className={styles.contextLabel}>
                      <span className="decision-center-eyebrow" id="saved-context-title">SAVED CONTEXT</span>
                      <span className={hasSavedContext ? "decision-workspace-side-tag is-connected" : "decision-workspace-side-tag"}>
                        <Icon name={hasSavedContext ? "plug-connected" : "plug"} size={13} /> {isLoading ? "CHECKING" : hasSavedContext ? "CONNECTED" : "NOT CONNECTED"}
                      </span>
                    </span>
                    <span className={styles.contextSummary}>
                      {data.files.length} {data.files.length === 1 ? "file" : "files"} · {data.interview.length} interview {data.interview.length === 1 ? "question" : "questions"}
                      <Icon name={isContextOpen ? "arrow-up" : "arrow-right"} size={13} />
                    </span>
                  </button>

                  {isContextOpen && (
                    <div className={styles.contextBody} id="saved-context-body">
                      <div className={styles.contextGroup}>
                        <h3>Uploaded files</h3>
                        {data.files.length ? (
                          <ul className={styles.fileChips}>
                            {data.files.map((file, index) => (
                              <li key={`${file.source}-${file.name}-${index}`} className={file.status === "blocked" || file.status === "failed" ? styles.isExcluded : ""}>
                                <Icon name="report" size={13} />
                                <span className={styles.fileName}>{file.name}</span>
                                <span className={styles.fileTag}>{fileStatusLabel(file)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className={styles.contextEmpty}>No files yet. Use + below to attach one to your question.</p>
                        )}
                      </div>

                      <div className={styles.contextGroup}>
                        <h3>Discovery interview</h3>
                        {data.problemStatement && (
                          <p className={styles.problem}><strong>Your problem statement</strong>{data.problemStatement}</p>
                        )}
                        {data.interview.length ? (
                          <ol className={styles.questions}>
                            {data.interview.map((turn, index) => (
                              <li key={`${index}-${turn.question.slice(0, 24)}`}>
                                <span className={styles.questionNumber}>{index + 1}</span>
                                <div>
                                  <p className={styles.question}>{turn.question}</p>
                                  {turn.answer && <p className={styles.answer}>{turn.answer}</p>}
                                </div>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className={styles.contextEmpty}>{isLoading ? "Reading your interview…" : "No interview questions saved yet."}</p>
                        )}
                      </div>
                    </div>
                  )}
                </section>

                <div className={styles.thread} ref={threadRef} aria-live="polite">
                  {!messages.length && !isSending ? (
                    <div className={styles.empty}>
                      <span className="decision-workspace-empty-mark" aria-hidden="true">🤖</span>
                      <strong>How can I help you today?</strong>
                      <p>Ask about your brief. Each question and answer is saved to your Decision Workspace.</p>
                      <div className={styles.suggestions}>
                        {suggestedQuestions.map((question) => (
                          <button key={question} type="button" data-chat-reveal onClick={() => void sendMessage(question)} disabled={isUploading}>
                            {question} <Icon name="arrow-right" size={13} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <ol className="decision-workspace-messages">
                      {messages.map((message, index) => {
                        const isUser = message.role !== "assistant";
                        return (
                          <li className={`decision-workspace-message ${isUser ? "is-you" : "is-agent"}`} key={`${message.createdAt}-${index}`} data-chat-message>
                            <div className="decision-workspace-bubble">
                              {isUser ? (
                                <>
                                  <p>{message.content}</p>
                                  {message.attachments?.length ? (
                                    <p className="decision-workspace-bubble-files">
                                      {message.attachments.map((file, fileIndex) => (
                                        <span key={`${file.name}-${fileIndex}`}>
                                          <Icon name="report" size={12} /> {file.name}{file.readable ? "" : " · name only"}
                                        </span>
                                      ))}
                                    </p>
                                  ) : null}
                                </>
                              ) : message.status === "failed"
                                ? <p className="decision-workspace-error"><Icon name="plug" size={14} /> {message.error || "The agent could not answer."}</p>
                                : <AgentOutput source={message.content} />}
                            </div>
                            <p className="decision-workspace-message-meta">
                              {isUser ? "You" : "Brief agent"} · {formatClock(message.createdAt)}
                            </p>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  {isSending && (
                    <p className="decision-workspace-thinking" data-chat-message><Icon name="chat" size={14} /> Your brief agent is answering…</p>
                  )}
                  {chatNotice && <p className="decision-workspace-notice" role="alert">{chatNotice}</p>}
                </div>

                {attachments.length > 0 && (
                  <div className="decision-workspace-tray" aria-label="Files attached to your next question">
                    {attachments.map((file) => (
                      <span className={`decision-workspace-chip-file${file.readable ? " is-readable" : ""}`} key={file.id}>
                        <Icon name="report" size={13} />
                        <span className="decision-workspace-chip-file-name">{file.name}</span>
                        <span className="decision-workspace-chip-file-meta">
                          {formatBytes(file.size)}{file.readable ? " · agent can read" : " · name only"}
                        </span>
                        <button className="decision-workspace-chip-file-remove" type="button" onClick={() => setAttachments((current) => current.filter((item) => item.id !== file.id))} disabled={isUploading} aria-label={`Detach ${file.name}`}>
                          <Icon name="close" size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className={`decision-workspace-composer ${styles.composer}`}>
                  <input
                    ref={fileInput}
                    className="decision-workspace-file-input"
                    type="file"
                    multiple
                    accept={acceptedExtensions.join(",")}
                    onChange={(event) => {
                      if (event.target.files) void uploadFiles(event.target.files);
                      event.target.value = "";
                    }}
                    aria-label="Attach evidence files to your question"
                  />
                  <button
                    className="decision-workspace-attach"
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={isUploading || attachments.length >= MAX_ATTACHMENTS}
                    aria-label={isUploading ? "Uploading your files" : "Attach evidence files"}
                    title={isUploading ? "Uploading…" : `Attach up to ${MAX_ATTACHMENTS} files`}
                  >
                    <Icon name="plus" size={17} />
                  </button>
                  <textarea
                    ref={inputRef}
                    className="decision-workspace-input"
                    rows={3}
                    maxLength={MAX_MESSAGE_CHARS}
                    value={draft}
                    placeholder="Ask about your revenue decisions…"
                    aria-label="Message your decision workspace"
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        void sendMessage();
                      }
                    }}
                  />
                  <button className="decision-workspace-send" type="button" onClick={() => void sendMessage()} disabled={isSending || isUploading || draft.trim().length < 2} aria-label="Send message">
                    <Icon name="arrow-up" size={17} />
                  </button>
                </div>
                <p className={`decision-workspace-caption ${styles.caption}`}>AI-powered insights help you make better decisions. <span className="decision-workspace-caption-caution">Verify critical information when needed.</span></p>
              </section>
            )}
          </div>
        </main>
      </div>
      <WelcomeCopyrightFooter />
    </>
  );
}
