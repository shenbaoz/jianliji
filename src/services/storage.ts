import type { SavedResumeVersion } from "../types";

const key = "resume-job-fit-versions";

export function loadVersions(): SavedResumeVersion[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as SavedResumeVersion[]) : [];
  } catch {
    return [];
  }
}

export function saveVersion(version: SavedResumeVersion) {
  const versions = loadVersions();
  const next = [version, ...versions.filter((item) => item.id !== version.id)].slice(0, 20);
  localStorage.setItem(key, JSON.stringify(next));
}

export function deleteVersion(id: string) {
  const next = loadVersions().filter((item) => item.id !== id);
  localStorage.setItem(key, JSON.stringify(next));
}
