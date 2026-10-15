"use client";

import { useEffect, useRef, useState } from "react";
import { LogoutButton } from "./logout-button";

type SessionUserData = { name: string; email: string; picture?: string };
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

function safePictureUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function SessionUser() {
  const [user, setUser] = useState<SessionUserData | null>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/auth/social/session`, { credentials: "include", cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Session unavailable")))
      .then((result) => { if (active && result.status === true && result.user) setUser(result.user as SessionUserData); })
      .catch(() => { if (active) setUser(null); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        menuRef.current?.removeAttribute("open");
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menuRef.current?.open) {
        menuRef.current.open = false;
        menuRef.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  if (!user) return null;
  const name = user.name || "Account";
  const email = user.email || "Email unavailable";
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "A";
  const picture = safePictureUrl(user.picture);
  return (
    <details className="account-menu" ref={menuRef}>
      <summary className="account-menu-trigger" aria-label={`Account menu for ${name}`}>
        <span className="account-menu-avatar" aria-hidden="true">{picture && <img src={picture} alt="" referrerPolicy="no-referrer"/>}<span>{initials}</span></span>
        <span className="account-menu-trigger-name">{name}</span>
        <svg className="account-menu-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </summary>
      <div className="account-menu-popover">
        <div className="account-menu-identity">
          <span className="account-menu-avatar" aria-hidden="true">{picture && <img src={picture} alt="" referrerPolicy="no-referrer"/>}<span>{initials}</span></span>
          <span className="account-menu-identity-copy"><strong>{name}</strong><small>{email}</small></span>
        </div>
        <LogoutButton variant="menu"/>
      </div>
    </details>
  );
}
