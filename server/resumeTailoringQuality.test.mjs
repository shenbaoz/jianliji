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
    strategy: { ...strategy, priorityEvidence: [] }
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
