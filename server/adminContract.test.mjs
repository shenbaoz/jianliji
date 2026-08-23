import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("admin console is protected and only exposes customer feedback", async () => {
  const source = await readFile("src/components/AdminView.tsx", "utf8");

  assert.match(source, /hasAdminSession/);
  assert.match(source, /loginAdmin/);
  assert.match(source, /下载前反馈/);
  assert.match(source, /投票统计/);
  assert.match(source, /feedback-9-9/);
  assert.match(source, /admin-vote-bar/);
  assert.doesNotMatch(source, /feedback-not-willing|feedback-19-9-plus|暂不付费|及以上/);
  assert.doesNotMatch(source, /模板上下架/);
  assert.doesNotMatch(source, /价格配置/);
  assert.doesNotMatch(source, /用户管理/);
  assert.doesNotMatch(source, /简历版本/);
});

test("admin API middleware rejects unauthenticated requests", async () => {
  const source = await readFile("server/app.mjs", "utf8");
  assert.match(source, /function requireAdmin\(sessions\)/);
  assert.match(source, /if \(!isAdmin\(req, sessions\)/);
  assert.match(source, /res\.status\(401\)/);
});

test("admin UI returns to login on expired sessions and surfaces action errors", async () => {
  const source = await readFile("src/components/AdminView.tsx", "utf8");

  assert.match(source, /管理员登录已失效/);
  assert.match(source, /setAuthenticated\(false\)/);
  assert.match(source, /setLoadError/);
  assert.match(source, /removeRow[\s\S]*?try[\s\S]*?catch/);
});

test("client storage keeps only APIs used by the current site", async () => {
  const source = await readFile("src/services/storage.ts", "utf8");

  assert.doesNotMatch(source, /export async function getStorageHealth/);
  assert.doesNotMatch(source, /export async function loadAdminVersions/);
  assert.doesNotMatch(source, /export async function deleteAdminVersion/);
  assert.doesNotMatch(source, /export async function recordUsageEvent/);
});
