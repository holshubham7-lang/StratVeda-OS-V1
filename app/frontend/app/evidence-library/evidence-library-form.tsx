"use client";

import { ChangeEvent, DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { beginOnboardingTransition } from "../../components/onboarding-route-transition";
import { setFlashNotice } from "../../components/feedback-toast";
import { clearStoredDraft, readStoredDraft, writeStoredDraft } from "../../lib/draft-storage";

type EvidenceItem = { id: string; name: string; size: number; category: string; period: string };
const categories = ["Financial", "Sales", "Marketing", "Operations", "Customer", "Strategy", "Board Reports", "Other"];
const periods = ["Current Month", "Current Quarter", "Last Quarter", "Current Year", "Other"];
// Mirrors `acceptedEvidenceExtensions` in app/backend/api/src/onboarding/evidence-item.schema.ts.
const acceptedExtensions = [".doc", ".docx", ".xls", ".xlsx", ".csv", ".json", ".pdf", ".jpg", ".jpeg", ".png"];
const maxFileSize = 25 * 1024 * 1024;
const maxEvidenceFiles = 25;
const draftKey = "stratveda-evidence-library-draft";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";
const supportedFileLabel = "Word, Excel, CSV, JSON, PDF or image (JPG, PNG) · up to 25 MB per file";
const unsupportedFileMessage = "Use Word, Excel, CSV, JSON, PDF, JPG, JPEG or PNG.";

/** Server payloads and browser drafts are both untrusted shapes. */
function toItems(source: unknown): EvidenceItem[] {
  if (!Array.isArray(source)) return [];
  return source.filter((item): item is EvidenceItem => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<EvidenceItem>;
    return typeof candidate.id === "string" && candidate.id.length > 0
      && typeof candidate.name === "string" && candidate.name.length > 0
      && typeof candidate.size === "number" && Number.isFinite(candidate.size)
      && typeof candidate.category === "string" && categories.includes(candidate.category)
      && typeof candidate.period === "string" && periods.includes(candidate.period);
  }).map((item) => ({ ...item, name: item.name.slice(0, 255) }));
}

function readiness(count: number) {
  if (count >= 5) return "Strong readiness";
  if (count >= 3) return "Good readiness";
  if (count >= 1) return "Basic readiness";
  return "Context established";
}

export function EvidenceLibraryForm() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const status = readiness(items.length);

  useEffect(() => {
    let active = true;
    localStorage.setItem("stratveda-onboarding-resume-route", "/evidence-library");
    const draft = readStoredDraft<unknown>(draftKey);
    const hasDraft = Array.isArray(draft) && draft.length > 0;
    if (hasDraft) {
      setItems(toItems(draft));
      setNotice("Restored your unsaved evidence from this browser.");
    }
    fetch(`${API_BASE}/onboarding/evidence-library`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json();
      })
      .then((result) => {
        if (!active || hasDraft) return;
        setItems(toItems(result.data));
      })
      .catch(() => { if (active && !hasDraft) setNotice("Your saved evidence could not be loaded."); });
    return () => { active = false; };
  }, []);

  const addFiles = (fileList: FileList | File[]) => {
    const next = [...fileList];
    const newErrors: Record<string, string> = {};
    const valid: EvidenceItem[] = [];
    for (const file of next) {
      const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
      if (!acceptedExtensions.includes(extension)) {
        newErrors.upload = `${file.name} isn’t a supported file type. ${unsupportedFileMessage}`;
      } else if (file.size > maxFileSize) {
        newErrors.upload = `${file.name} is larger than 25 MB.`;
      } else if (file.size === 0) {
        newErrors.upload = `${file.name} is empty, so it cannot be added.`;
      } else {
        valid.push({ id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`, name: file.name, size: file.size, category: "", period: "" });
      }
    }
    if (valid.length) {
      const room = maxEvidenceFiles - items.length;
      if (room <= 0) {
        newErrors.upload = `Upload no more than ${maxEvidenceFiles} evidence files at a time.`;
      } else {
        if (valid.length > room) newErrors.upload = `Only ${room} more file${room === 1 ? "" : "s"} can be added, so the rest were skipped.`;
        const nextItems = [...items, ...valid.slice(0, room)];
        setItems(nextItems);
        writeStoredDraft(draftKey, nextItems);
      }
    }
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors.upload;
      return newErrors.upload ? { ...nextErrors, upload: newErrors.upload } : nextErrors;
    });
    setNotice("");
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = "";
  };

  const updateItem = (id: string, field: "category" | "period", value: string) => {
    const nextItems = items.map((item) => item.id === id ? { ...item, [field]: value } : item);
    setItems(nextItems);
    writeStoredDraft(draftKey, nextItems);
    setErrors((current) => ({ ...current, [id]: "" }));
    setNotice("");
  };

  const removeItem = (id: string) => {
    const nextItems = items.filter((item) => item.id !== id);
    setItems(nextItems);
    writeStoredDraft(draftKey, nextItems);
    setErrors((current) => ({ ...current, [id]: "" }));
    setNotice("");
  };

  const proceed = async (skip: boolean) => {
    const nextErrors: Record<string, string> = {};
    if (!skip) {
      for (const item of items) {
        if (!item.category || !item.period) nextErrors[item.id] = "Choose an evidence category and reporting period.";
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setNotice("Complete the details for each uploaded file, or skip evidence for now.");
      document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }
    setNotice("");
    setIsSaving(true);

    // `id` is a browser/Mongo key, not a DTO field, and the API rejects unknown properties.
    const payloadItems = skip ? [] : items.map((item) => ({ name: item.name, size: item.size, category: item.category, period: item.period }));
    try {
      const response = await fetch(`${API_BASE}/onboarding/evidence-library`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: payloadItems }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(Array.isArray(result.message) ? result.message.join(" ") : result.message ?? "Evidence library could not be saved.");
      }
      clearStoredDraft(draftKey);
      localStorage.setItem("stratveda-onboarding-completed-step", "4");
      localStorage.setItem("stratveda-onboarding-resume-route", "/executive-brief");
      localStorage.setItem("stratveda-onboarding-brief-ready", "true");
      setFlashNotice({ kind: "success", title: "Your evidence is saved", message: skip ? "No evidence attached yet. Your brief is built from the profile you shared." : "Your evidence is in place. Building your first decision brief." });
      beginOnboardingTransition();
      router.push("/executive-brief");
    } catch (error) {
      setNotice(`Check your details: ${error instanceof Error ? error.message : "Evidence library could not be saved."}`);
      setIsSaving(false);
    }
  };

  const dragHandlers = {
    onDragEnter: (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(true); },
    onDragOver: (event: DragEvent<HTMLDivElement>) => event.preventDefault(),
    onDragLeave: (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); },
    onDrop: (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); },
  };

  return (
    <div className="fingerprint-shell">
      <div className="fingerprint-heading">
        <p className="fingerprint-eyebrow">STEP 4 OF 5</p>
        <h1>Connect your business data</h1>
        <p className="fingerprint-intro">Add a few reports or documents to ground your first decision brief in real evidence.</p>
      </div>

      <div className="fingerprint-progress" role="img" aria-label="Screen 4 of 5">
        <span className="is-complete" /><span className="is-complete" /><span className="is-complete" /><span className="is-current" /><span />
      </div>

      <form className="fingerprint-form evidence-library-form" noValidate onSubmit={(event) => { event.preventDefault(); proceed(false); }}>
        <div className="fingerprint-form-heading">
          <div><span className="fingerprint-section-kicker">INITIAL EVIDENCE REPOSITORY</span><h2>Upload supporting evidence</h2></div>
          <span className="fingerprint-required-note">Optional</span>
        </div>

        <div className="evidence-library-fields">
          <div
            className={`evidence-dropzone${dragging ? " is-dragging" : ""}${errors.upload ? " has-error" : ""}`}
            {...dragHandlers}
            onClick={(event) => { if (event.target !== fileInput.current) fileInput.current?.click(); }}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); fileInput.current?.click(); } }}
            role="button"
            tabIndex={0}
            aria-label="Choose evidence files to upload"
            aria-describedby="evidence-upload-help"
          >
            <input ref={fileInput} className="evidence-file-input" type="file" accept={acceptedExtensions.join(",")} multiple onChange={handleFileChange} aria-label="Upload evidence files" />
            <span className="evidence-upload-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4.5 15.5v3A2.5 2.5 0 0 0 7 21h10a2.5 2.5 0 0 0 2.5-2.5v-3" /></svg></span>
            <strong>Drop your files here, or <span>browse files</span></strong>
            <span id="evidence-upload-help">{supportedFileLabel}</span>
          </div>
          {errors.upload && <p className="fingerprint-error evidence-upload-error" role="alert">{errors.upload}</p>}

          <div className="evidence-readiness" aria-live="polite">
            <div><span className="evidence-readiness-label">CURRENT READINESS</span><strong>{status}</strong></div>
            <span className="evidence-readiness-count">{items.length} file{items.length === 1 ? "" : "s"}</span>
            <div className="evidence-readiness-track" aria-label={`${items.length} evidence files added`}><span style={{ width: `${Math.min((items.length / 5) * 100, 100)}%` }} /></div>
            <div className="evidence-readiness-milestones"><span className={items.length >= 1 ? "is-reached" : ""}>1 Basic</span><span className={items.length >= 3 ? "is-reached" : ""}>3 Good</span><span className={items.length >= 5 ? "is-reached" : ""}>5 Strong</span></div>
          </div>

          {items.length > 0 && (
            <div className="evidence-file-list" aria-label="Selected evidence files">
              {items.map((item) => (
                <div className="evidence-file-row" key={item.id}>
                  <div className="evidence-file-info"><span className="evidence-file-type" aria-hidden="true">{item.name.split(".").pop()?.toUpperCase()}</span><div><strong>{item.name}</strong><span>{(item.size / (1024 * 1024)).toFixed(item.size < 1024 * 1024 ? 2 : 1)} MB</span></div></div>
                  <div className="evidence-file-metadata">
                    <div className="fingerprint-field"><label htmlFor={`${item.id}-category`}>Category <span className="fingerprint-required">*</span></label><select id={`${item.id}-category`} required value={item.category} aria-invalid={Boolean(errors[item.id] && !item.category)} aria-describedby={errors[item.id] ? `${item.id}-error` : undefined} onChange={(event) => updateItem(item.id, "category", event.target.value)}><option value="">Choose category</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></div>
                    <div className="fingerprint-field"><label htmlFor={`${item.id}-period`}>Reporting period <span className="fingerprint-required">*</span></label><select id={`${item.id}-period`} required value={item.period} aria-invalid={Boolean(errors[item.id] && !item.period)} aria-describedby={errors[item.id] ? `${item.id}-error` : undefined} onChange={(event) => updateItem(item.id, "period", event.target.value)}><option value="">Choose period</option>{periods.map((period) => <option key={period}>{period}</option>)}</select></div>
                    <button className="evidence-file-remove" type="button" aria-label={`Remove ${item.name}`} onClick={() => removeItem(item.id)}><svg viewBox="0 0 20 20"><path d="M5 5l10 10M15 5L5 15" /></svg></button>
                  </div>
                  {errors[item.id] && <span className="fingerprint-error evidence-row-error" id={`${item.id}-error`} role="alert">{errors[item.id]}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="fingerprint-form-footer">
          <p className={`fingerprint-notice${Object.keys(errors).length ? " is-error" : ""}`} role="status" aria-live="polite">{notice}</p>
          <div className="fingerprint-form-actions evidence-actions">
            <Link className="fingerprint-save-exit" href="/decision-profile">Previous</Link>
            <div className="evidence-primary-actions">
              <button className="evidence-skip" type="button" disabled={isSaving} onClick={() => proceed(true)}>Skip For Now</button>
              <button className="fingerprint-continue" type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Generate Your First Decision Brief"} <span aria-hidden="true">→</span></button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
