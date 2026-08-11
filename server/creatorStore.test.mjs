import test from "node:test";
import assert from "node:assert/strict";
import { createCreatorStore } from "./creatorStore.mjs";

test("creator store keeps drafts isolated by anonymous visitor", async () => {
  const calls = [];
  const db = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.startsWith("SELECT profile_json")) return [[{ profile_json: JSON.stringify({ basics: { name: "林晓雨" } }) }]];
      return [[]];
    }
  };
  const store = createCreatorStore(db);
  await store.ensureSchema();
  await store.saveProfile("visitor-a", { basics: { name: "林晓雨" } });
  const profile = await store.getProfile("visitor-a");

  assert.equal(profile.basics.name, "林晓雨");
  assert.ok(calls.some(({ sql, values }) => sql.includes("anonymous_id = ?") && values.includes("visitor-a")));
});

test("creator store rejects an invalid visitor identifier", async () => {
  const store = createCreatorStore({ async query() { return [[]]; } });
  await assert.rejects(() => store.saveProfile("bad id", {}), /Anonymous visitor id is required/);
});
