import assert from "node:assert/strict";
import test from "node:test";
import { buildQaMessages, buildRepairMessages, buildRewriteMessages, buildStrategyMessages, buildUniversalRefineMessages } from "./resumeOptimizationPrompts.mjs";

const input = { sourceMode: "creator", targetRole: "内容运营实习生", jobDescription: "负责内容和活动", resumeText: "课程项目：校园公众号；负责选题和排版", evidenceAnswers: [] };

test("universal refinement does not require a job description or target role", () => {
  const messages = buildUniversalRefineMessages({ resumeText: "教育经历\n某大学" });

  assert.doesNotMatch(JSON.stringify(messages), /JD|匹配度|评分/);
  assert.match(JSON.stringify(messages), /删除|合并|重写/);
});

test("multi-stage prompts reconstruct novice resumes without inventing employment", () => {
  const strategy = buildStrategyMessages(input).map((item) => item.content).join("\n");
  const rewrite = buildRewriteMessages(input, {}).map((item) => item.content).join("\n");
  const qa = buildQaMessages(input, {}, "正文").map((item) => item.content).join("\n");
  const repair = buildRepairMessages(input, {}, "正文", ["缺少置于简历顶部的核心优势栏目"]).map((item) => item.content).join("\n");
  assert.match(strategy, /课程、校园、社团、志愿、兼职和个人作品/);
  assert.match(rewrite, /完整保留有事实依据且与岗位相关的核心优势/);
  assert.match(rewrite, /不得为了控制数量删除真实优势/);
  assert.match(rewrite, /不得把课程、校园或兼职升级成正式任职/);
  assert.match(qa, /只输出 JSON/);
  assert.match(qa, /finalText/);
  assert.match(repair, /必须逐项修复全部失败项/);
  assert.match(repair, /求职目标之后、教育背景之前插入/);
  assert.doesNotMatch(rewrite, /沈保自|杜小艳/);
});

test("existing-resume prompts require visible substantive rewrites instead of spacing or synonym polish", () => {
  const resumeInput = { ...input, sourceMode: "resume" };
  const rewrite = buildRewriteMessages(resumeInput, {}).map((item) => item.content).join("\n");
  const qa = buildQaMessages(resumeInput, {}, "正文").map((item) => item.content).join("\n");

  assert.match(rewrite, /动作、方法、结果/);
  assert.match(rewrite, /禁止只修改空格、标点、数字间距或替换少量近义词/);
  assert.match(rewrite, /整句重写/);
  assert.match(qa, /肉眼可见的实质改写/);
  assert.match(qa, /suggestions.*必须为空数组/);
});

test("existing-resume strategy outputs content prioritization instead of preserving every section verbatim", () => {
  const resumeInput = { ...input, sourceMode: "resume" };
  const strategy = buildStrategyMessages(resumeInput).map((item) => item.content).join("\n");

  assert.match(strategy, /priorityEvidence/);
  assert.match(strategy, /deprioritizedEvidence/);
  assert.match(strategy, /highlights/);
  assert.match(strategy, /可核实/);
  assert.doesNotMatch(strategy, /保留全部原始经历、章节顺序/);
  assert.doesNotMatch(strategy, /禁止删除、合并、重排/);
});

test("existing-resume rewrite allows reordering, front-loading and compression while keeping facts", () => {
  const resumeInput = { ...input, sourceMode: "resume" };
  const rewrite = buildRewriteMessages(resumeInput, {}).map((item) => item.content).join("\n");

  assert.match(rewrite, /重排/);
  assert.match(rewrite, /前置/);
  assert.match(rewrite, /压缩/);
  assert.match(rewrite, /核心优势/);
  assert.match(rewrite, /必须原样保留/);
  assert.match(rewrite, /编造/);
  assert.doesNotMatch(rewrite, /不得删除、合并、重排/);
  assert.doesNotMatch(rewrite, /每条原文对应输出一条优化文本/);
});

test("existing-resume QA checks role-fit front-loading instead of fixed slot positions", () => {
  const resumeInput = { ...input, sourceMode: "resume" };
  const qa = buildQaMessages(resumeInput, {}, "正文").map((item) => item.content).join("\n");

  assert.match(qa, /priorityEvidence/);
  assert.match(qa, /前半部分/);
  assert.match(qa, /低相关经历/);
  assert.doesNotMatch(qa, /全部原始章节、经历、日期、公司、职位和条目数量都在原位置/);
});

test("existing-resume repair requires flagged low-relevance evidence to move after priority evidence", () => {
  const resumeInput = { ...input, sourceMode: "resume" };
  const strategy = {
    priorityEvidence: ["小红书运营：输出 150+ 篇内容", "公众号运营：每周产出 3-4 篇"],
    deprioritizedEvidence: ["校园地推活动"]
  };
  const repair = buildRepairMessages(
    resumeInput,
    strategy,
    "校园地推活动\n小红书运营：输出 150+ 篇内容",
    ["与岗位关联较弱的经历仍占据成稿前半部分，应压缩或后置：校园地推活动"]
  ).map((item) => item.content).join("\n");

  assert.match(repair, /不得只改写措辞/);
  assert.match(repair, /移动到所有 priorityEvidence 之后/);
  assert.match(repair, /最多保留一条短描述/);
});

test("existing-resume prompts require restrained HR-first highlights", () => {
  const resumeInput = { ...input, sourceMode: "resume" };
  const strategy = buildStrategyMessages(resumeInput).map((item) => item.content).join("\n");
  const rewrite = buildRewriteMessages(resumeInput, {}).map((item) => item.content).join("\n");

  assert.match(strategy, /开头摘要/);
  assert.match(strategy, /核心经历首条/);
  assert.match(rewrite, /一至两段经历/);
  assert.match(rewrite, /没有原始指标时不得补造数字/);
  assert.match(rewrite, /禁止为制造差异而全篇重写/);
});

test("existing-resume prompts preserve the source owner of every experience item", () => {
  const resumeInput = { ...input, sourceMode: "resume" };
  const strategy = buildStrategyMessages(resumeInput).map((item) => item.content).join("\n");
  const rewrite = buildRewriteMessages(resumeInput, {}).map((item) => item.content).join("\n");
  const qa = buildQaMessages(resumeInput, {}, "正文").map((item) => item.content).join("\n");
  const repair = buildRepairMessages(resumeInput, {}, "正文", ["经历归属错误"]).map((item) => item.content).join("\n");

  for (const prompt of [strategy, rewrite, qa, repair]) {
    assert.match(prompt, /不得.*并入.*公司|不得.*归并.*公司/);
    assert.match(prompt, /归属不明/);
  }
});

test("existing-resume prompts preserve work and education section boundaries", () => {
  const resumeInput = { ...input, sourceMode: "resume" };
  const prompts = [
    buildStrategyMessages(resumeInput),
    buildRewriteMessages(resumeInput, {}),
    buildQaMessages(resumeInput, {}, "正文")
  ].flat().map((item) => item.content).join("\n");

  assert.match(prompts, /工作经历/);
  assert.match(prompts, /教育经历/);
  assert.match(prompts, /不得.*教育.*工作|不得.*工作.*教育/);
});
