import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export function createFileVersionStore(filePath) {
  let writeQueue = Promise.resolve();

  function enqueueWrite(fn) {
    writeQueue = writeQueue.then(fn, fn);
    return writeQueue;
  }

  return {
    async ensureSchema() {
      await mkdir(dirname(filePath), { recursive: true });
      const versions = await readVersions(filePath);
      await writeVersions(filePath, versions);
    },

    async list(visitorId) {
      const versions = await readVersions(filePath);
      return versions
        .filter((item) => item.visitorId === visitorId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 20);
    },

    async listAll(limit = 1000) {
      const versions = await readVersions(filePath);
      return versions
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, Math.max(1, Math.min(Number(limit) || 1000, 5000)))
        .map((item) => ({ ...item, id: `${item.visitorId}:${item.id}` }));
    },

    async save(version, visitorId) {
      return enqueueWrite(async () => {
        const versions = await readVersions(filePath);
        const saved = { ...version, visitorId };
        const visitorVersions = [saved, ...versions.filter((item) => item.visitorId === visitorId && item.id !== version.id)]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 20);
        const next = [...versions.filter((item) => item.visitorId !== visitorId), ...visitorVersions];
        await writeVersions(filePath, next);
        return version;
      });
    },

    async delete(id, visitorId) {
      return enqueueWrite(async () => {
        const versions = await readVersions(filePath);
        await writeVersions(
          filePath,
          versions.filter((item) => item.visitorId !== visitorId || item.id !== id)
        );
      });
    },

    async deleteAny(adminId) {
      return enqueueWrite(async () => {
        const separator = String(adminId || "").indexOf(":");
        if (separator < 1) return;
        const visitorId = adminId.slice(0, separator);
        const id = adminId.slice(separator + 1);
        const versions = await readVersions(filePath);
        await writeVersions(
          filePath,
          versions.filter((item) => item.visitorId !== visitorId || item.id !== id)
        );
      });
    },

    async deleteAll(visitorId) {
      return enqueueWrite(async () => {
        const versions = await readVersions(filePath);
        await writeVersions(filePath, versions.filter((item) => item.visitorId !== visitorId));
      });
    }
  };
}

async function readVersions(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeVersions(filePath, versions) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(versions, null, 2)}\n`, "utf8");
}
