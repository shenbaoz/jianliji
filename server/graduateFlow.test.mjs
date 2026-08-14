import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

test("change examples label moved source lines as reordering instead of rewriting", async () => {
  const { buildChangeExamples } = await loadService("changeExamples");
  assert.deepEqual(buildChangeExamples("A 项目成果\nB 项目成果", "B 项目成果\nA 项目成果"), [
    { before: "A 项目成果", after: "A 项目成果", kind: "reordered" }
  ]);
});

test("change examples never pair semantically unrelated lines as a rewrite", async () => {
  const { buildChangeExamples } = await loadService("changeExamples");
  assert.deepEqual(
    buildChangeExamples("负责门店导购、商品陈列与顾客接待", "使用 Python 完成数据清洗、可视化和分析报告"),
    []
  );
});

test("change examples do not claim a short source fragment became an unrelated AI paragraph", async () => {
  const { buildResumeChangeSet } = await loadService("changeExamples");
  assert.deepEqual(
    buildResumeChangeSet(
      "像分析、市场洞察与数据整理。",
      "具备独立账号运营经验：负责留学公众号从0到1搭建，完成内容体系规划、选题策划与数据复盘。"
    ),
    []
  );
});

test("change examples match a rewrite by meaning after headings insert new line positions", async () => {
  const { buildChangeExamples } = await loadService("changeExamples");
  const examples = buildChangeExamples(
    "核心课程：新闻学概论、新闻采访与写作\n内容创作：擅长小红书、公众号图文原创、活动文案撰写",
    "教育经历\n2024.09-2028.07 四川传媒学院 新闻学 本科\n核心优势\n内容创作：聚焦小红书与公众号图文原创，持续完成活动文案撰写"
  );

  assert.ok(examples.some((item) => item.before.startsWith("内容创作：") && item.after.startsWith("内容创作：聚焦")));
  assert.ok(examples.every((item) => !(item.before.startsWith("核心课程：") && item.after.startsWith("2024.09"))));
});

test("PDF change examples show only rewrites the server actually applied", async () => {
  const { buildVerifiedPdfChangeExamples } = await loadService("changeExamples");
  const proposed = [
    { before: "原文第一条", after: "AI 改写第一条" },
    { before: "原文第二条", after: "AI 改写第二条" }
  ];
  const applied = [{ before: "原文第二条", after: "AI 改写第二条" }];

  assert.deepEqual(buildVerifiedPdfChangeExamples(proposed, applied), [
    { before: "原文第二条", after: "AI 改写第二条", kind: "rewrite" }
  ]);
});

async function loadService(name) {
  return loadModule(join("src", "services", `${name}.ts`));
}

async function loadModule(entry) {
  const tempDir = await mkdtemp(join(tmpdir(), "graduate-flow-"));
  const outfile = join(tempDir, "module.mjs");
  await esbuild.build({
    entryPoints: [join(process.cwd(), entry)],
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
