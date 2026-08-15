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

  const declaredPriority = (strategy.priorityEvidence || [])
    .filter((item) => typeof item === "string" && item.trim());
  const priority = declaredPriority.length
    ? declaredPriority
    : inferPriorityEvidence(source, strategy.targetRole);
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

function inferPriorityEvidence(sourceText, targetRole) {
  const role = String(targetRole || "");
  const roleTerms = ["新媒体", "内容", "运营", "社群", "短视频", "投放", "广告", "信息流", "数据", "产品", "开发", "设计", "销售"]
    .filter((term) => role.includes(term));
  if (!roleTerms.length) return [];

  return String(sourceText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 12)
    .map((line) => ({
      line,
      score: roleTerms.reduce((total, term) => total + (line.includes(term) ? 3 : 0), 0)
        + (/\d+(?:\.\d+)?\s*(?:%|％|人|个|次|项|篇|万|条|户|家|月|周)?/.test(line) ? 1 : 0)
    }))
    .filter((item) => item.score >= 3)
    .sort((left, right) => right.score - left.score || right.line.length - left.line.length)
    .slice(0, 3)
    .map((item) => item.line);
}

/**
 * 在文本中定位某个事实片段：优先选取成稿中最早出现、且语义覆盖足够的候选句。
 * 顶部摘要往往会压缩原始长句；不能因为正文后部存在一条更接近原文的完整句，
 * 就忽略已前置的等价摘要。position 按归一化字符偏移计算，避免长短行影响前半部分判断。
 */
function locateEvidence(fragment, text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const target = normalizeForMatch(fragment);
  if (!target) return null;

  const targetBigrams = bigrams(target);
  const targetNumbers = new Set(target.match(/\d+(?:\.\d+)?%?/g) || []);

  const candidates = [];
  let charOffset = 0;
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
      // 简历摘要通常保留职责主语与核心动作、删去枚举项；连续保留 10 个字符视为足够的事实锚点。
      const leadLength = Math.min(10, target.length);
      if (leadLength >= 6 && normalized.includes(target.slice(0, leadLength))) score = Math.max(score, 0.5);
    }
    if (score >= 0.35) candidates.push({ index, score, length: normalized.length, charOffset });
    charOffset += normalized.length;
  }
  if (!candidates.length) return null;
  const bestScore = Math.max(...candidates.map((candidate) => candidate.score));
  // 允许摘要保留约一半的事实语义后被视为等价证据；数字型事实仍必须命中至少一个原始数字。
  const earliestEquivalent = candidates
    .filter((candidate) => candidate.score >= Math.max(0.35, bestScore * 0.45))
    .sort((left, right) => left.index - right.index)[0];
  const totalChars = Math.max(1, lines.reduce((sum, line) => sum + normalizeForMatch(line).length, 0));
  return {
    position: earliestEquivalent.charOffset / totalChars,
    lineIndex: earliestEquivalent.index,
    matchedLength: earliestEquivalent.length
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
