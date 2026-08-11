import { getApiBase } from "./apiBase";
import type { ResumeInput, UniversalRefinement } from "../types";

type AiOptimizeResponse = { provider: "deepseek" | "kimi"; model: string; text: string; changes?: Array<{ before: string; after: string }>; suggestions?: string[]; quality?: { verdict: "ready" | "needs_evidence"; score: number; checks: string[] }; reviewFlags?: string[]; safe?: boolean };

export async function optimizeWithDeepSeek(input: ResumeInput, evidenceAnswers: string[] = []): Promise<AiOptimizeResponse> {
  const skippedFollowUp = evidenceAnswers.length === 0;
  const response = await fetch(`${getApiBase()}/api/ai/optimize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeText: input.resumeText, targetRole: input.targetRole, jobDescription: input.jobDescription, evidenceAnswers, sourceMode: input.sourceMode || "resume", skippedFollowUp })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.text !== "string") {
    throw new Error(payload.error || "AI 优化暂时不可用。");
  }
  return payload as AiOptimizeResponse;
}

export async function optimizeUniversalResume(resumeText: string): Promise<UniversalRefinement> {
  const response = await fetch(`${getApiBase()}/api/ai/optimize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeText, sourceMode: "universal" })
  });
  const payload = await response.json().catch(() => ({}));
  const validQuality = payload?.quality
    && (payload.quality.verdict === "ready" || payload.quality.verdict === "unchanged")
    && Array.isArray(payload.quality.checks);
  if (!response.ok || typeof payload.text !== "string" || !Array.isArray(payload.changes) || !validQuality || typeof payload.safe !== "boolean") {
    throw new Error(payload.error || "简历整理暂时不可用。");
  }
  return payload as UniversalRefinement;
}
