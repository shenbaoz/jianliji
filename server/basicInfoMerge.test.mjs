import assert from "node:assert/strict";
import test from "node:test";
import { hasBasicInfo, mergeBasicInfo, normalizeBasicInfo } from "./basicInfoMerge.mjs";

test("normalizeBasicInfo trims values and caps length", () => {
  const normalized = normalizeBasicInfo({
    name: "  张三  ",
    school: "X".repeat(200),
    phone: " 13800138000 ",
    email: "a@b.com",
    major: undefined,
    degree: null
  });
  assert.equal(normalized.name, "张三");
  assert.equal(normalized.school.length, 80);
  assert.equal(normalized.phone, "13800138000");
  assert.equal(normalized.email, "a@b.com");
  assert.equal(normalized.major, "");
  assert.equal(normalized.degree, "");
  assert.equal(hasBasicInfo({ name: "" }), false);
  assert.equal(hasBasicInfo({ phone: "13800138000" }), true);
});

test("empty basic info leaves the draft unchanged", () => {
  const draft = "求职目标：内容运营\n核心优势\n- 完成校园公众号排版";
  assert.equal(mergeBasicInfo(draft, {}), draft);
  assert.equal(mergeBasicInfo(draft, null), draft);
  assert.equal(mergeBasicInfo("", { name: "张三" }), "");
});

test("name is prepended as a labeled header line when missing", () => {
  const draft = "求职目标：内容运营\n核心优势\n- 完成校园公众号排版";
  const merged = mergeBasicInfo(draft, { name: "张三" });
  const lines = merged.split("\n");
  assert.equal(lines[0], "姓名：张三");
  assert.ok(merged.includes("求职目标：内容运营"));
});

test("labeled name header is kept when it matches", () => {
  const draft = "姓名：张三\n求职目标：内容运营";
  assert.equal(mergeBasicInfo(draft, { name: "张三" }), draft);
});

test("plain first-line name is kept as the header", () => {
  const draft = "张三\n求职目标：内容运营";
  const merged = mergeBasicInfo(draft, { name: "张三" });
  assert.equal(merged.split("\n")[0], "张三");
  assert.equal(merged.split("\n").filter((line) => line === "张三").length, 1);
});

test("edited name replaces a stale labeled header", () => {
  const draft = "姓名：李四\n求职目标：内容运营";
  const merged = mergeBasicInfo(draft, { name: "张三" });
  assert.equal(merged.split("\n")[0], "姓名：张三");
  assert.ok(!merged.includes("李四"));
});

test("duplicate name lines elsewhere in the body are removed", () => {
  const draft = "姓名：张三\n核心优势\n- 完成校园公众号排版\n姓名：张三\n技能\n剪映";
  const merged = mergeBasicInfo(draft, { name: "张三" });
  assert.equal(merged.split("\n").filter((line) => line === "姓名：张三").length, 1);
});

test("contact line is inserted after the name when missing", () => {
  const draft = "姓名：张三\n求职目标：内容运营";
  const merged = mergeBasicInfo(draft, { name: "张三", phone: "13800138000", email: "a@b.com" });
  const lines = merged.split("\n");
  assert.equal(lines[0], "姓名：张三");
  assert.equal(lines[1], "联系方式：13800138000｜a@b.com");
});

test("existing contact line gets missing parts appended", () => {
  const draft = "姓名：张三\n联系方式：13800138000\n求职目标：内容运营";
  const merged = mergeBasicInfo(draft, { phone: "13800138000", email: "a@b.com", city: "成都" });
  assert.ok(merged.includes("联系方式：13800138000｜a@b.com｜成都"));
  assert.ok(!merged.includes("13800138000｜13800138000"));
});

test("contact parts already in the body are not duplicated", () => {
  const draft = "姓名：张三\n求职目标：内容运营\na@b.com";
  const merged = mergeBasicInfo(draft, { phone: "13800138000", email: "a@b.com" });
  assert.equal(merged.split("\n").filter((line) => line.includes("a@b.com")).length, 1);
  assert.ok(merged.includes("联系方式：13800138000"));
});

test("school is inserted into the existing education section when missing", () => {
  const draft = "姓名：张三\n教育经历\n新闻学本科\n技能\n剪映";
  const merged = mergeBasicInfo(draft, { school: "某大学", major: "新闻学", degree: "本科" });
  const lines = merged.split("\n");
  const headingIndex = lines.indexOf("教育经历");
  assert.ok(headingIndex >= 0);
  assert.equal(lines[headingIndex + 1], "学校：某大学");
  assert.ok(merged.includes("新闻学本科"));
});

test("major and degree are added when the school is already present", () => {
  const draft = "姓名：张三\n教育经历\n某大学\n技能\n剪映";
  const merged = mergeBasicInfo(draft, { school: "某大学", major: "新闻学", degree: "本科" });
  const lines = merged.split("\n");
  const headingIndex = lines.indexOf("教育经历");
  assert.equal(lines[headingIndex + 1], "专业：新闻学｜学历：本科");
});

test("education section is created before skills when missing", () => {
  const draft = "姓名：张三\n核心优势\n- 完成校园公众号排版\n技能\n剪映";
  const merged = mergeBasicInfo(draft, { school: "某大学" });
  const lines = merged.split("\n");
  const educationIndex = lines.indexOf("教育背景");
  const skillsIndex = lines.indexOf("技能");
  assert.ok(educationIndex >= 0);
  assert.ok(skillsIndex > educationIndex);
  assert.equal(lines[educationIndex + 1], "学校：某大学");
});

test("school already present in the draft is not duplicated", () => {
  const draft = "姓名：张三\n教育经历\n某大学 新闻学本科\n技能\n剪映";
  const merged = mergeBasicInfo(draft, { school: "某大学" });
  assert.equal(merged.split("\n").filter((line) => line.includes("某大学")).length, 1);
});

test("merge keeps numbers and structure of the rest of the resume", () => {
  const draft = "姓名：张三\n核心优势\n- 独立运营公众号，实现互动量提升 30%\n工作经历\n某公司 新媒体运营";
  const merged = mergeBasicInfo(draft, { name: "张三", school: "某大学" });
  assert.ok(merged.includes("互动量提升 30%"));
  assert.ok(merged.includes("工作经历"));
});
