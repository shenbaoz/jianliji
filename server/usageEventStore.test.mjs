import assert from "node:assert/strict";
import test from "node:test";
import { createUsageEventStore } from "./usageEventStore.mjs";

test("usage event store counts unique visitors and total runs by mode", async () => {
  const store = createUsageEventStore();
  await store.ensureSchema();
  await store.record({ visitorId: "visitor-a1b2c3d4", eventType: "resume_optimize", candidateName: "张三", targetRole: "前端工程师", school: "清华大学", major: "计算机", degree: "本科" });
  await store.record({ visitorId: "visitor-a1b2c3d4", eventType: "resume_optimize", candidateName: "张三", targetRole: "前端工程师", school: "清华大学", major: "计算机", degree: "本科" });
  await store.record({ visitorId: "visitor-a1b2c3d4", eventType: "resume_optimize" });
  await store.record({ visitorId: "visitor-b1b2c3d4", eventType: "resume_optimize", targetRole: "后端工程师" });
  await store.record({ visitorId: "visitor-a1b2c3d4", eventType: "creator_generate", candidateName: "李四", targetRole: "内容运营" });

  const stats = await store.getStats();
  assert.deepEqual({ ...stats, recentEvents: undefined }, {
    optimizationUsers: 2,
    optimizationRuns: 3,
    creatorUsers: 1,
    creatorRuns: 1,
    recentEvents: undefined
  });
  assert.equal(stats.recentEvents.length, 4);
  const namedEvent = stats.recentEvents.find((event) => event.candidateName === "张三");
  assert.deepEqual(namedEvent, {
    id: namedEvent.id,
    createdAt: namedEvent.createdAt,
    eventType: "resume_optimize",
    candidateName: "张三",
    targetRole: "前端工程师",
    school: "清华大学",
    major: "计算机",
    degree: "本科"
  });
});
