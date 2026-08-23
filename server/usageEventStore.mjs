import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

const eventTypes = new Set(["resume_optimize", "creator_generate"]);

export function createUsageEventStore(filePath = null) {
  let memoryEvents = [];
  let writeQueue = Promise.resolve();

  return {
    async ensureSchema() {
      if (!filePath) return;
      await mkdir(dirname(filePath), { recursive: true });
      await writeEvents(filePath, await readEvents(filePath));
    },

    async record({ visitorId, eventType }) {
      if (!eventTypes.has(eventType)) throw new Error("Unsupported usage event type");
      return enqueue(async () => {
        const events = filePath ? await readEvents(filePath) : memoryEvents;
        const next = [...events, { id: randomUUID(), visitorId, eventType, createdAt: new Date().toISOString(), ...optionalDetails(arguments[0]) }];
        if (filePath) await writeEvents(filePath, next);
        else memoryEvents = next;
      });
    },

    async getStats() {
      await writeQueue;
      const events = filePath ? await readEvents(filePath) : memoryEvents;
      return summarize(events);
    }
  };

  function enqueue(fn) {
    writeQueue = writeQueue.then(fn, fn);
    return writeQueue;
  }
}

export function summarize(events) {
  const uniqueEvents = deduplicateEvents(events);
  return {
    optimizationUsers: new Set(uniqueEvents.filter((event) => event.eventType === "resume_optimize").map((event) => event.visitorId)).size,
    optimizationRuns: uniqueEvents.filter((event) => event.eventType === "resume_optimize").length,
    creatorUsers: new Set(uniqueEvents.filter((event) => event.eventType === "creator_generate").map((event) => event.visitorId)).size,
    creatorRuns: uniqueEvents.filter((event) => event.eventType === "creator_generate").length,
    recentEvents: uniqueEvents.slice(0, 50).map(toPublicEvent)
  };
}

function deduplicateEvents(events) {
  const sorted = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const kept = [];
  for (const event of sorted) {
    const duplicate = kept.some((item) => sameEvent(item, event) && Math.abs(Date.parse(item.createdAt) - Date.parse(event.createdAt)) <= 10 * 60 * 1000);
    if (!duplicate) kept.push(event);
  }
  return kept;
}

function sameEvent(left, right) {
  return left.eventType === right.eventType && ["candidateName", "targetRole", "school", "major", "degree"].every((key) => (left[key] || "") === (right[key] || ""));
}

function optionalDetails(event) {
  return Object.fromEntries(["candidateName", "targetRole", "school", "major", "degree"].map((key) => [key, typeof event?.[key] === "string" ? event[key].trim().slice(0, 255) : ""]));
}

function toPublicEvent(event) {
  return {
    id: event.id,
    createdAt: event.createdAt,
    eventType: event.eventType,
    candidateName: event.candidateName || "",
    targetRole: event.targetRole || "",
    school: event.school || "",
    major: event.major || "",
    degree: event.degree || ""
  };
}

async function readEvents(filePath) {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeEvents(filePath, events) {
  await mkdir(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(events, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}
