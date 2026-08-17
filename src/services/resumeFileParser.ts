import { getApiBase } from "./apiBase";
import { getVisitorHeaders } from "./storage";
import type { BasicInfo } from "../types";

const apiBase = getApiBase();

export type ParsedResumeFile = {
  text: string;
  candidateName?: string;
  basicInfo?: Partial<BasicInfo>;
  originalResumeFileName?: string;
  originalResumeMimeType?: string;
  originalResumeFileUrl?: string;
};

export async function parseResumeFile(file: File): Promise<ParsedResumeFile> {
  const body = new FormData();
  body.append("resume", file);

  const response = await fetch(`${apiBase}/api/parse-resume`, {
    method: "POST",
    headers: getVisitorHeaders(),
    body
  });

  const payload = (await response.json().catch(() => null)) as (ParsedResumeFile & { error?: string }) | null;
  if (!response.ok) {
    throw new Error(payload?.error || "简历解析失败，请稍后再试。");
  }

  if (!payload?.text?.trim()) {
    throw new Error("没有提取到有效文本，请确认文件不是扫描件图片。");
  }

  return {
    text: payload.text,
    candidateName: payload.candidateName,
    basicInfo: payload.basicInfo,
    originalResumeFileName: payload.originalResumeFileName,
    originalResumeMimeType: payload.originalResumeMimeType,
    originalResumeFileUrl: payload.originalResumeFileUrl?.startsWith("/api/")
      ? `${apiBase}${payload.originalResumeFileUrl}`
      : payload.originalResumeFileUrl
  };
}
