import { TOKEN, api, type ApiError } from "./api.js";

export type KnowledgeDocumentStatus =
  | "ready"
  | "indexing"
  | "indexed"
  | "stale"
  | "failed"
  | "deleted_pending_index";

export interface KnowledgeDocumentEntry {
  documentId: string;
  sourceName: string;
  sourceType: string;
  name: string;
  displayName: string;
  size: number;
  updatedAt: string;
  status: KnowledgeDocumentStatus;
  indexedRevision: number;
  lastError?: { code?: string; message?: string } | string | null;
}

export interface KnowledgeIndexJob {
  jobId: string;
  workspaceFingerprint: string;
  requestedRevision: number;
  status: "queued" | "running" | "completed" | "partial" | "failed" | "cancelled" | "interrupted" | "blocked";
  startedAt?: string | null;
  finishedAt?: string | null;
  error?: { code?: string; message?: string; details?: unknown } | null;
  followUpQueued?: boolean;
}

export interface KnowledgeDocumentsState {
  workspaceFingerprint: string;
  contentRevision: number;
  indexedRevision: number;
  documents: KnowledgeDocumentEntry[];
  deletedDocuments?: KnowledgeDocumentEntry[];
  activeJob: KnowledgeIndexJob | null;
  lastJob: KnowledgeIndexJob | null;
  warnings?: string[];
  indexDirty: boolean;
  manifestReadOnly: boolean;
  includeKnowledgeDocs: boolean;
  maxFileBytes: number;
  uploadsPath: string;
}

export interface KnowledgeDocumentUploadResult {
  ok: boolean;
  workspaceFingerprint: string;
  contentRevision: number;
  document: KnowledgeDocumentEntry & { path: string };
  indexJob: KnowledgeIndexJob | null;
  warning?: string | null;
  renamed: boolean;
  indexDirty: boolean;
}

export interface KnowledgeDocumentDeleteResult {
  deleted: boolean;
  workspaceFingerprint: string;
  contentRevision: number;
  document: KnowledgeDocumentEntry & { deletedRevision: number };
  documentId: string;
  name: string;
  removedRaw: string[];
  indexJob: KnowledgeIndexJob | null;
  warning?: string | null;
  indexDirty: boolean;
}

export interface KnowledgeRequestOptions {
  signal?: AbortSignal;
  workspaceFingerprint?: string | null;
  requestId?: string;
}

function knowledgeRequestHeaders(options: KnowledgeRequestOptions): Record<string, string> {
  const headers: Record<string, string> = {};
  if (options.workspaceFingerprint) headers["X-Visionox-Workspace-Fingerprint"] = options.workspaceFingerprint;
  if (options.requestId) headers["X-Visionox-Request-Id"] = options.requestId;
  return headers;
}

export function listKnowledgeDocuments(options: KnowledgeRequestOptions = {}): Promise<KnowledgeDocumentsState> {
  return api("/knowledge/documents", { headers: knowledgeRequestHeaders(options), signal: options.signal });
}

export function deleteKnowledgeDocument(
  documentId: string,
  options: KnowledgeRequestOptions = {},
): Promise<KnowledgeDocumentDeleteResult> {
  return api(`/knowledge/documents/${encodeURIComponent(documentId)}`, {
    method: "DELETE",
    headers: knowledgeRequestHeaders(options),
    signal: options.signal,
  });
}

export function reindexKnowledgeDocuments(options: KnowledgeRequestOptions = {}): Promise<{
  accepted: boolean;
  status: string;
  jobId: string;
  workspaceFingerprint: string;
  job: KnowledgeIndexJob;
}> {
  return api("/knowledge/documents/reindex", {
    method: "POST",
    headers: knowledgeRequestHeaders(options),
    body: {},
    signal: options.signal,
  });
}

export function getKnowledgeReindexJob(jobId: string, options: KnowledgeRequestOptions = {}): Promise<{
  workspaceFingerprint: string;
  job: KnowledgeIndexJob;
}> {
  return api(`/knowledge/documents/reindex/${encodeURIComponent(jobId)}`, {
    headers: knowledgeRequestHeaders(options),
    signal: options.signal,
  });
}

export function cancelKnowledgeReindexJob(jobId: string, options: KnowledgeRequestOptions = {}): Promise<{
  workspaceFingerprint: string;
  cancelled: boolean;
  jobId: string;
}> {
  return api(`/knowledge/documents/reindex/${encodeURIComponent(jobId)}`, {
    method: "DELETE",
    headers: knowledgeRequestHeaders(options),
    signal: options.signal,
  });
}

function uploadError(status: number, statusText: string, parsed: Record<string, unknown> | null): ApiError {
  const message = String(parsed?.message ?? parsed?.error ?? `${status} ${statusText}`);
  const error = new Error(message) as ApiError;
  error.status = status;
  error.body = parsed;
  error.code = typeof parsed?.code === "string" ? parsed.code : undefined;
  error.title = typeof parsed?.title === "string" ? parsed.title : undefined;
  error.retryable = typeof parsed?.retryable === "boolean" ? parsed.retryable : undefined;
  error.action = typeof parsed?.action === "string" ? parsed.action : undefined;
  error.details = parsed?.details && typeof parsed.details === "object"
    ? parsed.details as Record<string, unknown>
    : undefined;
  return error;
}

export async function uploadKnowledgeDocument(
  file: File,
  options: KnowledgeRequestOptions = {},
): Promise<KnowledgeDocumentUploadResult> {
  const url = `/api/knowledge/documents?name=${encodeURIComponent(file.name)}&token=${TOKEN}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Reasonix-Token": TOKEN,
      "Content-Type": "application/octet-stream",
      ...knowledgeRequestHeaders(options),
    },
    body: file,
    signal: options.signal,
  });
  const text = await res.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { error: text };
  }
  if (!res.ok) throw uploadError(res.status, res.statusText, parsed);
  return parsed as unknown as KnowledgeDocumentUploadResult;
}
