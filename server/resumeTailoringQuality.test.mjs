import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRoleFitImpact } from "./resumeTailoringQuality.mjs";

const sourceText = [
  "教育背景",
  "新闻学本科",
  "经历",
  "校园推广活动执行，地推覆盖 400+ 人",
  "公众号运营：每周产出 3-4 篇深度原创",
  "小红书运营：输出 150+ 篇内容"
].join("\n");

const strategy = {
  targetRole: "新媒体运营实习生",
  keywords: ["内容运营", "账号运营"],
  priorityEvidence: [
    "公众号运营：每周产出 3-4 篇深度原创",
    "小红书运营：输出 150+ 篇内容"
  ],
  deprioritizedEvidence: ["校园推广活动执行，地推覆盖 400+ 人"],
  gaps: ["短视频拍摄"],
  highlights: ["前置小红书与公众号的内容运营证据"]
};

test("岗位证据未前置必须失败：原文在后半部分的岗位证据，成稿仍留在后半部分", () => {
  const draftText = [
    "教育背景",
    "新闻学本科",
    "经历",
    "校园推广活动执行，地推覆盖 400+ 人",
    "公众号运营：每周产出 3-4 篇深度原创",
    "小红书运营：输出 150+ 篇内容"
  ].join("\n");

  const result = evaluateRoleFitImpact({ sourceText, draftText, strategy });

  assert.equal(result.passed, false);
  assert.ok(result.checks.some((item) => /前置|前半部分/.test(item)));
});

test("岗位证据前置可以通过：成稿顶部核心优势出现可核实事实", () => {
  const draftText = [
    "核心优势",
    "- 小红书内容运营：日更原创，累计输出求职攻略 150+ 篇内容。",
    "- 公众号运营：每周产出 3-4 篇深度原创内容。",
    "教育背景",
    "新闻学本科",
    "经历",
    "- 校园推广活动执行，地推覆盖 400+ 人"
  ].join("\n");

  const result = evaluateRoleFitImpact({ sourceText, draftText, strategy });

  assert.equal(result.passed, true);
  assert.deepEqual(result.highlights, ["前置小红书与公众号的内容运营证据"]);
});

test("低相关经历仍占据成稿前半部分时必须失败", () => {
  const draftText = [
    "核心优势",
    "- 校园推广活动执行，地推覆盖 400+ 人",
    "- 公众号运营：每周产出 3-4 篇深度原创内容。",
    "教育背景",
    "新闻学本科",
    "经历",
    "- 小红书运营：输出 150+ 篇内容"
  ].join("\n");

  const result = evaluateRoleFitImpact({ sourceText, draftText, strategy });

  assert.equal(result.passed, false);
  assert.ok(result.checks.some((item) => /关联较弱|压缩/.test(item)));
});

test("前半部分可验证岗位证据不足两项时返回明确的证据缺口", () => {
  const thinStrategy = {
    ...strategy,
    priorityEvidence: ["小红书运营：输出 150+ 篇内容"]
  };
  const draftText = [
    "核心优势",
    "- 小红书运营：输出 150+ 篇内容",
    "教育背景",
    "新闻学本科",
    "经历",
    "校园推广活动执行"
  ].join("\n");

  const result = evaluateRoleFitImpact({ sourceText, draftText, strategy: thinStrategy });

  assert.equal(result.passed, false);
  assert.ok(result.checks.some((item) => /不足|缺口/.test(item)));
});

test("策略没有可前置证据时返回失败而不是高分", () => {
  const result = evaluateRoleFitImpact({
    sourceText,
    draftText: sourceText,
    strategy: { ...strategy, targetRole: "数据分析实习生", priorityEvidence: [] }
  });

  assert.equal(result.passed, false);
  assert.ok(result.checks.some((item) => /未识别出|缺少/.test(item)));
});

test("结果说明最多三条且必须来自真实事实", () => {
  const result = evaluateRoleFitImpact({
    sourceText: "小红书运营：输出 150+ 篇内容\n公众号运营：每周产出 3-4 篇",
    draftText: "核心优势\n- 小红书运营：输出 150+ 篇内容\n- 公众号运营：每周产出 3-4 篇",
    strategy: {
      ...strategy,
      priorityEvidence: [],
      highlights: [
        "前置小红书内容运营证据",
        "前置公众号内容运营证据",
        "整合社群增长数据",
        "压缩校园推广描述",
        "编造无关说明"
      ]
    }
  });

  assert.ok(result.highlights.length <= 3);
  assert.equal(result.highlights.includes("编造无关说明"), false);
  assert.equal(result.highlights.includes("整合社群增长数据"), false);
});

test("已强匹配的简历（证据本就在前半部分）标记为 alreadyWellTailored", () => {
  const wellTailoredSource = [
    "核心优势",
    "- 独立并行管理 3 个巨量引擎账户，月消耗约 60 万元",
    "- 实际获客成本约 95 元，参与 0-1 冷启动与 A/B 测试",
    "教育背景",
    "计算机科学与技术本科",
    "实习经历",
    "慈派（上海）医疗科技有限公司 | 广告投放实习生"
  ].join("\n");
  const adStrategy = {
    ...strategy,
    priorityEvidence: [
      "独立并行管理 3 个巨量引擎账户，月消耗约 60 万元",
      "实际获客成本约 95 元，参与 0-1 冷启动与 A/B 测试"
    ]
  };

  const result = evaluateRoleFitImpact({
    sourceText: wellTailoredSource,
    draftText: wellTailoredSource,
    strategy: adStrategy
  });

  assert.equal(result.passed, true);
  assert.equal(result.alreadyWellTailored, true);
});

test("顶部摘要已覆盖关键事实时，不应因后文存在更长原句而误判未前置", () => {
  const fullColdStart = "参与健康产品 0-1 冷启动，单轮批量搭建约 100 条计划，围绕素材卖点、出价策略、表单提交目标和落地页版本开展 A/B 测试";
  const fullReport = "独立输出投放日报，复盘消耗、转化数、CPA、CTR、CVR、素材表现、计划状态、后端反馈和次日优化动作";
  const source = ["教育背景", "实习经历", fullColdStart, fullReport].join("\n");
  const draft = [
    "核心优势",
    "- 参与健康产品 0-1 冷启动，单轮搭建约 100 条计划并开展 A/B 测试",
    "- 独立输出投放日报，复盘 CPA、CTR、CVR 与后端反馈",
    "教育背景",
    "实习经历",
    fullColdStart,
    fullReport
  ].join("\n");

  const result = evaluateRoleFitImpact({
    sourceText: source,
    draftText: draft,
    strategy: {
      priorityEvidence: [fullColdStart, fullReport],
      deprioritizedEvidence: [],
      highlights: []
    }
  });

  assert.equal(result.passed, true);
  assert.equal(result.checks.length, 0);
});

test("前半部分已有两项核心证据时，不应要求每一项策略证据都前置", () => {
  const account = "独立并行管理 3 个巨量引擎账户，月消耗约 60 万元，实际获客成本约 95 元";
  const coldStart = "参与健康产品 0-1 冷启动，单轮批量搭建约 100 条计划并开展 A/B 测试";
  const report = "独立输出投放日报，复盘 CPA、CTR、CVR、素材表现和后端反馈";
  const source = ["教育背景", "实习经历", account, coldStart, report].join("\n");
  const draft = ["核心优势", account, coldStart, "教育背景", "实习经历", report].join("\n");

  const result = evaluateRoleFitImpact({
    sourceText: source,
    draftText: draft,
    strategy: { priorityEvidence: [account, coldStart, report], deprioritizedEvidence: [], highlights: [] }
  });

  assert.equal(result.passed, true);
  assert.equal(result.checks.length, 0);
});

test("策略遗漏优先证据时，按目标岗位从原文回退提取可核实证据", () => {
  const source = [
    "教育背景",
    "校园推广活动执行，地推覆盖 400+ 人",
    "小红书 | 内容运营：输出求职攻略 150+ 篇，沉淀精准用户 300+ 人",
    "留学公众号 | 运营负责人：每周产出 3-4 篇原创内容，累计 50+ 篇"
  ].join("\n");
  const draft = [
    "核心优势",
    "- 小红书 | 内容运营：输出求职攻略 150+ 篇，沉淀精准用户 300+ 人",
    "- 留学公众号 | 运营负责人：每周产出 3-4 篇原创内容，累计 50+ 篇",
    "教育背景",
    "校园推广活动执行，地推覆盖 400+ 人"
  ].join("\n");

  const result = evaluateRoleFitImpact({
    sourceText: source,
    draftText: draft,
    strategy: { targetRole: "新媒体运营实习生", priorityEvidence: [], deprioritizedEvidence: [], highlights: [] }
  });

  assert.equal(result.passed, true);
  assert.equal(result.checks.length, 0);
});

test("顶部亮点不能使用原简历之外的成果", () => {
  const draftText = [
    "核心优势",
    "- 主导账号增长 300%，实现千万级曝光",
    "- 小红书运营：输出 150+ 篇内容",
    "- 公众号运营：每周产出 3-4 篇深度原创"
  ].join("\n");

  const result = evaluateRoleFitImpact({ sourceText, draftText, strategy });

  assert.equal(result.passed, false);
  assert.ok(result.checks.some((item) => /顶部亮点|未核实/.test(item)));
});

test("弱相关经历已后置时，相同日期不能让质检误判它仍在前半部分", () => {
  const weakExperience = "2024.09-至今 融合媒体学院外联部：主动联系校外品牌方并跟进活动对接";
  const contentExperience = "小红书内容运营：日更原创内容 150+ 篇，沉淀精准用户 300+ 人";
  const publicAccountExperience = "公众号运营：每周产出 3-4 篇原创内容，累计完成 50+ 篇";
  const source = [
    "教育背景",
    "2024.09-2028.07 四川传媒学院新闻学本科",
    weakExperience,
    contentExperience,
    publicAccountExperience
  ].join("\n");
  const draft = [
    "核心优势",
    contentExperience,
    publicAccountExperience,
    "教育背景",
    "2024.09-2028.07 四川传媒学院新闻学本科",
    "项目经历",
    "内容选题与排版支持",
    "社群日常维护",
    "活动物料整理",
    "技能：秀米、剪映",
    "其他实践",
    weakExperience
  ].join("\n");

  const result = evaluateRoleFitImpact({
    sourceText: source,
    draftText: draft,
    strategy: {
      priorityEvidence: [contentExperience, publicAccountExperience],
      deprioritizedEvidence: [weakExperience],
      highlights: []
    }
  });

  assert.equal(result.passed, true);
  assert.equal(result.checks.some((item) => /关联较弱/.test(item)), false);
});

test("弱相关经历不能因与核心经历共用起始月份而被误判前置", () => {
  const weakExperience = "2024.12-2025.02 红娘校园优享学车推广计划：完成市场调研与营销方案制定";
  const contentExperience = "2024.12-至今 小红书内容运营：日更原创内容 150+ 篇，沉淀精准用户 300+ 人";
  const publicAccountExperience = "留学公众号运营：每周产出 3-4 篇原创内容，累计完成 50+ 篇";
  const source = [weakExperience, contentExperience, publicAccountExperience].join("\n");
  const draft = [
    "核心优势",
    contentExperience,
    publicAccountExperience,
    "教育背景",
    "新闻学本科",
    "项目经历",
    "内容选题与排版支持",
    "社群日常维护",
    "活动物料整理",
    "技能：秀米、剪映",
    "其他实践",
    weakExperience
  ].join("\n");

  const result = evaluateRoleFitImpact({
    sourceText: source,
    draftText: draft,
    strategy: {
      priorityEvidence: [contentExperience, publicAccountExperience],
      deprioritizedEvidence: [weakExperience],
      highlights: []
    }
  });

  assert.equal(result.passed, true);
  assert.equal(result.checks.some((item) => /关联较弱/.test(item)), false);
});

test("弱相关经历排在全部核心证据之后时，不因仍处于全文前半段而失败", () => {
  const weakExperience = "校园推广活动执行：完成市场调研与线下活动物料协调";
  const contentExperience = "小红书内容运营：日更原创内容 150+ 篇，沉淀精准用户 300+ 人";
  const publicAccountExperience = "公众号运营：每周产出 3-4 篇原创内容，累计完成 50+ 篇";
  const source = [weakExperience, contentExperience, publicAccountExperience].join("\n");
  const draft = [
    "核心优势",
    contentExperience,
    publicAccountExperience,
    weakExperience,
    "技能与其他信息",
    "熟悉内容平台日常发布、排版与基础剪辑，能够配合活动执行、素材整理、社群维护、数据记录、选题协作和复盘文档沉淀。".repeat(5)
  ].join("\n");

  const result = evaluateRoleFitImpact({
    sourceText: source,
    draftText: draft,
    strategy: {
      priorityEvidence: [contentExperience, publicAccountExperience],
      deprioritizedEvidence: [weakExperience],
      highlights: []
    }
  });

  assert.equal(result.passed, true);
  assert.equal(result.checks.some((item) => /关联较弱/.test(item)), false);
});

test("弱相关经历排在两项前置核心证据之后时，不要求它再等待后文第三项证据", () => {
  const contentExperience = "小红书内容运营：日更原创内容 150+ 篇，沉淀精准用户 300+ 人";
  const publicAccountExperience = "公众号运营：每周产出 3-4 篇原创内容，累计完成 50+ 篇";
  const communityExperience = "社群运营：搭建并维护 4 个用户社群，记录日留存数据";
  const weakExperience = "校园推广活动执行：完成市场调研与线下活动物料协调";
  const source = [contentExperience, publicAccountExperience, communityExperience, weakExperience].join("\n");
  const draft = [
    "核心优势",
    contentExperience,
    publicAccountExperience,
    weakExperience,
    "教育背景",
    "新闻学本科",
    "其他实践",
    communityExperience
  ].join("\n");

  const result = evaluateRoleFitImpact({
    sourceText: source,
    draftText: draft,
    strategy: {
      priorityEvidence: [contentExperience, publicAccountExperience, communityExperience],
      deprioritizedEvidence: [weakExperience],
      highlights: []
    }
  });

  assert.equal(result.passed, true);
  assert.equal(result.checks.some((item) => /关联较弱/.test(item)), false);
});

test("核心证据完全未前置时，弱相关经历不叠加误报排在核心证据之前", () => {
  const filler = "这是一段很长的岗位无关描述，用于撑起前半部分篇幅，让核心证据全部落到后半部分区域。".repeat(4);
  const contentExperience = "公众号运营：每周产出 3-4 篇原创内容";
  const publicAccountExperience = "小红书运营：输出 150+ 篇内容";
  const weakExperience = "校园推广活动执行，地推覆盖 400+ 人";
  const source = [contentExperience, publicAccountExperience, weakExperience].join("\n");
  const draft = [
    "教育背景",
    filler,
    contentExperience,
    publicAccountExperience,
    "其他实践",
    weakExperience
  ].join("\n");

  const result = evaluateRoleFitImpact({
    sourceText: source,
    draftText: draft,
    strategy: {
      targetRole: "新媒体运营实习生",
      priorityEvidence: [contentExperience, publicAccountExperience],
      deprioritizedEvidence: [weakExperience],
      highlights: []
    }
  });

  assert.equal(result.passed, false);
  // 失败原因应是"核心证据未前置"，而不是弱相关经历误报
  assert.ok(result.checks.some((item) => /未前置/.test(item)));
  assert.equal(result.checks.some((item) => /关联较弱/.test(item)), false);
});

test("正文里提及「核心优势」的句子不会被误当成亮点栏目标题", () => {
  const draftText = [
    "我在实习中负责提升内容的传播效果，核心优势体现在选题与数据分析上",
    "核心优势",
    "- 小红书运营：输出 150+ 篇内容",
    "- 公众号运营：每周产出 3-4 篇深度原创"
  ].join("\n");

  const result = evaluateRoleFitImpact({ sourceText, draftText, strategy });

  // 标题应定位到真正的"核心优势"栏目行，正文提及不应触发未核实误报
  assert.equal(result.checks.some((item) => /顶部亮点|未核实/.test(item)), false);
});
