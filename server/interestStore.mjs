import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export function createInterestStore(filePath = null) {
  let memoryLeads = [];
  let writeQueue = Promise.resolve();

  function enqueueWrite(fn) {
    writeQueue = writeQueue.then(fn, fn);
    return writeQueue;
  }

  return {
    async ensureSchema() {
      if (!filePath) return;
      await mkdir(dirname(filePath), { recursive: true });
      await writeLeads(filePath, await readLeads(filePath));
    },

    async list() {
      const leads = filePath ? await readLeads(filePath) : memoryLeads;
      return [...leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
    },

    async save(lead) {
      return enqueueWrite(async () => {
        const normalized = normalizeLead(lead);
        const leads = filePath ? await readLeads(filePath) : memoryLeads;
        const next = [normalized, ...leads.filter((item) => item.id !== normalized.id)].slice(0, 50);
        if (filePath) await writeLeads(filePath, next);
        else memoryLeads = next;
        return normalized;
      });
    },

    async delete(id) {
      return enqueueWrite(async () => {
        const leads = filePath ? await readLeads(filePath) : memoryLeads;
        const next = leads.filter((item) => item.id !== id);
        if (filePath) await writeLeads(filePath, next);
        else memoryLeads = next;
      });
    }
  };
}

function normalizeLead(lead) {
  if (!lead || typeof lead !== "object") {
    throw new Error("Interest payload is required");
  }

  const source = optionalText(lead.source);
  const planId = optionalText(lead.planId);
  if (!source || !planId) {
    throw new Error("source and planId are required");
  }

  return {
    id: optionalText(lead.id) || crypto.randomUUID(),
    createdAt: optionalText(lead.createdAt) || new Date().toISOString(),
    source,
    candidateName: optionalText(lead.candidateName) || "未命名用户",
    targetRole: optionalText(lead.targetRole) || "目标岗位",
    planId,
    contact: optionalText(lead.contact),
    note: optionalText(lead.note)
  };
}

function optionalText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function readLeads(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeLeads(filePath, leads) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(leads, null, 2)}\n`, "utf8");
}
