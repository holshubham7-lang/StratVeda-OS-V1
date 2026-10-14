"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";
const ENTRY_KEY = "stratveda-workspace-entry";

type GatePhase =
  | { status: "checking" }
  | { status: "redirecting"; headline: string; detail: string }
  | { status: "needs-setup"; headline: string; detail: string; nextRoute: string }
  | { status: "allowed" };

const checkingCopy = { headline: "Checking your workspace", detail: "Confirming the setup you already saved." };
const signInCopy = { headline: "Taking you to sign in", detail: "We couldn’t find an active session on this device." };
const resumeCopy = { headline: "Picking up your setup", detail: "You’re a step short of your Decision Center — resuming where you left off." };
const choiceCopy = { headline: "Your setup isn’t finished", detail: "Continue where you left off, or open this workspace with the context you’ve already saved." };

function entryRemembered() {
  try { return sessionStorage.getItem(ENTRY_KEY) === "skipped"; } catch { return false; }
}

function rememberEntry() {
  try { sessionStorage.setItem(ENTRY_KEY, "skipped"); } catch { /* private mode: the choice just applies once */ }
}

export function WorkspaceAccessGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [phase, setPhase] = useState<GatePhase>({ status: "checking" });

  useEffect(() => {
    let active = true;
    const leave = (destination: string, copy: typeof signInCopy) => {
      if (!active) return;
      setPhase({ status: "redirecting", ...copy });
      router.replace(destination);
    };

    // Progress comes from saved documents, so a completed profile opens the
    // workspace on any device rather than only on the one that finished setup.
    fetch(`${API_BASE}/onboarding/progress`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) return leave("/sign-in", signInCopy);
        if (!response.ok) throw new Error("unavailable");
        return response.json();
      })
      .then((result) => {
        if (!active || !result) return;
        if (result.nextRoute === "/executive-brief") { setPhase({ status: "allowed" }); return; }
        // An explicit skip only applies while a session is still valid, so it can
        // never carry over to a signed-out visit or a different account.
        if (entryRemembered()) { setPhase({ status: "allowed" }); return; }
        setPhase({ status: "needs-setup", ...choiceCopy, nextRoute: result.nextRoute ?? "/welcome" });
      })
      .catch(() => leave("/welcome", resumeCopy));
    return () => { active = false; };
  }, [router]);

  const chooseSetup = () => {
    if (phase.status !== "needs-setup") return;
    setPhase({ status: "redirecting", ...resumeCopy });
    router.replace(phase.nextRoute);
  };

  const openWorkspace = () => {
    if (phase.status !== "needs-setup") return;
    rememberEntry();
    setPhase({ status: "allowed" });
  };

  if (phase.status === "allowed") return children;

  const isChoice = phase.status === "needs-setup";
  const copy = phase.status === "checking" ? checkingCopy : phase;

  return (
    <>
      <WorkspaceGateSkeleton />
      <div className={`workspace-gate-card${isChoice ? " has-actions" : ""}`} role="status" aria-live="polite">
        <span className="workspace-gate-mark" aria-hidden="true">S</span>
        <span className="workspace-gate-copy">
          <strong>{copy.headline}</strong>
          <span>{copy.detail}</span>
        </span>
        {isChoice ? (
          <span className="workspace-gate-actions">
            <button className="workspace-gate-button is-quiet" type="button" onClick={openWorkspace}>Open anyway</button>
            <button className="workspace-gate-button" type="button" onClick={chooseSetup}>Continue setup <span aria-hidden="true">→</span></button>
          </span>
        ) : (
          <span className="workspace-gate-loader" aria-hidden="true"><i /><i /><i /></span>
        )}
      </div>
    </>
  );
}

/** Stands in for the Decision Center shell so the page never flashes empty while the gate decides. */
function WorkspaceGateSkeleton() {
  return (
    <div className="workspace-gate-skeleton" aria-hidden="true">
      <header className="workspace-gate-header">
        <span className="wb wb-lg" />
        <span className="wb" />
      </header>
      <div className="workspace-gate-layout">
        <aside className="workspace-gate-side">
          <span className="wb wb-sm" />
          {[0, 1, 2, 3].map((row) => <span className="wb" key={row} />)}
          <span className="workspace-gate-side-help"><i className="wb wb-round" /><span><i className="wb" /><i className="wb wb-sm" /></span></span>
        </aside>
        <main className="workspace-gate-main">
          <div className="workspace-gate-heading">
            <span className="wb wb-sm" />
            <span className="wb wb-title" />
            <span className="wb wb-lg" />
          </div>
          <div className="workspace-gate-block"><span className="wb wb-sm" /><span className="wb wb-title" />{[0, 1, 2, 3].map((row) => <span className="wb" key={row} />)}</div>
          <div className="workspace-gate-block workspace-gate-focus"><span className="wb wb-sm" /><span className="wb wb-title" /><span className="wb wb-lg" /></div>
          <div className="workspace-gate-metrics">{[0, 1, 2].map((card) => <span key={card}><i className="wb wb-round" /><b><i className="wb wb-sm" /><i className="wb" /></b></span>)}</div>
          <div className="workspace-gate-grid">
            {[0, 1].map((panel) => (
              <div className="workspace-gate-block" key={panel}>
                <span className="wb wb-sm" /><span className="wb wb-title" />
                {[0, 1, 2].map((row) => <span className="wb" key={row} />)}
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
