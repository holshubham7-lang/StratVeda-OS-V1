"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLinkedinIn } from "@fortawesome/free-brands-svg-icons";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { FeedbackToast, type ToastNotice } from "../../components/feedback-toast";
import { saveWelcomeName } from "../../components/welcome-greeting";
import { getPostLoginRoute } from "../../components/auth-navigation";
import { Brand } from "../../components/site-chrome";

type SocialConfig = {
  googleClientId?: string;
  microsoftClientId?: string;
  linkedinClientId?: string;
  linkedinRedirectUri?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
      oauth2: {
        initCodeClient: (options: {
          client_id: string;
          scope: string;
          ux_mode: "popup";
          callback: (response: { code?: string; error?: string }) => void;
        }) => { requestCode: () => void };
        };
      };
    };
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

function randomBase64Url(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createCodeChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function getSocialConfig(): Promise<SocialConfig> {
  const response = await fetch(`${API_BASE}/auth/social/config`);
  if (!response.ok) throw new Error("Could not load social sign-in settings.");
  return response.json() as Promise<SocialConfig>;
}

function GoogleMark() {
  return (
    <svg className="signup-provider-icon signup-google-mark" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"/>
      <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8V33A20 20 0 0 0 24 44Z"/>
      <path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8l6.8-5.3Z"/>
      <path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 5.8 29.5 4 24 4A20 20 0 0 0 5.8 15.1l6.8 5.3C14.2 15.6 18.7 12 24 12Z"/>
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg className="signup-provider-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#F25022" d="M1 1h10.5v10.5H1z"/><path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z"/>
      <path fill="#00A4EF" d="M1 12.5h10.5V23H1z"/><path fill="#FFB900" d="M12.5 12.5H23V23H12.5z"/>
    </svg>
  );
}

export default function SignUpPage() {
  const router = useRouter();
  const [notice, setNotice] = useState<ToastNotice | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [socialConfig, setSocialConfig] = useState<SocialConfig | null>(null);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const googleCodeClientRef = useRef<{ requestCode: () => void } | null>(null);
  const googleAttemptActiveRef = useRef(false);

  useEffect(() => {
    let cancelTimer: number | undefined;
    const handleWindowFocus = () => {
      if (!googleAttemptActiveRef.current) return;
      cancelTimer = window.setTimeout(() => {
        if (!googleAttemptActiveRef.current) return;
        googleAttemptActiveRef.current = false;
        setBusyProvider((current) => current === "google" ? null : current);
        setNotice({ kind: "error", title: "Check your details", message: "Google sign-in was cancelled." });
      }, 800);
    };
    window.addEventListener("focus", handleWindowFocus);
    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      if (cancelTimer !== undefined) window.clearTimeout(cancelTimer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    getSocialConfig()
      .then((config) => { if (active) setSocialConfig(config); })
      .catch(() => { if (active) showNotice("The sign-in service is unavailable. Please try again shortly.", "error"); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!socialConfig?.googleClientId) return;

    const initializeGoogleCodeClient = () => {
      if (!window.google?.accounts.oauth2) return;
      googleCodeClientRef.current = window.google.accounts.oauth2.initCodeClient({
        client_id: socialConfig.googleClientId!,
        scope: "openid email profile",
        ux_mode: "popup",
        callback: (response) => { void handleGoogleCodeResponse(response); },
      });
    };

    if (window.google?.accounts.oauth2) { initializeGoogleCodeClient(); return; }
    const script = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')
      ?? document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", initializeGoogleCodeClient, { once: true });
    if (!script.isConnected) document.head.appendChild(script);
  }, [socialConfig]);

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const loginComplete = fragment.get("social_login") === "success";
    if (loginComplete) {
      saveWelcomeName(fragment.get("name") ?? "");
      window.history.replaceState({}, "", window.location.pathname);
      void getPostLoginRoute().then((route) => router.push(route));
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const providerError = params.get("error_description") ?? params.get("error");
    if (providerError) {
      googleAttemptActiveRef.current = false;
      setBusyProvider(null);
      window.history.replaceState({}, "", window.location.pathname);
      showNotice("Sign-in was cancelled or rejected by the provider.", "error");
      return;
    }
    if (!code) return;

    const returnedState = params.get("state");
    const microsoftState = window.sessionStorage.getItem("microsoft_oauth_state");
    if (microsoftState) {
      const verifier = window.sessionStorage.getItem("microsoft_oauth_verifier");
      const nonce = window.sessionStorage.getItem("microsoft_oauth_nonce");
      window.sessionStorage.removeItem("microsoft_oauth_state");
      window.sessionStorage.removeItem("microsoft_oauth_verifier");
      window.sessionStorage.removeItem("microsoft_oauth_nonce");
      window.history.replaceState({}, "", window.location.pathname);
      if (!returnedState || returnedState !== microsoftState || !verifier || !nonce) {
        showNotice("Microsoft sign-in could not be verified. Please try again.", "error");
        return;
      }
      setBusyProvider("microsoft");
      void exchangeMicrosoftCode(code, verifier, nonce).finally(() => setBusyProvider(null));
      return;
    }

    const savedState = window.sessionStorage.getItem("linkedin_oauth_state");
    window.sessionStorage.removeItem("linkedin_oauth_state");
    window.history.replaceState({}, "", window.location.pathname);
    if (!returnedState || !savedState || returnedState !== savedState) {
      showNotice("LinkedIn sign-in could not be verified. Please try again.", "error");
      return;
    }

    setBusyProvider("linkedin");
    void postSocialSignup("linkedin/exchange", { code }).finally(() => setBusyProvider(null));
  }, []);

  async function exchangeMicrosoftCode(code: string, verifier: string, expectedNonce: string) {
    await postSocialSignup("microsoft/exchange", {
      code,
      codeVerifier: verifier,
      nonce: expectedNonce,
    });
  }

  async function postSocialSignup(path: string, body: object, extraHeaders: Record<string, string> = {}) {
    const payload = { ...body, acceptedTerms: true };
    try {
      const response = await fetch(`${API_BASE}/auth/social/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...extraHeaders },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Sign-up could not be completed.");
      if (result.status !== true) throw new Error("Sign-in could not be completed.");
      saveWelcomeName("");
      router.push(await getPostLoginRoute());
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Sign-up could not be completed.", "error");
    }
  }

  async function handleCreateAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = form.elements.namedItem("name") as HTMLInputElement;
    const email = form.elements.namedItem("email") as HTMLInputElement;
    const password = form.elements.namedItem("password") as HTMLInputElement;

    if (!name.value.trim()) {
      showNotice("Please enter your full name.", "error");
      name.focus();
      return;
    }
    if (!email.checkValidity()) {
      showNotice("Please enter a valid work email address.", "error");
      email.focus();
      return;
    }
    if (password.value.length < 8) {
      showNotice("Your password must be at least 8 characters long.", "error");
      password.focus();
      return;
    }
    setBusyProvider("password");
    try {
      const response = await fetch(`${API_BASE}/auth/manual/signup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.value.trim(), email: email.value.trim(), password: password.value, acceptedTerms: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Account creation could not be completed.");
      saveWelcomeName(name.value.trim());
      router.push(await getPostLoginRoute());
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Account creation could not be completed.", "error");
    } finally {
      setBusyProvider(null);
    }
  }

  function showNotice(message: string, kind: ToastNotice["kind"] = "info") {
    setNotice({ kind, title: kind === "error" ? "Check your details" : "Sign-up unavailable", message });
  }

  function handleGoogleSignup() {
    if (!googleCodeClientRef.current) {
      showNotice("Google sign-in is not ready yet. Please try again shortly.", "error");
      return;
    }
    googleAttemptActiveRef.current = true;
    setBusyProvider("google");
    try {
      googleCodeClientRef.current.requestCode();
    } catch {
      googleAttemptActiveRef.current = false;
      setBusyProvider(null);
      showNotice("Google sign-in could not be started. Please try again.", "error");
    }
  }

  async function handleGoogleCodeResponse(response: { code?: string; error?: string }) {
    googleAttemptActiveRef.current = false;
    if (!response.code || response.error) {
      setBusyProvider(null);
      showNotice("Google sign-in was cancelled or could not be completed.", "error");
      return;
    }
    try {
      await postSocialSignup("google/exchange", { code: response.code }, { "X-Requested-With": "XmlHttpRequest" });
    } finally {
      setBusyProvider(null);
    }
  }

  async function handleMicrosoftSignup() {
    if (!socialConfig?.microsoftClientId) {
      showNotice("Microsoft sign-in is not configured.", "error");
      return;
    }
    setBusyProvider("microsoft");
    try {
      const state = `signup.${randomBase64Url()}`;
      const nonce = randomBase64Url();
      const verifier = randomBase64Url(48);
      const challenge = await createCodeChallenge(verifier);
      window.sessionStorage.setItem("microsoft_oauth_state", state);
      window.sessionStorage.setItem("microsoft_oauth_nonce", nonce);
      window.sessionStorage.setItem("microsoft_oauth_verifier", verifier);
      const authorizeUrl = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
      authorizeUrl.search = new URLSearchParams({
        client_id: socialConfig.microsoftClientId,
        response_type: "code",
        response_mode: "query",
        redirect_uri: `${window.location.origin}/api/auth/oauth/microsoft/callback`,
        scope: "openid profile email",
        state,
        nonce,
        code_challenge: challenge,
        code_challenge_method: "S256",
        prompt: "select_account",
      }).toString();
      window.location.assign(authorizeUrl.toString());
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Microsoft sign-in could not be completed.", "error");
      setBusyProvider(null);
    }
  }

  function handleLinkedInSignup() {
    if (!socialConfig?.linkedinClientId) {
      showNotice("LinkedIn sign-in is not configured.", "error");
      return;
    }
    const state = `signup.${crypto.randomUUID()}`;
    window.sessionStorage.setItem("linkedin_oauth_state", state);
    const authorizeUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
    authorizeUrl.search = new URLSearchParams({
      response_type: "code",
      client_id: socialConfig.linkedinClientId,
      redirect_uri: `${window.location.origin}/api/auth/oauth/linkedin/callback`,
      scope: "openid profile email",
      state,
    }).toString();
    setBusyProvider("linkedin");
    window.location.assign(authorizeUrl.toString());
  }

  return (
    <main className="signup-page">
      <section className="signup-layout" aria-label="Create your Decision Intelligence account">
        <aside className="signup-story">
          <Brand />
          <div className="signup-story-copy">
            <span className="signup-kicker"><i/> DECISION INTELLIGENCE, IN FOCUS</span>
            <h1>Make your next revenue move with confidence.</h1>
            <p>Bring pipeline, billing, and retention into one clear view, then turn the signals into action.</p>
          </div>
          <div className="signup-preview" aria-label="Sample revenue overview">
            <div className="signup-preview-top"><span>REVENUE OVERVIEW</span><span className="signup-live"><i/> LIVE</span></div>
            <div className="signup-preview-value"><span>Forecast ARR</span><strong>$4.82M</strong><small>↑ 18.4% this quarter</small></div>
            <svg className="signup-preview-chart" viewBox="0 0 440 92" preserveAspectRatio="none" role="img" aria-label="Illustrative upward revenue forecast">
              <defs><linearGradient id="signupChartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#a6d9b7" stopOpacity=".32"/><stop offset="1" stopColor="#a6d9b7" stopOpacity="0"/></linearGradient></defs>
              <path d="M0 76 C38 72 50 64 82 66 S133 60 164 53 S218 57 251 41 S309 46 343 26 S396 26 440 8 V92 H0Z" fill="url(#signupChartFill)"/>
              <path d="M0 76 C38 72 50 64 82 66 S133 60 164 53 S218 57 251 41 S309 46 343 26 S396 26 440 8" fill="none" stroke="#85c59b" strokeWidth="3" strokeLinecap="round"/>
            </svg>
            <div className="signup-preview-footer"><span>ONE REVENUE MODEL</span><span>BUILT FOR YOUR TEAM</span></div>
          </div>
          <p className="signup-privacy"><span aria-hidden="true">✓</span> Read-only data connections. Your source systems stay yours.</p>
        </aside>

        <section className="signup-panel" aria-labelledby="signup-title">
          <div className="signup-panel-mobile-brand">
            <Brand compact/>
          </div>
          <div className="signup-form-wrap">
            <span className="signup-eyebrow">GET STARTED</span>
            <h2 id="signup-title">Create your account</h2>
            <p className="signup-subtitle">Choose how you’d like to create your account.</p>

            <div className="signup-provider-list" aria-label="Sign up with a provider">
              <button className="signup-provider-button" type="button" onClick={handleGoogleSignup} disabled={busyProvider !== null}><GoogleMark/><span>{busyProvider === "google" ? "Connecting…" : "Continue with Google"}</span></button>
              <button className="signup-provider-button" type="button" onClick={() => void handleMicrosoftSignup()} disabled={busyProvider !== null}><MicrosoftMark/><span>{busyProvider === "microsoft" ? "Connecting…" : "Sign in with Microsoft"}</span></button>
              <button className="signup-provider-button" type="button" onClick={handleLinkedInSignup} disabled={busyProvider !== null}><span className="signup-linkedin-mark"><FontAwesomeIcon icon={faLinkedinIn} aria-hidden="true"/></span><span>{busyProvider === "linkedin" ? "Connecting…" : "Sign in with LinkedIn"}</span></button>
            </div>

            <div className="signup-divider"><span>OR REGISTER WITH YOUR EMAIL</span></div>
            <form className="signup-manual-form" onSubmit={handleCreateAccount} noValidate>
              <label htmlFor="signup-name">Full name</label>
              <input id="signup-name" name="name" type="text" autoComplete="name" placeholder="Alex Morgan" maxLength={80} required/>
              <label htmlFor="signup-email">Work email</label>
              <input id="signup-email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required/>
              <label htmlFor="signup-password">Password</label>
              <div className="signup-password-wrap">
                <input id="signup-password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="At least 8 characters" minLength={8} required/>
                <button className="signup-password-toggle" type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
                  <FontAwesomeIcon icon={showPassword ? faEye : faEyeSlash} aria-hidden="true"/>
                </button>
              </div>
              <button className="signup-create-button" type="submit" disabled={busyProvider !== null}>{busyProvider === "password" ? "Creating account…" : <>Create account <span aria-hidden="true">→</span></>}</button>
              <p className="signup-form-note">Use at least 8 characters for your password.</p>
            </form>
            <p className="signup-legal">By creating an account or continuing with a provider, you agree to StratVeda's <a href="/terms" target="_blank" rel="noopener noreferrer">Terms &amp; Conditions</a> and acknowledge the <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</p>
            <p className="signup-switch">Already have an account? <a href="/sign-in">Sign in</a></p>
          </div>
        </section>
      </section>
      <FeedbackToast notice={notice} onDismiss={() => setNotice(null)}/>
    </main>
  );
}
