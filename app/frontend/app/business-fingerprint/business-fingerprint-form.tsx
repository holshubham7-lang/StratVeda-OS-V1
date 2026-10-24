"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { beginOnboardingTransition } from "../../components/onboarding-route-transition";
import { setFlashNotice } from "../../components/feedback-toast";
import { countryPhoneCodes } from "./country-phone-codes";

type BusinessDetails = {
  companyName: string;
  website: string;
  industry: string;
  businessModel: string;
  teamSize: string;
  revenueRange: string;
  companyStage: string;
  country: string;
  state: string;
  city: string;
};

const emptyDetails: BusinessDetails = {
  companyName: "", website: "", industry: "", businessModel: "", teamSize: "",
  revenueRange: "", companyStage: "", country: "", state: "", city: "",
};

const businessModelOptions = ["SaaS", "Services", "Marketplace", "Manufacturing", "Ecommerce", "Consulting", "Agency", "Subscription", "Enterprise Software", "Other"];
const industries = ["Technology", "Financial Services", "Healthcare", "Retail & Ecommerce", "Manufacturing", "Professional Services", "Education", "Media & Entertainment", "Logistics & Transportation", "Energy", "Real Estate", "Other"];
const teamSizes = ["Just me", "2–10", "11–50", "51–200", "201–500", "501–1,000", "1,001–5,000", "5,001+"];
const revenueRanges = ["Pre-revenue", "Under $100K", "$100K–$500K", "$500K–$1M", "$1M–$5M", "$5M–$20M", "$20M–$100M", "$100M+"];
const companyStages = ["Ideation", "Validation", "Early Revenue", "Growth", "Scale", "Enterprise"];
const roles = ["Founder / Co-founder", "Owner", "CEO / Managing Director", "C-suite executive", "VP / Director", "Revenue Operations", "Sales", "Marketing", "Finance", "Operations", "Other"];
const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
const phoneCountries = Object.entries(countryPhoneCodes)
  .map(([id, callingCode]) => ({
    id,
    callingCode,
    name: countryNames.of(id) ?? id,
    flag: Array.from(id).map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0))).join(""),
  }))
  .sort((left, right) => left.name.localeCompare(right.name));
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";
const draftStorageKey = "stratveda-business-fingerprint-draft";

type PersonalProfile = { name: string; email: string };

function normalizedWebsite(value: string) {
  const website = value.trim();
  if (!website) return "";
  return /^[a-z][a-z\d+.-]*:\/\//i.test(website) ? website : `https://${website}`;
}

function readDraft(): BusinessDetails | null {
  try {
    const raw = localStorage.getItem(draftStorageKey);
    if (!raw) return null;
    const draft = { ...emptyDetails, ...(JSON.parse(raw) as Partial<BusinessDetails>) };
    return Object.values(draft).some((value) => typeof value === "string" && value.trim() !== "") ? draft : null;
  } catch {
    localStorage.removeItem(draftStorageKey);
    return null;
  }
}

function SelectField({ id, label, value, options, placeholder, error, onChange }: {
  id: string; label: string; value: string; options: string[]; placeholder: string; error?: string; onChange: (value: string) => void;
}) {
  return (
    <div className="fingerprint-field">
      <label htmlFor={id}>{label} <span className="fingerprint-required">*</span></label>
      <select id={id} required aria-required="true" value={value} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      {error && <span className="fingerprint-error" id={`${id}-error`}>{error}</span>}
    </div>
  );
}

function LocationFields({ details, errors, update }: {
  details: BusinessDetails;
  errors: Record<string, string>;
  update: (field: keyof BusinessDetails, value: string) => void;
}) {
  return (
    <section className="fingerprint-form-section" aria-labelledby="location-heading">
      <div className="fingerprint-section-heading"><span className="fingerprint-section-number">04</span><div><h3 id="location-heading">Where you’re based</h3><p>Choose your company’s primary location.</p></div></div>
      <div className="fingerprint-location-grid">
        <div className="fingerprint-field">
          <label htmlFor="country">Country <span className="fingerprint-required">*</span></label>
          <input id="country" name="country" autoComplete="country-name" required value={details.country} maxLength={100} aria-invalid={Boolean(errors.country)} aria-describedby={errors.country ? "country-error" : undefined} onChange={(event) => update("country", event.target.value)} placeholder="Enter country" />
          {errors.country && <span className="fingerprint-error" id="country-error">{errors.country}</span>}
        </div>
        <div className="fingerprint-field">
          <label htmlFor="state">State / province <span className="fingerprint-optional">Optional</span></label>
          <input id="state" name="state" autoComplete="address-level1" value={details.state} maxLength={100} onChange={(event) => update("state", event.target.value)} placeholder="Enter state or province" />
        </div>
        <div className="fingerprint-field">
          <label htmlFor="city">City <span className="fingerprint-optional">Optional</span></label>
          <input id="city" name="city" autoComplete="address-level2" value={details.city} maxLength={100} aria-invalid={Boolean(errors.city)} aria-describedby={errors.city ? "city-error" : "city-hint"} onChange={(event) => update("city", event.target.value)} placeholder="Enter city" />
          {errors.city ? <span className="fingerprint-error" id="city-error">{errors.city}</span> : <span className="fingerprint-hint" id="city-hint">Maximum 100 characters.</span>}
        </div>
      </div>
    </section>
  );
}
export function BusinessFingerprintForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [profile, setProfile] = useState<PersonalProfile>({ name: "", email: "" });
  const [phoneCountry, setPhoneCountry] = useState("IN");
  const [mobileNumber, setMobileNumber] = useState("");
  const [role, setRole] = useState("");
  const [details, setDetails] = useState<BusinessDetails>(emptyDetails);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    localStorage.setItem("stratveda-onboarding-resume-route", "/business-fingerprint");
    fetch(`${API_BASE}/auth/social/session`, { credentials: "include", cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((result) => {
        if (!active || !result?.user) return;
        setProfile({ name: result.user.name ?? "", email: result.user.email ?? "" });
      })
      .catch(() => {});
    const draft = readDraft();
    if (draft) {
      setDetails(draft);
      setNotice("Restored your unsaved answers from this browser.");
    }
    fetch(`${API_BASE}/onboarding/business-details`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Saved company details could not be loaded.");
        return response.json();
      })
      .then((result) => {
        if (!active || !result.data || draft) return;
        const saved = result.data as Partial<BusinessDetails> & { businessModels?: string[] };
        setDetails({
          companyName: saved.companyName ?? "", website: saved.website ?? "", industry: saved.industry ?? "",
          businessModel: saved.businessModel ?? saved.businessModels?.[0] ?? "", teamSize: saved.teamSize ?? "",
          revenueRange: saved.revenueRange ?? "", companyStage: saved.companyStage ?? "", country: saved.country ?? "",
          state: saved.state ?? "", city: saved.city ?? "",
        });
      })
      .catch((error) => { if (active && !draft) setNotice(error instanceof Error ? error.message : "Saved details could not be loaded."); });
    return () => { active = false; };
  }, []);

  const update = (field: keyof BusinessDetails, value: string) => {
    const nextDetails = { ...details, [field]: value };
    setDetails(nextDetails);
    try { localStorage.setItem(draftStorageKey, JSON.stringify(nextDetails)); } catch { /* Keep editing if browser storage is unavailable. */ }
    setErrors((current) => ({ ...current, [field]: "" }));
    setNotice("");
  };

  const validate = () => {
    const next: Record<string, string> = {};
    const companyName = details.companyName.trim();
    if (companyName.length < 2 || companyName.length > 100) next.companyName = "Enter a company name between 2 and 100 characters.";
    if (details.website.trim()) {
      try {
        const url = new URL(normalizedWebsite(details.website));
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Invalid website");
        if (!url.hostname.includes(".")) throw new Error("Invalid website");
      } catch { next.website = "Enter a valid website URL, including https://."; }
    }
    if (!details.industry) next.industry = "Choose an industry.";
    // The API still requires businessModel. It is hidden until the backend contract is updated.
    if (!details.teamSize) next.teamSize = "Choose a team size.";
    if (!details.revenueRange) next.revenueRange = "Choose a revenue range.";
    if (!details.companyStage) next.companyStage = "Choose a company stage.";
    if (!details.country.trim()) next.country = "Enter your country.";
    if (details.city.trim().length > 100) next.city = "City must be 100 characters or fewer.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const saveDetails = async () => {
    if (!validate()) {
      setNotice("Check the required fields before continuing.");
      return false;
    }
    setIsSaving(true);
    setNotice("");
    try {
      const response = await fetch(`${API_BASE}/onboarding/business-details`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...details, website: normalizedWebsite(details.website), companyName: details.companyName.trim(), country: details.country.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(" ") : result.message ?? "Company details could not be saved.");
      localStorage.removeItem(draftStorageKey);
      localStorage.setItem("stratveda-onboarding-completed-step", "1");
      localStorage.setItem("stratveda-onboarding-resume-route", "/strategic-context");
      return true;
    } catch (error) {
      setNotice(`Check your details: ${error instanceof Error ? error.message : "Company details could not be saved."}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleContinue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === 1) { setStep(2); setNotice(""); return; }
    if (!await saveDetails()) return;
    setFlashNotice({ kind: "success", title: "Company profile saved", message: "Your business details are on file. Next up: What matters most right now?" });
    beginOnboardingTransition();
    router.push("/strategic-context");
  };

  const handleSaveAndExit = async () => {
    if (!await saveDetails()) return;
    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE}/auth/social/logout`, { method: "POST", credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Details are saved, but sign-out could not be completed. Please use Log out.");
      if ("BroadcastChannel" in window) {
        const channel = new BroadcastChannel("stratveda-auth-session");
        channel.postMessage("logout");
        channel.close();
      }
      setFlashNotice({ kind: "success", title: "Company profile saved", message: "Your answers are safe. Sign in again to continue from step 2." });
      window.location.replace("/sign-in");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Details are saved, but sign-out could not be completed.");
      setIsSaving(false);
    }
  };

  return (
    <section className="fingerprint-shell" aria-labelledby="fingerprint-title">
      <div className="fingerprint-heading">
        <p className="fingerprint-eyebrow">STEP {step} OF 2</p>
        <h1 id="fingerprint-title">{step === 1 ? "Your personal details" : "Understand your business"}</h1>
        <p className="fingerprint-intro">{step === 1 ? "Confirm your signup details and add a mobile number." : "Share a few details so we can build a useful picture of how your business works."}</p>
      </div>

      <div className="fingerprint-progress" aria-label={`Step ${step} of 2`}>
        <span className={step === 1 ? "is-current" : "is-complete"}/><span className={step === 2 ? "is-current" : ""}/>
      </div>

      <form className="fingerprint-form" noValidate onSubmit={handleContinue}>
        {step === 1 ? <div className="fingerprint-fields">
          <section className="fingerprint-form-section" aria-labelledby="personal-details-heading">
            <div className="fingerprint-section-heading"><span className="fingerprint-section-number">01</span><div><h3 id="personal-details-heading">Personal details</h3><p>These details come from your signup profile.</p></div></div>
            <div className="fingerprint-company-grid fingerprint-personal-grid">
              <div className="fingerprint-field"><label htmlFor="profileName">Full name</label><input id="profileName" value={profile.name || "Not available"} readOnly autoComplete="name" /></div>
              <div className="fingerprint-field"><label htmlFor="profileEmail">Email address</label><input id="profileEmail" value={profile.email || "Not available"} readOnly autoComplete="email" /></div>
              <div className="fingerprint-field"><label htmlFor="mobileNumber">Mobile number <span className="fingerprint-optional">Optional</span></label><div className="fingerprint-phone-control"><select aria-label="Country and calling code" value={phoneCountry} onChange={(event) => setPhoneCountry(event.target.value)}>{phoneCountries.map((country) => <option key={country.id} value={country.id}>{country.flag} +{country.callingCode} · {country.name} ({country.id})</option>)}</select><input id="mobileNumber" type="tel" autoComplete="tel-national" value={mobileNumber} onChange={(event) => setMobileNumber(event.target.value)} placeholder="Mobile number" /></div></div>
            </div>
          </section>
        </div> : <div className="fingerprint-fields">
          <section className="fingerprint-form-section" aria-labelledby="company-details-heading">
            <div className="fingerprint-section-heading"><span className="fingerprint-section-number">01</span><div><h3 id="company-details-heading">Company Meta Data Capturing – Screen 1</h3><p>Tell us about your company and your role.</p></div></div>
            <div className="fingerprint-company-grid">
              <div className="fingerprint-field">
                <label htmlFor="companyName">Company name <span className="fingerprint-required">*</span></label>
                <input id="companyName" name="companyName" required autoComplete="organization" value={details.companyName} minLength={2} maxLength={100} aria-invalid={Boolean(errors.companyName)} aria-describedby={errors.companyName ? "companyName-error" : undefined} onChange={(event) => update("companyName", event.target.value)} placeholder="e.g. Acme Technologies" />
                {errors.companyName && <span className="fingerprint-error" id="companyName-error">{errors.companyName}</span>}
              </div>
              <div className="fingerprint-field">
                <label htmlFor="website">Company website <span className="fingerprint-optional">Optional</span></label>
                <input id="website" name="website" type="text" inputMode="url" autoComplete="url" value={details.website} aria-invalid={Boolean(errors.website)} aria-describedby={errors.website ? "website-error" : "website-hint"} onChange={(event) => update("website", event.target.value)} placeholder="https://companyname.com or companyname.com" />
                {errors.website ? <span className="fingerprint-error" id="website-error">{errors.website}</span> : <span className="fingerprint-hint" id="website-hint">You can enter a full URL or a domain name.</span>}
              </div>
              <SelectField id="industry" label="Industry" value={details.industry} options={industries} placeholder="Select an industry" error={errors.industry} onChange={(value) => update("industry", value)} />
            </div>
          </section>

          <section className="fingerprint-form-section" aria-labelledby="business-model-heading" hidden>
            <div className="fingerprint-section-heading"><span className="fingerprint-section-number">02</span><div><h3 id="business-model-heading">Business model</h3><p>Select every model that applies.</p></div></div>
            <fieldset className="fingerprint-field fingerprint-models" aria-required="true" aria-invalid={Boolean(errors.businessModel)} aria-describedby={errors.businessModel ? "businessModel-error" : undefined} tabIndex={-1}>
              <legend>How does your company generate revenue? <span className="fingerprint-required">*</span></legend>
              <div className="fingerprint-model-options">{businessModelOptions.map((model) => <label className="fingerprint-model-option" key={model}><input type="checkbox" checked={details.businessModel === model} onChange={(event) => update("businessModel", event.target.checked ? model : "")} />{model}</label>)}</div>
              {errors.businessModel && <span className="fingerprint-error" id="businessModel-error">{errors.businessModel}</span>}
            </fieldset>
          </section>

          <section className="fingerprint-form-section" aria-labelledby="business-snapshot-heading">
            <div className="fingerprint-section-heading"><span className="fingerprint-section-number">02</span><div><h3 id="business-snapshot-heading">Company snapshot</h3><p>Help us understand your current scale and stage.</p></div></div>
            <div className="fingerprint-snapshot-grid">
              <SelectField id="teamSize" label="Team size" value={details.teamSize} options={teamSizes} placeholder="Select team size" error={errors.teamSize} onChange={(value) => update("teamSize", value)} />
              <SelectField id="revenueRange" label="Annual revenue" value={details.revenueRange} options={revenueRanges} placeholder="Select revenue range" error={errors.revenueRange} onChange={(value) => update("revenueRange", value)} />
              <SelectField id="companyStage" label="Company stage" value={details.companyStage} options={companyStages} placeholder="Select company stage" error={errors.companyStage} onChange={(value) => update("companyStage", value)} />
            </div>
          </section>

          <div className="fingerprint-form-section fingerprint-company-extra-grid">
            <div className="fingerprint-field"><label htmlFor="companyLocation">Location <span className="fingerprint-required">*</span></label><input id="companyLocation" autoComplete="country-name" value={details.country} aria-invalid={Boolean(errors.country)} aria-describedby={errors.country ? "companyLocation-error" : undefined} onChange={(event) => update("country", event.target.value)} placeholder="City, state, country" />{errors.country && <span className="fingerprint-error" id="companyLocation-error">{errors.country}</span>}</div>
            <SelectField id="role" label="Role" value={role} options={roles} placeholder="Select your role" onChange={setRole} />
          </div>
          <div hidden><LocationFields details={details} errors={errors} update={update} /></div>
        </div>}

        <div className="fingerprint-form-footer">
          <p className={notice.startsWith("Check") ? "fingerprint-notice is-error" : "fingerprint-notice"} role="status" aria-live="polite">{notice}</p>
          <div className="fingerprint-form-actions">
            {step === 2 && <button className="fingerprint-save-exit" type="button" onClick={() => void handleSaveAndExit()} disabled={isSaving}>{isSaving ? "Saving…" : "Save & Exit"}</button>}
            {step === 2 && <button className="fingerprint-save-exit" type="button" onClick={() => { setStep(1); setNotice(""); }}>Back</button>}
            <button className="fingerprint-continue" type="submit" disabled={isSaving}>{step === 2 && isSaving ? "Saving…" : <>Continue <span aria-hidden="true">→</span></>}</button>
          </div>
        </div>
      </form>
    </section>
  );
}
