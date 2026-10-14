"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../../components/icon";
import { AgentOutput } from "../../components/agent-output";
import { DecisionCenterSidebar } from "../../components/decision-center-sidebar";
import { WelcomeCopyrightFooter, WelcomeHeader } from "../../components/site-chrome";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";
const THREADS_EVENT = "workspace:threads-changed";
const THREAD_SELECTED_EVENT = "workspace:thread-selected";
const THREAD_ACTIVE_EVENT = "workspace:thread-active";
const MAX_MESSAGE_CHARS = 4000;
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
// Mirrors `acceptedEvidenceExtensions` in app/backend/api/src/onboarding/evidence-item.schema.ts.
const acceptedExtensions = [".doc", ".docx", ".xls", ".xlsx", ".csv", ".json", ".pdf", ".jpg", ".jpeg", ".png"];
// Which of those the backend can turn into agent-readable text is reported per file as `readable`.

type SavedContext = {
  companyName: string;
  objective: string;
  constraint: string;
  domains: string[];
  evidenceCount: number;
  evidenceNames: string[];
  answersCount: number;
  briefStatus: string;
  briefGeneratedAt: string;
};

type Attachment = { id: string; name: string; size: number; readable: boolean };

type ChatMessage = {
  role: string;
  content: string;
  status?: string;
  model?: string;
  error?: string;
  attachments?: { name: string; size: number; readable: boolean }[];
  createdAt: string;
};

const emptyContext: SavedContext = {
  companyName: "",
  objective: "",
  constraint: "",
  domains: [],
  evidenceCount: 0,
  evidenceNames: [],
  answersCount: 0,
  briefStatus: "",
  briefGeneratedAt: "",
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extensionOf(name: string): string {
  return `.${name.split(".").pop()?.toLowerCase() ?? ""}`;
}

async function apiJson(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include", cache: "no-store", ...init });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(result.message) ? result.message.join(" ") : result.message;
    if (response.status === 429) throw new Error("You are asking quickly. Wait a minute and send it again.");
    throw new Error(typeof detail === "string" && detail ? detail : "The agent could not answer just now.");
  }
  return result;
}

/** A step can be missing (skipped, or saved on another device) without the panel losing the rest. */
async function settle<T>(promise: Promise<T>): Promise<T | null> {
  return promise.catch(() => null);
}

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatGeneratedAt(value: unknown): string {
  const raw = toText(value);
  if (!raw) return "";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function formatClock(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function DecisionWorkspaceChat() {
  const [context, setContext] = useState<SavedContext>(emptyContext);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState("");
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadContext = useCallback(async () => {
    const [business, strategic, profile, evidence, brief] = await Promise.all([
      settle(apiJson("/onboarding/business-details")),
      settle(apiJson("/onboarding/strategic-context")),
      settle(apiJson("/onboarding/decision-profile")),
      settle(apiJson("/onboarding/evidence-library")),
      settle(apiJson("/onboarding/executive-brief")),
    ]);

    const company = (business?.data ?? {}) as { companyName?: unknown };
    const contextData = (strategic?.data ?? {}) as { primaryObjective?: unknown; biggestConstraint?: unknown };
    const decisionProfile = (profile?.data ?? {}) as { decisionDomains?: unknown };
    const files = Array.isArray(evidence?.data) ? evidence.data : [];
    const savedBrief = (brief?.data ?? {}) as { answers?: unknown; generation?: { status?: unknown; generatedAt?: unknown } };

    setContext({
      companyName: toText(company.companyName),
      objective: toText(contextData.primaryObjective),
      constraint: toText(contextData.biggestConstraint),
      domains: Array.isArray(decisionProfile.decisionDomains)
        ? decisionProfile.decisionDomains.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [],
      evidenceCount: files.length,
      evidenceNames: files
        .map((item: unknown) => toText((item as { name?: unknown } | null)?.name))
        .filter((name: string) => Boolean(name))
        .slice(0, 8),
      answersCount: Array.isArray(savedBrief.answers) ? savedBrief.answers.length : 0,
      briefStatus: toText(savedBrief.generation?.status),
      briefGeneratedAt: formatGeneratedAt(savedBrief.generation?.generatedAt),
    });
    setIsLoadingContext(false);
  }, []);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const applyThread = useCallback((data: { id?: string; messages?: ChatMessage[] } | null | undefined) => {
    const list = data?.messages;
    setThreadId(toText(data?.id));
    setMessages(Array.isArray(list) ? list : []);
    setNotice("");
  }, []);

  const openThread = useCallback(async (id: string) => {
    try {
      const result = await apiJson(`/workspace/threads/${id}`);
      applyThread(result?.data);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "That conversation could not be opened.");
    }
  }, [applyThread]);

  // The sidebar lists threads, this panel reads one, so they hand off through the window.
  useEffect(() => {
    const onSelect = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (id) void openThread(id);
    };
    window.addEventListener(THREAD_SELECTED_EVENT, onSelect);
    return () => window.removeEventListener(THREAD_SELECTED_EVENT, onSelect);
  }, [openThread]);

  // The sidebar highlights whichever thread this panel is showing.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(THREAD_ACTIVE_EVENT, { detail: threadId }));
  }, [threadId]);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isSending]);

  const uploadFiles = async (fileList: FileList | File[]) => {
    const picked = [...fileList];
    if (!picked.length || isUploading) return;
    const rejected: string[] = [];
    const valid: File[] = [];
    for (const file of picked) {
      const extension = extensionOf(file.name);
      if (!acceptedExtensions.includes(extension)) rejected.push(`${file.name} isn’t a supported file type.`);
      else if (file.size > MAX_ATTACHMENT_BYTES) rejected.push(`${file.name} is larger than 25 MB.`);
      else if (!file.size) rejected.push(`${file.name} is empty.`);
      else valid.push(file);
    }
    const room = MAX_ATTACHMENTS - attachments.length;
    if (valid.length > room) rejected.push(`Only ${Math.max(room, 0)} more file${room === 1 ? "" : "s"} can be attached to one question.`);
    const accepted = valid.slice(0, Math.max(room, 0));
    if (rejected.length && !accepted.length) {
      setNotice(rejected.join(" "));
      return;
    }

    setIsUploading(true);
    setNotice("");
    try {
      const form = new FormData();
      for (const file of accepted) form.append("files", file);
      const result = await apiJson("/workspace/files", { method: "POST", body: form });
      const stored = (Array.isArray(result?.data) ? result.data : []) as Attachment[];
      setAttachments((current) => [...current, ...stored].slice(0, MAX_ATTACHMENTS));
      setNotice(rejected.length ? `${rejected.join(" ")} The rest was attached.` : "");
      // The upload also joins the evidence library, so the context panel re-reads.
      void loadContext();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Those files could not be attached.");
    } finally {
      setIsUploading(false);
    }
  };

  // Detaching only leaves the file out of the next question; it stays in the evidence library.
  const removeAttachment = (id: string) => {
    setAttachments((current) => current.filter((file) => file.id !== id));
  };

  const sendMessage = async () => {
    const message = draft.trim();
    if (!message || isSending || isUploading) return;
    const attached = attachments;
    setIsSending(true);
    setNotice("");
    // Optimistic bubble so the question is on screen while the agent runs.
    const pending: ChatMessage = {
      role: "user",
      content: message,
      attachments: attached.map((file) => ({ name: file.name, size: file.size, readable: file.readable })),
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, pending]);
    setDraft("");
    setAttachments([]);
    try {
      const path = threadId ? `/workspace/threads/${threadId}/messages` : "/workspace/threads";
      const result = await apiJson(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, attachmentIds: attached.map((file) => file.id) }),
      });
      applyThread(result?.data);
      window.dispatchEvent(new Event(THREADS_EVENT));
    } catch (error) {
      setMessages((current) => current.filter((entry) => entry !== pending));
      setDraft(message);
      setAttachments(attached);
      setNotice(error instanceof Error ? error.message : "The agent could not answer just now.");
    } finally {
      setIsSending(false);
    }
  };

  const startConversation = () => {
    setMessages([]);
    setThreadId("");
    setNotice("");
    setDraft("");
    setAttachments([]);
    window.dispatchEvent(new Event(THREADS_EVENT));
  };

  const questionCount = messages.filter((entry) => entry.role === "user").length;

  const hasSavedContext = Boolean(context.objective || context.constraint || context.domains.length);

  const briefLabel = !context.briefStatus
    ? "Not started"
    : context.briefStatus === "ok"
      ? context.briefGeneratedAt
        ? `Generated ${context.briefGeneratedAt}`
        : "Generated"
      : context.briefStatus === "failed"
        ? "Last run failed"
        : context.answersCount
          ? `${context.answersCount} answers saved`
          : "Waiting on your answers";

  const fields = [
    { label: "Primary objective", value: context.objective, chips: [] as string[] },
    { label: "Biggest constraint", value: context.constraint, chips: [] as string[] },
    { label: "Decision areas", value: context.domains.length ? `${context.domains.length} selected` : "", chips: context.domains },
    { label: "Evidence files", value: context.evidenceCount ? `${context.evidenceCount} in your library` : "", chips: context.evidenceNames },
    { label: "Brief agent", value: isLoadingContext ? "" : briefLabel, chips: [] as string[] },
  ];

  return (
    <>
      <a className="skip-link" href="#decision-workspace-main">Skip to content</a>
      <WelcomeHeader />
      <div className="decision-center-layout">
        <DecisionCenterSidebar />

        <main id="decision-workspace-main" className="decision-center-main decision-workspace-main">
          <div className="decision-workspace-shell">
            <section className="decision-workspace" aria-labelledby="decision-workspace-title">
              <header className="decision-workspace-head">
                <div>
                  <p className="decision-center-eyebrow">STRATVEDA <span>·</span> DECISION WORKSPACE</p>
                  <h1 id="decision-workspace-title">Ask your decision brief</h1>
                  <p>Keep the thread going on anything from your saved business context.</p>
                </div>
                <div className="decision-workspace-head-actions">
                  <span className={questionCount ? "decision-workspace-status is-live" : "decision-workspace-status"}>
                    <i /> {questionCount ? `${questionCount} QUESTION${questionCount === 1 ? "" : "S"} SAVED` : "READY TO ASK"}
                  </span>
                  {(questionCount > 0 || threadId) && (
                    <button className="decision-workspace-new" type="button" onClick={startConversation}>
                      <Icon name="plus" size={13} /> New conversation
                    </button>
                  )}
                </div>
              </header>

              <div className={`decision-workspace-thread${messages.length ? " is-live" : ""}`} ref={threadRef}>
                {messages.length === 0 ? (
                  <div className="decision-workspace-empty">
                    <span className="decision-workspace-empty-mark" aria-hidden="true">🤖</span>
                    <h2>How can I help you today?</h2>
                    <p>Ask a question about your saved setup and your brief agent answers from it. Each question and answer is kept in this workspace, so the thread is here when you come back.</p>
                  </div>
                ) : (
                  <ol className="decision-workspace-messages" aria-live="polite">
                    {messages.map((message, index) => (
                      <li className={`decision-workspace-message ${message.role === "assistant" ? "is-agent" : "is-you"}`} key={`${message.createdAt}-${index}`}>
                        <div className="decision-workspace-bubble">
                          {message.role !== "assistant"
                            ? <>
                              <p>{message.content}</p>
                              {message.attachments?.length ? (
                                <p className="decision-workspace-bubble-files">
                                  {message.attachments.map((file, fileIndex) => (
                                    <span key={`${file.name}-${fileIndex}`}>
                                      <Icon name="report" size={12} /> {file.name}
                                      {file.readable ? "" : " · name only"}
                                    </span>
                                  ))}
                                </p>
                              ) : null}
                            </>
                            : message.status === "failed"
                              ? <p className="decision-workspace-error"><Icon name="plug" size={14} /> {message.error || "The agent could not answer."}</p>
                              : <AgentOutput source={message.content} />}
                        </div>
                        <p className="decision-workspace-message-meta">
                          {message.role === "assistant" ? "Brief agent" : "You"} · {formatClock(message.createdAt)}
                          {message.role === "assistant" && message.model ? ` · ${message.model}` : ""}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
                {isSending && (
                  <p className="decision-workspace-thinking"><Icon name="chat" size={14} /> Your brief agent is answering…</p>
                )}
                {notice && <p className="decision-workspace-notice" role="alert">{notice}</p>}
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
                      <button className="decision-workspace-chip-file-remove" type="button" onClick={() => removeAttachment(file.id)} disabled={isUploading} aria-label={`Detach ${file.name}`}>
                        <Icon name="close" size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="decision-workspace-composer">
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
                  className="decision-workspace-input"
                  rows={4}
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
                <button className="decision-workspace-send" type="button" onClick={sendMessage} disabled={isSending || isUploading || !draft.trim()} aria-label="Send message">
                  <Icon name="arrow-up" size={17} />
                </button>
              </div>
              <p className="decision-workspace-caption">AI-powered insights help you make better decisions. <span className="decision-workspace-caption-caution">Verify critical information when needed.</span></p>
            </section>

            <aside className="decision-workspace-side" aria-labelledby="decision-workspace-side-title">
              <header className="decision-workspace-side-head">
                <div className="decision-workspace-side-top">
                  <p className="decision-center-eyebrow">SAVED CONTEXT</p>
                  <span className={hasSavedContext ? "decision-workspace-side-tag is-connected" : "decision-workspace-side-tag"}>
                    <Icon name={hasSavedContext ? "plug-connected" : "plug"} size={14} /> {isLoadingContext ? "CHECKING" : hasSavedContext ? "CONNECTED" : "NOT CONNECTED"}
                  </span>
                </div>
                <h2 id="decision-workspace-side-title">Decision Workspace</h2>
                {context.companyName && <p className="decision-workspace-side-company">Saved for {context.companyName}</p>}
              </header>

              <div className="decision-workspace-side-body">
                <h3 className="decision-workspace-side-group">What your chat can reason over</h3>
                <dl className="decision-workspace-context">
                  {fields.map((field) => (
                    <div className="decision-workspace-context-row" key={field.label}>
                      <dt>{field.label}</dt>
                      <dd className={field.value ? "" : "is-empty"}>{field.value || (isLoadingContext ? "Reading your setup…" : "Nothing saved yet")}</dd>
                      {field.chips.length > 0 && (
                        <div className="decision-workspace-chips">
                          {field.chips.map((chip) => <span className="decision-workspace-chip" key={chip}>{chip}</span>)}
                        </div>
                      )}
                    </div>
                  ))}
                </dl>
              </div>

              <footer className="decision-workspace-side-foot">
                <span><Icon name="shield" size={14} /> From your setup</span>
                <p>{hasSavedContext
                  ? "Every turn is read live from the details, context, profile, evidence list and brief you saved, then kept in your workspace so the thread stays auditable."
                  : "Finish your setup and reopen this workspace so the agent answers from your saved context."}</p>
              </footer>
            </aside>
          </div>
        </main>
      </div>
      <WelcomeCopyrightFooter />
    </>
  );
}
