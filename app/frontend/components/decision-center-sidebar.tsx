"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icon";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";
const THREADS_EVENT = "workspace:threads-changed";
const THREAD_SELECTED_EVENT = "workspace:thread-selected";
const THREAD_ACTIVE_EVENT = "workspace:thread-active";
const RAIL_STORAGE_KEY = "ri-workspace-sidebar-rail";
const MOBILE_BREAKPOINT = "(max-width: 760px)";
const SIDEBAR_ID = "decision-center-sidebar";

type ThreadRow = { id: string; title: string; updatedAt: string; questionCount: number };

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const items: { label: string; href: string; icon: IconName }[] = [
  { label: "Overview", href: "/decision-center", icon: "dashboard" },
  { label: "Decision Workspace", href: "/decision-workspace", icon: "chat" },
  { label: "Your First Decision Brief", href: "/executive-brief", icon: "report" },
  { label: "Business Profile", href: "/business-fingerprint", icon: "brain" },
  { label: "Connect Your Business Data", href: "/evidence-library", icon: "report" },
];

export function DecisionCenterSidebar() {
  const pathname = usePathname();
  const showsThreads = pathname === "/decision-workspace";
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [activeId, setActiveId] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [rail, setRail] = useState(false);
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const loadThreads = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/workspace/threads`, { credentials: "include", cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("Thread list unavailable.");
      setThreads(Array.isArray(result?.data) ? result.data : []);
      setState("ready");
    } catch {
      // A failed read keeps the last known list rather than pretending it is empty.
      setState((current) => (current === "ready" ? "ready" : "unavailable"));
    }
  }, []);

  useEffect(() => {
    if (!showsThreads) return;
    void loadThreads();
  }, [loadThreads, showsThreads]);

  useEffect(() => {
    if (!showsThreads) return;
    const onChanged = () => void loadThreads();
    const onActive = (event: Event) => setActiveId((event as CustomEvent<string>).detail ?? "");
    window.addEventListener(THREADS_EVENT, onChanged);
    window.addEventListener(THREAD_ACTIVE_EVENT, onActive);
    return () => {
      window.removeEventListener(THREADS_EVENT, onChanged);
      window.removeEventListener(THREAD_ACTIVE_EVENT, onActive);
    };
  }, [loadThreads, showsThreads]);

  useEffect(() => {
    setRail(window.localStorage.getItem(RAIL_STORAGE_KEY) === "1");
  }, []);

  useEffect(() => {
    const query = window.matchMedia(MOBILE_BREAKPOINT);
    const sync = () => {
      setIsMobile(query.matches);
      if (!query.matches) setOpen(false);
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const collapsed = rail && !isMobile;

  const toggle = () => {
    if (isMobile) {
      setOpen((current) => !current);
      return;
    }
    const next = !rail;
    setRail(next);
    window.localStorage.setItem(RAIL_STORAGE_KEY, next ? "1" : "0");
  };

  const openThread = (id: string) => {
    setActiveId(id);
    setOpen(false);
    window.dispatchEvent(new CustomEvent(THREAD_SELECTED_EVENT, { detail: id }));
  };

  const toggleLabel = isMobile
    ? open ? "Close menu" : "Open menu"
    : collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <>
      {isMobile && !open && (
        <button className="decision-center-sidebar-trigger" type="button" onClick={() => setOpen(true)} aria-controls={SIDEBAR_ID} aria-expanded={false}>
          <Icon name="menu" size={16} /> Menu
        </button>
      )}
      {isMobile && open && <div className="decision-center-sidebar-backdrop" aria-hidden="true" />}
      <aside className={`decision-center-sidebar${collapsed ? " is-rail" : ""}${open ? " is-open" : ""}`} id={SIDEBAR_ID} inert={isMobile && !open}>
        <div className="decision-center-sidebar-top">
          <p className="decision-center-sidebar-label">YOUR WORKSPACE</p>
          <button className="decision-center-sidebar-toggle" type="button" onClick={toggle} aria-controls={SIDEBAR_ID} aria-expanded={isMobile ? open : !collapsed} aria-label={toggleLabel} title={toggleLabel}>
            <Icon name={isMobile ? (open ? "close" : "menu") : collapsed ? "arrow-right" : "arrow-left"} size={15} />
          </button>
        </div>
        <nav aria-label="Decision Center navigation">
          {items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link className={isActive ? "is-active" : ""} href={item.href} key={item.label} aria-current={isActive ? "page" : undefined} aria-label={item.label} title={item.label}>
                <Icon name={item.icon} size={18} /><span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        {showsThreads && (
          <div className="decision-center-sidebar-threads">
            <p className="decision-center-sidebar-label">RECENT CONVERSATIONS</p>
            {state === "loading" && !threads.length && <p className="decision-center-sidebar-threads-empty">Reading your threads…</p>}
            {state === "unavailable" && <p className="decision-center-sidebar-threads-empty">Your thread list is unavailable right now. Reload this page to try again.</p>}
            {!threads.length && state !== "loading" && state !== "unavailable" && (
              <p className="decision-center-sidebar-threads-empty">No conversations yet. Ask a question in the workspace and it lands here.</p>
            )}
            {!!threads.length && (
              <ul className="decision-center-sidebar-thread-list">
                {threads.map((thread) => (
                  <li key={thread.id}>
                    <button className={thread.id === activeId ? "is-active" : ""} type="button" onClick={() => openThread(thread.id)}>
                      <span className="decision-center-sidebar-thread-title">{thread.title}</span>
                      <span className="decision-center-sidebar-thread-meta">
                        {thread.questionCount === 1 ? "1 question" : `${thread.questionCount} questions`} · {formatWhen(thread.updatedAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="decision-center-sidebar-help"><span aria-hidden="true"><Icon name="shield" size={17} /></span><p><strong>Your workspace, your pace</strong><br />Your saved context is here whenever you need it.</p></div>
      </aside>
    </>
  );
}
