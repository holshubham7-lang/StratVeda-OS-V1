import { NextRequest, NextResponse } from "next/server";
import { getOAuthCallbackOrigin } from "../../callback-origin";

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams;
  const error = source.get("error");
  const code = source.get("code");
  const state = source.get("state");
  const page = state?.startsWith("signin.") ? "/sign-in" : "/sign-up";
  const destination = new URL(page, getOAuthCallbackOrigin(request));

  if (error || !code || !state) {
    destination.searchParams.set("error", "oauth_failed");
  } else {
    destination.searchParams.set("code", code);
    destination.searchParams.set("state", state);
  }

  return NextResponse.redirect(destination);
}
