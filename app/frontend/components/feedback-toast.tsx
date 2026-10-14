"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type ToastNotice = {
  kind: "error" | "info" | "success";
  title: string;
  message: string;
};

export function FeedbackToast({
  notice,
  onDismiss,
}: {
  notice: ToastNotice | null;
  onDismiss: () => void;
}) {
  if (!notice) return null;

  return (
    <div className={`feedback-toast feedback-toast-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"} aria-live={notice.kind === "error" ? "assertive" : "polite"} aria-atomic="true">
      <span className="feedback-toast-icon" aria-hidden="true">
        {notice.kind === "error" ? "!" : notice.kind === "success" ? "✓" : "i"}
      </span>
      <span className="feedback-toast-copy">
        <strong>{notice.title}</strong>
        <span>{notice.message}</span>
      </span>
      <button className="feedback-toast-close" type="button" aria-label="Dismiss notification" onClick={onDismiss}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg>
      </button>
    </div>
  );
}

const flashStorageKey = "stratveda-flash-notice";

/**
 * Hands a notice to the page a redirect is about to land on, so confirmation
 * survives navigation instead of being unmounted with the form.
 */
export function setFlashNotice(notice: ToastNotice) {
  try {
    sessionStorage.setItem(flashStorageKey, JSON.stringify(notice));
  } catch { /* A blocked storage API must never block the redirect itself. */ }
}

export function FlashNoticeToast() {
  const pathname = usePathname();
  const [notice, setNotice] = useState<ToastNotice | null>(null);

  // The root layout never remounts during client navigation, so each pathname
  // change is the only signal that a form has just handed us a confirmation.
  useEffect(() => {
    let stored: ToastNotice | null = null;
    try {
      const raw = sessionStorage.getItem(flashStorageKey);
      if (raw) stored = JSON.parse(raw) as ToastNotice;
      sessionStorage.removeItem(flashStorageKey);
    } catch {
      sessionStorage.removeItem(flashStorageKey);
    }
    if (!stored || typeof stored.message !== "string" || typeof stored.title !== "string") return;
    setNotice(stored);
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [pathname]);

  return <FeedbackToast notice={notice} onDismiss={() => setNotice(null)} />;
}
