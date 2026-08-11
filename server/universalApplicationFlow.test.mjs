import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("a resume can be optimized for a user-entered role direction without a company JD", async () => {
  const [app, job, shell] = await Promise.all([
    readFile(new URL("../src/App.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/JobView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/ProductShell.tsx", import.meta.url), "utf8")
  ]);

  assert.match(app, /input\.resumeText\.trim\(\)\.length > 20 && input\.targetRole\.trim\(\)\.length > 1/);
  assert.doesNotMatch(job, /jobDescription\.trim\(\)\.length/);
  assert.match(job, /placeholder="例如：内容运营、新媒体运营"/);
  assert.match(shell, /label: "求职方向"/);
});

test("the beginner flow asks for a role direction instead of a job description", async () => {
  const creator = await readFile(new URL("../src/components/CreatorView.tsx", import.meta.url), "utf8");

  assert.match(creator, /求职方向/);
  assert.doesNotMatch(creator, /招聘信息 \/ 岗位要求/);
  assert.doesNotMatch(creator, /粘贴岗位职责和任职要求/);
});
