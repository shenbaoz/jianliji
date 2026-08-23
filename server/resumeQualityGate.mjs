import { findUnverifiedClaims } from "./aiProvider.mjs";
import { evaluateRoleFitImpact } from "./resumeTailoringQuality.mjs";

const STRONG_VERBS = ["负责", "完成", "主导", "搭建", "优化", "分析", "设计", "开发", "落地", "推进", "统筹", "策划", "输出", "搭建并", "独立完成", "独立负责", "独立策划", "编写", "建立", "制定", "管理", "维护", "协调", "组织", "参与", "协助", "执行", "撰写", "处理", "跟进", "打通", "沉淀", "上线", "迭代", "重构", "监控", "复盘", "交付", "从0搭建", "从零搭建", "持续优化", "围绕", "针对", "基于", "结合", "通过", "开展", "承担", "把控", "整理", "收集", "调研", "访谈", "测试", "构建", "部署", "运营", "推广", "拉新", "留存", "转化"];
const WEAK_OPENERS = ["负责日常", "负责相关", "参与日常", "协助日常", "负责一些", "参与一些", "做一些", "负责部分", "参与活动", "协助完成日常"];
const TEMPLATE_PHRASES = ["良好的沟通能力", "工作认真负责", "获得领导好评", "学习能力强", "性格开朗", "团队合作精神", "抗压能力强", "积极向上", "吃苦耐劳", "良好的团队协作能力", "较强的事业心", "具备良好的", "沟通协调能力", "多任务抗压能力强"];
const QUANT_PATTERN = /\d+(?:\.\d+)?\s*(?:%|％|人|个|次|项|篇|万|亿|单|户|家|份|条|款|张|件|批|轮|版|页|名|位|天|周|月|年|小时|分钟|倍|家|款|门|类)?/;

// 从零创建模式：用户事实稿只有求职意愿、没有具体经历时，AI 常会编造
// "拥有XX运营经验"式的具体经历。下面两条规则用于兜底拦截。
const CREATOR_INTENT_PATTERN = /(?:我想|希望|想|打算|计划|目标|意向|求职|应聘|找|投递)[^，。\n]{0,24}(?:工作|岗位|职位|方向|简历|实习)?/g;
const CREATOR_FACT_OBJECTS = /运营|负责|参与|组织|策划|设计|开发|写过|做过|整理|剪辑|拍摄|管理|创建|搭建|担任|实习|兼职|课程|社团|项目|公众号|账号|活动|视频|文章|文案|数据|排版|海报|脚本|编辑|编写|维护|推广|拉新|社群|客户|店铺|销售|客服|测试|代码|平台/;
const FABRICATED_EXPERIENCE_PATTERN = /(?:拥有|具备|有)(?:过)?(?:从零运营|独立运营|运营|管理|负责|参与|组织|策划|搭建|维护|创建|经营|撰写|设计|开发|完成|开展)[^，。\n]{2,40}?(?:经验|经历|账号|平台|项目|店铺|社群|体系|能力)/g;

export function hasSubstantiveCreatorFacts(sourceText) {
  const cleaned = String(sourceText || "").replace(CREATOR_INTENT_PATTERN, "").replace(/[，。；、\s]+/g, "");
  return cleaned.length >= 6 && CREATOR_FACT_OBJECTS.test(cleaned);
}

export function findFabricatedExperienceClaims(draft) {
  return [...new Set(String(draft || "").match(FABRICATED_EXPERIENCE_PATTERN) || [])].slice(0, 3);
}

export function evaluateUniversalRefinement({ sourceText, draft, changes }) {
  const source = String(sourceText || "").trim();
  const text = String(draft || "").trim();
  const normalizedChanges = Array.isArray(changes)
    ? changes
      .filter((change) => change && typeof change.before === "string" && typeof change.after === "string")
      .map((change) => ({ before: change.before.trim(), after: change.after.trim() }))
      .filter((change) => change.before)
    : [];
  const checks = [];

  if (!source) checks.push("原简历为空，无法安全整理");
  if (!text) checks.push("整理结果为空");
  if (source && text && normalizedResumeText(source) === normalizedResumeText(text)) checks.push("未产生实际文字改写");
  if (!normalizedChanges.length) checks.push("未提供可验证的改动记录");

  let hasSubstantiveChange = false;
  for (const change of normalizedChanges) {
    if (!source.includes(change.before)) checks.push(`改动原文未在简历中找到：${change.before}`);
    if (change.after && !text.includes(change.after)) checks.push(`改动结果未在成稿中找到：${change.after}`);
    if (!change.after && text.includes(change.before)) checks.push(`声明删除的内容仍在成稿中：${change.before}`);
    if (isSubstantiveUniversalChange(change.before, change.after)) hasSubstantiveChange = true;
  }
  if (normalizedChanges.length && !hasSubstantiveChange) checks.push("改动仅涉及标点、空格或少量近义词，不属于实质改写");

  const reviewFlags = findUnverifiedClaims(source, text);
  checks.push(...reviewFlags);
  const unique = [...new Set(checks)].slice(0, 12);
  return {
    passed: unique.length === 0,
    checks: unique,
    reviewFlags
  };
}

function isSubstantiveUniversalChange(before, after) {
  const source = normalizedResumeText(before);
  const result = normalizedResumeText(after);
  if (!source) return false;
  if (!result) return source.length >= 4;
  if (source === result) return false;
  const lengthDelta = Math.abs(source.length - result.length) / Math.max(source.length, result.length);
  return lengthDelta >= 0.2 || sourceSimilarity(source, result) < 0.72;
}

export function evaluateResumeQuality({ sourceText, evidenceAnswers = [], targetRole, draft, sourceMode = "standard", qa = {}, strategy }) {
  const text = String(draft || "").trim();
  const checks = [];
  const preservesExistingLayout = sourceMode === "resume";
  // 岗位效果检查：验证最相关证据是否前置、弱相关经历是否被压缩/后置
  const roleFit = preservesExistingLayout && strategy
    ? evaluateRoleFitImpact({ sourceText, draftText: text, strategy })
    : null;
  const alreadyWellTailored = Boolean(roleFit?.passed && roleFit.alreadyWellTailored);
  if (!preservesExistingLayout && text.length < 180) checks.push("正文过短，未达到基础投递完整度");
  if (!/(教育|学历|学校|项目|实践|经历|技能)/.test(text)) checks.push("缺少教育、经历或技能结构");
  if (preservesExistingLayout) {
    const lostSections = findLostSectionGroups(sourceText, text);
    if (lostSections.length) checks.push(`AI 删除了原简历的章节：${lostSections.join("、")}`);
  }
  if (!preservesExistingLayout && !/核心优势/.test(text)) checks.push("缺少置于简历顶部的核心优势栏目");
  if (!preservesExistingLayout && targetRole && !text.includes(targetRole) && !text.includes(targetRole.replace(/实习生|专员|工程师/g, ""))) checks.push("目标岗位不清晰");
  if (/(改写说明|投递前补强建议|\[待确认\]|\[待补充\]|TODO|作为AI|以下是)/i.test(text)) checks.push("正文混入说明或待确认内容");
  if (/自我评价|个人评价/.test(text)) checks.push("使用了空泛自我评价，应改为有证据的核心优势");
  if (sourceText && preservesExistingLayout && !alreadyWellTailored && normalizedResumeText(sourceText) === normalizedResumeText(text)) {
    checks.push("AI 未产生实际文字改写");
  } else if (sourceText && preservesExistingLayout && !alreadyWellTailored && sourceSimilarity(sourceText, text) > 0.94) {
    checks.push("改写幅度不足，成稿与原简历过于相似");
  } else if (sourceText && !preservesExistingLayout && sourceSimilarity(sourceText, text) > 0.88) {
    checks.push("改写幅度不足，成稿与原简历过于相似");
  }
  const reviewFlags = findUnverifiedClaims(sourceText, text, evidenceAnswers);
  // 从零创建模式兜底：用户没有提供具体经历时，成稿中出现"拥有XX经验"
  // 式的具体经历断言视为编造，直接拦下并提示（宁可占位，不虚构）。
  if (!preservesExistingLayout && !hasSubstantiveCreatorFacts(sourceText)) {
    for (const claim of findFabricatedExperienceClaims(text)) {
      reviewFlags.push(`新增经历“${claim}”未在用户提供的信息中找到。`);
    }
  }
  checks.push(...reviewFlags);
  if (roleFit) checks.push(...roleFit.checks);
  if (qa.verdict === "repair") checks.push(...(Array.isArray(qa.issues) ? qa.issues : ["招聘者质检未通过"]));
  const unique = [...new Set(checks)].slice(0, 12);
  // 模型自评分不可靠（可能极端低或虚高）：低于 65 视为不可信，用 65 保底
  const rawModelScore = Number(qa.score);
  const modelScore = Number.isFinite(rawModelScore) ? Math.max(65, Math.min(100, rawModelScore)) : 85;
  const positive = assessPositiveQuality(text);
  // 正向指标作为加分项：达标才加分（动词覆盖率 ≥0.7、量化覆盖率 ≥0.5、无模板化）
  const positiveBonus = (positive.strongVerbCoverage >= 0.7 ? 6 : 0) + (positive.quantifiedRatio >= 0.5 ? 6 : 0) + (positive.templatePhrases.length === 0 ? 4 : 0);
  const score = Math.max(0, Math.min(100, modelScore - unique.length * 8 + positiveBonus));
  return {
    passed: unique.length === 0,
    score,
    checks: unique,
    reviewFlags,
    positive,
    highlights: roleFit?.highlights || []
  };
}

/**
 * 正向质量评估：动词开头率、量化覆盖率、模板化检测。
 * 结果只用于加分与展示，不决定 passed（负向检查决定）。
 */
function assessPositiveQuality(text) {
  const experienceLines = extractExperienceLines(text);
  const strippedLines = experienceLines.map((line) => line.replace(/^[-•·▪◆◇]\s*/, "").trim());
  const strongVerbCoverage = strippedLines.length
    ? strippedLines.filter((line) => isStrongVerbStart(line)).length / strippedLines.length
    : 1;
  const quantifiedRatio = strippedLines.length
    ? strippedLines.filter((line) => QUANT_PATTERN.test(line)).length / strippedLines.length
    : 0;
  const templatePhrases = TEMPLATE_PHRASES.filter((phrase) => text.includes(phrase));
  const weakOpeners = strippedLines.filter((line) => WEAK_OPENERS.some((opener) => line.startsWith(opener)));
  return {
    experienceLineCount: experienceLines.length,
    strongVerbCoverage,
    quantifiedRatio,
    templatePhrases,
    weakOpeners,
    passHint: templatePhrases.length ? "存在空泛自我描述，建议删除" : weakOpeners.length ? "存在弱开头描述，建议改用强动词" : ""
  };
}

function extractExperienceLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => (
      line.length >= 8
      && !/^(核心优势|教育背景|教育经历|工作经历|实习经历|项目经历|校园经历|技能|技能清单|证书|荣誉|自我评价|个人评价|求职目标|求职意向|联系方式|个人信息)\s*[:：]?$/.test(line)
      && !/^\s*[-•·]\s*$/.test(line)
      && !/^(邮箱|电话|手机|微信|联系)/.test(line)
      && !/^\d+[.、]\s*(?:音视频|新媒体|内容|运营|通用|设计|视频|文案|数据分析|沟通)/.test(line)
      // 过滤条目头（公司|职位|日期 格式，如"慈派（上海）医疗科技有限公司 | 广告投放实习生 | 2025.07 - 2026.03"）
      && !(/\|/.test(line) && /(?:19|20)\d{2}/.test(line) && /本科|硕士|博士|实习生|专员|工程师|负责人|助理|经理|主管/.test(line))
    ));
}

const SECTION_HEADING_PATTERN = /^(核心优势|个人优势|教育背景|教育经历|工作经历|实习经历|项目经历|校园经历|项目经验|工作内容|技能|技能清单|技能与优势|证书|荣誉|自我评价|个人评价|获奖经历|相关经历|实践经历|主要经历|专业技能)\s*[:：]?$/;

const VERB_HEAD_REGEX = /^(?:独立|主导|统筹|负责|参与|协助|完成|搭建|优化|分析|设计|开发|落地|推进|策划|输出|编写|建立|制定|管理|维护|协调|组织|执行|撰写|处理|跟进|打通|沉淀|上线|迭代|重构|监控|复盘|交付|围绕|针对|基于|结合|通过|开展|承担|把控|整理|收集|调研|访谈|测试|构建|部署|运营|推广|拉新|留存|转化|聚焦|深入|挖掘|从0搭建|从零搭建|持续优化|将|拆分|接受|主动|系统|配合|实现|辅助|参与并|支持|提供|对接|跟进并|维护并|协助完成|负责并|复盘并|制定并)/;

function isStrongVerbStart(line) {
  if (STRONG_VERBS.some((verb) => line.startsWith(verb))) return true;
  if (WEAK_OPENERS.some((opener) => line.startsWith(opener))) return false;
  // 兼容"标签：内容"格式（如"账户管理：独立并行管理3个账户"）——剥离冒号前的短标签后检测
  const afterLabel = line.replace(/^[^：:]{1,8}[：:]\s*/, "");
  if (afterLabel !== line) {
    if (STRONG_VERBS.some((verb) => afterLabel.startsWith(verb))) return true;
    if (VERB_HEAD_REGEX.test(afterLabel.slice(0, 6))) return true;
    if (WEAK_OPENERS.some((opener) => afterLabel.startsWith(opener))) return false;
  }
  return VERB_HEAD_REGEX.test(line.slice(0, 6));
}

/**
 * 章节保留检查放宽为分组校验：教育/经历/技能/证书荣誉四类锚点中，
 * 只要原文有、成稿整组缺失才算删除章节。允许重排、合并、重命名
 * （如"专业技能"→"技能"、删除允许的空泛"自我评价"），但真实内容骨架必须保留。
 */
const SECTION_HEADING_GROUPS = [
  ["教育背景", "教育经历"],
  ["工作经历", "实习经历", "项目经历", "项目经验", "实践经历", "主要经历", "相关经历", "校园经历", "工作内容"],
  ["技能", "技能清单", "专业技能", "技能与优势"],
  ["证书", "荣誉", "获奖经历"]
];

function findLostSectionGroups(sourceText, draft) {
  const sourceHeadings = new Set(
    String(sourceText || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => SECTION_HEADING_PATTERN.test(line))
      .map((line) => line.replace(/[:：]$/, ""))
  );
  if (!sourceHeadings.size) return [];
  const draftHeadings = new Set(
    String(draft || "")
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/[:：]$/, ""))
      .filter((line) => SECTION_HEADING_PATTERN.test(line))
  );
  return SECTION_HEADING_GROUPS
    .filter((group) => group.some((heading) => sourceHeadings.has(heading)) && !group.some((heading) => draftHeadings.has(heading)))
    .map((group) => group[0]);
}

function normalizedResumeText(value) {
  return String(value || "").replace(/[\s，。；、:：|｜\-•·]/g, "");
}

function sourceSimilarity(sourceText, draft) {
  const source = normalizedResumeText(sourceText);
  const result = normalizedResumeText(draft);
  if (!source || !result) return 0;
  const sourcePairs = new Set(Array.from({ length: Math.max(0, source.length - 1) }, (_, index) => source.slice(index, index + 2)));
  const resultPairs = new Set(Array.from({ length: Math.max(0, result.length - 1) }, (_, index) => result.slice(index, index + 2)));
  const shared = [...sourcePairs].filter((pair) => resultPairs.has(pair)).length;
  return shared / Math.max(1, Math.min(sourcePairs.size, resultPairs.size));
}
