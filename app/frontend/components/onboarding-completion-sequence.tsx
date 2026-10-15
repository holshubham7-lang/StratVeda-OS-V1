"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icon";

const savedSteps = [
  "UNDERSTAND YOUR BUSINESS",
  "WHAT MATTERS MOST RIGHT NOW?",
  "WHERE DO YOU NEED BETTER DECISIONS?",
  "CONNECT YOUR BUSINESS DATA",
  "YOUR FIRST DECISION BRIEF",
];

export type CompletionStatus = "running" | "ready" | "failed";

/**
 * The step ticks are animation, but completion is not: this waits for the real
 * agent call in `status` before handing off, so nobody is redirected to an empty
 * Decision Center.
 */
export function OnboardingCompletionSequence({ status, onComplete }: { status: CompletionStatus; onComplete: () => void }) {
  const [completedSteps, setCompletedSteps] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stepDelay = reduceMotion ? 250 : 540;
    const timers: ReturnType<typeof setTimeout>[] = [];

    savedSteps.forEach((_, index) => {
      timers.push(setTimeout(() => setCompletedSteps(index + 1), stepDelay * (index + 1)));
    });
    timers.push(setTimeout(() => setIsGenerating(true), stepDelay * savedSteps.length + 180));

    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (status === "running") return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finishDelay = status === "ready" ? (reduceMotion ? 150 : 320) : 600;
    setIsComplete(status === "ready");
    const timer = setTimeout(onComplete, finishDelay);
    return () => clearTimeout(timer);
  }, [status, onComplete]);

  const progress = status === "running" ? (isGenerating ? 88 : Math.round((completedSteps / savedSteps.length) * 78)) : 100;

  return (
    <div className="onboarding-completion" role="status" aria-live="polite" aria-label="Preparing your Decision Center">
      <section className="onboarding-completion-card" aria-labelledby="onboarding-completion-title">
        <div className="onboarding-completion-brand"><span aria-hidden="true">S</span> STRATVEDA</div>
        <p className="onboarding-completion-kicker">YOUR WORKSPACE IS TAKING SHAPE</p>
        <h2 id="onboarding-completion-title">Bringing your decisions into focus</h2>
        <p className="onboarding-completion-description">We’re saving your setup and preparing a useful starting view.</p>

        <ol className="onboarding-completion-steps">
          {savedSteps.map((step, index) => {
            const saved = index < completedSteps;
            const active = index === completedSteps && !isGenerating;
            return (
              <li className={saved ? "is-saved" : active ? "is-active" : ""} key={step}>
                <span className="onboarding-completion-step-icon" aria-hidden="true">{saved ? "✓" : active ? <i /> : index + 1}</span>
                <span>{step}</span>
                <strong>{saved ? "SAVED" : active ? "SAVING" : "WAITING"}</strong>
              </li>
            );
          })}
        </ol>

        <div className="onboarding-completion-generating" aria-live="polite">
          <span className={isGenerating ? "onboarding-completion-spark is-active" : "onboarding-completion-spark"} aria-hidden="true"><Icon name="sparkles" size={14} /></span>
          <span>GENERATING YOUR OVERVIEW</span>
          <strong>{status === "failed" ? "SKIPPED" : isComplete ? "READY" : isGenerating ? "IN PROGRESS" : "UP NEXT"}</strong>
        </div>

        <div className="onboarding-completion-progress-track" role="progressbar" aria-label="Preparing your Decision Center" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className="onboarding-completion-progress-label">{status === "failed" ? "Your brief agent could not be reached — you can retry it in the Decision Center" : isComplete ? "Your Decision Center is ready" : "This will only take a moment"}</p>
      </section>
    </div>
  );
}
