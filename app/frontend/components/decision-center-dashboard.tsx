"use client";

import { KeyboardEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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

type CenterData = {
  companyName: string;
  generation: BriefGeneration | null;
  masterResponse: string;
  masterCompletedAt: string;
};

type ChatMessage = {
  role: string;
  content: string;
  status?: string;
  error?: string;
  createdAt: string;
};

const emptyData: CenterData = {
  companyName: "your business",
  generation: null,
  masterResponse: "",
  masterCompletedAt: "",
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

function formatDate(value: string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
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
  const renderedCount = useRef(0);
  const [data, setData] = useState(emptyData);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [briefMessage, setBriefMessage] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(startWithChat);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState("");
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatNotice, setChatNotice] = useState("");

  const load = useCallback(async () => {
    const [business, brief, intake] = await Promise.all([
      settle(apiJson("/onboarding/business-details")),
      settle(apiJson("/onboarding/executive-brief")),
      settle(apiJson("/data-intake")),
    ]);

    const company = (business?.data ?? {}) as { companyName?: string };
    const savedBrief = (brief?.data ?? {}) as { generation?: BriefGeneration };
    const dataIntake = (intake?.data ?? {}) as { masterResponse?: unknown; completedAt?: unknown };

    setData({
      companyName: company.companyName?.trim() || emptyData.companyName,
      generation: savedBrief.generation ?? null,
      masterResponse: typeof dataIntake.masterResponse === "string" ? dataIntake.masterResponse.trim() : "",
      masterCompletedAt: typeof dataIntake.completedAt === "string" ? dataIntake.completedAt : "",
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
        .from("[data-center-brief]", { opacity: 0, y: 20, duration: 0.6 }, "-=0.25")
        .from("[data-center-ask]", { opacity: 0, y: 16, duration: 0.5 }, "-=0.3");
    }, rootRef);
    return () => context.revert();
  }, []);

  // The brief text fades in once it arrives, so the card does not pop from a placeholder.
  useEffect(() => {
    if (isLoading || !rootRef.current || prefersReducedMotion()) return;
    const body = rootRef.current.querySelector("[data-center-brief-body]");
    if (body) gsap.from(body, { opacity: 0, y: 8, duration: 0.5, ease: "power2.out" });
  }, [isLoading]);

  // Opening the chat unfolds it below the brief and moves focus into the composer.
  useIsomorphicLayoutEffect(() => {
    if (!isChatOpen) return;
    const panel = chatRef.current;
    if (panel && !prefersReducedMotion() && !startWithChat) {
      gsap.fromTo(panel, { opacity: 0, y: 18, scale: 0.985 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "power3.out" });
      gsap.from(panel.querySelectorAll("[data-chat-suggestion]"), { opacity: 0, y: 8, duration: 0.35, stagger: 0.06, delay: 0.15, ease: "power2.out" });
    }
    panel?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "nearest" });
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
    thread.scrollTo({ top: thread.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [messages, isSending]);

  // The composer grows with its text up to a few lines, like a chat app.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 200)}px`;
  }, [draft, isChatOpen]);

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

  const sendMessage = async (text?: string) => {
    const message = (text ?? draft).trim();
    if (message.length < 2 || isSending) return;
    setIsSending(true);
    setChatNotice("");
    const pending: ChatMessage = { role: "user", content: message, createdAt: new Date().toISOString() };
    setMessages((current) => [...current, pending]);
    setDraft("");
    try {
      const path = threadId ? `/workspace/threads/${threadId}/messages` : "/workspace/threads";
      const result = await apiJson(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
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
      setDraft(message);
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
    setChatNotice("");
    inputRef.current?.focus();
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const generation = data.generation;
  // The Master Agent's onboarding handover is the brief once it exists; the brief
  // agent's generation is the fallback for users who have not reached it.
  const briefFromMaster = Boolean(data.masterResponse);
  const briefIsReady = briefFromMaster || (generation?.status === "ok" && Boolean(generation.content));
  const briefSource = briefFromMaster ? data.masterResponse : generation?.content ?? "";
  const briefDate = formatDate(briefFromMaster ? data.masterCompletedAt : generation?.generatedAt);
  const canSend = draft.trim().length >= 2 && !isSending;

  return (
    <>
      <a className="skip-link" href="#decision-center-main">Skip to content</a>
      <WelcomeHeader />
      <div className="decision-center-layout">
        <DecisionCenterSidebar />

        <main id="decision-center-main" className={`decision-center-main ${styles.main}`} ref={rootRef}>
          <div className="decision-center-heading" data-center-heading>
            <div>
              <p className="decision-center-eyebrow">STRATVEDA <span>·</span> DECISION CENTER</p>
              <h1>Welcome to your Decision Center</h1>
              <p>{isLoading ? "Loading your saved context…" : `Here is your decision brief for ${data.companyName}. Ask your agent anything about it.`}</p>
            </div>
            <Link className="decision-center-edit" href="/business-fingerprint"><Icon name="brain" size={16} /> Review your profile</Link>
          </div>

          <section className={styles.brief} aria-labelledby="decision-agent-brief-title" data-center-brief>
            <header className={styles.briefHeader}>
              <span className={styles.briefMark} aria-hidden="true"><Icon name="sparkles" size={18} /></span>
              <div>
                <span className={styles.kicker}>{briefIsReady ? (briefFromMaster ? "GENERATED BY YOUR MASTER AGENT" : "GENERATED BY YOUR BRIEF AGENT") : "BRIEF AGENT"}</span>
                <h2 id="decision-agent-brief-title">Your decision brief</h2>
              </div>
              {briefIsReady
                ? <span className={styles.badge}><Icon name="check" size={13} /> {briefDate ? `Ready · ${briefDate}` : "Ready"}</span>
                : <button className={styles.secondaryButton} type="button" onClick={generateBrief} disabled={isGenerating || isLoading}>{isGenerating ? "Generating…" : generation?.status === "failed" ? "Retry brief" : "Generate brief"}</button>}
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
          </section>

          {!isChatOpen ? (
            <section className={styles.askCta} aria-labelledby="ask-agent-title" data-center-ask>
              <span className={styles.askIcon} aria-hidden="true"><Icon name="chat" size={20} /></span>
              <div className={styles.askCopy}>
                <h2 id="ask-agent-title">Have a question about your brief?</h2>
                <p>Ask your StratVeda agent for more detail, next steps, or anything that is unclear. It already knows your profile, interview and data.</p>
              </div>
              <button className={styles.primaryButton} type="button" onClick={() => setIsChatOpen(true)}>
                <Icon name="sparkles" size={16} /> Ask your agent
              </button>
            </section>
          ) : (
            <section className={styles.chat} ref={chatRef} aria-labelledby="ask-chat-title" data-center-ask>
              <header className={styles.chatHeader}>
                <div className={styles.chatTitle}>
                  <span className={styles.agentAvatar} aria-hidden="true">S</span>
                  <div>
                    <h2 id="ask-chat-title">Ask StratVeda</h2>
                    <span><i aria-hidden="true" /> Answers from your brief and saved setup</span>
                  </div>
                </div>
                <div className={styles.chatActions}>
                  {threadId && <Link className={styles.ghostButton} href="/decision-workspace">Open in workspace <Icon name="arrow-up-right" size={14} /></Link>}
                  <button className={styles.ghostButton} type="button" onClick={startNewChat} disabled={isSending || (!messages.length && !draft)}>
                    <Icon name="plus" size={14} /> New chat
                  </button>
                </div>
              </header>

              <div className={styles.thread} ref={threadRef} aria-live="polite">
                {!messages.length && !isSending ? (
                  <div className={styles.empty}>
                    <strong>What would you like to know?</strong>
                    <p>Pick a starting point or write your own question below.</p>
                    <div className={styles.suggestions}>
                      {suggestedQuestions.map((question) => (
                        <button key={question} type="button" data-chat-suggestion onClick={() => void sendMessage(question)}>
                          {question} <Icon name="arrow-right" size={13} />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <ol className={styles.messages}>
                    {messages.map((message, index) => {
                      const isUser = message.role === "user";
                      return (
                        <li className={`${styles.message} ${isUser ? styles.isUser : styles.isAgent}`} key={`${message.createdAt}-${index}`} data-chat-message>
                          {!isUser && <span className={styles.agentAvatar} aria-hidden="true">S</span>}
                          <div className={styles.bubble}>
                            {isUser
                              ? <p>{message.content}</p>
                              : message.status === "failed"
                                ? <p className={styles.failed}>The agent could not answer this one{message.error ? `: ${message.error}` : "."} Try asking again.</p>
                                : <AgentOutput source={message.content} />}
                          </div>
                        </li>
                      );
                    })}
                    {isSending && (
                      <li className={`${styles.message} ${styles.isAgent}`} data-chat-message>
                        <span className={styles.agentAvatar} aria-hidden="true">S</span>
                        <div className={`${styles.bubble} ${styles.typing}`} role="status" aria-label="StratVeda is thinking">
                          <i /><i /><i /><span>Thinking about your brief…</span>
                        </div>
                      </li>
                    )}
                  </ol>
                )}
              </div>

              <form className={styles.composerWrap} onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
                {chatNotice && <p className={styles.notice} role="alert">{chatNotice}</p>}
                <div className={styles.composer}>
                  <label className={styles.srOnly} htmlFor="decision-center-question">Ask about your decision brief</label>
                  <textarea
                    id="decision-center-question"
                    ref={inputRef}
                    rows={1}
                    maxLength={MAX_MESSAGE_CHARS}
                    value={draft}
                    disabled={isSending}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={onComposerKeyDown}
                    placeholder="Ask about your brief, a next step, or a risk…"
                  />
                  <button className={styles.send} type="submit" disabled={!canSend} aria-label="Send question">
                    <Icon name="arrow-up" size={18} />
                  </button>
                </div>
                <p className={styles.composerHint}>
                  <span>Enter to send · Shift + Enter for a new line</span>
                  {draft.length > MAX_MESSAGE_CHARS * 0.8 && <span>{draft.length}/{MAX_MESSAGE_CHARS}</span>}
                </p>
              </form>
            </section>
          )}
        </main>
      </div>
      <WelcomeCopyrightFooter />
    </>
  );
}
