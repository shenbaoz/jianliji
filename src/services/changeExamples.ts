import { diffChars } from "diff";

export type ChangeExample = { before: string; after: string; kind: "rewrite" | "reordered" };

export function buildChangeExamples(source: string, finalText: string): ChangeExample[] {
  const sourceLines = comparableLines(source);
  const finalLines = comparableLines(finalText);
  const reordered = sourceLines.find((line, index) => finalLines.indexOf(line) !== -1 && finalLines.indexOf(line) !== index);
  const rewrites = buildRewritePairs(sourceLines, finalLines, 18);

  return [
    ...(reordered ? [{ before: reordered, after: reordered, kind: "reordered" as const }] : []),
    ...rewrites
  ].slice(0, 4);
}

export function buildResumeChangeSet(source: string, finalText: string): Array<{ before: string; after: string }> {
  return buildRewritePairs(comparableLines(source), comparableLines(finalText), 8)
    .map(({ before, after }) => ({ before, after }));
}

export function buildVerifiedPdfChangeExamples(
  proposedChanges: Array<{ before: string; after: string }>,
  appliedChanges: Array<{ before: string; after: string }>
): ChangeExample[] {
  const proposed = new Set(proposedChanges.map(changeKey));
  return appliedChanges
    .filter((change) => proposed.has(changeKey(change)))
    .map((change) => ({ ...change, kind: "rewrite" as const }))
    .slice(0, 4);
}

function changeKey(change: { before: string; after: string }) {
  return `${change.before.replace(/\s+/g, "").trim()}\u0000${change.after.replace(/\s+/g, "").trim()}`;
}

function buildRewritePairs(sourceLines: string[], finalLines: string[], minimumLength: number) {
  const usedSourceLines = new Set<string>();
  return finalLines.flatMap((after) => {
    if (after.length < minimumLength || sourceLines.includes(after) || structuralLine(after)) return [];
    const candidates = sourceLines
      .filter((before) => !usedSourceLines.has(before) && !identityLine(before) && linesAreRelated(before, after))
      .map((before) => ({ before, score: similarityScore(before, after) }))
      .sort((left, right) => right.score - left.score);
    const best = candidates[0];
    if (!best || best.score < 0.42) return [];
    usedSourceLines.add(best.before);
    return [{ before: best.before, after, kind: "rewrite" as const }];
  });
}

function similarityScore(before: string, after: string) {
  const unchanged = diffChars(before, after)
    .filter((part) => !part.added && !part.removed)
    .reduce((total, part) => total + part.value.replace(/\s/g, "").length, 0);
  return unchanged / Math.max(1, Math.min(before.replace(/\s/g, "").length, after.replace(/\s/g, "").length));
}

function comparableLines(text: string) {
  return text.split(/\n+/).map((line) => line.replace(/^[\-•·]\s*/, "").trim()).filter(Boolean)
    .filter((line) => !/^(个人优势|核心能力|工作经历|实习经历|项目经历|教育经历|技能|技能清单|专业技能)$/.test(line));
}

function identityLine(line: string) {
  return /姓名|性别|出生年月|政治面貌|籍贯|邮箱|电话|联系方式|求职目标|求职意向/.test(line);
}

function structuralLine(line: string) {
  return /^(?:19|20)\d{2}[.年/-]/.test(line) && /大学|学院|本科|硕士|博士|大专|专业/.test(line);
}

function linesAreRelated(before: string, after: string) {
  const beforeTokens = tokenSet(before);
  const afterTokens = tokenSet(after);
  const shared = [...beforeTokens].filter((token) => afterTokens.has(token));
  return shared.length >= 2 || shared.length / Math.max(1, Math.min(beforeTokens.size, afterTokens.size)) >= 0.3;
}

function tokenSet(line: string) {
  const normalized = line
    .toLowerCase()
    .replace(/负责|参与|协助|完成|进行|通过|使用|实现/g, "")
    .replace(/[^\u4e00-\u9fa5a-z0-9+#.]/g, "");
  const tokens = new Set<string>(normalized.match(/[a-z][a-z0-9+#.]+|\d+(?:\.\d+)?/g) || []);
  const chinese = normalized.replace(/[a-z0-9+#.]/g, "");
  for (let index = 0; index < chinese.length - 1; index += 1) tokens.add(chinese.slice(index, index + 2));
  return tokens;
}
