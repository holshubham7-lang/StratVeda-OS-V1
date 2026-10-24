import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_INTERNAL_URL ?? "http://localhost:3001/api";

function signupRedirect(request: NextRequest, success = false, cookie?: string) {
  const destination = new URL(success ? "/welcome" : "/sign-up", request.url);
  if (!success) destination.searchParams.set("error", "oauth_failed");
  const response = NextResponse.redirect(destination, 303);
  if (success && cookie) response.headers.append("set-cookie", cookie);
  return response;
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const credential = form.get("credential");
  const formCsrfToken = form.get("g_csrf_token");
  const cookieCsrfToken = request.cookies.get("g_csrf_token")?.value;

  if (
    typeof credential !== "string" ||
    typeof formCsrfToken !== "string" ||
    !cookieCsrfToken ||
    formCsrfToken !== cookieCsrfToken
  ) {
    return signupRedirect(request);
  }

  try {
    const response = await fetch(`${API_BASE}/auth/social/google/signup`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: request.headers.get("origin") ?? new URL(request.url).origin,
      },
      cache: "no-store",
      body: JSON.stringify({ idToken: credential, acceptedTerms: true }),
    });
    if (!response.ok) return signupRedirect(request);

    const result = await response.json() as { status?: boolean };
    if (result.status !== true) return signupRedirect(request);
    return signupRedirect(request, true, response.headers.get("set-cookie") ?? undefined);
  } catch {
    return signupRedirect(request);
  }
}
