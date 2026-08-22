import assert from "node:assert/strict";
import test from "node:test";
import { createUsageEventStore } from "./usageEventStore.mjs";

test("usage event store counts unique visitors and total runs by mode", async () => {
  const store = createUsageEventStore();
  await store.ensureSchema();
  await store.record({ visitorId: "visitor-a1b2c3d4", eventType: "resume_optimize" });
  await store.record({ visitorId: "visitor-a1b2c3d4", eventType: "resume_optimize" });
  await store.record({ visitorId: "visitor-b1b2c3d4", eventType: "resume_optimize" });
  await store.record({ visitorId: "visitor-a1b2c3d4", eventType: "creator_generate" });

  assert.deepEqual(await store.getStats(), {
    optimizationUsers: 2,
    optimizationRuns: 3,
    creatorUsers: 1,
    creatorRuns: 1
  });
});
