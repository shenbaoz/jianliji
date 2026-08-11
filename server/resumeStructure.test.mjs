import assert from "node:assert/strict";
import test from "node:test";
import { formatNumberedResumeWithRoles, parseResumeStructure } from "./resumeStructure.mjs";

test("parses a resume into sections, entries and bullet lines", () => {
  const resume = `张三
求职目标：内容运营
教育背景
新闻学本科
实习经历
2023.06 - 2024.02 某科技公司 内容运营实习生
负责公众号选题、撰写与排版，参与活动执行。
整理用户反馈并输出周报。
项目经历
2024.03 校园公众号改造计划
负责栏目规划与内容排期，完成 30 篇内容产出。
技能
剪映、秀米、Excel`;

  const parsed = parseResumeStructure(resume);
  assert.equal(parsed.entryCount, 2);
  assert.ok(parsed.sections.some((section) => section.name === "实习经历"));
  assert.ok(parsed.sections.some((section) => section.name === "项目经历"));
  const internship = parsed.sections.find((section) => section.name === "实习经历");
  assert.equal(internship.entries.length, 1);
  assert.match(internship.entries[0].header, /内容运营实习生/);
  assert.ok(internship.entries[0].bulletLines.length >= 2);
});

test("formats numbered lines with role annotations", () => {
  const resume = `教育背景
新闻学本科
实习经历
2023.06 - 2024.02 某公司 内容运营实习生
负责公众号内容制作。`;
  const formatted = formatNumberedResumeWithRoles(resume);
  assert.match(formatted, /0: \[章节标题\] 教育背景/);
  assert.match(formatted, /3: \[实习经历·条目头\] 2023\.06/);
  assert.match(formatted, /4: \[实习经历·职责行\] 负责公众号内容制作/);
});

test("detects when a resume has no experience entries at all", () => {
  const parsed = parseResumeStructure("张三\n电话：13812345678\n教育背景\n新闻学本科\n技能\n剪映");
  assert.equal(parsed.entryCount, 0);
  assert.ok(parsed.sections.length >= 2);
});
