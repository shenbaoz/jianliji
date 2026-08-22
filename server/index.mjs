import { config as loadEnv } from "dotenv";
import mysql from "mysql2/promise";
import { resolve } from "node:path";
import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { createApp } from "./app.mjs";
import { createFileVersionStore } from "./fileVersionStore.mjs";
import { createInterestStore } from "./interestStore.mjs";
import { createMysqlInterestStore } from "./mysqlInterestStore.mjs";
import { createCreatorStore } from "./creatorStore.mjs";
import { createVersionStore } from "./versionStore.mjs";
import { createUsageEventStore } from "./usageEventStore.mjs";
import { createMysqlUsageEventStore } from "./mysqlUsageEventStore.mjs";
import { createDeepSeekClient, createFallbackAiClient, createKimiClient } from "./aiProvider.mjs";
import { validateProductionConfig } from "./productionConfig.mjs";

loadEnv({ path: resolve(".env.local"), quiet: true });
loadEnv({ quiet: true });
validateProductionConfig(process.env);

const port = Number(process.env.BACKEND_PORT || 3001);
const uploadDir = resolve("data", "uploads");
const uploadMaxAgeMs = Number(process.env.UPLOAD_MAX_AGE_HOURS || 24) * 60 * 60 * 1000;
const cleanupIntervalMs = Number(process.env.UPLOAD_CLEANUP_INTERVAL_MINUTES || 60) * 60 * 1000;

let dbPool = null;
let cleanupTimer = null;
let cleanupRunning = false;
let server = null;

const { versionStore, interestStore, creatorStore, usageStore, storageStatus } = await createStores();

const deepSeekClient = process.env.DEEPSEEK_API_KEY ? createDeepSeekClient() : null;
const kimiClient = process.env.KIMI_API_KEY ? createKimiClient() : null;
const aiClient = createFallbackAiClient(deepSeekClient, kimiClient);
const healthCheck = async () => {
  if (!dbPool) return true;
  await dbPool.query("SELECT 1");
  return true;
};
const app = createApp(versionStore, interestStore, storageStatus, creatorStore, aiClient, { healthCheck, usageStore });
server = app.listen(port, process.env.BACKEND_HOST || "127.0.0.1", () => {
  console.log(`Resume backend listening on http://127.0.0.1:${port}`);
  startUploadCleanup();
});

function startUploadCleanup() {
  cleanupTimer = setInterval(async () => {
    if (cleanupRunning) return;
    cleanupRunning = true;
    try {
      const files = await readdir(uploadDir).catch(() => []);
      const now = Date.now();
      let deleted = 0;
      for (const file of files) {
        const filePath = join(uploadDir, file);
        const stats = await stat(filePath).catch(() => null);
        if (stats && now - stats.mtimeMs > uploadMaxAgeMs) {
          await unlink(filePath).catch(() => {});
          deleted += 1;
        }
      }
      if (deleted > 0) {
        console.log(`[cleanup] Deleted ${deleted} expired upload file(s).`);
      }
    } catch (error) {
      console.warn("[cleanup] Upload cleanup failed:", error.message);
    } finally {
      cleanupRunning = false;
    }
  }, cleanupIntervalMs);

  cleanupTimer.unref();
}

async function gracefulShutdown(signal) {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  if (cleanupTimer) clearInterval(cleanupTimer);
  const forceExit = setTimeout(() => {
    console.warn("[shutdown] Forcing exit after timeout.");
    process.exit(1);
  }, 10_000);
  forceExit.unref();
  try {
    if (server) {
      server.closeIdleConnections?.();
      await new Promise((resolve) => server.close(() => resolve()));
      console.log("[shutdown] HTTP server closed.");
    }
    if (dbPool) {
      await dbPool.end();
      console.log("[shutdown] MySQL pool closed.");
    }
  } catch (error) {
    console.warn("[shutdown] Error during shutdown:", error.message);
  }
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
  process.exit(1);
});
process.on("uncaughtException", (error) => {
  console.error("[uncaughtException]", error);
  process.exit(1);
});

async function createStores() {
  const hasDbConfig = process.env.DB_HOST && process.env.DB_NAME;

  if (hasDbConfig) {
    const db = mysql.createPool({
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      charset: process.env.DB_CHARSET || "utf8mb4",
      waitForConnections: true,
      connectionLimit: 10
    });

    const mysqlVersionStore = createVersionStore(db);
    const mysqlInterestStore = createMysqlInterestStore(db);
    const mysqlCreatorStore = createCreatorStore(db);
    const mysqlUsageStore = createMysqlUsageEventStore(db);
    try {
      await mysqlVersionStore.ensureSchema();
      await mysqlInterestStore.ensureSchema();
      await mysqlCreatorStore.ensureSchema();
      await mysqlUsageStore.ensureSchema();
      console.log("Resume backend using MySQL storage.");
      dbPool = db;
      return {
        versionStore: mysqlVersionStore,
        interestStore: mysqlInterestStore,
        creatorStore: mysqlCreatorStore,
        usageStore: mysqlUsageStore,
        storageStatus: {
          mode: "mysql",
          label: "MySQL 数据库（简历版本 + 留资）",
          persistent: true
        }
      };
    } catch (error) {
      await db.end().catch(() => {});
      if (process.env.REQUIRE_MYSQL === "true") {
        throw error;
      }
      console.warn(`MySQL unavailable, falling back to file storage.`, error.message);
    }
  }

  const versionFilePath = resolve("data", "resume-versions.json");
  const interestFilePath = resolve("data", "unlock-interest.json");
  const usageFilePath = resolve("data", "usage-events.json");
  console.log(`Using file storage at ${versionFilePath}.`);
  const fileVersionStore = createFileVersionStore(versionFilePath);
  const fileInterestStore = createInterestStore(interestFilePath);
  const fileUsageStore = createUsageEventStore(usageFilePath);
  await fileVersionStore.ensureSchema();
  await fileInterestStore.ensureSchema();
  await fileUsageStore.ensureSchema();
  return {
    versionStore: fileVersionStore,
    interestStore: fileInterestStore,
    creatorStore: null,
    usageStore: fileUsageStore,
    storageStatus: {
      mode: "file",
      label: "服务器文件存储",
      persistent: true
    }
  };
}
