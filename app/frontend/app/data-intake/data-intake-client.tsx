"use client";

import { DragEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faCloudArrowUp,
  faFile,
  faShieldHalved,
  faTriangleExclamation,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { beginOnboardingTransition } from "../../components/onboarding-route-transition";
import styles from "./data-intake.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";
const MAX_FILES = 5;
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "xlsx", "csv", "json", "txt", "png", "jpg", "jpeg"]);
const FORMAT_LABELS = ["PDF", "DOCX", "XLSX", "CSV", "JSON", "TXT", "PNG", "JPG"];
const TERMINAL_FILE_STATES = new Set(["ready", "blocked", "failed"]);

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
};

type StageKey = "upload" | "scan" | "extract" | "format" | "done" | "error";

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
  return "format";
}

function stageIndex(stage: StageKey) {
  return stage === "error" ? stageOrder.indexOf("format") : stageOrder.indexOf(stage);
}

function stagePercent(stage: StageKey, uploadProgress: number | null) {
  if (stage === "upload") return Math.max(6, uploadProgress ?? 6);
  if (stage === "scan") return 32;
  if (stage === "extract") return 57;
  if (stage === "format") return 82;
  if (stage === "done") return 100;
  return 82;
}

function annotationFor(stage: StageKey) {
  if (stage === "upload") return "Uploading to quarantine";
  if (stage === "scan") return "Waiting for Defender";
  if (stage === "extract") return "Reading approved files";
  if (stage === "format") return "Building evidence package";
  if (stage === "done") return "Handover complete";
  return "Needs attention";
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

export function DataIntakeClient() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const [data, setData] = useState<IntakeData | null>(null);
  const [selected, setSelected] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

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

  useEffect(() => {
    if (!rootRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      gsap.from("[data-intake-animate]", { opacity: 0, y: 16, duration: 0.55, stagger: 0.08, ease: "power3.out" });
      gsap.from("[data-intake-rail]", { opacity: 0, x: 14, duration: 0.5, delay: 0.12, ease: "power3.out" });
    }, rootRef);
    return () => context.revert();
  }, []);

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
  const percent = stagePercent(stage, uploadProgress);
  const processing = data?.sessionStatus === "processing";
  const failed = data?.sessionStatus === "failed";
  const done = data?.sessionStatus === "ready" || data?.sessionStatus === "skipped";
  const blockedFiles = data?.files.filter((file) => file.status === "blocked" || file.status === "failed") ?? [];
  const noticeIsError = Boolean(notice && !notice.startsWith("Upload complete") && !notice.startsWith("Pipeline restarted") && !notice.startsWith("File removed"));

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
    if (processing || done) return;
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
      setNotice("Upload complete. Defender is checking the files before anything is read.");
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
      setData(await deleteIntakeFile(file.id));
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
      setData(await postIntake("complete"));
      setNotice("Pipeline restarted. We will keep this page updated as it runs.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The handover could not be started.");
    } finally {
      setBusy(false);
    }
  }

  function openDecisionCenter() {
    localStorage.setItem("stratveda-onboarding-completed-step", "2");
    localStorage.setItem("stratveda-onboarding-resume-route", "/decision-center");
    beginOnboardingTransition();
    router.push("/decision-center");
  }

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

  const activeIndex = stageIndex(stage);

  return (
    <section className={styles.shell} ref={rootRef} aria-labelledby="data-intake-title">
      <div className={styles.heading}>
        <p className={styles.optional}><i aria-hidden="true" />OPTIONAL · COMPANY DATA</p>
        <h1 id="data-intake-title">Ground your evidence package</h1>
        <p>Add company data after the interview. Files are scanned before a clean copy is read, and only approved text reaches the Data Agent.</p>
      </div>

      <div className={styles.workspace}>
        <div className={styles.card} data-intake-animate>
          <header className={styles.cardHeader}>
            <div>
              <span className={styles.kicker}>COMPANY DATA</span>
              <h2>{done ? "Your data stage is complete" : failed ? "The pipeline needs attention" : "Add the files behind your numbers"}</h2>
              <p>{done ? "Review what was handed over, then open your Decision Center." : "PDF, Word, Excel, CSV, JSON, text, and images up to 25 MB each. Legacy .doc and .xls are not accepted."}</p>
            </div>
            <span className={styles.capacity}>{existingCount}/{MAX_FILES} files</span>
          </header>

          {!done && (
            <label
              className={`${styles.dropzone}${dragging ? ` ${styles.isDragging}` : ""}`}
              onDragOver={(event) => { event.preventDefault(); if (!processing) setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                disabled={processing || busy}
                accept=".pdf,.docx,.xlsx,.csv,.json,.txt,.png,.jpg,.jpeg"
                onChange={(event) => {
                  addFiles(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />
              <span className={styles.dropIcon} aria-hidden="true"><FontAwesomeIcon icon={faCloudArrowUp} /></span>
              <strong>{processing ? "Files are already in the pipeline" : "Drop files here or browse"}</strong>
              <span>Select up to {MAX_FILES} files. A malware scan runs before any extraction.</span>
              <span className={styles.formats} aria-label="Accepted formats">
                {FORMAT_LABELS.map((label) => <span key={label}>{label}</span>)}
              </span>
            </label>
          )}

          {selected.length > 0 && (
            <div className={styles.selection}>
              <div className={styles.selectionTop}>
                <strong>{selected.length} ready to upload</strong>
                <button type="button" onClick={() => setSelected([])} disabled={busy}>Clear</button>
              </div>
              {selected.map((file) => (
                <div className={styles.selectedRow} key={`${file.name}:${file.size}:${file.lastModified}`}>
                  <FontAwesomeIcon icon={faFile} aria-hidden="true" />
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
                </div>
              ))}
            </div>
          )}

          {uploadProgress !== null && (
            <div className={styles.uploadBar} role="status" aria-live="polite">
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${uploadProgress}%` }} />
              </div>
              <div className={styles.progressMeta}>
                <span>Uploading to quarantine</span>
                <span>{uploadProgress}%</span>
              </div>
            </div>
          )}

          {data && data.files.length > 0 && (
            <div className={styles.fileList} aria-label="Uploaded files">
              {data.files.map((file) => {
                const status = fileStatus(file.status);
                return (
                  <div className={styles.fileRow} key={file.id}>
                    <span className={styles.fileIcon} aria-hidden="true"><FontAwesomeIcon icon={faFile} /></span>
                    <span className={styles.fileCopy}>
                      <strong>{file.name}</strong>
                      <span>
                        {formatBytes(file.size)}
                        {file.status === "ready" && file.extractedChars > 0 ? ` · ${file.extractedChars.toLocaleString()} characters extracted` : ""}
                        {file.textTruncated ? " · shortened to 50,000 characters" : ""}
                      </span>
                      {file.error && <em>{file.error}</em>}
                    </span>
                    <span className={styles.fileActions}>
                      <span className={`${styles.statusPill}${status.tone ? ` ${styles[status.tone]}` : ""}`}>
                        <i aria-hidden="true" />{status.label}
                      </span>
                      {(file.status === "blocked" || file.status === "failed") && !done && !processing && (
                        <button
                          className={styles.remove}
                          type="button"
                          aria-label={`Remove ${file.name}`}
                          disabled={busy}
                          onClick={() => void handleRemoveFile(file)}
                        >
                          <FontAwesomeIcon icon={faXmark} />
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {done && data?.evidenceSummary && (
            <div className={styles.result}>
              <div className={styles.resultTop}>
                <span className={styles.resultIcon} aria-hidden="true"><FontAwesomeIcon icon={faShieldHalved} /></span>
                <div>
                  <strong>Evidence package ready</strong>
                  <span>{data.evidenceSummary.packageStatus || "Received by the Master Agent"}</span>
                </div>
              </div>
              {data.evidenceSummary.summary && <p>{data.evidenceSummary.summary}</p>}
              {data.evidenceSummary.limitations.length > 0 && (
                <ul className={styles.limitations}>
                  {data.evidenceSummary.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
                </ul>
              )}
            </div>
          )}

          {failed && (
            <div className={styles.result} role="alert">
              <div className={styles.resultTop}>
                <span className={styles.resultIcon} aria-hidden="true"><FontAwesomeIcon icon={faTriangleExclamation} /></span>
                <div>
                  <strong>Handover did not finish</strong>
                  <span>{data?.error || "The pipeline stopped before the evidence package was ready."}</span>
                </div>
              </div>
            </div>
          )}

          {blockedFiles.length > 0 && !failed && (
            <div className={styles.result} role="status">
              <div className={styles.resultTop}>
                <span className={styles.resultIcon} aria-hidden="true"><FontAwesomeIcon icon={faTriangleExclamation} /></span>
                <div>
                  <strong>Some files were excluded</strong>
                  <span>{blockedFiles.length} {blockedFiles.length === 1 ? "file was" : "files were"} blocked or could not be processed. The rest can continue.</span>
                </div>
              </div>
            </div>
          )}

          <footer className={styles.cardFooter}>
            <p className={`${styles.notice}${noticeIsError ? ` ${styles.isError}` : ""}`} role="status" aria-live="polite">
              {notice || (done ? (data?.sessionStatus === "skipped" ? "You skipped the optional data stage." : "Step 1, Step 2, and the evidence package were handed to the Master Agent.") : processing ? "You can leave this page — the pipeline keeps running." : "")}
            </p>
            <div className={styles.actions}>
              {!done && !failed && (
                <button className={styles.secondary} type="button" onClick={() => void handleSkip()} disabled={busy}>
                  Skip for now
                </button>
              )}
              {!done && !failed && selected.length > 0 && (
                <button className={styles.primary} type="button" onClick={() => void handleUpload()} disabled={busy || processing}>
                  {busy ? "Uploading…" : `Upload ${selected.length} ${selected.length === 1 ? "file" : "files"}`}
                </button>
              )}
              {!done && !failed && selected.length === 0 && existingCount === 0 && !processing && (
                <button className={styles.primary} type="button" onClick={() => void handleComplete()} disabled={busy}>
                  Use profile only <FontAwesomeIcon icon={faArrowRight} />
                </button>
              )}
              {failed && (
                <button className={styles.primary} type="button" onClick={() => void handleComplete()} disabled={busy}>
                  {busy ? "Retrying…" : "Retry handover"} <FontAwesomeIcon icon={faArrowRight} />
                </button>
              )}
              {failed && (
                <button className={styles.secondary} type="button" onClick={() => void handleSkip()} disabled={busy}>Skip for now</button>
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
          <span className={styles.kicker}>LIVE PIPELINE</span>
          <h2>{annotationFor(stage)}</h2>

          <ol className={styles.pipeline}>
            {stages.map((item, index) => {
              const itemState = stage === "error" && index === activeIndex
                ? styles.isError
                : index < activeIndex
                  ? styles.isComplete
                  : index === activeIndex
                    ? `${styles.isActive}${stage === "done" ? ` ${styles.isComplete}` : ""}`
                    : "";
              return (
                <li className={`${styles.stage}${itemState ? ` ${itemState}` : ""}`} key={item.key}>
                  <span className={styles.stageDot} aria-hidden="true">
                    {index < activeIndex || (stage === "done" && index === activeIndex) ? "✓" : index + 1}
                  </span>
                  <span className={styles.stageCopy}>
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </span>
                </li>
              );
            })}
          </ol>

          <div className={styles.pipelineProgress}>
            <div className={styles.pipelineProgressTop}>
              <span>Progress</span>
              <strong>{loading ? "—" : `${percent}%`}</strong>
            </div>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${loading ? 6 : percent}%` }} />
            </div>
          </div>

          {data?.masterSummary && (
            <p className={styles.railNote}><strong>Master Agent:</strong> {data.masterSummary}</p>
          )}
          {!data?.masterSummary && (
            <p className={styles.railNote}>
              <strong>Your data stays staged.</strong> Quarantine is temporary; only the clean copy is read, and the Agent receives text only.
            </p>
          )}

          {loading && (
            <div className={styles.empty} aria-live="polite">
              <div className={styles.skeleton} style={{ width: "72%" }} />
              <div className={styles.skeleton} style={{ width: "48%" }} />
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
