import type { CookieOptions } from 'express';

type SameSite = NonNullable<CookieOptions['sameSite']>;

export function authCookieBaseOptions(): CookieOptions {
  const configuredSameSite = process.env.COOKIE_SAMESITE?.toLowerCase();
  const sameSite: SameSite = configuredSameSite === 'strict' || configuredSameSite === 'none'
    ? configuredSameSite
    : configuredSameSite === 'lax'
      ? 'lax'
      : process.env.NODE_ENV === 'production' ? 'none' : 'lax';
  const configuredSecure = process.env.COOKIE_SECURE?.toLowerCase();

  return {
    httpOnly: true,
    secure: sameSite === 'none' || configuredSecure === 'true'
      || (configuredSecure !== 'false' && process.env.NODE_ENV === 'production'),
    sameSite,
    path: '/',
  };
}

export function authCookieOptions(maxAgeMs: number): CookieOptions {
  return { ...authCookieBaseOptions(), maxAge: maxAgeMs };
}
