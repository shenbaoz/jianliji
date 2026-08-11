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
