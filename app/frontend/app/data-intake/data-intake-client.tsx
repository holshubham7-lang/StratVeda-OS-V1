"use client";

import { DragEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faCheck,
  faCloudArrowUp,
  faFileLines,
  faLock,
  faShieldHalved,
  faTriangleExclamation,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { OnboardingCompletionSequence } from "../../components/onboarding-completion-sequence";
import styles from "./data-intake.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";
const MAX_FILES = 5;
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "xlsx", "csv", "json", "txt", "png", "jpg", "jpeg"]);
const FORMAT_LABELS = ["PDF", "DOCX", "XLSX", "CSV", "JSON", "TXT", "PNG", "JPG"];
const TERMINAL_FILE_STATES = new Set(["ready", "blocked", "failed"]);
const completionSteps = ["PERSONAL & COMPANY DETAILS", "DISCOVERY INTERVIEW", "COMPANY DATA", "MASTER AGENT HANDOVER"];
const fileSteps = ["Upload", "Scan", "Extract", "Ready"];
const RING_RADIUS = 34;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type IntakeFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  status: string;
  scanResult?: string;
  extractedChars: number;
  textTruncated: boolean;
  error?: string;
};

type EvidenceSummary = {
  packageStatus?: string;
  summary?: string;
  limitations: string[];
};

type IntakeData = {
  sessionStatus: string;
  dataAgentStatus: string;
  masterStatus: string;
  handoverRequested: boolean;
  error?: string;
  completedAt?: string;
  files: IntakeFile[];
  evidenceSummary: EvidenceSummary | null;
  masterSummary: string | null;
  masterResponse: string | null;
};

type StageKey = "upload" | "scan" | "extract" | "staged" | "format" | "done" | "error";

const stageOrder: StageKey[] = ["upload", "scan", "extract", "format", "done"];

const stages: Array<{ key: StageKey; label: string; detail: string }> = [
  { key: "upload", label: "Upload", detail: "Files go straight to quarantine." },
  { key: "scan", label: "Defender scan", detail: "Only a no-threat verdict moves a file forward." },
  { key: "extract", label: "Clean copy & extract", detail: "Approved text is read from the verified copy." },
  { key: "format", label: "Format & validate", detail: "The Data Agent builds your evidence package." },
  { key: "done", label: "Handover ready", detail: "The Master Agent receives Step 1 and Step 2 data." },
];

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extensionOf(name: string) {
  return (name.split(".").pop() ?? "").toUpperCase().slice(0, 4) || "FILE";
}

function errorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const message = (payload as Record<string, unknown>).message;
  if (Array.isArray(message)) return message.join(" ");
  if (typeof message === "string" && message.trim()) return message;
  return fallback;
}

async function readJson(response: Response) {
  return response.json().catch(() => ({}));
}

async function fetchIntake(): Promise<IntakeData> {
  const response = await fetch(`${API_BASE}/data-intake`, { credentials: "include", cache: "no-store" });
  const payload = await readJson(response);
  if (!response.ok) throw new Error(errorMessage(payload, "Your data-intake status could not be loaded."));
  return (payload as { data: IntakeData }).data;
}

async function postIntake(path: string): Promise<IntakeData> {
  const response = await fetch(`${API_BASE}/data-intake/${path}`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) throw new Error(errorMessage(payload, "The data-intake request could not be completed."));
  return (payload as { data: IntakeData }).data;
}

async function deleteIntakeFile(fileId: string): Promise<IntakeData> {
  const response = await fetch(`${API_BASE}/data-intake/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    credentials: "include",
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) throw new Error(errorMessage(payload, "That file could not be removed."));
  return (payload as { data: IntakeData }).data;
}

function uploadFiles(files: File[], onProgress: (percent: number) => void): Promise<IntakeData> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${API_BASE}/data-intake/files`);
    request.withCredentials = true;
    request.responseType = "json";

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error("The upload could not reach the server. Check your connection and try again."));
    request.onload = () => {
      const payload = request.response ?? {};
      if (request.status >= 200 && request.status < 300) {
        resolve((payload as { data: IntakeData }).data);
        return;
      }
      reject(new Error(errorMessage(payload, "The files could not be uploaded.")));
    };

    const body = new FormData();
    for (const file of files) body.append("files", file, file.name);
    onProgress(0);
    request.send(body);
  });
}

function stageFor(data: IntakeData | null, uploadProgress: number | null): StageKey {
  if (uploadProgress !== null) return "upload";
  if (!data) return "upload";
  if (data.sessionStatus === "failed") return "error";
  if (data.sessionStatus === "ready" || data.sessionStatus === "skipped") return "done";

  const statuses = data.files.map((file) => file.status);
  if (statuses.some((status) => status === "quarantined" || status === "scanning")) return "scan";
  if (statuses.some((status) => status === "clean" || status === "extracting")) return "extract";
  if (statuses.length === 0) return data.sessionStatus === "processing" ? "format" : "upload";
  // Files are scanned and read, but nothing is handed over until the user asks.
  return data.sessionStatus === "processing" ? "format" : "staged";
}

function stageIndex(stage: StageKey) {
  return stage === "error" || stage === "staged" ? stageOrder.indexOf("format") : stageOrder.indexOf(stage);
}

function stagePercent(stage: StageKey, uploadProgress: number | null) {
  if (stage === "upload") return Math.max(6, Math.round((uploadProgress ?? 0) * 0.2));
  if (stage === "scan") return 32;
  if (stage === "extract") return 57;
  if (stage === "staged") return 70;
  if (stage === "format") return 82;
  if (stage === "done") return 100;
  return 82;
}

function annotationFor(stage: StageKey) {
  if (stage === "upload") return "Waiting for files";
  if (stage === "scan") return "Waiting for Defender";
  if (stage === "extract") return "Reading approved files";
  if (stage === "staged") return "Ready to hand over";
  if (stage === "format") return "Building evidence package";
  if (stage === "done") return "Handover complete";
  return "Needs attention";
}

function railDetailFor(stage: StageKey) {
  if (stage === "upload") return "Add files on the left, or continue with your profile only.";
  if (stage === "scan") return "Each file is held in quarantine until Defender clears it.";
  if (stage === "extract") return "Text is read only from the verified clean copy.";
  if (stage === "staged") return "Add more files, or hand them over when you are ready.";
  if (stage === "format") return "The Data Agent is preparing your evidence package.";
  if (stage === "done") return "Your Master Agent has everything it needs.";
  return "The handover stopped. Retry it from the card.";
}

function fileStatus(status: string) {
  if (status === "quarantined") return { label: "Queued for scan", tone: "isWorking" };
  if (status === "scanning") return { label: "Scanning", tone: "isWorking" };
  if (status === "clean") return { label: "Clean copy ready", tone: "isWorking" };
  if (status === "extracting") return { label: "Extracting", tone: "isWorking" };
  if (status === "ready") return { label: "Ready", tone: "isReady" };
  if (status === "blocked") return { label: "Blocked", tone: "isBlocked" };
  if (status === "failed") return { label: "Needs attention", tone: "isBlocked" };
  return { label: "Waiting", tone: "" };
}

/** Which of the four per-file steps are done, active, or where the file stopped. */
function fileProgress(file: IntakeFile) {
  if (file.status === "ready") return { done: 4, active: -1, failedAt: -1 };
  if (file.status === "quarantined" || file.status === "scanning") return { done: 1, active: 1, failedAt: -1 };
  if (file.status === "clean" || file.status === "extracting") return { done: 2, active: 2, failedAt: -1 };
  if (file.status === "blocked" || file.status === "failed") {
    const scanned = (file.scanResult ?? "").toLowerCase().startsWith("no threats");
    const failedAt = scanned ? 2 : 1;
    return { done: failedAt, active: -1, failedAt };
  }
  return { done: 1, active: -1, failedAt: -1 };
}

/** Older sessions stored raw storage errors; never show XML to a customer. */
function friendlyFileError(error: string) {
  if (/azure blob storage|<\?xml|<Code>/i.test(error)) {
    return "This file could not be checked because of a storage problem on our side. Remove it and try again later.";
  }
  return error;
}

export function DataIntakeClient() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const seenFileIds = useRef<Set<string> | null>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);
  const percentValue = useRef({ value: 0 });
  const fillRef = useRef<HTMLSpanElement>(null);
  const dropIconRef = useRef<HTMLSpanElement>(null);
  const [data, setData] = useState<IntakeData | null>(null);
  const [selected, setSelected] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [isOpeningCenter, setIsOpeningCenter] = useState(false);

  async function refresh(silent = false) {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const next = await fetchIntake();
      setData(next);
      if (!silent) setNotice("");
    } catch (error) {
      if (!silent) setNotice(error instanceof Error ? error.message : "Your data-intake status could not be loaded.");
    } finally {
      busyRef.current = false;
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    localStorage.setItem("stratveda-onboarding-resume-route", "/data-intake");
    void refresh();
  }, []);

  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useIsomorphicLayoutEffect(() => {
    if (!rootRef.current || reduceMotion()) return;
    const context = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
      timeline
        .from("[data-intake-hero] > *", { opacity: 0, y: 14, duration: 0.5, stagger: 0.07 })
        .from("[data-intake-trust] > *", { opacity: 0, y: 8, scale: 0.96, duration: 0.4, stagger: 0.06 }, "-=0.25")
        .from("[data-intake-animate]", { opacity: 0, y: 22, duration: 0.6 }, "-=0.2")
        .from("[data-intake-rail]", { opacity: 0, x: 22, duration: 0.6 }, "<0.08")
        .from("[data-intake-stage]", { opacity: 0, x: -8, duration: 0.35, stagger: 0.06 }, "-=0.3");
    }, rootRef);
    return () => context.revert();
  }, []);

  // A gentle float on the upload icon tells people the drop zone is live.
  useEffect(() => {
    const icon = dropIconRef.current;
    if (!icon || reduceMotion()) return;
    const tween = gsap.to(icon, { y: -5, duration: 1.6, ease: "sine.inOut", repeat: -1, yoyo: true });
    return () => { tween.kill(); };
  }, [data?.sessionStatus]);

  useEffect(() => {
    const icon = dropIconRef.current;
    if (!icon || reduceMotion()) return;
    gsap.to(icon, { scale: dragging ? 1.12 : 1, rotate: dragging ? -6 : 0, duration: 0.3, ease: "back.out(2)" });
  }, [dragging]);

  const pollKey = data
    ? `${data.sessionStatus}:${data.dataAgentStatus}:${data.masterStatus}:${data.files.map((file) => file.status).join(",")}`
    : "";
  useEffect(() => {
    if (!data) return;
    const active = data.sessionStatus === "processing" || data.files.some((file) => !TERMINAL_FILE_STATES.has(file.status));
    if (!active) return;
    const timer = window.setInterval(() => void refresh(true), 2500);
    return () => window.clearInterval(timer);
  }, [pollKey, data]);

  const existingCount = data?.files.length ?? 0;
  const stage = loading ? "upload" : stageFor(data, uploadProgress);
  const percent = loading ? 0 : stagePercent(stage, uploadProgress);
  const processing = data?.sessionStatus === "processing";
  const failed = data?.sessionStatus === "failed";
  const done = data?.sessionStatus === "ready" || data?.sessionStatus === "skipped";
  const blockedFiles = data?.files.filter((file) => file.status === "blocked" || file.status === "failed") ?? [];
  const readyFiles = data?.files.filter((file) => file.status === "ready") ?? [];
  const filesSettling = data?.files.some((file) => !TERMINAL_FILE_STATES.has(file.status)) ?? false;
  const canAddFiles = !processing && !busy && existingCount + selected.length < MAX_FILES;
  const noticeIsError = Boolean(notice && !notice.startsWith("Upload complete") && !notice.startsWith("Handover started") && !notice.startsWith("Pipeline restarted") && !notice.startsWith("File removed"));
  const activeIndex = stageIndex(stage);
  const fileIdKey = data?.files.map((file) => file.id).join(",") ?? "";

  // New file cards slide in; cards already on screen stay put during polling.
  useIsomorphicLayoutEffect(() => {
    if (!data) return;
    const ids = new Set(data.files.map((file) => file.id));
    const seen = seenFileIds.current;
    seenFileIds.current = ids;
    if (!seen || !rootRef.current || reduceMotion()) return;
    const fresh = data.files.filter((file) => !seen.has(file.id));
    if (!fresh.length) return;
    const nodes = fresh
      .map((file) => rootRef.current?.querySelector(`[data-file-id="${CSS.escape(file.id)}"]`))
      .filter((node): node is Element => Boolean(node));
    gsap.from(nodes, { opacity: 0, y: 14, scale: 0.97, duration: 0.45, stagger: 0.08, ease: "back.out(1.4)" });
  }, [fileIdKey]);

  // The ring, its counter and the timeline fill all follow the real pipeline stage.
  useEffect(() => {
    const ring = ringRef.current;
    const label = percentRef.current;
    const fill = fillRef.current;
    const target = RING_LENGTH * (1 - percent / 100);
    const fillScale = Math.min(1, Math.max(0, activeIndex / (stages.length - 1)));
    if (reduceMotion()) {
      if (ring) ring.style.strokeDashoffset = String(target);
      if (label) label.textContent = `${percent}%`;
      if (fill) fill.style.transform = `scaleY(${fillScale})`;
      percentValue.current.value = percent;
      return;
    }
    const tweens = [
      ring && gsap.to(ring, { strokeDashoffset: target, duration: 0.9, ease: "power2.out" }),
      label && gsap.to(percentValue.current, {
        value: percent,
        duration: 0.9,
        ease: "power2.out",
        onUpdate: () => { label.textContent = `${Math.round(percentValue.current.value)}%`; },
      }),
      fill && gsap.to(fill, { scaleY: fillScale, duration: 0.8, ease: "power2.inOut" }),
    ];
    return () => tweens.forEach((tween) => tween?.kill());
  }, [percent, activeIndex]);

  // Finishing the stage earns a small celebration on the result cards.
  useIsomorphicLayoutEffect(() => {
    if (!done || !rootRef.current || reduceMotion()) return;
    const context = gsap.context(() => {
      gsap.from("[data-intake-result]", { opacity: 0, y: 12, duration: 0.45, stagger: 0.1, ease: "power2.out" });
      gsap.from("[data-intake-result-icon]", { scale: 0.3, rotate: -20, duration: 0.6, stagger: 0.1, ease: "back.out(2.2)" });
    }, rootRef);
    return () => context.revert();
  }, [done]);

  function addFiles(incoming: File[]) {
    if (!incoming.length) return;
    const rejected: string[] = [];
    const accepted: File[] = [];
    for (const file of incoming) {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ALLOWED_EXTENSIONS.has(extension)) {
        rejected.push(`${file.name} is not a supported format`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        rejected.push(`${file.name} is larger than 25 MB`);
        continue;
      }
      if (file.size === 0) {
        rejected.push(`${file.name} is empty`);
        continue;
      }
      accepted.push(file);
    }

    const remaining = Math.max(0, MAX_FILES - existingCount - selected.length);
    const seen = new Set(selected.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
    const unique = accepted.filter((file) => {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const kept = unique.slice(0, remaining);
    if (unique.length > remaining) rejected.push(`You can add ${MAX_FILES} files in this stage`);
    setSelected((current) => [...current, ...kept]);
    setNotice(rejected.length ? rejected.slice(0, 2).join(". ") : "");
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (!canAddFiles) return;
    addFiles(Array.from(event.dataTransfer.files));
  }

  async function handleUpload() {
    if (!selected.length || busy) return;
    setBusy(true);
    setNotice("");
    setUploadProgress(0);
    try {
      const next = await uploadFiles(selected, setUploadProgress);
      setData(next);
      setSelected([]);
      setUploadProgress(100);
      setNotice(`Upload complete. Defender is checking the files before anything is read. ${existingCount + selected.length < MAX_FILES ? "Add more files or hand them over when you are ready." : "Hand them over when you are ready."}`);
      window.setTimeout(() => setUploadProgress(null), 550);
    } catch (error) {
      setUploadProgress(null);
      setNotice(error instanceof Error ? error.message : "The files could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveFile(file: IntakeFile) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      const node = rootRef.current?.querySelector(`[data-file-id="${CSS.escape(file.id)}"]`);
      const next = await deleteIntakeFile(file.id);
      if (node && !reduceMotion()) await gsap.to(node, { opacity: 0, x: 18, height: 0, marginTop: 0, paddingBlock: 0, duration: 0.3, ease: "power2.in" });
      setData(next);
      setNotice("File removed. You can add a replacement file.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "That file could not be removed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      const wasFailed = failed;
      setData(await postIntake("complete"));
      setNotice(wasFailed ? "Pipeline restarted. We will keep this page updated as it runs." : "Handover started. We will keep this page updated as it runs.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The handover could not be started.");
    } finally {
      setBusy(false);
    }
  }

  function openDecisionCenter() {
    localStorage.setItem("stratveda-onboarding-completed-step", "2");
    localStorage.setItem("stratveda-onboarding-resume-route", "/decision-center");
    setIsOpeningCenter(true);
  }

  const finishOpeningCenter = useCallback(() => router.push("/decision-center"), [router]);

  async function handleSkip() {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      await postIntake("skip");
      openDecisionCenter();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "This step could not be skipped right now.");
      setBusy(false);
    }
  }

  const title = done ? "Your data stage is complete" : failed ? "The handover needs attention" : existingCount ? "Your files are in the pipeline" : "Add the files behind your numbers";
  const subtitle = done
    ? "Review what was handed over, add or replace files, or open your Decision Center."
    : failed
      ? "Nothing was lost. Retry the handover or skip this optional step."
      : "Upload together or one at a time. Every file is scanned before a clean copy is read.";
  const footerNote = notice || (done
    ? (data?.sessionStatus === "skipped" ? "You skipped the optional data stage." : "Step 1, Step 2, and the evidence package were handed to the Master Agent.")
    : processing
      ? "You can leave this page — the pipeline keeps running."
      : "");

  return (
    <section className={styles.shell} ref={rootRef} aria-labelledby="data-intake-title">
      <div className={styles.heading} data-intake-hero>
        <p className={styles.optional}><i aria-hidden="true" />STEP 3 · OPTIONAL · COMPANY DATA</p>
        <h1 id="data-intake-title">Ground your evidence package</h1>
        <p>Add company data after the interview. Only approved text from scanned, clean copies reaches the Data Agent.</p>
      </div>
      <ul className={styles.trust} data-intake-trust aria-label="How your files are protected">
        <li><FontAwesomeIcon icon={faShieldHalved} aria-hidden="true" /> Defender malware scan</li>
        <li><FontAwesomeIcon icon={faLock} aria-hidden="true" /> Quarantined until clean</li>
        <li><FontAwesomeIcon icon={faFileLines} aria-hidden="true" /> Agents receive text only</li>
      </ul>

      <div className={styles.workspace}>
        <div className={styles.card} data-intake-animate>
          <header className={styles.cardHeader}>
            <div>
              <span className={styles.kicker}>COMPANY DATA</span>
              <h2>{title}</h2>
              <p>{subtitle}</p>
            </div>
            <div className={styles.capacity} aria-label={`${existingCount} of ${MAX_FILES} files added`}>
              <span><strong>{existingCount}</strong> of {MAX_FILES} files</span>
              <span className={styles.capacityBars} aria-hidden="true">
                {Array.from({ length: MAX_FILES }, (_, index) => (
                  <i key={index} className={index < existingCount ? styles.isFilled : index < existingCount + selected.length ? styles.isQueued : ""} />
                ))}
              </span>
            </div>
          </header>

          <div className={styles.cardBody}>
            {!processing && (
              <label
                className={`${styles.dropzone}${done ? ` ${styles.isCompact}` : ""}${dragging ? ` ${styles.isDragging}` : ""}${canAddFiles ? "" : ` ${styles.isDisabled}`}`}
                onDragOver={(event) => { event.preventDefault(); if (canAddFiles) setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  disabled={!canAddFiles}
                  accept=".pdf,.docx,.xlsx,.csv,.json,.txt,.png,.jpg,.jpeg"
                  onChange={(event) => {
                    addFiles(Array.from(event.target.files ?? []));
                    event.target.value = "";
                  }}
                />
                <span className={styles.dropIcon} ref={dropIconRef} aria-hidden="true"><FontAwesomeIcon icon={faCloudArrowUp} /></span>
                <span className={styles.dropCopy}>
                  <strong>{existingCount + selected.length >= MAX_FILES ? `You have added ${MAX_FILES} files` : dragging ? "Release to add these files" : done ? "Add or replace files" : existingCount ? "Drop more files, or browse" : "Drop files here, or browse"}</strong>
                  <span>{done
                    ? "New files reopen this stage. Your current brief stays in place until you hand over again."
                    : `PDF, Word, Excel, CSV, JSON, text and images · up to 25 MB each · ${MAX_FILES} files in total`}</span>
                </span>
                {canAddFiles && <span className={styles.browse}>Browse files</span>}
                {!done && (
                  <span className={styles.formats} aria-label="Accepted formats">
                    {FORMAT_LABELS.map((label) => <span key={label}>{label}</span>)}
                  </span>
                )}
              </label>
            )}

            {selected.length > 0 && (
              <div className={styles.queue}>
                <div className={styles.sectionTop}>
                  <strong>{selected.length} {selected.length === 1 ? "file" : "files"} ready to upload</strong>
                  <button className={styles.textButton} type="button" onClick={() => setSelected([])} disabled={busy}>Clear</button>
                </div>
                <ul className={styles.queueList}>
                  {selected.map((file) => (
                    <li className={styles.queueRow} key={`${file.name}:${file.size}:${file.lastModified}`}>
                      <span className={styles.extBadge}>{extensionOf(file.name)}</span>
                      <strong>{file.name}</strong>
                      <span>{formatBytes(file.size)}</span>
                      <button
                        className={styles.remove}
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        disabled={busy}
                        onClick={() => setSelected((current) => current.filter((item) => item !== file))}
                      >
                        <FontAwesomeIcon icon={faXmark} />
                      </button>
                    </li>
                  ))}
                </ul>
                {uploadProgress !== null ? (
                  <div className={styles.uploadBar} role="status" aria-live="polite">
                    <div className={styles.progressTrack}><div className={styles.progressFill} style={{ width: `${uploadProgress}%` }} /></div>
                    <div className={styles.progressMeta}><span>Uploading to quarantine</span><span>{uploadProgress}%</span></div>
                  </div>
                ) : (
                  <button className={`${styles.primary} ${styles.queueUpload}`} type="button" onClick={() => void handleUpload()} disabled={busy || processing}>
                    <FontAwesomeIcon icon={faCloudArrowUp} /> Upload {selected.length} {selected.length === 1 ? "file" : "files"}
                  </button>
                )}
              </div>
            )}

            {data && data.files.length > 0 && (
              <div className={styles.files}>
                <div className={styles.sectionTop}>
                  <strong>{done ? "Handed over" : "In the pipeline"}</strong>
                  <span>{readyFiles.length} ready{blockedFiles.length ? ` · ${blockedFiles.length} excluded` : ""}</span>
                </div>
                <ul className={styles.fileList} aria-label="Uploaded files">
                  {data.files.map((file) => {
                    const status = fileStatus(file.status);
                    const progress = fileProgress(file);
                    const canRemove = (file.status === "blocked" || file.status === "failed") && !processing;
                    return (
                      <li className={`${styles.fileCard}${progress.failedAt >= 0 ? ` ${styles.isFailed}` : ""}`} key={file.id} data-file-id={file.id}>
                        <span className={styles.extBadge}>{extensionOf(file.name)}</span>
                        <span className={styles.fileCopy}>
                          <strong title={file.name}>{file.name}</strong>
                          <span>
                            {formatBytes(file.size)}
                            {file.status === "ready" && file.extractedChars > 0 ? ` · ${file.extractedChars.toLocaleString()} characters extracted` : ""}
                            {file.textTruncated ? " · shortened to 50,000 characters" : ""}
                          </span>
                          <span className={styles.fileSteps} aria-label={`Progress: ${status.label}`}>
                            {fileSteps.map((step, index) => {
                              const state = index === progress.failedAt ? styles.isFailed : index < progress.done ? styles.isDone : index === progress.active ? styles.isActive : "";
                              return <span className={`${styles.fileStep}${state ? ` ${state}` : ""}`} key={step}><i />{step}</span>;
                            })}
                          </span>
                        </span>
                        <span className={styles.fileActions}>
                          <span className={`${styles.statusPill}${status.tone ? ` ${styles[status.tone]}` : ""}`}><i aria-hidden="true" />{status.label}</span>
                          {canRemove && (
                            <button className={styles.remove} type="button" aria-label={`Remove ${file.name}`} disabled={busy} onClick={() => void handleRemoveFile(file)}>
                              <FontAwesomeIcon icon={faXmark} />
                            </button>
                          )}
                        </span>
                        {file.error && (
                          <p className={styles.fileError}>
                            <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
                            <span>{friendlyFileError(file.error)}</span>
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {done && data?.evidenceSummary && (
              <div className={`${styles.result} ${styles.isSuccess}`} data-intake-result>
                <span className={styles.resultIcon} data-intake-result-icon aria-hidden="true"><FontAwesomeIcon icon={faShieldHalved} /></span>
                <div className={styles.resultCopy}>
                  <strong>Evidence package ready</strong>
                  <span className={styles.resultMeta}>{data.evidenceSummary.packageStatus || "Received by the Master Agent"}</span>
                  {data.evidenceSummary.summary && <p>{data.evidenceSummary.summary}</p>}
                  {data.evidenceSummary.limitations.length > 0 && (
                    <ul className={styles.limitations}>
                      {data.evidenceSummary.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {failed && (
              <div className={`${styles.result} ${styles.isDanger}`} role="alert">
                <span className={styles.resultIcon} aria-hidden="true"><FontAwesomeIcon icon={faTriangleExclamation} /></span>
                <div className={styles.resultCopy}>
                  <strong>Handover did not finish</strong>
                  <span className={styles.resultMeta}>{data?.error || "The pipeline stopped before the evidence package was ready."}</span>
                </div>
              </div>
            )}

            {blockedFiles.length > 0 && !failed && (
              <div className={`${styles.result} ${styles.isWarning}`} role="status" data-intake-result>
                <span className={styles.resultIcon} data-intake-result-icon aria-hidden="true"><FontAwesomeIcon icon={faTriangleExclamation} /></span>
                <div className={styles.resultCopy}>
                  <strong>{blockedFiles.length} {blockedFiles.length === 1 ? "file was" : "files were"} excluded</strong>
                  <span className={styles.resultMeta}>
                    {done ? "The handover continued with your other data. Remove the file and upload a replacement to include it." : "Remove excluded files to free their slots. The rest can continue."}
                  </span>
                </div>
              </div>
            )}
          </div>

          <footer className={styles.cardFooter}>
            <p className={`${styles.notice}${noticeIsError ? ` ${styles.isError}` : ""}`} role="status" aria-live="polite">{footerNote}</p>
            <div className={styles.actions}>
              {!done && !failed && (
                <button className={styles.secondary} type="button" onClick={() => void handleSkip()} disabled={busy}>Skip for now</button>
              )}
              {!done && !failed && selected.length === 0 && !processing && (
                <button className={styles.primary} type="button" onClick={() => void handleComplete()} disabled={busy}>
                  {existingCount === 0 ? "Use profile only" : filesSettling ? `Hand over when scanned (${existingCount})` : `Hand over ${existingCount} ${existingCount === 1 ? "file" : "files"}`} <FontAwesomeIcon icon={faArrowRight} />
                </button>
              )}
              {failed && (
                <button className={styles.secondary} type="button" onClick={() => void handleSkip()} disabled={busy}>Skip for now</button>
              )}
              {failed && (
                <button className={styles.primary} type="button" onClick={() => void handleComplete()} disabled={busy}>
                  {busy ? "Retrying…" : "Retry handover"} <FontAwesomeIcon icon={faArrowRight} />
                </button>
              )}
              {done && (
                <button className={styles.primary} type="button" onClick={openDecisionCenter}>
                  Open Decision Center <FontAwesomeIcon icon={faArrowRight} />
                </button>
              )}
            </div>
          </footer>
        </div>

        <aside className={styles.rail} data-intake-rail aria-label="Data pipeline status">
          <div className={styles.railTop}>
            <div>
              <span className={styles.kicker}>LIVE PIPELINE</span>
              <h2>{annotationFor(stage)}</h2>
              <p>{railDetailFor(stage)}</p>
            </div>
            <div className={`${styles.ring}${stage === "error" ? ` ${styles.isError}` : ""}`} role="progressbar" aria-label="Pipeline progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
              <svg viewBox="0 0 80 80" aria-hidden="true">
                <circle className={styles.ringTrack} cx="40" cy="40" r={RING_RADIUS} />
                <circle className={styles.ringValue} ref={ringRef} cx="40" cy="40" r={RING_RADIUS} strokeDasharray={RING_LENGTH} strokeDashoffset={RING_LENGTH} />
              </svg>
              <span ref={percentRef}>0%</span>
            </div>
          </div>

          <ol className={styles.pipeline}>
            <span className={styles.pipelineTrack} aria-hidden="true"><span ref={fillRef} /></span>
            {stages.map((item, index) => {
              const warn = item.key === "scan" && blockedFiles.length > 0 && index < activeIndex;
              const complete = index < activeIndex || (stage === "done" && index === activeIndex);
              const itemState = stage === "error" && index === activeIndex
                ? styles.isError
                : warn
                  ? styles.isWarning
                  : complete
                    ? styles.isComplete
                    : index === activeIndex
                      ? stage === "staged" ? styles.isWaiting : styles.isActive
                      : "";
              return (
                <li className={`${styles.stage}${itemState ? ` ${itemState}` : ""}`} key={item.key} data-intake-stage>
                  <span className={styles.stageDot} aria-hidden="true">
                    {warn ? "!" : complete ? <FontAwesomeIcon icon={faCheck} /> : index + 1}
                  </span>
                  <span className={styles.stageCopy}>
                    <strong>{item.label}</strong>
                    <span>{warn ? `${blockedFiles.length} ${blockedFiles.length === 1 ? "file" : "files"} excluded · ${item.detail}` : stage === "staged" && index === activeIndex ? "Starts when you hand your files over." : item.detail}</span>
                  </span>
                </li>
              );
            })}
          </ol>

          <p className={styles.railNote}>
            <FontAwesomeIcon icon={faLock} aria-hidden="true" />
            <span><strong>Your data stays staged.</strong> Quarantine is temporary; only the clean copy is read, and agents receive text only.</span>
          </p>

          {loading && (
            <div className={styles.empty} aria-live="polite">
              <div className={styles.skeleton} style={{ width: "72%" }} />
              <div className={styles.skeleton} style={{ width: "48%" }} />
            </div>
          )}
        </aside>
      </div>
      {isOpeningCenter && <OnboardingCompletionSequence steps={completionSteps} status="ready" onComplete={finishOpeningCenter} />}
    </section>
  );
}
