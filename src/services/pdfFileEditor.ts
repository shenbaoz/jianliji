import { getApiBase } from "./apiBase";
import { getVisitorHeaders } from "./storage";
import type { PreparedPdf } from "../types";

const apiBase = getApiBase();

export type PdfDeliveryMode = PreparedPdf["deliveryMode"];

export async function createEditedPdfPreview(originalResumeFileUrl: string, text: string, changes: Array<{ before: string; after: string }>) {
  const response = await fetch(`${apiBase}/api/edit-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getVisitorHeaders() },
    body: JSON.stringify({ originalResumeFileUrl, text, changes })
  });
  const payload = (await response.json().catch(() => null)) as { fileUrl?: string; reviewFileUrl?: string; changedLineCount?: number; appliedChanges?: Array<{ before?: unknown; after?: unknown }>; deliveryMode?: PdfDeliveryMode; portraitApplied?: boolean; portraitDataUrl?: string; error?: string } | null;
  if (!response.ok || !payload?.fileUrl || !payload.reviewFileUrl || !payload.deliveryMode) {
    throw new Error(payload?.error || "PDF 同步失败。");
  }
  return {
    fileUrl: resolveApiUrl(payload.fileUrl),
    reviewFileUrl: resolveApiUrl(payload.reviewFileUrl),
    changedLineCount: Math.max(0, Number(payload.changedLineCount) || 0),
    deliveryMode: payload.deliveryMode,
    portraitApplied: payload.portraitApplied === true,
    portraitDataUrl: typeof payload.portraitDataUrl === "string" && payload.portraitDataUrl.startsWith("data:image/") ? payload.portraitDataUrl : undefined,
    appliedChanges: Array.isArray(payload.appliedChanges)
      ? payload.appliedChanges.flatMap((change) => {
          const before = typeof change.before === "string" ? change.before.trim() : "";
          const after = typeof change.after === "string" ? change.after.trim() : "";
          return before && after ? [{ before, after }] : [];
        })
      : []
  };
}

export async function createGeneratedPdf(text: string): Promise<PreparedPdf> {
  const response = await fetch(`${apiBase}/api/export-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getVisitorHeaders() },
    body: JSON.stringify({ text })
  });
  const payload = (await response.json().catch(() => null)) as { fileUrl?: string; error?: string } | null;
  if (!response.ok || !payload?.fileUrl) throw new Error(payload?.error || "PDF 生成失败。");
  const fileUrl = resolveApiUrl(payload.fileUrl);
  return {
    fileUrl,
    reviewFileUrl: fileUrl,
    changedLineCount: 0,
    appliedChanges: [],
    deliveryMode: "generated-template",
    portraitApplied: false
  };
}

function resolveApiUrl(value: string) {
  return value.startsWith("/api/") ? `${apiBase}${value}` : value;
}
