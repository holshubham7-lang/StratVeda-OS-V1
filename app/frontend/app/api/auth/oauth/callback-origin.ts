import { NextRequest } from "next/server";

/**
 * Resolve the browser-facing origin for an OAuth callback redirect.
 * App Service can expose an internal container URL (for example localhost:8080)
 * as request.url, so production must use the explicitly configured public origin.
 */
export function getOAuthCallbackOrigin(request: NextRequest): URL {
  const configuredOrigin = process.env.APP_PUBLIC_ORIGIN?.trim();
  if (configuredOrigin) {
    const origin = new URL(configuredOrigin);
    if (origin.protocol !== "https:") {
      throw new Error("APP_PUBLIC_ORIGIN must use HTTPS.");
    }
    return new URL(origin.origin);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_PUBLIC_ORIGIN must be configured for production OAuth callbacks.");
  }

  return new URL(request.nextUrl.origin);
}
