import { getApiBase } from "./apiBase";
import type { SavedResumeVersion, UnlockInterest } from "../types";

const key = "resume-job-fit-versions";
const interestKey = "resume-job-fit-unlock-interest";
const visitorKey = "resume-job-fit-visitor-id";
const apiBase = getApiBase();

function getVisitorId() {
  let visitorId = localStorage.getItem(visitorKey);
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem(visitorKey, visitorId);
  }
  return visitorId;
}

export function getVisitorHeaders() {
  return { "X-Visitor-Id": getVisitorId() };
}

function loadLocalVersions(): SavedResumeVersion[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as SavedResumeVersion[]) : [];
  } catch {
    return [];
  }
}

function saveLocalVersion(version: SavedResumeVersion) {
  const versions = loadLocalVersions();
  const next = [version, ...versions.filter((item) => item.id !== version.id)].slice(0, 20);
  localStorage.setItem(key, JSON.stringify(next));
}

function deleteLocalVersion(id: string) {
  const next = loadLocalVersions().filter((item) => item.id !== id);
  localStorage.setItem(key, JSON.stringify(next));
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

export function clearLocalResumeData() {
  localStorage.removeItem(key);
  localStorage.removeItem(interestKey);
}

export async function loadVersions(): Promise<SavedResumeVersion[]> {
  try {
    const response = await fetch(`${apiBase}/api/versions`, {
      headers: getVisitorHeaders()
    });
    if (!response.ok) throw new Error("Failed to load versions");
    return (await response.json()) as SavedResumeVersion[];
  } catch {
    return loadLocalVersions();
  }
}

export async function saveVersion(version: SavedResumeVersion) {
  saveLocalVersion(version);
  try {
    const response = await fetch(`${apiBase}/api/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getVisitorHeaders() },
      body: JSON.stringify(version)
    });
    if (!response.ok) throw new Error("Failed to save version");
  } catch (error) {
    console.warn("Saved locally because the backend is unavailable.", error);
  }
}

export async function deleteVersion(id: string) {
  deleteLocalVersion(id);
  try {
    const response = await fetch(`${apiBase}/api/versions/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: getVisitorHeaders()
    });
    if (!response.ok) throw new Error("Failed to delete version");
  } catch (error) {
    console.warn("Deleted locally because the backend is unavailable.", error);
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

export async function deleteAllCloudVersions() {
  const response = await fetch(`${apiBase}/api/versions`, {
    method: "DELETE",
    headers: getVisitorHeaders()
  });
  if (!response.ok) throw new Error("云端数据删除失败，请稍后重试。");
  clearLocalResumeData();
}

function loadLocalInterest(): UnlockInterest[] {
  try {
    const raw = localStorage.getItem(interestKey);
    return raw ? (JSON.parse(raw) as UnlockInterest[]) : [];
  } catch {
    return [];
  }
}

function saveLocalInterest(interest: UnlockInterest) {
  const leads = loadLocalInterest();
  const next = [interest, ...leads.filter((item) => item.id !== interest.id)].slice(0, 50);
  localStorage.setItem(interestKey, JSON.stringify(next));
}

function deleteLocalInterest(id: string) {
  const next = loadLocalInterest().filter((item) => item.id !== id);
  localStorage.setItem(interestKey, JSON.stringify(next));
}

export async function saveUnlockInterest(interest: UnlockInterest) {
  saveLocalInterest(interest);
  try {
    const response = await fetch(`${apiBase}/api/interest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(interest)
    });
    if (!response.ok) throw new Error("Failed to save unlock interest");
  } catch (error) {
    console.warn("Saved unlock interest locally because the backend is unavailable.", error);
  }
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
