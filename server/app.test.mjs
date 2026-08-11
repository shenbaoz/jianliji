import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "./app.mjs";

function createStores() {
  const leads = [
    {
      id: "lead-1",
      createdAt: "2026-07-28T00:00:00.000Z",
      source: "result",
      candidateName: "张三",
      targetRole: "前端工程师",
      planId: "jd-fit",
      contact: "wx: zhangsan",
      note: "测试"
    }
  ];
  return {
    versionStore: { list: async () => [], save: async (value) => value, delete: async () => {} },
    interestStore: {
      list: async () => leads,
      save: async (value) => value,
      delete: async () => {}
    }
  };
}

async function withServer(run) {
  const { versionStore, interestStore } = createStores();
  const app = createApp(versionStore, interestStore, { mode: "mysql", label: "MySQL", persistent: true });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("health endpoint does not disclose storage implementation", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.deepEqual(await response.json(), { ok: true });
  });
});

test("API responses include production-safe browser security headers", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.match(response.headers.get("permissions-policy") || "", /camera=\(\)/);
    assert.match(response.headers.get("content-security-policy") || "", /frame-ancestors 'none'/);
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
});

test("development API allows the alternate local Vite port", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`, { headers: { Origin: "http://127.0.0.1:5174" } });
    assert.equal(response.headers.get("access-control-allow-origin"), "http://127.0.0.1:5174");
  });
});

test("creator API stores a draft for its anonymous visitor only", async () => {
  const drafts = new Map();
  const creatorStore = {
    getProfile: async (visitor) => drafts.get(visitor) || null,
    saveProfile: async (visitor, profile) => {
      drafts.set(visitor, profile);
      return profile;
    },
    listVersions: async () => [],
    saveVersion: async (_visitor, version) => version
  };
  const { versionStore, interestStore } = createStores();
  const app = createApp(versionStore, interestStore, null, creatorStore);
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const saved = await fetch(`${baseUrl}/api/creator/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Visitor-Id": "creator-a1b2c3d4" },
      body: JSON.stringify({ basics: { name: "林晓雨" } })
    });
    assert.equal(saved.status, 201);
    const own = await fetch(`${baseUrl}/api/creator/profile`, { headers: { "X-Visitor-Id": "creator-a1b2c3d4" } });
    assert.deepEqual(await own.json(), { basics: { name: "林晓雨" } });
    const other = await fetch(`${baseUrl}/api/creator/profile`, { headers: { "X-Visitor-Id": "creator-z9y8x7w6" } });
    assert.equal(other.status, 404);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("administrator data requires a password-backed session", async () => {
  const originalPassword = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = "correct horse battery staple";
  try {
    await withServer(async (baseUrl) => {
      const publicCreate = await fetch(`${baseUrl}/api/interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "result", planId: "jd-fit" })
      });
      assert.equal(publicCreate.status, 201);

      const unauthenticated = await fetch(`${baseUrl}/api/interest`);
      assert.equal(unauthenticated.status, 401);

      const login = await fetch(`${baseUrl}/api/admin/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: process.env.ADMIN_PASSWORD })
      });
      assert.equal(login.status, 204);
      const cookie = login.headers.get("set-cookie");
      assert.match(cookie || "", /HttpOnly/);

      const authenticated = await fetch(`${baseUrl}/api/interest`, { headers: { Cookie: cookie || "" } });
      assert.equal(authenticated.status, 200);
      assert.equal((await authenticated.json())[0].id, "lead-1");
    });
  } finally {
    if (originalPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalPassword;
  }
});

test("administrator versions use an all-visitor route while visitors can delete only their own data", async () => {
  const originalPassword = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = "correct horse battery staple";
  const calls = [];
  const versionStore = {
    list: async (visitorId) => [{ id: "own", visitorId }],
    listAll: async () => [{ id: "visitor-b:shared", visitorId: "visitor-b", candidateName: "李四" }],
    save: async (value) => value,
    delete: async () => {},
    deleteAny: async (id) => calls.push(["deleteAny", id]),
    deleteAll: async (visitorId) => calls.push(["deleteAll", visitorId])
  };
  const app = createApp(versionStore);
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${baseUrl}/api/admin/versions`)).status, 401);

    const login = await fetch(`${baseUrl}/api/admin/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: process.env.ADMIN_PASSWORD })
    });
    const cookie = login.headers.get("set-cookie") || "";
    const listed = await fetch(`${baseUrl}/api/admin/versions`, { headers: { Cookie: cookie } });
    assert.equal(listed.status, 200);
    assert.equal((await listed.json())[0].visitorId, "visitor-b");

    const removedByAdmin = await fetch(`${baseUrl}/api/admin/versions/${encodeURIComponent("visitor-b:shared")}`, {
      method: "DELETE",
      headers: { Cookie: cookie }
    });
    assert.equal(removedByAdmin.status, 204);

    const removedOwn = await fetch(`${baseUrl}/api/versions`, {
      method: "DELETE",
      headers: { "X-Visitor-Id": "visitor-a1b2c3d4" }
    });
    assert.equal(removedOwn.status, 204);
    assert.deepEqual(calls, [
      ["deleteAny", "visitor-b:shared"],
      ["deleteAll", "visitor-a1b2c3d4"]
    ]);
  } finally {
    if (originalPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalPassword;
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("expected resume parsing failures return an actionable 422", async () => {
  await withServer(async (baseUrl) => {
    const body = new FormData();
    body.append("resume", new Blob(["not a real PDF"], { type: "application/pdf" }), "broken.pdf");
    const response = await fetch(`${baseUrl}/api/parse-resume`, { method: "POST", body });
    assert.equal(response.status, 422);
    assert.match((await response.json()).error, /PDF|文本|扫描件/);
  });
});

test("uploaded resumes require an unguessable expiring file URL", async () => {
  const uploadDir = await mkdtemp(join(tmpdir(), "resume-upload-test-"));
  const versions = [];
  const { interestStore } = createStores();
  const versionStore = {
    list: async () => [...versions],
    listAll: async () => [...versions],
    save: async (value) => {
      versions.push(value);
      return value;
    },
    delete: async () => {},
    deleteAny: async () => {},
    deleteAll: async () => {
      versions.length = 0;
    }
  };
  const app = createApp(versionStore, interestStore, null, null, null, { uploadDir });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const body = new FormData();
    body.append("resume", new Blob(["张三\n项目经历"], { type: "text/plain" }), "resume.txt");
    const upload = await fetch(`${baseUrl}/api/parse-resume`, {
      method: "POST",
      headers: { "X-Visitor-Id": "file-owner-a1b2c3d4" },
      body
    });
    assert.equal(upload.status, 200);
    const payload = await upload.json();
    assert.match(payload.originalResumeFileUrl, /^\/api\/resume-files\/[a-f0-9-]+\.txt\?token=[a-f0-9-]+$/);

    const withoutToken = await fetch(`${baseUrl}${payload.originalResumeFileUrl.split("?")[0]}`);
    assert.equal(withoutToken.status, 404);
    const wrongToken = await fetch(`${baseUrl}${payload.originalResumeFileUrl.split("?")[0]}?token=wrong`);
    assert.equal(wrongToken.status, 404);

    const authorized = await fetch(`${baseUrl}${payload.originalResumeFileUrl}`);
    assert.equal(authorized.status, 200);
    assert.equal(await authorized.text(), "张三\n项目经历");
    assert.equal(authorized.headers.get("cache-control"), "no-store");
    assert.equal(authorized.headers.get("x-content-type-options"), "nosniff");
    assert.match(authorized.headers.get("content-disposition") || "", /^inline;/);

    await fetch(`${baseUrl}/api/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Visitor-Id": "file-owner-a1b2c3d4" },
      body: JSON.stringify({ id: "version-1", originalResumeFileUrl: payload.originalResumeFileUrl })
    });
    const deleted = await fetch(`${baseUrl}/api/versions`, {
      method: "DELETE",
      headers: { "X-Visitor-Id": "file-owner-a1b2c3d4" }
    });
    assert.equal(deleted.status, 204);
    assert.equal((await fetch(`${baseUrl}${payload.originalResumeFileUrl}`)).status, 404);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test("AI optimize endpoint uses the configured provider and never receives raw contact details", async () => {
  const { versionStore, interestStore } = createStores();
  let received;
  const aiClient = {
    optimize: async (input) => {
      received = input;
      return { provider: "deepseek", model: "deepseek-chat", text: "优化后的简历" };
    }
  };
  const app = createApp(versionStore, interestStore, null, null, aiClient);
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ai/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Visitor-Id": "ai-a1b2c3d4" },
      body: JSON.stringify({ resumeText: "张三 13812345678", targetRole: "产品运营", jobDescription: "负责活动" })
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).text, "优化后的简历");
    assert.equal(received.resumeText, "张三 13812345678");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("AI optimize endpoint accepts the three-step flow without a company job description", async () => {
  const { versionStore, interestStore } = createStores();
  let received;
  const app = createApp(versionStore, interestStore, null, null, {
    optimize: async (input) => {
      received = input;
      return { provider: "deepseek", model: "deepseek-chat", text: "通用投递版简历" };
    }
  });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ai/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Visitor-Id": "ai-no-jd-a1b2c3d4" },
      body: JSON.stringify({ resumeText: "校园项目与内容运营经历", targetRole: "内容运营", jobDescription: "" })
    });

    assert.equal(response.status, 200);
    assert.equal((await response.json()).text, "通用投递版简历");
    assert.equal(received.jobDescription, "");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("AI optimize endpoint accepts a universal resume with no target role or job description", async () => {
  const { versionStore, interestStore } = createStores();
  let received;
  const app = createApp(versionStore, interestStore, null, null, {
    optimizeUniversal: async (input) => {
      received = input;
      return { provider: "deepseek", model: "deepseek-chat", text: "通用简历优化稿" };
    }
  });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ai/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Visitor-Id": "ai-universal-a1b2c3d4" },
      body: JSON.stringify({ resumeText: "校园项目与内容运营经历", sourceMode: "universal" })
    });

    assert.equal(response.status, 200);
    assert.equal((await response.json()).text, "通用简历优化稿");
    assert.deepEqual(received, { resumeText: "校园项目与内容运营经历" });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("AI optimize endpoint removes unresolved contact placeholders from the final draft", async () => {
  const { versionStore, interestStore } = createStores();
  const app = createApp(versionStore, interestStore, null, null, {
    optimize: async () => ({
      provider: "deepseek",
      model: "deepseek-chat",
      text: "林晓雨\n{{PHONE_1}}｜{{EMAIL_1}}\n内容运营"
    })
  });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ai/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Visitor-Id": "ai-placeholders-a1b2c3d4" },
      body: JSON.stringify({ resumeText: "校园内容项目经历", targetRole: "内容运营", jobDescription: "" })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.doesNotMatch(payload.text, /\{\{(?:PHONE|EMAIL)_\d+\}\}/);
    assert.match(payload.text, /林晓雨[\s\S]*内容运营/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("AI optimize endpoint enforces a dedicated anonymous cost boundary", async () => {
  const { versionStore, interestStore } = createStores();
  let calls = 0;
  const app = createApp(versionStore, interestStore, null, null, {
    optimize: async () => {
      calls += 1;
      return { provider: "test", model: "test", text: "安全草稿" };
    }
  });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/ai/optimize`;
    const payload = JSON.stringify({ resumeText: "项目经历", targetRole: "运营", jobDescription: "负责内容" });
    const statuses = [];
    for (let index = 0; index < 11; index += 1) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Visitor-Id": "ai-limit-a1b2c3d4" },
        body: payload
      });
      statuses.push(response.status);
    }
    assert.deepEqual(statuses.slice(0, 10), Array(10).fill(200));
    assert.equal(statuses[10], 429);
    assert.equal(calls, 10);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("AI optimize endpoint rejects oversized resume fields before provider billing", async () => {
  const { versionStore, interestStore } = createStores();
  let calls = 0;
  const app = createApp(versionStore, interestStore, null, null, {
    optimize: async () => {
      calls += 1;
      return { text: "不应生成" };
    }
  });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ai/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Visitor-Id": "ai-size-a1b2c3d4" },
      body: JSON.stringify({ resumeText: "经历".repeat(60_000), targetRole: "运营", jobDescription: "负责内容" })
    });
    assert.equal(response.status, 413);
    assert.equal(calls, 0);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
