"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WelcomeCopyrightFooter, WelcomeHeader } from "../../components/site-chrome";
import { OnboardingCompletionSequence, type CompletionStatus } from "../../components/onboarding-completion-sequence";
import { clearStoredDraft, readStoredDraft, writeStoredDraft } from "../../lib/draft-storage";

type BriefData = {
  objective: string;
  constraint: string;
  domains: string[];
  fileCount: number;
  evidenceStatus: string;
  readiness: string;
};

const recommendedQuestions = [
  "What matters most for achieving our revenue growth objective?",
  "What decision should leadership prioritize next?",
  "Where are the biggest constraints to growth?",
  "What evidence supports our current priorities?",
];
const answerDraftKey = "stratveda-executive-brief-answers";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

const emptyBrief: BriefData = {
  objective: "Not provided yet",
  constraint: "Not provided yet",
  domains: [],
  fileCount: 0,
  evidenceStatus: "No files uploaded",
  readiness: "Profile incomplete",
};

function questionFor(brief: BriefData) {
  if (brief.objective.toLowerCase() === "revenue growth") return recommendedQuestions[0];
  if (brief.fileCount > 0) return recommendedQuestions[3];
  if (brief.constraint !== "Not provided yet") return recommendedQuestions[2];
  return "What decision should leadership prioritize next?";
}

async function apiJson(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include", cache: "no-store", ...init });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(result.message) ? result.message.join(" ") : result.message;
    throw new Error(message || "Request failed.");
  }
  return result;
}

/** Server payloads and browser drafts are both untrusted shapes. */
function toAnswers(source: unknown): Record<string, string> {
  const entries = Array.isArray(source) ? source : [];
  const next: Record<string, string> = {};
  for (const entry of entries) {
    const record = (entry ?? {}) as { question?: unknown; answer?: unknown };
    if (typeof record.question === "string" && typeof record.answer === "string" && recommendedQuestions.includes(record.question)) {
      next[record.question] = record.answer.slice(0, 4000);
    }
  }
  return next;
}

export default function ExecutiveBriefPage() {
  const router = useRouter();
  const [brief, setBrief] = useState(emptyBrief);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answerNotice, setAnswerNotice] = useState("");
  const [isPreparingDecisionCenter, setIsPreparingDecisionCenter] = useState(false);
  const [sequenceStatus, setSequenceStatus] = useState<CompletionStatus>("running");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openDecisionCenter = useCallback(() => router.replace("/decision-center"), [router]);

  useEffect(() => {
    let active = true;
    const draft = readStoredDraft<unknown>(answerDraftKey);
    const draftAnswers = draft && typeof draft === "object" && !Array.isArray(draft)
      ? Object.fromEntries(Object.entries(draft as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0))
      : {};
    if (Object.keys(draftAnswers).length) {
      setAnswers(draftAnswers);
      setAnswerNotice("Restored your unsaved answers from this browser.");
      return;
    }
    apiJson("/onboarding/executive-brief")
      .then((result) => {
        if (!active) return;
        const saved = toAnswers(result.data?.answers);
        if (Object.keys(saved).length) setAnswers(saved);
      })
      .catch(() => { if (active) setAnswerNotice("Your saved answers could not be loaded."); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const get = async (path: string) => {
      const response = await fetch(`${API_BASE}${path}`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(path);
      return response.json();
    };
    Promise.all([get("/onboarding/strategic-context"), get("/onboarding/decision-profile"), get("/onboarding/evidence-library")])
      .then(([contextResult, profileResult, evidenceResult]) => {
        if (!active) return;
        const context = (contextResult.data ?? {}) as { primaryObjective?: string; biggestConstraint?: string; successDefinition?: string; whyNow?: string };
        const profile = (profileResult.data ?? {}) as { decisionDomains?: unknown; decisionFrequency?: string; importantDecision?: string };
        const files = Array.isArray(evidenceResult.data) ? evidenceResult.data : [];
        const count = files.length;
        const domains = Array.isArray(profile.decisionDomains) ? profile.decisionDomains.filter((item): item is string => typeof item === "string") : [];
        const successLength = context.successDefinition?.trim().length ?? 0;
        const whyNowLength = context.whyNow?.trim().length ?? 0;
        const decisionLength = profile.importantDecision?.trim().length ?? 0;
        const contextComplete = Boolean(context.primaryObjective && context.biggestConstraint && successLength >= 20 && successLength <= 500 && whyNowLength >= 20 && whyNowLength <= 500);
        const profileComplete = domains.length >= 3 && Boolean(profile.decisionFrequency) && decisionLength >= 20 && decisionLength <= 500;
        const isComplete = contextComplete && profileComplete;
        const readiness = !isComplete ? "Profile incomplete" : count >= 5 ? "Strong Foundation" : count >= 3 ? "Decision Foundation" : count >= 1 ? "Evidence Foundation" : "Context Established";
        setBrief({
          objective: context.primaryObjective || emptyBrief.objective,
          constraint: context.biggestConstraint || emptyBrief.constraint,
          domains,
          fileCount: count,
          evidenceStatus: count ? `${count} file${count === 1 ? "" : "s"} added` : "No files uploaded",
          readiness,
        });
      })
      .catch(() => {
        if (!active) return;
        setBrief(emptyBrief);
        setAnswerNotice("Your saved profile could not be loaded, so the brief may look incomplete.");
      });
    return () => { active = false; };
  }, []);

  const handleContinue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || isPreparingDecisionCenter) return;
    const unansweredIndex = recommendedQuestions.findIndex((question) => !answers[question]?.trim());
    if (unansweredIndex >= 0) {
      setAnswerNotice("Please answer all four questions before continuing.");
      document.getElementById(`executive-brief-answer-${unansweredIndex}`)?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      await apiJson("/onboarding/executive-brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: recommendedQuestions.map((question) => ({ question, answer: answers[question].trim() })) }),
      });
      clearStoredDraft(answerDraftKey);
      setAnswerNotice("");
      setIsPreparingDecisionCenter(true);
      setSequenceStatus("running");
    } catch (error) {
      setAnswerNotice(`Check your details: ${error instanceof Error ? error.message : "Your answers could not be saved."}`);
      setIsSubmitting(false);
      return;
    }

    // The popup waits on this call, so the Decision Center opens with a brief in it
    // — or with an honest failure the user can retry there.
    let generation: { status?: string } | null = null;
    try {
      generation = await apiJson("/onboarding/executive-brief/generate", { method: "POST" });
    } catch {
      generation = { status: "failed" };
    }
    setSequenceStatus(generation?.status === "ok" ? "ready" : "failed");
    setIsSubmitting(false);
  };

  const updateAnswer = (question: string, value: string) => {
    const nextAnswers = { ...answers, [question]: value };
    setAnswers(nextAnswers);
    setAnswerNotice("");
    writeStoredDraft(answerDraftKey, nextAnswers);
  };

  const recommendedQuestion = questionFor(brief);
  const answeredCount = recommendedQuestions.filter((question) => answers[question]?.trim()).length;

  return (
    <>
      <a className="skip-link" href="#executive-brief-main">Skip to content</a>
      <WelcomeHeader />
      <main id="executive-brief-main" className="fingerprint-page">
        <div className="fingerprint-shell executive-brief-shell">
          <div className="fingerprint-heading">
            <p className="fingerprint-eyebrow">STEP 5 OF 5</p>
            <h1>Your first decision brief</h1>
            <p className="fingerprint-intro">A first view of the context, priorities, and evidence you’ve shared.</p>
          </div>
          <div className="fingerprint-progress" role="img" aria-label="Screen 5 of 5">
            <span className="is-complete" /><span className="is-complete" /><span className="is-complete" /><span className="is-complete" /><span className="is-current" />
          </div>
          <section className="executive-brief-card" aria-labelledby="executive-brief-title">
            <div className="executive-brief-card-top"><div><span className="fingerprint-section-kicker">DECISION INTELLIGENCE OUTPUT</span><h2 id="executive-brief-title">Your Brief</h2></div><span className="executive-brief-status"><i />{brief.readiness}</span></div>
            <div className="executive-brief-summary">
              <div><span>PRIMARY OBJECTIVE</span><strong>{brief.objective}</strong></div>
              <div><span>PRIMARY CONSTRAINT</span><strong>{brief.constraint}</strong></div>
              <div className="executive-brief-domains"><span>KEY DECISION AREAS</span><div>{brief.domains.length ? brief.domains.map((domain) => <span className="executive-brief-tag" key={domain}>{domain}</span>) : <strong>Not provided yet</strong>}</div></div>
              <div><span>EVIDENCE STATUS</span><strong>{brief.evidenceStatus}</strong></div>
            </div>
            <form className="executive-brief-answer-form" onSubmit={handleContinue} noValidate>
              <div className="executive-brief-answer-heading">
                <span className="fingerprint-section-kicker">RECOMMENDED QUESTION GENERATOR</span>
                <h3>Answer these four questions</h3>
                <p>Your answers are saved as you type. Complete all four to open your workspace.</p>
              </div>
              <div className="executive-brief-question-options">
                {recommendedQuestions.map((question, index) => (
                  <div className="executive-brief-question-option" key={question}>
                    <label className="executive-brief-answer-label" htmlFor={`executive-brief-answer-${index}`}>
                      <span className="executive-brief-question-title"><span className="executive-brief-question-number" aria-hidden="true">{index + 1}</span>{question}</span>{question === recommendedQuestion && <small>RECOMMENDED</small>}
                    </label>
                    <textarea id={`executive-brief-answer-${index}`} rows={4} required value={answers[question] ?? ""} onChange={(event) => updateAnswer(question, event.target.value)} placeholder="Add your perspective, evidence, or next steps..." />
                  </div>
                ))}
              </div>
              <div className="executive-brief-answer-footer">
                <p className="fingerprint-notice" role="status" aria-live="polite">{answerNotice}</p>
                <span className="executive-brief-answer-count" aria-live="polite">{answeredCount} of {recommendedQuestions.length} answered</span>
              </div>
              <div className="executive-brief-actions"><Link className="fingerprint-save-exit" href="/business-fingerprint">Edit Profile</Link><button className="fingerprint-continue" type="submit" disabled={isSubmitting}>{isPreparingDecisionCenter ? "Preparing your Decision Center…" : "Open your workspace"} <span aria-hidden="true">→</span></button></div>
            </form>
          </section>
        </div>
      </main>
      <WelcomeCopyrightFooter />
      {isPreparingDecisionCenter && <OnboardingCompletionSequence status={sequenceStatus} onComplete={openDecisionCenter} />}
    </>
  );
}
