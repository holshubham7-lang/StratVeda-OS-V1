"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

export function SessionRequired({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "authorized" | "rate-limited" | "unavailable">("checking");
  const [retryCount, setRetryCount] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const retryNow = () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    setState("checking");
    setRetryCount((count) => count + 1);
  };

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/auth/social/session`, { credentials: "include", cache: "no-store" })
      .then((response) => {
        if (response.status === 401) {
          router.replace("/sign-in");
          return null;
        }
        if (response.status === 429) {
          if (!active) return null;
          setState("rate-limited");
          const retryAfter = Number(response.headers.get("retry-after")) || 5;
          const delay = Math.min(Math.max(retryAfter, 2) * 1000, 60_000);
          if (retryTimer.current) clearTimeout(retryTimer.current);
          retryTimer.current = setTimeout(() => {
            if (!active) return;
            setState("checking");
            setRetryCount((count) => count + 1);
          }, delay);
          return null;
        }
        if (!response.ok) throw new Error("Session service is unavailable");
        return response.json();
      })
      .then((result) => {
        if (!active || result === null) return;
        if (result.status === true) setState("authorized");
        else setState("unavailable");
      })
      .catch(() => { if (active) setState("unavailable"); });
    return () => {
      active = false;
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [retryCount, router]);

  if (state !== "authorized") {
    return (
      <main className="session-check" aria-busy={state === "checking"} aria-label="Checking your session">
        {state === "rate-limited" && (
          <div className="session-check-message" role="status" aria-live="polite">
            <p>You’re moving faster than the sign-in service allows. We’ll retry automatically.</p>
            <button type="button" onClick={retryNow}>Try now</button>
          </div>
        )}
        {state === "unavailable" && (
          <div className="session-check-message" role="alert">
            <p>We couldn’t verify your session because the sign-in service is unavailable.</p>
            <button type="button" onClick={retryNow}>Try again</button>
          </div>
        )}
      </main>
    );
  }
  return children;
}
