const MINIMUM_SESSION_SECONDS = 24 * 60 * 60;

/** Keep sessions valid for at least 24 hours, even if a shorter value is configured. */
export function jwtLifetimeSeconds(value?: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value?.trim() ?? "");
  if (!match) return MINIMUM_SESSION_SECONDS;

  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 } as const;
  const configuredSeconds = Number(match[1]) * multipliers[match[2] as keyof typeof multipliers];
  if (!Number.isSafeInteger(configuredSeconds)) return MINIMUM_SESSION_SECONDS;
  return Math.max(MINIMUM_SESSION_SECONDS, configuredSeconds);
}
