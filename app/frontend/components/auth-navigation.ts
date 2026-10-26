const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";
const BUSINESS_SETUP_ROUTE = "/business-fingerprint";
const EXISTING_USER_ROUTE = "/decision-center";

export async function getPostLoginRoute(): Promise<string> {
  try {
    const response = await fetch(`${API_BASE}/onboarding/progress`, {
      credentials: "include",
      cache: "no-store",
    });
    if (response.ok) {
      const result = await response.json();
      if (result.status === true && typeof result.nextRoute === "string") {
        // Only the two business fingerprint steps gate login. Anyone past them
        // is an existing user and lands in the Decision Center; everyone else
        // resumes the unfinished fingerprint step.
        return result.nextRoute === BUSINESS_SETUP_ROUTE ? BUSINESS_SETUP_ROUTE : EXISTING_USER_ROUTE;
      }
    }
  } catch {
    // The welcome page performs its own server-session check after navigation.
  }
  return BUSINESS_SETUP_ROUTE;
}
