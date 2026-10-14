"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { beginOnboardingTransition } from "../../components/onboarding-route-transition";
import { setFlashNotice } from "../../components/feedback-toast";
import { clearStoredDraft, isDraftEmpty, readStoredDraft, writeStoredDraft } from "../../lib/draft-storage";

type ProfileValues = {
  decisionDomains: string[];
  decisionFrequency: string;
  importantDecision: string;
};

const emptyValues: ProfileValues = {
  decisionDomains: [],
  decisionFrequency: "",
  importantDecision: "",
};

const domains = [
  "Strategy", "Revenue Growth", "Sales", "Marketing", "Pricing", "Finance",
  "Operations", "Customer Success", "Hiring", "Product", "Investments",
];
const frequencies = ["Daily", "Weekly", "Monthly", "Quarterly"];
const draftKey = "stratveda-decision-profile-draft";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

/** Server payloads and browser drafts are both untrusted shapes. */
function toValues(source: unknown): ProfileValues {
  const record = (source ?? {}) as Partial<Record<keyof ProfileValues, unknown>>;
  return {
    decisionDomains: Array.isArray(record.decisionDomains) ? record.decisionDomains.filter((item): item is string => typeof item === "string" && domains.includes(item)) : [],
    decisionFrequency: typeof record.decisionFrequency === "string" && frequencies.includes(record.decisionFrequency) ? record.decisionFrequency : "",
    importantDecision: typeof record.importantDecision === "string" ? record.importantDecision.slice(0, 500) : "",
  };
}

export function DecisionProfileForm() {
  const router = useRouter();
  const [values, setValues] = useState<ProfileValues>(emptyValues);
  const [errors, setErrors] = useState<{ decisionDomains?: string; decisionFrequency?: string; importantDecision?: string }>({});
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    localStorage.setItem("stratveda-onboarding-resume-route", "/decision-profile");
    const draft = readStoredDraft<unknown>(draftKey);
    const hasDraft = draft !== null && !isDraftEmpty(draft);
    if (hasDraft) {
      setValues(toValues(draft));
      setNotice("Restored your unsaved answers from this browser.");
    }
    fetch(`${API_BASE}/onboarding/decision-profile`, { credentials: "include", cache: "no-store" })
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

  const toggleDomain = (domain: string) => {
    const nextValues = {
      ...values,
      decisionDomains: values.decisionDomains.includes(domain)
        ? values.decisionDomains.filter((item) => item !== domain)
        : [...values.decisionDomains, domain],
    };
    setValues(nextValues);
    writeStoredDraft(draftKey, nextValues);
    setErrors((current) => ({ ...current, decisionDomains: undefined }));
    setNotice("");
  };

  const update = (field: "decisionFrequency" | "importantDecision", value: string) => {
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);
    writeStoredDraft(draftKey, nextValues);
    setErrors((current) => ({ ...current, [field]: undefined }));
    setNotice("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (values.decisionDomains.length < 3) nextErrors.decisionDomains = "Choose at least 3 decision domains.";
    if (!values.decisionFrequency) nextErrors.decisionFrequency = "Choose how often these decisions come up.";
    const length = values.importantDecision.trim().length;
    if (length < 20 || length > 500) nextErrors.importantDecision = "Enter between 20 and 500 characters.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setNotice("Review the highlighted fields to continue.");
      event.currentTarget.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }
    setNotice("");
    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE}/onboarding/decision-profile`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, importantDecision: values.importantDecision.trim() }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(Array.isArray(result.message) ? result.message.join(" ") : result.message ?? "Decision profile could not be saved.");
      }
      clearStoredDraft(draftKey);
      localStorage.setItem("stratveda-onboarding-completed-step", "3");
      localStorage.setItem("stratveda-onboarding-resume-route", "/evidence-library");
      setFlashNotice({ kind: "success", title: "Your decision areas are saved", message: "Your decision profile is captured. Next up: Connect your business data." });
      beginOnboardingTransition();
      router.push("/evidence-library");
    } catch (error) {
      setNotice(`Check your details: ${error instanceof Error ? error.message : "Decision profile could not be saved."}`);
      setIsSaving(false);
    }
  };

  return (
    <div className="fingerprint-shell">
      <div className="fingerprint-heading">
        <p className="fingerprint-eyebrow">STEP 3 OF 5</p>
        <h1>Where do you need better decisions?</h1>
        <p className="fingerprint-intro">Choose the areas where your decisions have the greatest impact, then highlight what matters this quarter.</p>
      </div>

      <div className="fingerprint-progress" role="img" aria-label="Screen 3 of 5">
        <span className="is-complete" /><span className="is-complete" /><span className="is-current" /><span /><span />
      </div>

      <form className="fingerprint-form strategic-context-form" noValidate onSubmit={handleSubmit}>
        <div className="fingerprint-form-heading">
          <div><span className="fingerprint-section-kicker">DECISION DOMAIN MAPPING</span><h2>Your decision profile</h2></div>
          <span className="fingerprint-required-note"><i>*</i> Required fields</span>
        </div>

        <div className="decision-profile-fields">
          <fieldset className="fingerprint-field decision-domain-fieldset" tabIndex={-1} aria-invalid={Boolean(errors.decisionDomains)} aria-describedby={errors.decisionDomains ? "decisionDomains-error" : "decisionDomains-hint"}>
            <legend>Decision domains <span className="fingerprint-required">*</span></legend>
            <p className="strategic-context-prompt" id="decisionDomains-hint">Select at least three areas you’re responsible for.</p>
            <div className="decision-domain-options">
              {domains.map((domain) => {
                const selected = values.decisionDomains.includes(domain);
                return (
                  <label className="fingerprint-model-option decision-domain-option" key={domain}>
                    <input type="checkbox" checked={selected} onChange={() => toggleDomain(domain)} />
                    <span>{domain}</span>
                  </label>
                );
              })}
            </div>
            <span className="decision-domain-selection" aria-live="polite">{values.decisionDomains.length} selected <span>·</span> minimum 3</span>
            {errors.decisionDomains && <span className="fingerprint-error" id="decisionDomains-error" role="alert">{errors.decisionDomains}</span>}
          </fieldset>

          <div className="decision-profile-bottom">
            <div className="fingerprint-field">
              <label htmlFor="decisionFrequency">Decision frequency <span className="fingerprint-required">*</span></label>
              <select id="decisionFrequency" value={values.decisionFrequency} required aria-invalid={Boolean(errors.decisionFrequency)} aria-describedby={errors.decisionFrequency ? "decisionFrequency-error" : undefined} onChange={(event) => update("decisionFrequency", event.target.value)}>
                <option value="">How often do these decisions come up?</option>
                {frequencies.map((frequency) => <option key={frequency} value={frequency}>{frequency}</option>)}
              </select>
              {errors.decisionFrequency && <span className="fingerprint-error" id="decisionFrequency-error">{errors.decisionFrequency}</span>}
            </div>

            <div className="fingerprint-field strategic-context-textarea-field">
              <label htmlFor="importantDecision">Most important decision this quarter <span className="fingerprint-required">*</span></label>
              <p className="strategic-context-prompt" id="importantDecision-prompt">What decision needs your attention before the quarter ends?</p>
              <textarea id="importantDecision" required minLength={20} maxLength={500} rows={5} value={values.importantDecision} placeholder="Describe the decision and what’s at stake..." aria-invalid={Boolean(errors.importantDecision)} aria-describedby={`importantDecision-prompt importantDecision-count${errors.importantDecision ? " importantDecision-error" : ""}`} onChange={(event) => update("importantDecision", event.target.value)} />
              {errors.importantDecision && <span className="fingerprint-error" id="importantDecision-error">{errors.importantDecision}</span>}
              <span className="strategic-context-count" id="importantDecision-count" aria-live="polite">{values.importantDecision.length} / 500</span>
            </div>
          </div>
        </div>

        <div className="fingerprint-form-footer">
          <p className={`fingerprint-notice${Object.keys(errors).length ? " is-error" : ""}`} role="status" aria-live="polite">{notice}</p>
          <div className="fingerprint-form-actions">
            <Link className="fingerprint-save-exit" href="/strategic-context">Previous</Link>
            <button className="fingerprint-continue" type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Continue"} <span aria-hidden="true">→</span></button>
          </div>
        </div>
      </form>
    </div>
  );
}
