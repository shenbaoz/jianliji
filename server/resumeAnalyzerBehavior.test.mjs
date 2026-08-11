import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

test("generateOptimizedResume rewrites weak experience lines instead of returning the original text", async () => {
  const { generateOptimizedResume } = await loadResumeAnalyzer();
  const input = {
    candidateName: "杜小艳",
    targetRole: "内容运营",
    resumeText: [
      "姓名：杜小艳",
      "工作经历",
      "2024.09-至今 美团 活动运营&社群运营",
      "负责拉新活动全流程策划、方案撰写与落地执行，单场拉新200+人，品牌渗透率提升15%",
      "搭建并运营4个用户社群，精细化运营实现日留存80%+"
    ].join("\n"),
    jobDescription: "负责内容运营、社群运营、活动策划、数据复盘，提升用户增长和留存。"
  };
  const report = {
    matchedKeywords: ["内容", "社群", "活动", "运营", "数据"],
    missingKeywords: ["复盘"]
  };
  const optimized = generateOptimizedResume(input, report, {
    metric: "单场拉新200+人，日留存80%+，品牌渗透率提升15%",
    role: "本人负责活动策划、社群运营、数据复盘"
  });

  assert.notEqual(optimized.fullText, input.resumeText);
  assert.match(optimized.fullText, /工作经历/);
  assert.match(optimized.fullText, /- 负责拉新活动全流程策划/);
  assert.doesNotMatch(optimized.fullText, /项目经历/);
  assert.match(optimized.fullText, /200\+|80%\+|15%/);
});

test("does not duplicate project bullets into work experience or emit campus-practice headings as content", async () => {
  const { generateOptimizedResume } = await loadResumeAnalyzer();
  const input = {
    candidateName: "林晓雨",
    targetRole: "数据分析实习生",
    resumeText: [
      "林晓雨｜统计学本科｜2026届｜上海",
      "项目经历",
      "校园消费数据分析｜数据分析成员｜2025.03-2025.06",
      "- 使用 Python 清洗 1200 份匿名问卷数据，完成分类统计和可视化。",
      "- 输出 12 页分析报告和 5 条运营建议。",
      "校园实践",
      "学生会活动复盘｜活动组成员｜2025.10-2025.12",
      "- 整理报名、到场和反馈数据，使用 Excel 数据透视表完成复盘。",
      "技能：Excel、Python、SQL"
    ].join("\n"),
    jobDescription: "协助业务数据整理、报表制作、专题分析和数据可视化。"
  };
  const report = { matchedKeywords: ["Excel", "Python", "SQL"], missingKeywords: [] };
  const optimized = generateOptimizedResume(input, report, {});

  assert.doesNotMatch(optimized.fullText, /工作经历/);
  assert.equal((optimized.fullText.match(/使用 Python 清洗/g) || []).length, 1);
  assert.equal((optimized.fullText.match(/学生会活动复盘/g) || []).length, 1);
  assert.doesNotMatch(optimized.fullText, /校园实践。/);
});

test("extracts a spaced Chinese name instead of saving an unnamed candidate", async () => {
  const { generateOptimizedResume } = await loadResumeAnalyzer();
  const optimized = generateOptimizedResume(
    {
      candidateName: "",
      targetRole: "运营实习生",
      resumeText: "杜 小 艳\n教育经历\n厦门大学\n项目经历\n- 负责校园活动执行与数据复盘",
      jobDescription: "负责活动运营和数据复盘"
    },
    { matchedKeywords: ["活动", "运营", "数据", "复盘"], missingKeywords: [] },
    {}
  );

  assert.match(optimized.fullText, /^杜小艳/m);
  assert.doesNotMatch(optimized.fullText, /求职者|未命名/);
});

test("keeps a professional-skills line instead of emitting a placeholder", async () => {
  const { generateOptimizedResume } = await loadResumeAnalyzer();
  const optimized = generateOptimizedResume(
    {
      candidateName: "杜小艳",
      targetRole: "新媒体运营",
      resumeText: "杜小艳\n专业技能：PR、AE、剪映、PS、秀米\n工作经历\n负责公众号内容运营与活动执行，累计发布原创内容 50 篇。",
      jobDescription: "负责新媒体内容运营与活动策划"
    },
    { matchedKeywords: ["内容运营", "活动策划"], missingKeywords: [] },
    {}
  );

  assert.match(optimized.fullText, /PR、AE、剪映、PS、秀米/);
  assert.doesNotMatch(optimized.fullText, /请从原简历中补充/);
});

async function loadResumeAnalyzer() {
  const tempDir = await mkdtemp(join(tmpdir(), "resume-analyzer-"));
  const outfile = join(tempDir, "resumeAnalyzer.mjs");
  await esbuild.build({
    entryPoints: [join(process.cwd(), "src", "services", "resumeAnalyzer.ts")],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    logLevel: "silent"
  });
  const mod = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
  await rm(tempDir, { recursive: true, force: true });
  return mod;
}
