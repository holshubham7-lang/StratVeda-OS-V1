"use client";

/**
 * Onboarding drafts are a safety net for unsaved typing, not a second copy of
 * the record: a form hydrates from the API and only prefers the draft when one
 * exists, then clears it as soon as the save lands. Storage failures are
 * swallowed everywhere because a blocked localStorage must never stop a user
 * from editing or saving.
 *
 * Each caller validates the shape it expects, since a draft is untrusted
 * browser state that may have been written by an older version of the form.
 */

export function readStoredDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    clearStoredDraft(key);
    return null;
  }
}

export function writeStoredDraft(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearStoredDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch { /* Nothing left to clean up. */ }
}

/** True when there is nothing worth recovering. */
export function isDraftEmpty(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "";
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every(isDraftEmpty);
  }
  return true;
}
