import { getApiBase } from "./apiBase";
import { getVisitorHeaders } from "./storage";
import type { ResumeInput } from "../types";

type AiOptimizeResponse = { provider: "deepseek" | "kimi"; model: string; text: string; changes?: Array<{ before: string; after: string }>; suggestions?: string[]; highlights?: string[]; quality?: { verdict: "ready" | "needs_evidence"; score: number; checks: string[]; highlights?: string[] }; reviewFlags?: string[]; safe?: boolean };

export async function optimizeWithDeepSeek(input: ResumeInput, evidenceAnswers: string[] = [], options: { skippedFollowUp?: boolean } = {}): Promise<AiOptimizeResponse> {
  const skippedFollowUp = options.skippedFollowUp ?? evidenceAnswers.length === 0;
  try {
    const response = await fetch(`${getApiBase()}/api/ai/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getVisitorHeaders() },
      body: JSON.stringify({
        resumeText: input.resumeText,
        targetRole: input.targetRole,
        jobDescription: input.jobDescription,
        evidenceAnswers,
        sourceMode: input.sourceMode || "resume",
        fastPolish: (input.sourceMode || "resume") === "resume",
        skippedFollowUp,
        basicInfo: input.basicInfo || undefined
      }),
      signal: AbortSignal.timeout(240_000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || typeof payload.text !== "string") {
      throw new Error(payload.error || "AI 优化暂时不可用。");
    }
    return payload as AiOptimizeResponse;
  } catch (error) {
    if ((error as { name?: string })?.name === "TimeoutError" || (error as { name?: string })?.name === "AbortError") {
      throw new Error("整理耗时较长已超时，请稍后重试。");
    }
    throw error;
  }
}
