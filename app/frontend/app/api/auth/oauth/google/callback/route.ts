import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_INTERNAL_URL ?? "http://localhost:3001/api";

async function postSignupRoute(cookie?: string) {
  const cookiePair = cookie?.split(";", 1)[0];
  if (!cookiePair) return "/business-fingerprint";
  try {
    const response = await fetch(`${API_BASE}/onboarding/progress`, {
      headers: { cookie: cookiePair },
      cache: "no-store",
    });
    if (!response.ok) return "/business-fingerprint";
    const result = await response.json() as { nextRoute?: unknown };
    const route = result.nextRoute;
    return typeof route === "string" && route.startsWith("/") && !route.startsWith("//")
      ? route
      : "/business-fingerprint";
  } catch {
    return "/business-fingerprint";
  }
}

function signupRedirect(request: NextRequest, success = false, cookie?: string, nextRoute = "/business-fingerprint") {
  const destination = new URL(success ? nextRoute : "/sign-up", request.url);
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
    const cookie = response.headers.get("set-cookie") ?? undefined;
    return signupRedirect(request, true, cookie, await postSignupRoute(cookie));
  } catch {
    return signupRedirect(request);
  }
}
