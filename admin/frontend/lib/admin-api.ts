export const API = (process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL || 'http://localhost:8080/api').replace(/\/$/, '');

const COOKIE_FALLBACK = 'Your session is valid but the browser cannot send its cookie. Check cookie settings, then sign in again.';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

function describeError(status: number, payload: unknown): string {
  const raw = (payload as { message?: string | string[] } | null)?.message;
  const text = (Array.isArray(raw) ? raw[0] : raw ?? '').toString().replace(/^([A-Za-z]*Exception):\s*/i, '').trim();
  if (status === 401) return text || 'Your session has ended. Please sign in again.';
  if (status === 403) return text || 'This request was not accepted from this origin.';
  if (status === 429) return text || 'Too many attempts. Please wait a minute before trying again.';
  return text || COOKIE_FALLBACK;
}

export const ENV_LABEL = process.env.NEXT_PUBLIC_ADMIN_ENV_LABEL || 'Development';

export async function probeHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API}/health`, { method: 'GET' });
    if (!response.ok) return false;
    const data = await response.json().catch(() => null) as { status?: string } | null;
    return data?.status === 'ok';
  } catch {
    return false;
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init?.headers } });
  } catch {
    throw new ApiError('The admin service is unreachable. Check your connection and try again.', 0);
  }
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(describeError(response.status, data), response.status);
  return data as T;
}
