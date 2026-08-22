const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);

export function validateProductionConfig(env = process.env) {
  if (env.NODE_ENV !== "production") return;

  const errors = [];
  const backendHost = env.BACKEND_HOST || "127.0.0.1";
  if (!loopbackHosts.has(backendHost)) {
    errors.push("BACKEND_HOST must bind to loopback only (127.0.0.1, localhost or ::1).");
  }

  if (!isExactHttpsOrigin(env.CORS_ORIGIN)) {
    errors.push("CORS_ORIGIN must be one exact HTTPS origin without a path, wildcard or comma-separated list.");
  }

  if (env.REQUIRE_MYSQL !== "true") {
    errors.push("REQUIRE_MYSQL must be true so production never falls back to file storage.");
  }

  for (const key of ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD", "DEEPSEEK_API_KEY"]) {
    if (!env[key] || /replace_me|replace_with/i.test(env[key])) {
      errors.push(`${key} must be configured with a non-example production value.`);
    }
  }

  if (errors.length) {
    throw new Error(`Unsafe production configuration:\n- ${errors.join("\n- ")}`);
  }
}

function isExactHttpsOrigin(value) {
  if (!value || value.includes(",") || value.includes("*")) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.origin === value && parsed.pathname === "/";
  } catch {
    return false;
  }
}
