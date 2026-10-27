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
// At this width and above the chat is docked beside the brief; below it opens as a drawer.
const DOCK_QUERY = "(min-width: 1200px)";
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const suggestedQuestions = [
  "What should I do first this week?",
  "What are the biggest risks in this plan?",
  "Which data would make this brief stronger?",
  "Explain the decision focus simply.",
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
type Tab = "brief" | "files" | "interview";

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

/** Markdown reduced to readable text for the interview list. */
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

function fileBadge(name: string) {
  return extensionOf(name).replace(".", "").toUpperCase().slice(0, 4) || "FILE";
}

function fileStatus(file: SavedFile) {
  if (file.source === "library") return { label: "Added in chat", tone: "" };
  if (file.status === "ready") return { label: "Used in your brief", tone: styles.isReady };
  if (file.status === "blocked" || file.status === "failed") return { label: "Excluded", tone: styles.isExcluded };
  return { label: "Processing", tone: "" };
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

/** `startWithChat` opens the chat straight away on small screens (the legacy /chat route). */
export function DecisionCenterDashboard({ startWithChat = false }: { startWithChat?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLElement>(null);
  const tabPanelRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const renderedCount = useRef(0);
  const [data, setData] = useState(emptyData);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [briefMessage, setBriefMessage] = useState("");
  const [tab, setTab] = useState<Tab>("brief");
  const [isDocked, setIsDocked] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(startWithChat);
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

  useEffect(() => {
    const query = window.matchMedia(DOCK_QUERY);
    const sync = () => setIsDocked(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const chatVisible = isDocked || isDrawerOpen;

  useIsomorphicLayoutEffect(() => {
    if (!rootRef.current || prefersReducedMotion()) return;
    const context = gsap.context(() => {
      gsap.timeline({ defaults: { ease: "power3.out" } })
        .from("[data-center-heading] > *", { opacity: 0, y: 12, duration: 0.45, stagger: 0.06 })
        .from("[data-center-brief]", { opacity: 0, y: 18, duration: 0.55 }, "-=0.2")
        .from("[data-center-chat]", { opacity: 0, x: 24, duration: 0.55 }, "<0.08");
    }, rootRef);
    return () => context.revert();
  }, []);

  // Switching tabs cross-fades the panel instead of snapping.
  useEffect(() => {
    const panel = tabPanelRef.current;
    if (!panel || prefersReducedMotion()) return;
    gsap.fromTo(panel, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" });
  }, [tab, isLoading]);

  // On small screens the chat slides in as a drawer and keeps the page behind it still.
  useIsomorphicLayoutEffect(() => {
    if (isDocked || !isDrawerOpen) return;
    const panel = chatRef.current;
    if (panel && !prefersReducedMotion()) gsap.fromTo(panel, { x: "100%" }, { x: "0%", duration: 0.45, ease: "power3.out" });
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus({ preventScroll: true });
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") setIsDrawerOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [isDrawerOpen, isDocked]);

  // New messages slide in; ones already on screen stay still.
  useIsomorphicLayoutEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    const items = thread.querySelectorAll("[data-chat-message]");
    const fresh = Array.from(items).slice(renderedCount.current);
    renderedCount.current = items.length;
    if (fresh.length && !prefersReducedMotion()) {
      gsap.from(fresh, { opacity: 0, y: 10, duration: 0.35, stagger: 0.06, ease: "power2.out" });
    }
    if (items.length) thread.scrollTo({ top: thread.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [messages, isSending, chatVisible]);

  // The composer grows with its text up to a few lines.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 168)}px`;
  }, [draft, chatVisible]);

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
      // Attached files also join the evidence library, so the Files tab re-reads.
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
    inputRef.current?.focus();
  };

  const openChat = () => {
    if (isDocked) inputRef.current?.focus();
    else setIsDrawerOpen(true);
  };

  const generation = data.generation;
  // The Master Agent's onboarding handover is the brief once it exists; the brief
  // agent's generation is the fallback for users who have not reached it.
  const briefFromMaster = Boolean(data.masterResponse);
  const briefIsReady = briefFromMaster || (generation?.status === "ok" && Boolean(generation.content));
  const briefSource = briefFromMaster ? data.masterResponse : generation?.content ?? "";
  const briefDate = formatDate(briefFromMaster ? data.masterCompletedAt : generation?.generatedAt);
  const canSend = draft.trim().length >= 2 && !isSending && !isUploading;
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "brief", label: "Decision brief" },
    { key: "files", label: "Files", count: data.files.length },
    { key: "interview", label: "Interview", count: data.interview.length },
  ];

  return (
    <>
      <a className="skip-link" href="#decision-center-main">Skip to content</a>
      <WelcomeHeader />
      <div className="decision-center-layout">
        <DecisionCenterSidebar />

        <main id="decision-center-main" className={`decision-center-main ${styles.main}`} ref={rootRef}>
          <div className={styles.layout}>
            <div className={styles.content}>
              <header className={styles.heading} data-center-heading>
                <div>
                  <p className="decision-center-eyebrow">STRATVEDA <span>·</span> DECISION CENTER</p>
                  <h1>Your decision brief</h1>
                  <p>{isLoading ? "Loading your saved context…" : `Prepared for ${data.companyName}. Read it here, then ask your agent anything about it.`}</p>
                </div>
                <Link className={styles.profileLink} href="/business-fingerprint"><Icon name="brain" size={15} /> Review profile</Link>
              </header>

              <section className={styles.briefCard} aria-label="Decision brief and saved context" data-center-brief>
                <div className={styles.tabs} role="tablist" aria-label="Brief sections">
                  {tabs.map((item) => (
                    <button
                      key={item.key}
                      className={`${styles.tab}${tab === item.key ? ` ${styles.isActive}` : ""}`}
                      type="button"
                      role="tab"
                      id={`center-tab-${item.key}`}
                      aria-selected={tab === item.key}
                      aria-controls="center-tab-panel"
                      onClick={() => setTab(item.key)}
                    >
                      {item.label}
                      {item.count !== undefined && <span className={styles.tabCount}>{item.count}</span>}
                    </button>
                  ))}
                </div>

                <div className={styles.tabPanel} id="center-tab-panel" role="tabpanel" aria-labelledby={`center-tab-${tab}`} ref={tabPanelRef}>
                  {tab === "brief" && (
                    <>
                      <div className={styles.briefMeta}>
                        <span className={styles.briefSource}>
                          <span className={styles.sourceMark} aria-hidden="true"><Icon name="sparkles" size={14} /></span>
                          {briefIsReady ? (briefFromMaster ? "Written by your Master Agent" : "Written by your brief agent") : "Brief agent"}
                        </span>
                        {briefIsReady
                          ? <span className={styles.readyBadge}><Icon name="check" size={12} /> {briefDate ? `Ready · ${briefDate}` : "Ready"}</span>
                          : <button className={styles.smallButton} type="button" onClick={generateBrief} disabled={isGenerating || isLoading}>{isGenerating ? "Generating…" : generation?.status === "failed" ? "Retry brief" : "Generate brief"}</button>}
                      </div>
                      {isLoading ? (
                        <div className={styles.skeleton} aria-label="Loading your brief">
                          <span style={{ width: "92%" }} /><span style={{ width: "84%" }} /><span style={{ width: "88%" }} /><span style={{ width: "62%" }} />
                        </div>
                      ) : briefIsReady ? (
                        <div className={styles.document}><AgentOutput source={briefSource} /></div>
                      ) : (
                        <p className={styles.empty}>
                          {briefMessage
                            || generation?.error
                            || "Your decision brief is not ready yet. Finish your company data step so the Master Agent can prepare it, or generate one here."}
                        </p>
                      )}
                      {!isDocked && (
                        <button className={styles.inlineAsk} type="button" onClick={openChat}>
                          <Icon name="chat" size={16} /> Ask your agent about this brief
                        </button>
                      )}
                    </>
                  )}

                  {tab === "files" && (
                    <>
                      <p className={styles.panelIntro}>Files your agent can draw on. Attach more from the chat with <strong>+</strong>.</p>
                      {data.files.length ? (
                        <ul className={styles.fileList}>
                          {data.files.map((file, index) => {
                            const status = fileStatus(file);
                            return (
                              <li key={`${file.source}-${file.name}-${index}`}>
                                <span className={styles.fileBadge}>{fileBadge(file.name)}</span>
                                <span className={styles.fileName}>{file.name}</span>
                                <span className={`${styles.fileStatus}${status.tone ? ` ${status.tone}` : ""}`}>{status.label}</span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className={styles.empty}>{isLoading ? "Reading your files…" : "No files yet. Attach one in the chat, or add company data from your profile."}</p>
                      )}
                    </>
                  )}

                  {tab === "interview" && (
                    <>
                      <p className={styles.panelIntro}>What the discovery agent asked, and how you answered.</p>
                      {data.problemStatement && (
                        <div className={styles.problem}>
                          <span>Your problem statement</span>
                          <p>{data.problemStatement}</p>
                        </div>
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
                        <p className={styles.empty}>{isLoading ? "Reading your interview…" : "No interview questions saved yet."}</p>
                      )}
                    </>
                  )}
                </div>
              </section>
            </div>

            {!isDocked && isDrawerOpen && <div className={styles.backdrop} onClick={() => setIsDrawerOpen(false)} aria-hidden="true" />}

            {chatVisible && (
              <aside
                className={`${styles.chat}${isDocked ? "" : ` ${styles.isDrawer}`}`}
                ref={chatRef}
                aria-labelledby="ask-chat-title"
                role={isDocked ? undefined : "dialog"}
                aria-modal={isDocked ? undefined : true}
                data-center-chat
              >
                <header className={styles.chatHeader}>
                  <span className={styles.avatar} aria-hidden="true">S</span>
                  <div className={styles.chatTitle}>
                    <h2 id="ask-chat-title">Ask StratVeda</h2>
                    <p><i aria-hidden="true" /> Knows your brief, files and interview</p>
                  </div>
                  <div className={styles.chatTools}>
                    {messages.length > 0 && (
                      <button className={styles.iconButton} type="button" onClick={startNewChat} disabled={isSending} aria-label="New conversation" title="New conversation">
                        <Icon name="plus" size={16} />
                      </button>
                    )}
                    {threadId && (
                      <Link className={styles.iconButton} href="/decision-workspace" aria-label="Open in Decision Workspace" title="Open in Decision Workspace">
                        <Icon name="arrow-up-right" size={15} />
                      </Link>
                    )}
                    {!isDocked && (
                      <button className={styles.iconButton} type="button" onClick={() => setIsDrawerOpen(false)} aria-label="Close chat" title="Close">
                        <Icon name="close" size={15} />
                      </button>
                    )}
                  </div>
                </header>

                <div className={styles.thread} ref={threadRef} aria-live="polite">
                  {!messages.length && !isSending ? (
                    <div className={styles.welcome}>
                      <h3>Hi, how can I help?</h3>
                      <p>Ask about your brief, a next step, or a risk. Answers are saved to your Decision Workspace.</p>
                      <div className={styles.suggestions}>
                        {suggestedQuestions.map((question) => (
                          <button key={question} type="button" onClick={() => void sendMessage(question)} disabled={isUploading}>
                            {question}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <ol className={styles.messages}>
                      {messages.map((message, index) => {
                        const isUser = message.role !== "assistant";
                        return (
                          <li className={`${styles.message} ${isUser ? styles.isUser : styles.isAgent}`} key={`${message.createdAt}-${index}`} data-chat-message>
                            <div className={styles.bubble}>
                              {isUser ? (
                                <>
                                  <p>{message.content}</p>
                                  {message.attachments?.length ? (
                                    <span className={styles.bubbleFiles}>
                                      {message.attachments.map((file, fileIndex) => (
                                        <span key={`${file.name}-${fileIndex}`}><Icon name="report" size={12} /> {file.name}</span>
                                      ))}
                                    </span>
                                  ) : null}
                                </>
                              ) : message.status === "failed"
                                ? <p className={styles.failed}>{message.error || "The agent could not answer."} Try asking again.</p>
                                : <AgentOutput source={message.content} />}
                            </div>
                            <span className={styles.meta}>{isUser ? "You" : "StratVeda"} · {formatClock(message.createdAt)}</span>
                          </li>
                        );
                      })}
                      {isSending && (
                        <li className={`${styles.message} ${styles.isAgent}`} data-chat-message>
                          <div className={`${styles.bubble} ${styles.typing}`} role="status" aria-label="StratVeda is answering">
                            <i /><i /><i />
                          </div>
                        </li>
                      )}
                    </ol>
                  )}
                </div>

                <div className={styles.composerArea}>
                  {chatNotice && <p className={styles.notice} role="alert">{chatNotice}</p>}
                  {attachments.length > 0 && (
                    <div className={styles.tray} aria-label="Files attached to your next question">
                      {attachments.map((file) => (
                        <span className={styles.trayFile} key={file.id}>
                          <span className={styles.trayBadge}>{fileBadge(file.name)}</span>
                          <span className={styles.trayName}>{file.name}</span>
                          <span className={styles.trayMeta}>{formatBytes(file.size)}</span>
                          <button type="button" onClick={() => setAttachments((current) => current.filter((item) => item.id !== file.id))} disabled={isUploading} aria-label={`Remove ${file.name}`}>
                            <Icon name="close" size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
                    <input
                      ref={fileInput}
                      className={styles.fileInput}
                      type="file"
                      multiple
                      accept={acceptedExtensions.join(",")}
                      onChange={(event) => {
                        if (event.target.files) void uploadFiles(event.target.files);
                        event.target.value = "";
                      }}
                      aria-label="Attach files to your question"
                    />
                    <button
                      className={styles.attach}
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      disabled={isUploading || attachments.length >= MAX_ATTACHMENTS}
                      aria-label={isUploading ? "Uploading your files" : "Attach files"}
                      title={isUploading ? "Uploading…" : `Attach up to ${MAX_ATTACHMENTS} files`}
                    >
                      {isUploading ? <span className={styles.spinner} aria-hidden="true" /> : <Icon name="plus" size={18} />}
                    </button>
                    <label className={styles.srOnly} htmlFor="decision-center-question">Ask about your decision brief</label>
                    <textarea
                      id="decision-center-question"
                      ref={inputRef}
                      rows={1}
                      maxLength={MAX_MESSAGE_CHARS}
                      value={draft}
                      placeholder="Ask about your brief…"
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                          event.preventDefault();
                          void sendMessage();
                        }
                      }}
                    />
                    <button className={styles.send} type="submit" disabled={!canSend} aria-label="Send question">
                      <Icon name="arrow-up" size={18} />
                    </button>
                  </form>
                  <p className={styles.caption}>Enter to send · Shift + Enter for a new line · Verify critical figures.</p>
                </div>
              </aside>
            )}
          </div>

          {!isDocked && !isDrawerOpen && (
            <button className={styles.fab} type="button" onClick={openChat}>
              <Icon name="chat" size={18} /> Ask StratVeda
            </button>
          )}
        </main>
      </div>
      <WelcomeCopyrightFooter />
    </>
  );
}
