import { getApiBase } from "./apiBase";
import type { SavedResumeVersion, UnlockInterest } from "../types";

const visitorKey = "resume-job-fit-visitor-id";
const visitorPattern = /^[a-zA-Z0-9_-]{16,80}$/;
const apiBase = getApiBase();

function getVisitorId() {
  let visitorId = localStorage.getItem(visitorKey);
  if (!visitorId || !visitorPattern.test(visitorId)) {
    visitorId = crypto.randomUUID();
    try {
      localStorage.setItem(visitorKey, visitorId);
    } catch (error) {
      console.warn("Visitor id could not be persisted.", error);
    }
  }
  return visitorId;
}

export function getVisitorHeaders() {
  return { "X-Visitor-Id": getVisitorId() };
}

export type StorageHealth = {
  online: boolean;
  mode: "mysql" | "file" | "local" | "unknown";
  label: string;
  persistent: boolean;
};

export async function getStorageHealth(): Promise<StorageHealth> {
  try {
    const response = await fetch(`${apiBase}/api/health`);
    if (!response.ok) throw new Error("Health check failed");
    const payload = (await response.json()) as {
      ok?: boolean;
      storage?: { mode?: string; label?: string; persistent?: boolean };
    };
    return {
      online: Boolean(payload.ok),
      mode: payload.storage?.mode === "mysql" || payload.storage?.mode === "file" ? payload.storage.mode : "unknown",
      label: payload.storage?.label || "服务器存储",
      persistent: Boolean(payload.storage?.persistent)
    };
  } catch {
    return {
      online: false,
      mode: "local",
      label: "本机浏览器缓存",
      persistent: false
    };
  }
}

export async function loadAdminVersions(): Promise<SavedResumeVersion[]> {
  const response = await fetch(`${apiBase}/api/admin/versions`, { credentials: "include" });
  if (response.status === 401) throw new Error("管理员登录已失效，请重新登录。");
  if (!response.ok) throw new Error("读取全站简历版本失败，请稍后重试。");
  return (await response.json()) as SavedResumeVersion[];
}

export async function deleteAdminVersion(id: string) {
  const response = await fetch(`${apiBase}/api/admin/versions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include"
  });
  if (response.status === 401) throw new Error("管理员登录已失效，请重新登录。");
  if (!response.ok) throw new Error("删除简历版本失败，请稍后重试。");
}

export async function loadUnlockInterest(): Promise<UnlockInterest[]> {
  const response = await fetch(`${apiBase}/api/interest`, { credentials: "include" });
  if (response.status === 401) throw new Error("管理员登录已失效，请重新登录。");
  if (!response.ok) throw new Error("读取解锁意向失败，请稍后重试。");
  return (await response.json()) as UnlockInterest[];
}

export async function deleteUnlockInterest(id: string) {
  const response = await fetch(`${apiBase}/api/interest/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include"
  });
  if (response.status === 401) throw new Error("管理员登录已失效，请重新登录。");
  if (!response.ok) throw new Error("删除解锁意向失败，请稍后重试。");
}

export async function saveExportFeedback(input: Pick<UnlockInterest, "candidateName" | "targetRole" | "planId" | "note">) {
  const response = await fetch(`${apiBase}/api/interest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getVisitorHeaders() },
    body: JSON.stringify({ source: "editor", contact: "", ...input })
  });
  if (!response.ok) throw new Error("反馈提交失败，请稍后重试。");
}

export async function hasAdminSession() {
  const response = await fetch(`${apiBase}/api/admin/session`, { credentials: "include" });
  return response.status === 204;
}

export async function loginAdmin(password: string) {
  const response = await fetch(`${apiBase}/api/admin/session`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });
  if (response.status === 401) throw new Error("密码不正确。");
  if (!response.ok) throw new Error("登录暂不可用，请稍后重试。");
}

export async function logoutAdmin() {
  await fetch(`${apiBase}/api/admin/session`, { method: "DELETE", credentials: "include" });
}
