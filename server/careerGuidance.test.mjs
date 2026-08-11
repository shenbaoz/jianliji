import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

test("routes mini-program development to technical evidence, not operations metrics", async () => {
  const { classifyRole, buildEvidenceQuestions } = await loadGuidance();
  const category = classifyRole("微信小程序前端开发工程师", "熟悉 TypeScript、组件封装、性能优化和接口联调");
  const questions = buildEvidenceQuestions(category, "graduate");

  assert.equal(category, "tech");
  assert.match(questions[0].question, /性能|稳定性|接口耗时|交付/);
  assert.doesNotMatch(questions[0].question, /下单|核销|GMV|ROI/);
});

test("gives graduates evidence prompts that allow coursework and an explicit skip", async () => {
  const { buildEvidenceQuestions } = await loadGuidance();
  const questions = buildEvidenceQuestions("content", "graduate");

  assert.match(questions[0].question, /课设|比赛|作品|项目/);
  assert.equal(questions[0].allowSkip, true);
  assert.match(questions[0].skipLabel, /暂无相关经历/);
});

test("creates requirement-to-evidence rows and retains unmet requirements", async () => {
  const { buildMatchItems } = await loadGuidance();
  const items = buildMatchItems("React、JavaScript、3年以上经验", "项目中使用 React 和 JavaScript 开发页面");

  assert.deepEqual(items.map((item) => [item.requirement, item.status]), [
    ["React", "matched"],
    ["JavaScript", "matched"],
    ["3年以上经验", "missing"]
  ]);
});

test("normalizes repeated tool requirements and includes Chinese responsibilities", async () => {
  const { buildMatchItems } = await loadGuidance();
  const items = buildMatchItems("使用 Excel、SQL，协助业务数据整理并输出分析结论", "使用 Excel 和 SQL 整理数据");

  assert.equal(items.filter((item) => item.requirement === "Excel").length, 1);
  assert.ok(items.some((item) => item.requirement.includes("业务数据整理")));
});

test("ignores JD section headings and matches evidence with spacing differences", async () => {
  const { buildMatchItems } = await loadGuidance();
  const items = buildMatchItems(
    "岗位职责\n负责内容运营与数据复盘\n任职要求\n熟悉 Excel 数据透视表",
    "项目经历\n使用Excel数据透视表完成活动数据复盘"
  );

  assert.equal(items.some((item) => /岗位职责|任职要求/.test(item.requirement)), false);
  assert.equal(items.find((item) => item.requirement === "Excel")?.status, "matched");
  assert.equal(items.some((item) => item.status === "matched" && /数据复盘/.test(item.requirement)), true);
});

test("recognizes common modern frontend skills as separate evidence requirements", async () => {
  const { buildMatchItems } = await loadGuidance();
  const items = buildMatchItems(
    "前端开发实习生。参与 Web 前端页面与交互功能开发，完成接口联调、组件封装和问题排查。熟悉 HTML、CSS、JavaScript、TypeScript 和 Vue 或 React，了解 Git 与 Vite，有课程项目或实习经验。",
    "技术栈：Vue 3、HTML5、CSS3、Git；使用 Vite 完成项目构建"
  );

  for (const skill of ["HTML", "CSS", "Vue", "Git", "Vite"]) {
    assert.equal(items.find((item) => item.requirement === skill)?.status, "matched", `${skill} should match`);
  }
  assert.equal(items.find((item) => item.requirement === "JavaScript")?.status, "missing");
});

async function loadGuidance() {
  const tempDir = await mkdtemp(join(tmpdir(), "career-guidance-"));
  const outfile = join(tempDir, "module.mjs");
  await esbuild.build({
    entryPoints: [join(process.cwd(), "src", "services", "careerGuidance.ts")],
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
