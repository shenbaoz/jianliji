const phonePattern = /(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d[-\s]?\d{4}[-\s]?\d{4}(?!\d)/g;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const mainlandIdPattern = /(?<!\d)\d{17}[\dXx](?!\d)/g;
const addressPattern = /(?:北京市|上海市|天津市|重庆市|[\u4e00-\u9fff]{2,8}省)[^，。；;\n]{0,36}(?:路|街|道|巷|弄|小区)[^，。；;\n]{0,20}(?:\d+[号室栋单元]?|号|室)/g;
const toolPattern = /(?:\b(?:Excel|Python|SQL|Tableau|Power\s?BI|Figma|Axure|React|TypeScript|JavaScript|Photoshop|Premiere)\b|剪映|秀米|135编辑器)/gi;

export function redactResumeContacts(text) {
  const replacements = new Map();
  let phoneIndex = 0;
  let emailIndex = 0;
  const replace = (value, type, index) => {
    const token = `{{${type}_${index}}}`;
    replacements.set(token, value);
    return token;
  };

  const withoutPhones = String(text || "").replace(phonePattern, (value) => replace(value, "PHONE", ++phoneIndex));
  return {
    text: withoutPhones.replace(emailPattern, (value) => replace(value, "EMAIL", ++emailIndex)),
    replacements
  };
}

function restoreContacts(text, replacements) {
  return Array.from(replacements.entries()).reduce((result, [token, value]) => result.split(token).join(value), String(text || ""));
}

export function redactAiPayload({ resumeText, targetRole, jobDescription, evidenceAnswers = [] }) {
  const candidateName = extractCandidateName(resumeText);
  const resume = redactResumeContacts(resumeText);
  const redactIdentity = (value) => {
    let output = String(value || "")
      .replace(phonePattern, "[联系方式已脱敏]")
      .replace(emailPattern, "[联系方式已脱敏]")
      .replace(mainlandIdPattern, "[身份证已脱敏]")
      .replace(addressPattern, "[详细地址已脱敏]");
    if (candidateName) output = output.replace(new RegExp(escapeRegExp(candidateName), "g"), "[姓名已脱敏]");
    return output;
  };

  return {
    payload: {
      resumeText: redactIdentity(resume.text),
      targetRole: redactIdentity(targetRole),
      jobDescription: redactIdentity(jobDescription),
      evidenceAnswers: Array.isArray(evidenceAnswers) ? evidenceAnswers.map(redactIdentity) : []
    },
    replacements: resume.replacements
  };
}

function extractCandidateName(text) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 8);
  for (const line of lines) {
    const labelled = line.match(/^姓名\s*[:：]\s*([\u4e00-\u9fff·]{2,6})$/);
    if (labelled) return labelled[1];
    if (
      /^[\u4e00-\u9fff·]{2,4}$/.test(line)
      && !/^(简历|教育背景|教育经历|个人信息|个人优势|核心优势|联系方式|求职意向|求职目标|工作经历|实习经历|项目经历|相关经历|校园经历|技能|技能优势|技能与优势|获奖经历|证书|荣誉|自我评价)$/.test(line)
    ) return line;
  }
  return "";
}

function restoreCandidateName(text, candidateName) {
  const output = String(text || "").trim();
  if (!candidateName) return output.replace(/^\s*\[姓名已脱敏\]\s*(?:\r?\n|$)/gm, "").trim();
  const restored = output.replace(/\[姓名已脱敏\]/g, candidateName);
  const lines = restored.split(/\r?\n/);
  const withoutDuplicateNameLines = lines.filter((line, index) => index === 0 || line.trim() !== candidateName);
  if (withoutDuplicateNameLines[0]?.trim() === candidateName) return withoutDuplicateNameLines.join("\n");
  return [candidateName, ...withoutDuplicateNameLines.filter((line) => line.trim() !== candidateName)].join("\n");
}

function restoreSourceContact(text, sourceText) {
  const output = String(text || "").trim();
  const sourceLines = String(sourceText || "").split(/\r?\n/).map((line) => line.trim());
  const sourceContact = sourceLines
    .map((line) => line.trim())
    .find((line) => /^联系方式\s*[:：]/.test(line));
  const location = sourceLines
    .find((line) => /^(?:期望地点|期望工作地点|所在地|城市)\s*[:：]/.test(line))
    ?.replace(/^(?:期望地点|期望工作地点|所在地|城市)\s*[:：]\s*/, "");
  const contactMarkers = sourceContact
    ? sourceContact.match(new RegExp(`${emailPattern.source}|${phonePattern.source}`, "gi")) || []
    : [];
  const lines = output.split(/\r?\n/).filter((line) => (
    /^联系方式\s*[:：]/.test(line)
    || !contactMarkers.some((marker) => line.includes(marker))
  ));
  const existingIndex = lines.findIndex((line) => /^联系方式\s*[:：]/.test(line));
  if (existingIndex >= 0) {
    if (location && !lines[existingIndex].includes(location)) lines[existingIndex] += `｜${location}`;
    return lines.join("\n");
  }
  if (!sourceContact) return output;
  const contactLine = `${sourceContact.replace(/^联系方式\s*[:：]\s*/, "联系方式：")}${location && !sourceContact.includes(location) ? `｜${location}` : ""}`;
  const targetIndex = lines.findIndex((line) => /^求职目标\s*[:：]/.test(line));
  lines.splice(targetIndex >= 0 ? targetIndex + 1 : Math.min(1, lines.length), 0, contactLine);
  return lines.join("\n");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 只把姓名/学校/专业/学历这类"需要 AI 写进成稿"的基础信息传给提示词；
// 电话、邮箱等联系方式由后端在成稿阶段确定性合并，不发送给 AI。
function pickBasicInfoForPrompt(raw) {
  const source = (raw && typeof raw === "object") ? raw : {};
  const result = {};
  for (const key of ["name", "school", "major", "degree"]) {
    const value = typeof source[key] === "string" ? source[key].trim().slice(0, 80) : "";
    if (value) result[key] = value;
  }
  return result;
}

const CN_DIGIT = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

function chineseToNumber(str) {
  let total = 0;
  let section = 0;
  let num = 0;
  for (const ch of str) {
    if (ch in CN_DIGIT) {
      num = CN_DIGIT[ch];
    } else if (ch === "十") {
      section += (num || 1) * 10;
      num = 0;
    } else if (ch === "百") {
      section += num * 100;
      num = 0;
    } else if (ch === "千") {
      section += num * 1000;
      num = 0;
    } else if (ch === "万") {
      total += (section + num) * 10000;
      section = 0;
      num = 0;
    } else {
      return null;
    }
  }
  const result = total + section + num;
  return result || null;
}

// 把"三个月""两家客户"等中文数词展开为阿拉伯数字 token，避免
// AI 把中文数字规范化为阿拉伯数字时被误判为"新增数字"。
function collectNumericTokens(text) {
  const tokens = (text.match(/\d+(?:\.\d+)?/g) || []).map(String);
  const cnPattern = /[零一二两三四五六七八九十百千万]+(?=[个名位家天月年次场条款人份台套平米平方米平千米里斤吨元角分%％]|多|余|左右|$)/g;
  for (const m of text.match(cnPattern) || []) {
    const n = chineseToNumber(m);
    if (n !== null && n !== 0) tokens.push(String(n));
  }
  return tokens;
}

// A draft number is trusted when it (a) appears verbatim in the source/evidence,
// (b) its digits can be assembled, in order, from adjacent source tokens, or
// (c) it matches a Chinese-numeral phrase from the source ("一个月" -> "1").
// This tolerates formatting rewrites ("2011-09" -> "2011.09") and masked
// contact digits ("181****9780" -> "1819780") without letting fabricated
// quantities through ("与2名开发人员" when no "2" exists in the source).
function isTrustedNumericToken(value, trustedNumbers) {
  if (trustedNumbers.includes(value)) return true;
  const plainValue = value.replace(/\D/g, "");
  if (!plainValue) return false;
  const plainTrusted = trustedNumbers.map((token) => token.replace(/\D/g, ""));
  for (let i = 0; i < plainTrusted.length; i++) {
    let acc = "";
    for (let j = i; j < plainTrusted.length && j < i + 6; j++) {
      acc += plainTrusted[j];
      if (acc === plainValue) return true;
      if (acc.length > plainValue.length) break;
    }
  }
  return false;
}

export function findUnverifiedClaims(sourceText, draftText, evidenceAnswers = []) {
  const trusted = `${sourceText || ""}\n${evidenceAnswers.join("\n")}`;
  const output = String(draftText || "");
  const flags = [];
  // Do not require word boundaries: English source resumes often express multipliers
  // as "15x", while the Chinese rewrite renders the same evidence as "15 倍".
  const trustedNumbers = collectNumericTokens(trusted);
  for (const value of new Set(collectNumericTokens(output))) {
    if (!isTrustedNumericToken(value, trustedNumbers)) flags.push(`新增数字“${value}”未在原简历或补充证据中找到。`);
  }
  const trustedTools = new Set((trusted.match(toolPattern) || []).map((value) => value.toLowerCase()));
  for (const value of new Set(output.match(toolPattern) || [])) {
    if (!trustedTools.has(value.toLowerCase())) flags.push(`新增工具“${value}”未在原简历或补充证据中找到。`);
  }
  const assertionTerms = ["独立", "主导", "牵头", "精通", "熟练", "全程负责"];
  for (const term of assertionTerms) {
    if (output.includes(term) && !trusted.includes(term)) flags.push(`能力表述“${term}”未在原简历或补充证据中找到。`);
  }
  return flags.slice(0, 8);
}

// 从 reviewFlags 提取被标记的 token（数字/工具/经历断言），
// 只在成稿中移除这些未验证 token 本身（含相邻量词），保留句子结构与优化效果。
// 例如 "与 2 名开发人员协同推进项目迭代" -> "与开发人员协同推进项目迭代"。
function autoStripUnverifiedClaims(draft, reviewFlags) {
  let text = String(draft || "");
  let removed = false;
  const flags = Array.isArray(reviewFlags) ? reviewFlags : [];
  for (const flag of flags) {
    const capture = flag.match(/新增(?:数字|工具|经历)“([^”]+)”/);
    if (!capture) continue;
    const token = capture[1].trim();
    if (!token) continue;
    const esc = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // 数字：删除 token 及紧跟的量词（"2名""80%""15分钟"）。
    // 前后加边界保护：{{PHONE_1}}、邮箱、版本号等占位符/标识里的数字不删除。
    const pattern = new RegExp(
      `(?<![\\dA-Za-z_])${esc}(?![\\dA-Za-z_])\\s*(?:%|％|人|个|次|项|篇|万|亿|单|户|家|份|条|款|张|件|批|轮|版|页|名|位|天|周|月|年|小时|分钟|倍|门|类|名开发人员)?`,
      "g"
    );
    const next = text.replace(pattern, "");
    if (next !== text) {
      text = next;
      removed = true;
    }
  }
  if (!removed) return draft;
  // 清理删除后残留的重复标点与多余空格
  return text
    .replace(/[，、；;：:]\s*[，、；;：:]/g, "，")
    .replace(/[。；]\s*[。；]/g, "。")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sanitizeResumeDraft(draftText, sourceText, evidenceAnswers = []) {
  const trusted = `${sourceText || ""}\n${evidenceAnswers.join("\n")}`;
  let text = String(draftText || "")
    .replace(/^.*\{\{NAME\}\}.*(?:\r?\n|$)/gim, "")
    .replace(/^.*\{\{(?:PHONE|EMAIL)_n\}\}.*(?:\r?\n|$)/gim, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, "")
    .replace(/^求职意向\s*[:：]\s*/gm, "求职目标：")
    .replace(/^教育背景\s*$/gm, "教育经历");
  if (!/(?:主修|相关)?课程\s*[:：]/.test(trusted)) {
    text = text.replace(/^\s*(?:主修|相关)?课程\s*[:：].*(?:\r?\n|$)/gm, "");
  }
  const replacements = new Map([
    ["熟练使用", "使用"], ["熟练掌握", "掌握基础"], ["熟练", ""], ["精通", "使用"],
    ["独立完成", "完成"], ["独立负责", "负责"], ["独立", ""], ["主导", "参与"],
    ["牵头", "参与协调"], ["全程负责", "负责"]
  ]);
  for (const [term, replacement] of replacements) {
    if (!trusted.includes(term)) text = text.split(term).join(replacement);
  }
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

export function createDeepSeekClient(options = {}) {
  return createChatCompletionClient({
    provider: "deepseek",
    endpoint: "https://api.deepseek.com/chat/completions",
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
    ...options
  });
}

export function createKimiClient(options = {}) {
  return createChatCompletionClient({
    provider: "kimi",
    endpoint: "https://api.moonshot.cn/v1/chat/completions",
    apiKey: process.env.KIMI_API_KEY,
    // moonshot-v1 系列已于 2026-08-31 全平台下线；kimi-k2 系列也已下线。
    // kimi-k3 为当前旗舰（1M 上下文，原生支持视觉），kimi-k2.6 为上一代 256k。
    model: process.env.KIMI_MODEL || "kimi-k3",
    ...options
  });
}

export function createFallbackAiClient(primary, fallback) {
  if (!primary) return fallback;
  if (!fallback) return primary;

  const withFallback = (method) => async (input) => {
    try {
      return await primary[method](input);
    } catch (primaryError) {
      try {
        return await fallback[method](input);
      } catch (fallbackError) {
        throw new Error(`AI 优化暂不可用：主服务失败（${primaryError.message}）；备用服务失败（${fallbackError.message}）。`);
      }
    }
  };

  return {
    optimize: withFallback("optimize"),
    ...(typeof primary.optimizeUniversal === "function" || typeof fallback.optimizeUniversal === "function"
      ? { optimizeUniversal: withFallback("optimizeUniversal") }
      : {})
  };
}

async function parseJsonContent(content, fallback) {
  try {
    const cleaned = String(content).replace(/^```json\s*/i, "").replace(/\s*```$/, "");
    return JSON.parse(cleaned);
  } catch { return fallback; }
}

function createChatCompletionClient({ provider, endpoint, apiKey, fetchImpl = fetch, model, timeoutMs = 60_000, pipelineDeadlineMs = 200_000 }) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  // 整条优化管线的总时长上限：客户端等待 240s（见 src/services/aiOptimize.ts 与 Nginx 对齐），
  // 服务端必须在其之前返回，避免客户端已超时、服务端仍继续调用模型烧 token。

  async function completeWithRetry(messages, json = false, maxTokens = 1800, reasoningEffort, deadlineAt = 0) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      const remainingMs = deadlineAt ? Math.max(0, deadlineAt - Date.now()) : timeoutMs;
      if (remainingMs < 3_000) {
        throw lastError || new Error(`${provider} 优化总时长超限，请稍后重试。`);
      }
      const attemptTimeout = deadlineAt ? Math.min(timeoutMs, remainingMs) : timeoutMs;
      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(attemptTimeout),
          body: JSON.stringify({
            model,
            // DeepSeek V4 使用 reasoning_effort 控制思考强度（none/high/max），
            // 旧参数 thinking: {type:"disabled"} 已被 V4 忽略。
            // 注意：reasoning_effort=high 时 reasoning tokens 计入 max_tokens，
            // 必须同步调大 max_tokens，否则输出会被截断（finish_reason=length）。
            ...(provider === "deepseek" ? { reasoning_effort: reasoningEffort || "none" } : {}),
            // Kimi K3 只接受 temperature=1（不允许其他值）
            temperature: provider === "kimi" ? 1 : (json ? 0.1 : 0.35),
            max_tokens: maxTokens,
            ...(json ? { response_format: { type: "json_object" } } : {}),
            messages
          })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const retryable = response.status >= 500 || response.status === 429;
          const errMsg = payload?.error?.message || `${provider === "kimi" ? "Kimi" : "DeepSeek"} 请求失败，请稍后重试。`;
          const error = new Error(errMsg);
          error.retryable = retryable;
          throw error;
        }
        const content = payload?.choices?.[0]?.message?.content?.trim();
        if (!content) throw new Error(`${provider === "kimi" ? "Kimi" : "DeepSeek"} 未返回可用的简历内容。`);
        return content;
      } catch (error) {
        lastError = error;
        const retryable = error?.retryable === true
          || error?.name === "TimeoutError"
          || error?.name === "AbortError";
        const canRetry = attempt < 2 && retryable && (!deadlineAt || Date.now() < deadlineAt - 5_000);
        if (canRetry) {
          await sleep(Math.min(2000 * Math.pow(2, attempt), 8000));
          continue;
        }
        throw error;
      }
    }
    throw lastError || new Error(`${provider} 请求失败。`);
  }

  async function optimizeUniversal({ resumeText }) {
    if (!apiKey) throw new Error(`未配置 ${provider === "kimi" ? "KIMI_API_KEY" : "DEEPSEEK_API_KEY"}，不会发送简历内容。`);
    const sourceText = String(resumeText || "");
    const redacted = redactAiPayload({ resumeText: sourceText });
    const { buildUniversalRefineMessages } = await import("./resumeOptimizationPrompts.mjs");
    const { evaluateUniversalRefinement } = await import("./resumeQualityGate.mjs");
    const deadlineAt = Date.now() + pipelineDeadlineMs;
    const raw = await completeWithRetry(buildUniversalRefineMessages({ resumeText: redacted.payload.resumeText }), true, 3200, undefined, deadlineAt);
    const parsed = await parseJsonContent(raw, { text: "", changes: [] });
    const candidateName = extractCandidateName(sourceText);
    const restoreInline = (value) => restoreContacts(
      String(value || "").replace(/\[姓名已脱敏\]/g, candidateName),
      redacted.replacements
    );
    const draft = sanitizeResumeDraft(parsed?.text, sourceText);
    const text = restoreSourceContact(
      restoreCandidateName(restoreContacts(draft, redacted.replacements), candidateName),
      sourceText
    );
    const changes = Array.isArray(parsed?.changes)
      ? parsed.changes
        .filter((change) => change && typeof change.before === "string" && typeof change.after === "string")
        .map((change) => ({ before: restoreInline(change.before).trim(), after: restoreInline(change.after).trim() }))
        .filter((change) => change.before)
      : [];
    const quality = evaluateUniversalRefinement({ sourceText, draft: text, changes });
    if (!quality.passed) {
      return {
        text: sourceText,
        changes: [],
        quality: { verdict: "unchanged", checks: quality.checks },
        safe: quality.reviewFlags.length === 0
      };
    }
    return {
      text,
      changes,
      quality: { verdict: "ready", checks: quality.checks },
      safe: true
    };
  }

  return {
    optimizeUniversal,
    async optimize({ resumeText, targetRole, jobDescription, evidenceAnswers = [], sourceMode = "resume", skippedFollowUp = false, fastPolish = false, basicInfo }) {
      if (sourceMode === "universal") return optimizeUniversal({ resumeText });
      if (!apiKey) throw new Error(`未配置 ${provider === "kimi" ? "KIMI_API_KEY" : "DEEPSEEK_API_KEY"}，已保留本地规则分析，不会发送简历内容。`);
      const redacted = redactAiPayload({ resumeText, targetRole, jobDescription, evidenceAnswers });
      const input = { ...redacted.payload, sourceMode, skippedFollowUp, basicInfo: pickBasicInfoForPrompt(basicInfo) };
      const { buildStrategyMessages, buildRewriteMessages, buildQaMessages, buildRepairMessages } = await import("./resumeOptimizationPrompts.mjs");
      const { evaluateResumeQuality, hasSubstantiveCreatorFacts } = await import("./resumeQualityGate.mjs");
      // 从零创建模式：用户没提供任何具体经历时，先追问而不是让 AI 编造。
      // 用户回答后（evidenceAnswers 非空）或明确跳过（skippedFollowUp）才进入生成管线。
      if (sourceMode === "creator" && !skippedFollowUp && evidenceAnswers.length === 0 && !hasSubstantiveCreatorFacts(resumeText)) {
        return {
          provider,
          model,
          text: "",
          suggestions: [
            "你具体做过哪些事？请举一件具体的（课程、社团、兼职、实习或项目都可以）。",
            "你掌握哪些工具或技能？比如剪映、Excel、PS、公众号排版等。"
          ],
          reviewFlags: [],
          safe: false,
          highlights: [],
          quality: { verdict: "needs_evidence", score: 0, checks: [], positive: { strongVerbCoverage: 0, quantifiedRatio: 0, templatePhrases: [], weakOpeners: [] }, highlights: [] }
        };
      }
      // 全管线共享一个总 deadline：任一调用按剩余时间收缩超时与重试，
      // 确保服务端在客户端等待窗口（240s）内返回，不出现客户端已放弃、服务端仍在调模型。
      const deadlineAt = Date.now() + pipelineDeadlineMs;
      // JSON Patch 快捷路径仅保留给显式请求的"快速润色"模式；
      // 深度岗位优化默认走"策略优先"管线，禁止因局部 patch 成功就提前返回。
      if (sourceMode === "resume" && fastPolish === true) {
        const patchResult = await tryApplyReactiveResumePatch({
          input,
          resumeText,
          evidenceAnswers,
          completeWithRetry,
          buildReactiveResumeImproveMessages: (await import("./vendor/reactive-resume/patch-proposal.mjs")).buildReactiveResumeImproveMessages,
          parseReactiveResumePatchResponse: (await import("./vendor/reactive-resume/patch-proposal.mjs")).parseReactiveResumePatchResponse,
          applyReactiveResumeProposals: (await import("./vendor/reactive-resume/patch-proposal.mjs")).applyReactiveResumeProposals,
          redacted,
          evaluateResumeQuality,
          extractCandidateName,
          restoreCandidateName,
          restoreContacts,
          restoreSourceContact,
          findUnverifiedClaims,
          provider,
          model,
          targetRole,
          deadlineAt
        });
        if (patchResult) return patchResult;
        // patch 路径失败或未通过质量门禁 → 自动降级到标准管线
      }
      const strategyRaw = await completeWithRetry(buildStrategyMessages(input), true, 700, undefined, deadlineAt);
      const strategy = await parseJsonContent(strategyRaw, { mode: sourceMode === "creator" ? "creator" : "novice", targetRole, keywords: [], priorityEvidence: [], deprioritizedEvidence: [], gaps: [], highlights: [], evidence: [], structure: [] });
      let draft = await completeWithRetry(buildRewriteMessages(input, strategy), false, 1800, undefined, deadlineAt);
      const qaRaw = await completeWithRetry(buildQaMessages(input, strategy, draft), true, 2200, undefined, deadlineAt);
      const qa = await parseJsonContent(qaRaw, { verdict: "ready", score: 85, issues: [], suggestions: [] });
      if (typeof qa.finalText === "string" && qa.finalText.trim()) draft = qa.finalText.trim();
      draft = sanitizeResumeDraft(draft, resumeText, evidenceAnswers);
      let quality = evaluateResumeQuality({ sourceText: resumeText, evidenceAnswers, targetRole, draft, sourceMode, qa, strategy });
      let autoStripped = false;
      // 最多两轮修复：让 AI 依据未验证清单自己删改并保持句子通顺（比删 token 保留更多语义）
      let repairCount = 0;
      while (!quality.passed && repairCount < 2) {
        draft = await completeWithRetry(buildRepairMessages(input, strategy, draft, quality.checks), false, 1800, undefined, deadlineAt);
        draft = sanitizeResumeDraft(draft, resumeText, evidenceAnswers);
        quality = evaluateResumeQuality({ sourceText: resumeText, evidenceAnswers, targetRole, draft, sourceMode, qa: { verdict: "ready", score: qa.score || 80 }, strategy });
        repairCount += 1;
      }
      if (!quality.passed && quality.reviewFlags?.length) {
        // 修复轮之后仍包含未验证内容：删除未核实数字/工具 token 本身，
        // 让用户拿到"去掉编造内容"的干净成稿，而不是只报错。
        const cleaned = autoStripUnverifiedClaims(draft, quality.reviewFlags);
        if (cleaned !== draft) {
          draft = cleaned;
          quality = evaluateResumeQuality({ sourceText: resumeText, evidenceAnswers, targetRole, draft, sourceMode, qa: { verdict: "ready", score: qa.score || 80 }, strategy });
          autoStripped = true;
        }
      }
      const text = restoreSourceContact(
        restoreCandidateName(restoreContacts(draft, redacted.replacements), extractCandidateName(resumeText)),
        resumeText
      );
      const highlights = Array.isArray(quality.highlights) ? quality.highlights.slice(0, 3) : [];
      if (autoStripped) highlights.push("AI 生成的部分内容未在你的简历中找到，已自动移除，确保成稿只保留真实信息。");      return { provider, model, text, suggestions: Array.isArray(qa.suggestions) ? qa.suggestions.slice(0, 3) : [], reviewFlags: quality.reviewFlags, safe: quality.reviewFlags.length === 0, highlights: highlights.slice(0, 3), quality: { verdict: quality.passed ? "ready" : "needs_evidence", score: quality.score, checks: quality.checks, positive: quality.positive, highlights: highlights.slice(0, 3) } };
    }
  };
}

/**
 * 尝试走 Reactive Resume patch 路径。任何一步失败（patch 无法解析、应用报错、
 * 无实质改写、或未通过完整质量门禁）都返回 null，让调用方降级到标准管线。
 */
async function tryApplyReactiveResumePatch({
  input,
  resumeText,
  evidenceAnswers,
  completeWithRetry,
  buildReactiveResumeImproveMessages,
  parseReactiveResumePatchResponse,
  applyReactiveResumeProposals,
  redacted,
  evaluateResumeQuality,
  extractCandidateName,
  restoreCandidateName,
  restoreContacts,
  restoreSourceContact,
  findUnverifiedClaims,
  provider,
  model,
  targetRole,
  deadlineAt = 0
}) {
  try {
    const patchContent = await completeWithRetry(buildReactiveResumeImproveMessages({ ...input, skippedFollowUp: input.skippedFollowUp }), true, 3200, undefined, deadlineAt);
    const proposals = parseReactiveResumePatchResponse(patchContent);
    const sourceLines = input.resumeText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const patched = applyReactiveResumeProposals({ lines: sourceLines }, proposals);
    if (!patched.changes.length) return null;
    const restore = (value) => restoreCandidateName(
      restoreContacts(value, redacted.replacements),
      extractCandidateName(resumeText)
    );
    const text = restoreSourceContact(restore(patched.lines.join("\n")), resumeText);
    const changes = patched.changes.map((change) => ({
      before: restore(change.before),
      after: restore(change.after)
    }));
    const reviewFlags = findUnverifiedClaims(resumeText, text, evidenceAnswers);
    if (reviewFlags.length) return null; // 含未核实信息 → 交给标准管线的质量门禁处理
    const quality = evaluateResumeQuality({ sourceText: resumeText, evidenceAnswers, targetRole, draft: text, sourceMode: "resume" });
    if (!quality.passed) return null; // 未通过完整质量门禁 → 降级
    return {
      provider,
      model,
      text,
      changes,
      suggestions: [],
      reviewFlags: [],
      safe: true,
      quality: { verdict: "ready", score: quality.score, checks: quality.checks, positive: quality.positive }
    };
  } catch {
    return null; // 任何解析/应用异常都降级到标准管线，不让单点失败拖垮整次优化
  }
}
