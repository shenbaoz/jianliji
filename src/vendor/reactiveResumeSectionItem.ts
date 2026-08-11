/*
 * Adapted from Reactive Resume, MIT License.
 * Source: https://github.com/amruthpillai/reactive-resume
 * Copyright (c) 2026 Amruth Pillai
 */

export function makeSectionItem<T extends { id: string }>(defaultItem: T, item?: T): T {
  if (item) return { ...item, id: crypto.randomUUID() };
  return { ...defaultItem, id: crypto.randomUUID() };
}
