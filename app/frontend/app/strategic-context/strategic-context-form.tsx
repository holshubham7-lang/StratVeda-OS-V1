"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { beginOnboardingTransition } from "../../components/onboarding-route-transition";
import { setFlashNotice } from "../../components/feedback-toast";
import { clearStoredDraft, isDraftEmpty, readStoredDraft, writeStoredDraft } from "../../lib/draft-storage";

type ContextValues = {
  primaryObjective: string;
  biggestConstraint: string;
  successDefinition: string;
  whyNow: string;
};

const emptyValues: ContextValues = {
  primaryObjective: "",
  biggestConstraint: "",
  successDefinition: "",
  whyNow: "",
};

const objectives = [
  "Revenue Growth", "Profitability", "Market Expansion", "Fundraising",
  "Operational Efficiency", "Customer Retention", "Product Growth", "Risk Reduction",
];

const constraints = [
  "Too Many Priorities", "Leadership Misalignment", "Slow Decision Making", "Resource Allocation",
  "Customer Churn", "Revenue Predictability", "Operational Bottlenecks", "Lack Of Visibility",
];

const draftKey = "stratveda-strategic-context-draft";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

/** Server payloads and browser drafts are both untrusted shapes. */
function toValues(source: unknown): ContextValues {
  const record = (source ?? {}) as Partial<Record<keyof ContextValues, unknown>>;
  const readText = (value: unknown) => (typeof value === "string" ? value.slice(0, 500) : "");
  const readChoice = (value: unknown, options: readonly string[]) => {
    const text = typeof value === "string" ? value : "";
    return options.includes(text) ? text : "";
  };
  return {
    primaryObjective: readChoice(record.primaryObjective, objectives),
    biggestConstraint: readChoice(record.biggestConstraint, constraints),
    successDefinition: readText(record.successDefinition),
    whyNow: readText(record.whyNow),
  };
}

function SelectField({
  id, label, value, options, onChange, error,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div className="fingerprint-field">
      <label htmlFor={id}>{label} <span className="fingerprint-required">*</span></label>
      <select
        id={id}
        name={id}
        required
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      {error && <span className="fingerprint-error" id={`${id}-error`}>{error}</span>}
    </div>
  );
}

function LongTextField({
  id, label, value, prompt, error, onChange,
}: {
  id: "successDefinition" | "whyNow";
  label: string;
  value: string;
  prompt: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const errorId = `${id}-error`;
  const promptId = `${id}-prompt`;
  const countId = `${id}-count`;
  return (
    <div className="fingerprint-field strategic-context-textarea-field">
      <label htmlFor={id}>{label} <span className="fingerprint-required">*</span></label>
      <p className="strategic-context-prompt" id={promptId}>{prompt}</p>
      <textarea
        id={id}
        name={id}
        required
        minLength={20}
        maxLength={500}
        rows={5}
        value={value}
        placeholder="Write a few sentences..."
        aria-invalid={Boolean(error)}
        aria-describedby={`${promptId} ${countId}${error ? ` ${errorId}` : ""}`}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && <span className="fingerprint-error" id={errorId}>{error}</span>}
      <span className="strategic-context-count" id={countId} aria-live="polite">{value.length} / 500</span>
    </div>
  );
}

export function StrategicContextForm() {
  const router = useRouter();
  const [values, setValues] = useState<ContextValues>(emptyValues);
  const [errors, setErrors] = useState<Partial<Record<keyof ContextValues, string>>>({});
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    localStorage.setItem("stratveda-onboarding-resume-route", "/strategic-context");
    const draft = readStoredDraft<unknown>(draftKey);
    const hasDraft = draft !== null && !isDraftEmpty(draft);
    if (hasDraft) {
      setValues(toValues(draft));
      setNotice("Restored your unsaved answers from this browser.");
    }
    fetch(`${API_BASE}/onboarding/strategic-context`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json();
      })
      .then((result) => {
        if (!active || !result.data || hasDraft) return;
        setValues(toValues(result.data));
      })
      .catch(() => { if (active && !hasDraft) setNotice("Your saved answers could not be loaded."); });
    return () => { active = false; };
  }, []);

  const update = (field: keyof ContextValues, value: string) => {
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);
    writeStoredDraft(draftKey, nextValues);
    setErrors((current) => ({ ...current, [field]: "" }));
    setNotice("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Partial<Record<keyof ContextValues, string>> = {};
    if (!values.primaryObjective) nextErrors.primaryObjective = "Choose a primary objective.";
    if (!values.biggestConstraint) nextErrors.biggestConstraint = "Choose the biggest constraint.";
    for (const field of ["successDefinition", "whyNow"] as const) {
      const length = values[field].trim().length;
      if (length < 20 || length > 500) {
        nextErrors[field] = "Enter between 20 and 500 characters.";
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setNotice("Review the highlighted fields to define your decision focus.");
      const firstInvalid = event.currentTarget.querySelector<HTMLElement>("[aria-invalid='true']");
      firstInvalid?.focus();
      return;
    }
    setNotice("");
    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE}/onboarding/strategic-context`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...values,
          successDefinition: values.successDefinition.trim(),
          whyNow: values.whyNow.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(Array.isArray(result.message) ? result.message.join(" ") : result.message ?? "Strategic context could not be saved.");
      }
      clearStoredDraft(draftKey);
      localStorage.setItem("stratveda-onboarding-completed-step", "2");
      localStorage.setItem("stratveda-onboarding-resume-route", "/decision-profile");
      setFlashNotice({ kind: "success", title: "Your priorities are saved", message: "Your direction is captured. Next up: Where do you need better decisions?" });
      beginOnboardingTransition();
      router.push("/decision-profile");
    } catch (error) {
      setNotice(`Check your details: ${error instanceof Error ? error.message : "Strategic context could not be saved."}`);
      setIsSaving(false);
    }
  };

  return (
    <div className="fingerprint-shell">
      <div className="fingerprint-heading">
        <p className="fingerprint-eyebrow">STEP 2 OF 5</p>
        <h1>What matters most right now?</h1>
        <p className="fingerprint-intro">Set a clear direction, then share what success looks like and why this moment matters.</p>
      </div>

      <div className="fingerprint-progress" role="img" aria-label="Screen 2 of 5">
        <span className="is-complete" /><span className="is-current" /><span /><span /><span />
      </div>

      <form className="fingerprint-form strategic-context-form" noValidate onSubmit={handleSubmit}>
        <div className="fingerprint-form-heading">
          <div><span className="fingerprint-section-kicker">DECISION CONTEXT</span><h2>Define what matters</h2></div>
          <span className="fingerprint-required-note"><i>*</i> Required fields</span>
        </div>

        <div className="strategic-context-fields">
          <SelectField
            id="primaryObjective"
            label="Primary objective"
            value={values.primaryObjective}
            options={objectives}
            error={errors.primaryObjective}
            onChange={(value) => update("primaryObjective", value)}
          />
          <SelectField
            id="biggestConstraint"
            label="Biggest constraint"
            value={values.biggestConstraint}
            options={constraints}
            error={errors.biggestConstraint}
            onChange={(value) => update("biggestConstraint", value)}
          />
          <LongTextField
            id="successDefinition"
            label="Success definition"
            value={values.successDefinition}
            prompt="How will you know you’ve made meaningful progress?"
            error={errors.successDefinition}
            onChange={(value) => update("successDefinition", value)}
          />
          <LongTextField
            id="whyNow"
            label="Why now?"
            value={values.whyNow}
            prompt="What makes this the right time to focus on this objective?"
            error={errors.whyNow}
            onChange={(value) => update("whyNow", value)}
          />
        </div>

        <div className="fingerprint-form-footer">
          <p className={`fingerprint-notice${Object.keys(errors).length ? " is-error" : ""}`} role="status" aria-live="polite">{notice}</p>
          <div className="fingerprint-form-actions">
            <Link className="fingerprint-save-exit" href="/business-fingerprint">Previous</Link>
            <button className="fingerprint-continue" type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Continue"} <span aria-hidden="true">→</span></button>
          </div>
        </div>
      </form>
    </div>
  );
}
