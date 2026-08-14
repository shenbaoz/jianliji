import { resumeTemplates } from "../data/templates";
import type { ResumeTemplate } from "../types";

export type ManagedResumeTemplate = ResumeTemplate & {
  enabled: boolean;
};

const templateKey = "resume-job-fit-admin-templates";

let templatesCache: ManagedResumeTemplate[] | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("templates-updated", () => {
    templatesCache = null;
  });
}

export function getDefaultManagedTemplates(): ManagedResumeTemplate[] {
  return resumeTemplates.map((template) => ({
    ...template,
    enabled: true
  }));
}

export function loadManagedTemplates(): ManagedResumeTemplate[] {
  if (typeof window === "undefined") return getDefaultManagedTemplates();
  if (templatesCache) return templatesCache;

  try {
    const raw = localStorage.getItem(templateKey);
    if (!raw) return getDefaultManagedTemplates();
    const saved = JSON.parse(raw) as ManagedResumeTemplate[];
    if (!Array.isArray(saved)) return getDefaultManagedTemplates();

    templatesCache = getDefaultManagedTemplates().map((defaultTemplate) => ({
      ...defaultTemplate,
      ...saved.find((template) => template.id === defaultTemplate.id),
      id: defaultTemplate.id
    }));
    return templatesCache;
  } catch {
    return getDefaultManagedTemplates();
  }
}

export function getVisibleResumeTemplates(): ManagedResumeTemplate[] {
  const visibleTemplates = loadManagedTemplates().filter((template) => template.enabled);
  return visibleTemplates.length ? visibleTemplates : getDefaultManagedTemplates().slice(0, 1);
}

export function saveManagedTemplates(templates: ManagedResumeTemplate[]) {
  localStorage.setItem(templateKey, JSON.stringify(templates));
  window.dispatchEvent(new Event("templates-updated"));
}

export function resetManagedTemplates() {
  localStorage.removeItem(templateKey);
  window.dispatchEvent(new Event("templates-updated"));
  return getDefaultManagedTemplates();
}
