import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSectionHeadingLines, preserveExperienceSections } from "./resumeSectionBoundaries.mjs";

test("restores a missing work-experience section instead of leaving it under education", () => {
  const source = `教育经历
2020.09-2024.06 某大学 新闻学本科
工作经历
2024.07-至今 某公司 内容运营
负责公众号选题、撰写与排版。
技能
剪映、Excel`;
  const draft = `核心优势
内容运营
教育经历
新闻学本科
技能
剪映、Excel`;

  const restored = preserveExperienceSections(draft, source);

  assert.match(restored, /教育经历[\s\S]*工作经历[\s\S]*某公司 内容运营/);
  assert.match(restored, /技能/);
});

test("does not duplicate an existing experience section", () => {
  const source = "工作经验\n2024.07-至今 某公司 内容运营\n负责公众号运营";
  const draft = "工作经历\n某公司 内容运营\n负责公众号运营";

  assert.equal(preserveExperienceSections(draft, source), draft);
});

test("puts section headings on their own lines when AI glues them to body text", () => {
  const draft = "个人信息：张三 核心优势\n- 负责内容运营\n项目总结 教育经历\n会员 工 作经历 中国科学院\n实 习经历";
  const normalized = normalizeSectionHeadingLines(draft);
  assert.equal(normalized, "个人信息：张三\n核心优势\n- 负责内容运营\n项目总结\n教育经历\n会员\n工作经历\n中国科学院\n实习经历");
});
