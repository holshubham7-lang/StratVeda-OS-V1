"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";
const SESSION_KEYS = [
  "stratvedaWelcomeName",
  "microsoft_oauth_state",
  "microsoft_oauth_nonce",
  "microsoft_oauth_verifier",
  "linkedin_oauth_state",
];

function clearSessionData() {
  for (const key of SESSION_KEYS) {
    try { window.sessionStorage.removeItem(key); } catch { /* Storage may be unavailable in private browsing. */ }
  }
}

export function LogoutButton({ variant = "header" }: { variant?: "header" | "menu" }) {
  const [loggingOut, setLoggingOut] = useState(false);
  const logoutStarted = useRef(false);

  const logout = useCallback(async (broadcast: boolean) => {
    if (logoutStarted.current) return;
    logoutStarted.current = true;
    setLoggingOut(true);

    clearSessionData();

    if (broadcast && "BroadcastChannel" in window) {
      const channel = new BroadcastChannel("stratveda-auth-session");
      channel.postMessage("logout");
      channel.close();
    }

    try {
      await fetch(`${API_BASE}/auth/social/logout`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      });
    } catch { /* Local session data is cleared even if the API is unavailable. */ }

    window.location.replace("/sign-in");
  }, []);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel("stratveda-auth-session");
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (event.data === "logout") void logout(false);
    };
    return () => channel.close();
  }, [logout]);

  return (
    <button className={`app-shell-logout${variant === "menu" ? " account-menu-logout" : ""}`} type="button" onClick={() => void logout(true)} disabled={loggingOut}>
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M8 3H4.5A1.5 1.5 0 0 0 3 4.5v11A1.5 1.5 0 0 0 4.5 17H8M12 6l4 4-4 4m4-4H7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
      {loggingOut ? "Signing out…" : variant === "menu" ? "Sign out" : "Log out"}
    </button>
  );
}
