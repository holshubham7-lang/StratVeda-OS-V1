const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

export async function getPostLoginRoute(): Promise<string> {
  try {
    const response = await fetch(`${API_BASE}/onboarding/progress`, {
      credentials: "include",
      cache: "no-store",
    });
    if (response.ok) {
      const result = await response.json();
      if (result.status === true && typeof result.nextRoute === "string") return result.nextRoute;
    }
  } catch {
    // The welcome page performs its own server-session check after navigation.
  }
  return "/business-fingerprint";
}
