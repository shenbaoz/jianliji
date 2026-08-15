/**
 * 岗位效果质检：验证成稿是否把目标岗位最相关的可核实证据前置到前半部分，
 * 而不是只检查"没编造、没丢章节、文字有差异"。
 *
 * evaluateRoleFitImpact({ sourceText, draftText, strategy })
 * 返回 { passed, checks, highlights, alreadyWellTailored }
 *
 * - passed：岗位匹配度是否明显提升（或原简历已强匹配且未降低专业性）
 * - checks：失败项说明，供质量门禁合并与修复提示词使用
 * - highlights：面向用户展示的"本次优化重点"，最多 3 条，必须来自真实事实
 * - alreadyWellTailored：原文中岗位优先证据本就在前半部分（原简历已强匹配，
 *   允许优化幅度较小，不需要为了制造差异而重排）
 */

export function evaluateRoleFitImpact({ sourceText, draftText, strategy = {} }) {
  const source = String(sourceText || "");
  const draft = String(draftText || "");
  const checks = [];
  const highlights = buildGroundedHighlights(strategy, source, draft);

  const priority = (strategy.priorityEvidence || [])
    .filter((item) => typeof item === "string" && item.trim());
  const deprioritized = (strategy.deprioritizedEvidence || [])
    .filter((item) => typeof item === "string" && item.trim());

  if (!priority.length) {
    checks.push("策略未识别出可前置的岗位证据，成稿无法证明岗位匹配度提升");
    return { passed: false, checks, highlights, alreadyWellTailored: false };
  }

  const sourceLocations = priority.map((fragment) => locateEvidence(fragment, source));
  const draftLocations = priority.map((fragment) => locateEvidence(fragment, draft));
  const matchedInDraft = draftLocations.filter(Boolean);

  if (!matchedInDraft.length) {
    checks.push("成稿未保留策略要求前置的岗位证据");
    return { passed: false, checks, highlights, alreadyWellTailored: false };
  }

  const frontPlaced = matchedInDraft.some((location) => location.position < 0.5);
  if (!frontPlaced) checks.push("岗位最相关证据未前置到成稿前半部分");

  priority.forEach((fragment, index) => {
    const sourceLocation = sourceLocations[index];
    const draftLocation = draftLocations[index];
    if (
      sourceLocation && draftLocation
      && sourceLocation.position >= 0.5
      && draftLocation.position >= 0.5
    ) {
      checks.push(`原文后半部分的岗位证据未前置：${truncate(fragment)}`);
    }
  });

  const firstHalfEvidenceCount = matchedInDraft
    .filter((location) => location.position < 0.5)
    .length;
  if (firstHalfEvidenceCount < 2) {
    checks.push(
      firstHalfEvidenceCount === 0
        ? "成稿前半部分缺少可验证的岗位证据，信息不足应补齐事实后再投递"
        : `成稿前半部分岗位证据不足（仅 ${firstHalfEvidenceCount} 项），应前置更多可验证证据`
    );
  }

  for (const fragment of deprioritized) {
    const location = locateEvidence(fragment, draft);
    if (location && location.position < 0.5 && location.matchedLength >= 10) {
      checks.push(`与岗位关联较弱的经历仍占据成稿前半部分，应压缩或后置：${truncate(fragment)}`);
    }
  }

  // 原简历中已有岗位优先证据位于前半部分 → 视为已强匹配，允许轻量优化
  const alreadyWellTailored = sourceLocations.some((location) => location && location.position < 0.5);

  return {
    passed: checks.length === 0,
    checks,
    highlights,
    alreadyWellTailored
  };
}

function buildGroundedHighlights(strategy, source, draft) {
  const trusted = normalizeForMatch(`${source}\n${draft}`);
  const trustedBigrams = bigrams(trusted);
  const candidates = (strategy.highlights || [])
    .filter((item) => typeof item === "string" && item.trim());
  const grounded = candidates.filter((item) => {
    const normalized = normalizeForMatch(item);
    if (!normalized) return false;
    const numbers = normalized.match(/\d+(?:\.\d+)?%?/g) || [];
    if (numbers.length) {
      return numbers.every((number) => trusted.includes(number))
        || countSharedBigrams(normalized, trustedBigrams) >= 2;
    }
    return countSharedBigrams(normalized, trustedBigrams) >= 2;
  });
  return grounded.slice(0, 3);
}

function truncate(value, limit = 28) {
  const text = String(value || "").trim();
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

/**
 * 在文本中定位某个事实片段：先按行归一化后做包含匹配，再退化为二元组相似度匹配。
 * 返回 { position, lineIndex, matchedLength }；position 为 0~1 的归一化行位置。
 */
function locateEvidence(fragment, text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const total = Math.max(1, lines.length);
  const target = normalizeForMatch(fragment);
  if (!target) return null;

  const targetBigrams = bigrams(target);
  const targetNumbers = new Set(target.match(/\d+(?:\.\d+)?%?/g) || []);

  let best = null;
  for (let index = 0; index < lines.length; index += 1) {
    const normalized = normalizeForMatch(lines[index]);
    if (!normalized) continue;
    let score;
    if (normalized.includes(target)) {
      score = 1;
    } else {
      const overlap = countSharedBigrams(normalized, targetBigrams) / Math.max(1, targetBigrams.length);
      const hasTargetNumber = [...targetNumbers].some((number) => normalized.includes(number));
      score = overlap * 0.7 + (hasTargetNumber ? 0.3 : 0);
    }
    if (score >= 0.35 && (!best || score > best.score)) {
      best = { index, score, length: normalized.length };
    }
  }
  if (!best) return null;
  return {
    position: (best.index + 1) / total,
    lineIndex: best.index,
    matchedLength: best.length
  };
}

function normalizeForMatch(value) {
  return String(value || "")
    .replace(/[\s，。；、:：|｜\-•·"'"“”‘’（）()【】《》]/g, "")
    .toLowerCase();
}

function bigrams(value) {
  const text = String(value || "");
  const result = [];
  for (let index = 0; index < text.length - 1; index += 1) {
    result.push(text.slice(index, index + 2));
  }
  return result;
}

function countSharedBigrams(value, targetBigrams) {
  const sourceBigrams = bigrams(value);
  const targetSet = new Set(targetBigrams);
  return sourceBigrams.filter((item) => targetSet.has(item)).length;
}
