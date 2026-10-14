import type { ReactNode } from "react";

export type IconName =
  | "trend" | "dashboard" | "retention" | "filter" | "sparkles" | "report"
  | "plug" | "wand" | "brain" | "rocket" | "arrow-right" | "arrow-left" | "check" | "menu"
  | "compare" | "arrow-up-right" | "check-square"
  | "linkedin" | "instagram" | "x" | "calendar" | "shield" | "close"
  | "chat" | "arrow-up" | "plus" | "plug-connected";

const iconPaths: Record<IconName, ReactNode> = {
  trend: <><path d="M4 16.5 9.2 11l3.4 3.2L20 6.5"/><path d="M14.5 6.5H20v5.4"/></>,
  dashboard: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.4"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4"/></>,
  retention: <><path d="M19.5 11.2a7.5 7.5 0 1 1-2.1-5.2"/><path d="M19.5 4v5h-5"/><path d="M8.4 13.1c.7 1.2 1.8 1.8 3.2 1.8s2.5-.6 3.2-1.8"/><path d="M9 9.2h.01M14 9.2h.01"/></>,
  filter: <><path d="M4 5h16l-6.2 7.2v5.1l-3.6 1.8v-6.9L4 5Z"/></>,
  sparkles: <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"/><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14ZM5 2l.7 1.8L7.5 4.5l-1.8.7L5 7l-.7-1.8-1.8-.7 1.8-.7L5 2Z"/></>,
  report: <><path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 16v-2m3 2v-5m3 5v-3"/></>,
  plug: <><path d="M9 4v5m6-5v5M7 9h10v3a5 5 0 0 1-5 5v3m0-3a5 5 0 0 1-5-5V9Z"/></>,
  wand: <><path d="m4 20 11.5-11.5"/><path d="m14 5 1-2 1 2 2 1-2 1-1 2-1-2-2-1 2-1ZM20 12l.7 1.3L22 14l-1.3.7L20 16l-.7-1.3L18 14l1.3-.7L20 12Z"/><path d="m5 3 .6 1.4L7 5l-1.4.6L5 7l-.6-1.4L3 5l1.4-.6L5 3Z"/></>,
  brain: <><path d="M12 4.2a3 3 0 0 0-5.8 1.2 3.4 3.4 0 0 0-1.5 6.2A3.3 3.3 0 0 0 8 17.4a3 3 0 0 0 4 2.2V4.2Z"/><path d="M12 4.2a3 3 0 0 1 5.8 1.2 3.4 3.4 0 0 1 1.5 6.2 3.3 3.3 0 0 1-3.3 5.8 3 3 0 0 1-4 2.2V4.2ZM8 8.5c1.3 0 2 .7 2 2m6-2c-1.3 0-2 .7-2 2M8 14c1.4-.2 2.3.2 3 1m5-1c-1.4-.2-2.3.2-3 1"/></>,
  rocket: <><path d="M14.2 5.1c2.2-2.2 5.7-2.2 5.7-2.2s0 3.5-2.2 5.7l-5.5 5.5-3.5-3.5 5.5-5.5Z"/><path d="m8.7 10.6-3.5.7-2.1 2.1 4.2.7M13.5 15.4l-.7 3.5-2.1 2.1-.7-4.2"/><circle cx="15.5" cy="7.5" r="1"/><path d="M5.4 16.7c-1.7.4-2.4 1.5-2.7 2.7 1.2-.3 2.3-1 2.7-2.7Z"/></>,
  "arrow-right": <><path d="M4.5 12h14"/><path d="m12.5 6 6 6-6 6"/></>,
  "arrow-left": <><path d="M19.5 12h-14"/><path d="m11.5 6-6 6 6 6"/></>,
  check: <path d="m5 12.5 4.3 4.2L19 7"/>,
  compare: <><path d="M4 9.3h13"/><path d="m14 6.3 3 3-3 3"/><path d="M20 14.7H7"/><path d="m10 11.7-3 3 3 3"/></>,
  "arrow-up-right": <><path d="M6.5 17.5 17.5 6.5"/><path d="M9.5 6.5H17.5v8"/></>,
  "check-square": <><rect x="4" y="4" width="16" height="16" rx="3.2"/><path d="m8.4 12.3 2.5 2.5 4.7-5.3"/></>,
  menu: <><path d="M4 6.5h16M4 12h16M4 17.5h16"/></>,
  linkedin: <><path d="M6.5 9v9M6.5 6.5v.1M10.5 18v-9h4v1.3a3.5 3.5 0 0 1 6 2.5V18h-4v-4.6a1.5 1.5 0 0 0-3 0V18h-3Z"/></>,
  instagram: <><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.8" r=".8" fill="currentColor" stroke="none"/></>,
  x: <><path d="M5 4.5h4l10 15h-4l-10-15ZM5 19.5l6.1-7.2m1.8-2.1L19 4.5"/></>,
  calendar: <><rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M8 3.5v4M16 3.5v4M4 10h16"/></>,
  shield: <><path d="M12 3 19 6v5.3c0 4.6-2.8 7.8-7 9.7-4.2-1.9-7-5.1-7-9.7V6l7-3Z"/><path d="m9 12 2 2 4-4"/></>,
  close: <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"/>,
  chat: <><path d="M20.5 12.1c0 3.7-3.8 6.7-8.5 6.7-1.1 0-2.2-.2-3.2-.5L4 20.3l1.7-3.7A6.9 6.9 0 0 1 3.5 12.1C3.5 8.4 7.3 5.4 12 5.4s8.5 3 8.5 6.7Z"/><path d="M8.4 12.1h.01M12 12.1h.01M15.6 12.1h.01"/></>,
  "arrow-up": <><path d="M12 19.5V5"/><path d="m5.8 11.2 6.2-6.2 6.2 6.2"/></>,
  plus: <path d="M12 5.5v13M5.5 12h13"/>,
  "plug-connected": <><path d="M9 4v5m6-5v5M7 9h10v3a5 5 0 0 1-5 5v3m0-3a5 5 0 0 1-5-5V9Z"/><path d="m17.8 5.2 1.9 1.9 2.9-3.3"/></>,
};

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      {iconPaths[name]}
    </svg>
  );
}
