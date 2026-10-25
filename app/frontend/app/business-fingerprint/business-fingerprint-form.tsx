"use client";

import { FormEvent, KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBriefcase,
  faBuilding,
  faChartLine,
  faChevronDown,
  faEnvelope,
  faFlag,
  faGlobe,
  faLayerGroup,
  faLocationDot,
  faPhone,
  faUser,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
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
  }))
  .sort((left, right) => left.name.localeCompare(right.name));
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";
const draftStorageKey = "stratveda-business-fingerprint-draft";
const problemStatementStorageKey = "stratveda-problem-statement-draft";

type PersonalProfile = { name: string; email: string };
type InterviewMessage = { role: 'user' | 'assistant'; content: string; createdAt?: string };
type InterviewState = { status: 'active' | 'complete'; messages: InterviewMessage[] };

function FieldIconLabel({ htmlFor, icon, children }: { htmlFor: string; icon: IconDefinition; children: ReactNode }) {
  return (
    <label className="fingerprint-label-with-icon" htmlFor={htmlFor}>
      <FontAwesomeIcon icon={icon} aria-hidden="true" />
      <span>{children}</span>
    </label>
  );
}

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

function SelectField({ id, label, icon, value, options, placeholder, error, onChange }: {
  id: string; label: string; icon: IconDefinition; value: string; options: string[]; placeholder: string; error?: string; onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = options.indexOf(value);
  const listId = `${id}-options`;

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const focusIndex = selectedIndex >= 0 ? selectedIndex : 0;
    const frame = window.requestAnimationFrame(() => optionRefs.current[focusIndex]?.focus());
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [isOpen, selectedIndex]);

  function focusOption(index: number) {
    const wrappedIndex = (index + options.length) % options.length;
    optionRefs.current[wrappedIndex]?.focus();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsOpen(true);
    } else if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      setIsOpen(false);
    }
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown") { event.preventDefault(); focusOption(index + 1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); focusOption(index - 1); }
    else if (event.key === "Home") { event.preventDefault(); focusOption(0); }
    else if (event.key === "End") { event.preventDefault(); focusOption(options.length - 1); }
    else if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  }

  return (
    <div
      ref={rootRef}
      className={`fingerprint-field fingerprint-select-field${isOpen ? " is-open" : ""}`}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsOpen(false); }}
    >
      <FieldIconLabel htmlFor={`${id}-trigger`} icon={icon}>{label} <span className="fingerprint-required">*</span></FieldIconLabel>
      <button
        ref={triggerRef}
        id={`${id}-trigger`}
        className={`fingerprint-select-trigger${value ? "" : " is-placeholder"}`}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-required="true"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span>{value || placeholder}</span>
        <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" />
      </button>
      <div id={listId} className="fingerprint-select-menu" role="listbox" aria-label={label} aria-hidden={!isOpen} inert={!isOpen}>
        {options.map((option, index) => (
          <button
            ref={(element) => { optionRefs.current[index] = element; }}
            className="fingerprint-select-option"
            type="button"
            role="option"
            aria-selected={value === option}
            tabIndex={-1}
            key={option}
            onClick={() => { onChange(option); setIsOpen(false); triggerRef.current?.focus(); }}
            onKeyDown={(event) => handleOptionKeyDown(event, index)}
          >
            <span>{option}</span>
            {value === option && <span className="fingerprint-select-check" aria-hidden="true">✓</span>}
          </button>
        ))}
      </div>
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
      <div className="fingerprint-section-heading"><div><h2 id="location-heading">Location</h2><p>Choose your company’s primary location.</p></div></div>
      <div className="fingerprint-location-grid">
        <div className="fingerprint-field">
          <FieldIconLabel htmlFor="country" icon={faGlobe}>Country <span className="fingerprint-required">*</span></FieldIconLabel>
          <input id="country" name="country" autoComplete="country-name" required value={details.country} maxLength={100} aria-invalid={Boolean(errors.country)} aria-describedby={errors.country ? "country-error" : undefined} onChange={(event) => update("country", event.target.value)} placeholder="Enter country" />
          {errors.country && <span className="fingerprint-error" id="country-error">{errors.country}</span>}
        </div>
        <div className="fingerprint-field">
          <FieldIconLabel htmlFor="state" icon={faLocationDot}>State / province <span className="fingerprint-optional">Optional</span></FieldIconLabel>
          <input id="state" name="state" autoComplete="address-level1" value={details.state} maxLength={100} onChange={(event) => update("state", event.target.value)} placeholder="Enter state or province" />
        </div>
        <div className="fingerprint-field">
          <FieldIconLabel htmlFor="city" icon={faLocationDot}>City <span className="fingerprint-optional">Optional</span></FieldIconLabel>
          <input id="city" name="city" autoComplete="address-level2" value={details.city} maxLength={100} aria-invalid={Boolean(errors.city)} aria-describedby={errors.city ? "city-error" : "city-hint"} onChange={(event) => update("city", event.target.value)} placeholder="Enter city" />
          {errors.city ? <span className="fingerprint-error" id="city-error">{errors.city}</span> : <span className="fingerprint-hint" id="city-hint">Maximum 100 characters.</span>}
        </div>
      </div>
    </section>
  );
}

function PhoneCountryPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const selected = phoneCountries.find((country) => country.id === value) ?? phoneCountries[0];
  const visibleCountries = phoneCountries.filter((country) => `${country.name} ${country.id} +${country.callingCode}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <details className="fingerprint-phone-picker">
      <summary aria-label={`Country ${selected.name}, +${selected.callingCode}`}>
        <span className="fingerprint-flag" style={{ backgroundImage: `url(https://flagcdn.com/w40/${selected.id.toLowerCase()}.png)` }} aria-hidden="true" />
        <span>+{selected.callingCode}</span><span className="fingerprint-phone-current-id">{selected.id}</span><span className="fingerprint-phone-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="fingerprint-phone-menu">
        <input aria-label="Search countries" type="search" placeholder="Search country or code" value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="fingerprint-phone-options" role="listbox" aria-label="Countries">
          {visibleCountries.map((country) => (
            <button className="fingerprint-phone-option" type="button" role="option" aria-selected={value === country.id} key={country.id} onClick={(event) => { onChange(country.id); setSearch(""); event.currentTarget.closest("details")?.removeAttribute("open"); }}>
              <span className="fingerprint-flag" style={{ backgroundImage: `url(https://flagcdn.com/w40/${country.id.toLowerCase()}.png)` }} aria-hidden="true" />
              <span className="fingerprint-phone-country-name">{country.name}</span><span>+{country.callingCode}</span><span className="fingerprint-phone-country-id">{country.id}</span>
            </button>
          ))}
        </div>
      </div>
    </details>
  );
}
export function BusinessFingerprintForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [profile, setProfile] = useState<PersonalProfile>({ name: "", email: "" });
  const [phoneCountry, setPhoneCountry] = useState("IN");
  const [mobileNumber, setMobileNumber] = useState("");
  const [role, setRole] = useState("");
  const [problemStatement, setProblemStatement] = useState("");
  const [problemStatementError, setProblemStatementError] = useState("");
  const [interviewReply, setInterviewReply] = useState("");
  const [interview, setInterview] = useState<InterviewState | null>(null);
  const [details, setDetails] = useState<BusinessDetails>(emptyDetails);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isInterviewLoading, setIsInterviewLoading] = useState(false);

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
    fetch(`${API_BASE}/onboarding/problem-interview`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Your saved interview could not be loaded.");
        return response.json();
      })
      .then((result) => {
        if (!active || !result.data) return;
        setInterview(result.data as InterviewState);
        setProblemStatement((current) => current || result.data.messages?.find((message: InterviewMessage) => message.role === "user")?.content || "");
      })
      .catch((error) => { if (active) setNotice(error instanceof Error ? error.message : "Your saved interview could not be loaded."); });
    const draft = readDraft();
    try { setProblemStatement(sessionStorage.getItem(problemStatementStorageKey) ?? ""); } catch { /* Private browsing can disable session storage. */ }
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
    if (step === 1) {
      if (!await saveDetails()) return;
      setStep(2);
      setNotice("");
      return;
    }
    if (interview?.status === "complete") {
      setFlashNotice({ kind: "success", title: "Discovery interview complete", message: "Your answers are saved. Continue setting up your priorities." });
      beginOnboardingTransition();
      router.push("/strategic-context");
      return;
    }

    const isStarting = !interview;
    const message = isStarting ? problemStatement.trim() : interviewReply.trim();
    if (isStarting && message.length < 10) {
      setProblemStatementError("Add a little more detail so the interview can focus on the right problem.");
      return;
    }
    if (!isStarting && !message) return;

    setIsInterviewLoading(true);
    setNotice("");
    try {
      const response = await fetch(`${API_BASE}/onboarding/problem-interview/${isStarting ? "start" : "message"}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(isStarting ? { problemStatement: message, role } : { message }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(" ") : result.message ?? "The discovery interview could not be reached.");
      setInterview(result.data as InterviewState);
      setInterviewReply("");
      if (isStarting) {
        try { sessionStorage.setItem(problemStatementStorageKey, message); } catch { /* The API has saved the interview. */ }
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The discovery interview could not be reached. Please try again.");
    } finally {
      setIsInterviewLoading(false);
    }
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
        <h1 id="fingerprint-title">{step === 1 ? "Personal and company details" : "Your problem statement"}</h1>
        <p className="fingerprint-intro">{step === 1 ? "Confirm your signup details, then tell us about your company." : "Start with the decision or challenge you want to work through."}</p>
      </div>

      <div className="fingerprint-progress" aria-label={`Step ${step} of 2`}>
        <span className={step === 1 ? "is-current" : "is-complete"}/><span className={step === 2 ? "is-current" : ""}/>
      </div>

      <form className="fingerprint-form" noValidate onSubmit={handleContinue}>
        {step === 1 ? <div className="fingerprint-fields">
          <section className="fingerprint-form-section fingerprint-personal-section" aria-labelledby="personal-details-heading">
            <div className="fingerprint-section-heading"><div><h2 id="personal-details-heading">Personal details</h2><p>These details come from your signup profile.</p></div></div>
            <div className="fingerprint-company-grid fingerprint-personal-grid">
              <div className="fingerprint-field"><FieldIconLabel htmlFor="profileName" icon={faUser}>Full name</FieldIconLabel><input id="profileName" value={profile.name || "Not available"} readOnly autoComplete="name" /></div>
              <div className="fingerprint-field"><FieldIconLabel htmlFor="profileEmail" icon={faEnvelope}>Email address</FieldIconLabel><input id="profileEmail" value={profile.email || "Not available"} readOnly autoComplete="email" /></div>
              <div className="fingerprint-field"><FieldIconLabel htmlFor="mobileNumber" icon={faPhone}>Mobile number <span className="fingerprint-optional">Optional</span></FieldIconLabel><div className="fingerprint-phone-control"><PhoneCountryPicker value={phoneCountry} onChange={setPhoneCountry} /><input id="mobileNumber" type="tel" autoComplete="tel-national" value={mobileNumber} onChange={(event) => setMobileNumber(event.target.value)} placeholder="Mobile number" /></div></div>
            </div>
          </section>
          <section className="fingerprint-form-section" aria-labelledby="company-details-heading">
            <div className="fingerprint-section-heading"><div><h2 id="company-details-heading">Company details</h2><p>Share your company’s size, stage, location, and your role.</p></div></div>
            <div className="fingerprint-company-grid">
              <div className="fingerprint-field">
                <FieldIconLabel htmlFor="companyName" icon={faBuilding}>Company name <span className="fingerprint-required">*</span></FieldIconLabel>
                <input id="companyName" name="companyName" required autoComplete="organization" value={details.companyName} minLength={2} maxLength={100} aria-invalid={Boolean(errors.companyName)} aria-describedby={errors.companyName ? "companyName-error" : undefined} onChange={(event) => update("companyName", event.target.value)} placeholder="e.g. Acme Technologies" />
                {errors.companyName && <span className="fingerprint-error" id="companyName-error">{errors.companyName}</span>}
              </div>
              <div className="fingerprint-field">
                <FieldIconLabel htmlFor="website" icon={faGlobe}>Company website <span className="fingerprint-optional">Optional</span></FieldIconLabel>
                <input id="website" name="website" type="text" inputMode="url" autoComplete="url" value={details.website} aria-invalid={Boolean(errors.website)} aria-describedby={errors.website ? "website-error" : "website-hint"} onChange={(event) => update("website", event.target.value)} placeholder="https://companyname.com or companyname.com" />
                {errors.website ? <span className="fingerprint-error" id="website-error">{errors.website}</span> : <span className="fingerprint-hint" id="website-hint">You can enter a full URL or a domain name.</span>}
              </div>
              <SelectField id="industry" label="Industry" icon={faLayerGroup} value={details.industry} options={industries} placeholder="Select an industry" error={errors.industry} onChange={(value) => update("industry", value)} />
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

          <section className="fingerprint-form-section" aria-label="Company details continued">
            <div className="fingerprint-snapshot-grid">
              <SelectField id="teamSize" label="Team size" icon={faUsers} value={details.teamSize} options={teamSizes} placeholder="Select team size" error={errors.teamSize} onChange={(value) => update("teamSize", value)} />
              <SelectField id="revenueRange" label="Annual revenue" icon={faChartLine} value={details.revenueRange} options={revenueRanges} placeholder="Select revenue range" error={errors.revenueRange} onChange={(value) => update("revenueRange", value)} />
              <SelectField id="companyStage" label="Company stage" icon={faFlag} value={details.companyStage} options={companyStages} placeholder="Select company stage" error={errors.companyStage} onChange={(value) => update("companyStage", value)} />
              <SelectField id="role" label="Role" icon={faBriefcase} value={role} options={roles} placeholder="Select your role" onChange={setRole} />
            </div>
          </section>
          <LocationFields details={details} errors={errors} update={update} />
        </div> : <div className="fingerprint-fields fingerprint-problem-step">
          <section className="fingerprint-form-section" aria-labelledby="problem-statement-heading">
            <div className="fingerprint-problem-chat-card">
              <div className="fingerprint-problem-agent-mark" aria-hidden="true">S</div>
              <div><span className="fingerprint-section-kicker">STRATVEDA INTERVIEW</span><p>What decision or problem is taking up the most attention right now? Share what is happening, what you have tried, and what a useful outcome would look like.</p></div>
            </div>
            {!interview ? <>
              <div className="fingerprint-problem-field-heading">
                <h2 id="problem-statement-heading">Describe the problem you want help with</h2>
                <p>Include what is happening, what you have tried, and the outcome you want.</p>
              </div>
              <div className="fingerprint-field">
                <label htmlFor="problemStatement">Problem statement</label>
                <textarea id="problemStatement" rows={7} maxLength={3000} disabled={isInterviewLoading} value={problemStatement} aria-invalid={Boolean(problemStatementError)} aria-describedby={problemStatementError ? "problemStatement-error" : "problemStatement-hint"} onChange={(event) => { setProblemStatement(event.target.value); setProblemStatementError(""); try { sessionStorage.setItem(problemStatementStorageKey, event.target.value); } catch { /* Keep editing if browser storage is unavailable. */ } }} placeholder="For example: We’re growing quickly, but our sales forecasts keep missing the mark. I’d like to understand what is driving the gap and where to focus first." />
                {problemStatementError ? <span className="fingerprint-error" id="problemStatement-error">{problemStatementError}</span> : <span className="fingerprint-hint" id="problemStatement-hint">Your statement and interview answers are saved to your account. {problemStatement.length}/3,000</span>}
              </div>
            </> : <>
              <div className="fingerprint-interview-thread" aria-live="polite" aria-label="Discovery interview">
                {interview.messages.map((message, index) => <article className={`fingerprint-interview-message is-${message.role}`} key={`${message.createdAt ?? "turn"}-${index}`}>
                  <span>{message.role === "assistant" ? "Discovery agent" : "You"}</span>
                  <p>{message.content}</p>
                </article>)}
                {isInterviewLoading && <p className="fingerprint-interview-thinking" role="status">The discovery agent is thinking…</p>}
              </div>
              {interview.status === "active" && <div className="fingerprint-field">
                <label htmlFor="interviewReply">Your answer</label>
                <textarea id="interviewReply" rows={4} maxLength={4000} disabled={isInterviewLoading} value={interviewReply} onChange={(event) => setInterviewReply(event.target.value)} placeholder="Share any details that will help the agent understand your situation." />
              </div>}
              {interview.status === "complete" && <div className="fingerprint-interview-ready" role="status">
                <span className="fingerprint-interview-ready-icon" aria-hidden="true">✓</span>
                <div><strong>Interview complete</strong><p>Your problem statement and answers are saved. Continue to the next setup step.</p></div>
              </div>}
            </>}
          </section>
        </div>}

        <div className="fingerprint-form-footer">
          <p className={notice.startsWith("Check") ? "fingerprint-notice is-error" : "fingerprint-notice"} role="status" aria-live="polite">{notice}</p>
          <div className="fingerprint-form-actions">
            {step === 1 && <button className="fingerprint-save-exit" type="button" onClick={() => void handleSaveAndExit()} disabled={isSaving}>{isSaving ? "Saving…" : "Save & Exit"}</button>}
            {step > 1 && <button className="fingerprint-save-exit" type="button" onClick={() => { setStep(1); setNotice(""); }}>Back</button>}
            <button className="fingerprint-continue" type="submit" disabled={isSaving || isInterviewLoading || (step === 2 && interview?.status === "active" && !interviewReply.trim())}>{step === 1 && isSaving ? "Saving…" : isInterviewLoading ? "Connecting…" : step === 2 && interview?.status === "active" ? <>Send answer <span aria-hidden="true">→</span></> : step === 2 && interview?.status === "complete" ? <>Continue setup <span aria-hidden="true">→</span></> : step === 2 ? <>Start interview <span aria-hidden="true">→</span></> : <>Continue <span aria-hidden="true">→</span></>}</button>
          </div>
        </div>
      </form>
    </section>
  );
}
