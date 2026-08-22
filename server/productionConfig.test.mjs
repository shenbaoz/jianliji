import assert from "node:assert/strict";
import test from "node:test";
import { validateProductionConfig } from "./productionConfig.mjs";

const secureConfig = {
  NODE_ENV: "production",
  BACKEND_HOST: "127.0.0.1",
  CORS_ORIGIN: "https://resume.example.com",
  ADMIN_PASSWORD: "mD6!sQ9#vR2@xK8$wP4&",
  REQUIRE_MYSQL: "true",
  DB_HOST: "127.0.0.1",
  DB_NAME: "resume_fit",
  DB_USER: "resume_app",
  DB_PASSWORD: "database-password",
  DEEPSEEK_API_KEY: "provider-secret"
};

test("accepts a hardened production configuration", () => {
  assert.doesNotThrow(() => validateProductionConfig(secureConfig));
});

test("rejects public backend binding, wildcard CORS and file fallback in production", () => {
  const unsafe = {
    ...secureConfig,
    BACKEND_HOST: "0.0.0.0",
    CORS_ORIGIN: "*",
    REQUIRE_MYSQL: "false"
  };
  assert.throws(
    () => validateProductionConfig(unsafe),
    /BACKEND_HOST.*CORS_ORIGIN.*REQUIRE_MYSQL/s
  );
});

test("requires database and AI provider secrets in production", () => {
  const missing = { ...secureConfig, DB_PASSWORD: "", DEEPSEEK_API_KEY: "" };
  assert.throws(() => validateProductionConfig(missing), /DB_PASSWORD.*DEEPSEEK_API_KEY/s);
});

test("does not block local development configuration", () => {
  assert.doesNotThrow(() => validateProductionConfig({ NODE_ENV: "development" }));
});
