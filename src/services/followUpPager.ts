export function clampQuestionIndex(index: number, total: number) {
  return total < 1 ? 0 : Math.max(0, Math.min(index, total - 1));
}
