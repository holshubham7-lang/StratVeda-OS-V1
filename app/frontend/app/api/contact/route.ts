import { NextResponse } from "next/server";

export const runtime = "nodejs";

const submissionsByIp = new Map<string, number[]>();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isRateLimited(ip: string, now: number) {
  const recent = (submissionsByIp.get(ip) ?? []).filter((timestamp) => now - timestamp < 60_000);
  if (recent.length >= 5) {
    submissionsByIp.set(ip, recent);
    return true;
  }
  recent.push(now);
  submissionsByIp.set(ip, recent);
  if (submissionsByIp.size > 2_000) {
    for (const [key, timestamps] of submissionsByIp) {
      if (timestamps.every((timestamp) => now - timestamp >= 60_000)) submissionsByIp.delete(key);
    }
  }
  return false;
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ message: "Send the form using the contact page." }, { status: 415 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 12_000) return NextResponse.json({ message: "The message is too large." }, { status: 413 });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "The form submission was invalid." }, { status: 400 });
  }

  // Quietly accept automated submissions caught by the hidden honeypot.
  if (clean(body.website, 300)) return NextResponse.json({ ok: true });

  const name = clean(body.name, 120);
  const email = clean(body.email, 254).toLowerCase();
  const company = clean(body.company, 160);
  const message = clean(body.message, 5_000);
  if (name.length < 2 || !emailPattern.test(email) || message.length < 10) {
    return NextResponse.json({ message: "Enter a name, a valid email address, and a message of at least 10 characters." }, { status: 400 });
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientIp = forwardedFor || request.headers.get("x-client-ip") || "unknown";
  if (isRateLimited(clientIp, Date.now())) {
    return NextResponse.json({ message: "Too many messages were sent. Please wait a minute and try again." }, { status: 429 });
  }

  const webhookUrl = process.env.TEAMS_CONTACT_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ message: "The contact form is not connected yet. Please try again later." }, { status: 503 });
  }

  let target: URL;
  try {
    target = new URL(webhookUrl);
    if (target.protocol !== "https:") throw new Error("Webhook must use HTTPS");
  } catch {
    return NextResponse.json({ message: "The contact form delivery is temporarily unavailable." }, { status: 503 });
  }

  const text = [
    "New StratVeda website enquiry",
    `Name: ${name}`,
    `Email: ${email}`,
    ...(company ? [`Company: ${company}`] : []),
    "Message:",
    message,
  ].join("\n");

  try {
    const response = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Teams workflow returned ${response.status}`);
  } catch {
    return NextResponse.json({ message: "We couldn’t deliver your message right now. Please try again shortly." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
