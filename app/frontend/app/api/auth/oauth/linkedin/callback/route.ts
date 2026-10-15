import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams;
  const error = source.get("error");
  const code = source.get("code");
  const state = source.get("state");
  const page = state?.startsWith("signin.") ? "/sign-in" : "/sign-up";
  // `request.url` is the container-local URL behind the Azure proxy; rebuild from forwarded headers.
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const candidate = forwardedHost ?? request.nextUrl.host;
  const host = /^[a-z0-9.-]+$/.test(candidate) && !candidate.startsWith("localhost") && !candidate.startsWith("127.")
    ? candidate
    : request.nextUrl.host;
  const destination = new URL(`https://${host}${page}`);

  if (error || !code || !state) {
    destination.searchParams.set("error", "oauth_failed");
  } else {
    destination.searchParams.set("code", code);
    destination.searchParams.set("state", state);
  }

  return NextResponse.redirect(destination);
}
