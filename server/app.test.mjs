import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import JSZip from "jszip";
import mammoth from "mammoth";
import PDFDocument from "pdfkit";
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
    versionStore: {
      list: async () => [],
      listAll: async () => [],
      save: async (value) => value,
      delete: async () => {},
      deleteAny: async () => {},
      deleteAll: async () => {}
    },
    interestStore: {
      list: async () => leads,
      save: async (value) => value,
      delete: async () => {}
    },
    usageStore: {
      events: [],
      record: async function (event) { this.events.push(event); },
      getStats: async () => ({ optimizationUsers: 2, optimizationRuns: 3, creatorUsers: 1, creatorRuns: 1 })
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

test("administrator data requires a password while customer feedback remains public to submit", async () => {
  await withServer(async (baseUrl) => {
    const publicCreate = await fetch(`${baseUrl}/api/interest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "result", planId: "jd-fit" })
    });
    assert.equal(publicCreate.status, 201);

    const publicInterest = await fetch(`${baseUrl}/api/interest`);
    assert.equal(publicInterest.status, 401);

    const publicVersions = await fetch(`${baseUrl}/api/admin/versions`);
    assert.equal(publicVersions.status, 401);
  });
});

test("administrator logout invalidates the active session cookie", async () => {
  const previousPassword = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = "test-admin-password-2026";
  try {
    const { versionStore, interestStore } = createStores();
    const app = createApp(versionStore, interestStore);
    const server = await new Promise((resolve) => {
      const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    });
    try {
      const baseUrl = `http://127.0.0.1:${server.address().port}`;
      const login = await fetch(`${baseUrl}/api/admin/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: process.env.ADMIN_PASSWORD })
      });
      assert.equal(login.status, 204);
      const cookie = login.headers.get("set-cookie");
      assert.match(cookie || "", /resume_admin_session=/);
      assert.doesNotMatch(cookie || "", /Max-Age=315360000/);

      const active = await fetch(`${baseUrl}/api/admin/session`, { headers: { Cookie: cookie } });
      assert.equal(active.status, 204);

      const logout = await fetch(`${baseUrl}/api/admin/session`, {
        method: "DELETE",
        headers: { Cookie: cookie }
      });
      assert.equal(logout.status, 204);

      const afterLogout = await fetch(`${baseUrl}/api/admin/session`, { headers: { Cookie: cookie } });
      assert.equal(afterLogout.status, 401);
    } finally {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  } finally {
    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousPassword;
  }
});

test("usage events are public to record but usage stats require administrator auth", async () => {
  const stores = createStores();
  const app = createApp(stores.versionStore, stores.interestStore, null, null, null, { usageStore: stores.usageStore });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const recorded = await fetch(`${baseUrl}/api/usage-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Visitor-Id": "visitor-a1b2c3d4" },
      body: JSON.stringify({ eventType: "resume_optimize" })
    });
    assert.equal(recorded.status, 204);
    assert.deepEqual(stores.usageStore.events[0], { visitorId: "visitor-a1b2c3d4", eventType: "resume_optimize" });

    const publicStats = await fetch(`${baseUrl}/api/admin/usage-stats`);
    assert.equal(publicStats.status, 401);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("successful optimization records an anonymous device id when the visitor header is absent", async () => {
  const stores = createStores();
  const app = createApp(stores.versionStore, stores.interestStore, null, null, {
    optimize: async () => ({ text: "核心优势\n负责内容整理", safe: true })
  }, { usageStore: stores.usageStore });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ai/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText: "负责内容整理", targetRole: "内容运营", sourceMode: "resume" })
    });

    assert.equal(response.status, 200);
    assert.match(stores.usageStore.events[0].visitorId, /^device-[a-f0-9]{40}$/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("administrator version routes reject unauthenticated access", async () => {
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
    const listed = await fetch(`${baseUrl}/api/admin/versions`);
    assert.equal(listed.status, 401);

    const removedByAdmin = await fetch(`${baseUrl}/api/admin/versions/${encodeURIComponent("visitor-b:shared")}`, {
      method: "DELETE"
    });
    assert.equal(removedByAdmin.status, 401);

    const removedOwn = await fetch(`${baseUrl}/api/versions`, {
      method: "DELETE",
      headers: { "X-Visitor-Id": "visitor-a1b2c3d4" }
    });
    assert.equal(removedOwn.status, 204);
    assert.deepEqual(calls, [["deleteAll", "visitor-a1b2c3d4"]]);
  } finally {
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
    server.closeAllConnections?.();
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test("text resumes can be exported as a token-protected PDF without browser printing", async () => {
  const uploadDir = await mkdtemp(join(tmpdir(), "resume-export-test-"));
  const { versionStore, interestStore } = createStores();
  const app = createApp(versionStore, interestStore, null, null, null, { uploadDir });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const exported = await fetch(`${baseUrl}/api/export-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Visitor-Id": "export-owner-a1b2c3d4" },
      body: JSON.stringify({ text: "林晓雨\n核心优势\n- 完成小红书内容运营与短视频制作。" })
    });
    assert.equal(exported.status, 201);
    const payload = await exported.json();
    assert.match(payload.fileUrl, /^\/api\/resume-files\/[a-f0-9-]+\.pdf\?token=[a-f0-9-]+$/);

    const preview = await fetch(`${baseUrl}${payload.fileUrl}`);
    assert.equal(preview.status, 200);
    assert.equal(preview.headers.get("content-type"), "application/pdf");
    assert.match(preview.headers.get("content-disposition") || "", /^inline;/);
    assert.match(Buffer.from(await preview.arrayBuffer()).subarray(0, 5).toString("ascii"), /^%PDF-/);

    const download = await fetch(`${baseUrl}${payload.fileUrl}&download=1`);
    assert.equal(download.status, 200);
    assert.equal(download.headers.get("content-disposition"), 'attachment; filename="optimized-resume.pdf"');
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test("PDF export rejects anonymous requests before creating a file", async () => {
  const uploadDir = await mkdtemp(join(tmpdir(), "resume-export-anonymous-test-"));
  const { versionStore, interestStore } = createStores();
  const app = createApp(versionStore, interestStore, null, null, null, { uploadDir });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/export-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "林晓雨\n核心优势\n- 完成内容运营。" })
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await readdir(uploadDir), []);
  } finally {
    server.closeAllConnections?.();
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
      headers: { "Content-Type": "application/json", "X-Visitor-Id": "ai-visitor-a1b2c3d4" },
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
      body: JSON.stringify({ resumeText: "校园项目与内容运营经历", targetRole: "内容运营", jobDescription: "", fastPolish: true })
    });

    assert.equal(response.status, 200);
    assert.equal((await response.json()).text, "通用投递版简历");
    assert.equal(received.jobDescription, "");
    assert.equal(received.fastPolish, true);
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

test("AI optimize endpoint merges user basic info into the final draft", async () => {
  const { versionStore, interestStore } = createStores();
  let received;
  const app = createApp(versionStore, interestStore, null, null, {
    optimize: async (input) => {
      received = input;
      return { provider: "deepseek", model: "deepseek-chat", text: "求职目标：内容运营\n教育经历\n新闻学本科\n技能\n剪映" };
    }
  });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ai/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Visitor-Id": "ai-basicinfo-a1b2c3d4" },
      body: JSON.stringify({
        resumeText: "校园公众号运营经历",
        targetRole: "内容运营",
        jobDescription: "",
        basicInfo: { name: "张三", school: "某大学", phone: "13800138000", email: "a@b.com" }
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(received.basicInfo.name, "张三");
    assert.equal(received.basicInfo.school, "某大学");
    // 电话与邮箱不发给 AI，由服务端确定性合并进成稿
    assert.equal(received.basicInfo.phone, undefined);
    assert.equal(received.basicInfo.email, undefined);
    const lines = payload.text.split("\n");
    assert.equal(lines[0], "姓名：张三");
    assert.ok(payload.text.includes("联系方式：13800138000｜a@b.com"));
    assert.ok(payload.text.includes("学校：某大学"));
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("AI optimize endpoint returns optimization highlights from the provider", async () => {
  const { versionStore, interestStore } = createStores();
  const app = createApp(versionStore, interestStore, null, null, {
    optimize: async () => ({
      provider: "deepseek",
      model: "deepseek-chat",
      text: "核心优势\n- 小红书内容运营：输出 150+ 篇内容。",
      highlights: ["前置小红书内容运营证据", "压缩校园推广描述"]
    })
  });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ai/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Visitor-Id": "ai-highlights-a1b2c3d4" },
      body: JSON.stringify({ resumeText: "校园内容项目经历", targetRole: "新媒体运营实习生", jobDescription: "" })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload.highlights, ["前置小红书内容运营证据", "压缩校园推广描述"]);
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

const DOCX_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

async function createDocxFixture() {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p><w:r><w:t>姓名：测试用户</w:t></w:r></w:p>
    <w:p><w:r><w:t>教育背景</w:t></w:r></w:p>
    <w:p><w:r><w:t>某大学 新闻学本科</w:t></w:r><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:blipFill><a:blip r:embed="rId99"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
  </w:body>
</w:document>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId99" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>`);
  zip.file("word/media/image1.png", DOCX_PNG);
  return zip.generateAsync({ type: "nodebuffer" });
}

function createPdfBuffer(lines) {
  return new Promise((resolve) => {
    const chunks = [];
    const doc = new PDFDocument();
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.image(DOCX_PNG, 455, 45, { width: 54, height: 54 });
    lines.forEach((line) => doc.text(line));
    doc.end();
  });
}

async function registerFixture(uploadDir, name, buffer, fileType, mimeType) {
  const token = randomUUID();
  await writeFile(join(uploadDir, name), buffer);
  await writeFile(join(uploadDir, `${name}.meta.json`), JSON.stringify({
    owner: "word-visitor-a1b2c3d4e5f6",
    fileType,
    mimeType,
    originalName: name,
    token,
    expiresAt: new Date(Date.now() + 60_000).toISOString()
  }), "utf8");
  return `/api/resume-files/${name}?token=${token}`;
}

test("export-word turns an uploaded DOCX into an editable docx with replaced text and kept photo", async () => {
  const uploadDir = await mkdtemp(join(tmpdir(), "resume-export-word-"));
  const app = createApp(createStores().versionStore, createStores().interestStore, null, null, null, { uploadDir });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const docxUrl = await registerFixture(uploadDir, "source.docx", await createDocxFixture(), "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/export-word`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Visitor-Id": "word-visitor-a1b2c3d4e5f6" },
      body: JSON.stringify({ text: "姓名：张三\n教育背景\n某大学 新闻学\n技能\n剪映", docxUrl })
    });
    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.match(payload.fileUrl, /\/api\/resume-files\/[a-f0-9-]+\.docx\?token=/);

    const fileResponse = await fetch(`http://127.0.0.1:${server.address().port}${payload.fileUrl}`);
    assert.equal(fileResponse.status, 200);
    const bytes = Buffer.from(await fileResponse.arrayBuffer());
    const zip = await JSZip.loadAsync(bytes);
    assert.ok(zip.file("word/media/image1.png"), "source photo must survive export-word");
    const text = (await mammoth.extractRawText({ buffer: bytes })).value.replace(/\s+/g, " ").trim();
    assert.ok(text.includes("姓名：张三"));
    assert.ok(text.includes("剪映"));
    assert.ok(!text.includes("测试用户"), "paragraph text must be replaced with the refined lines");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test("export-word converts the refined PDF into an editable docx", async () => {
  const uploadDir = await mkdtemp(join(tmpdir(), "resume-export-word-pdf-"));
  const app = createApp(createStores().versionStore, createStores().interestStore, null, null, null, { uploadDir });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const pdfUrl = await registerFixture(uploadDir, "source.pdf", await createPdfBuffer(["Name: Test User", "Education: Test University", "Managed event operations"]), "pdf", "application/pdf");
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/export-word`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Visitor-Id": "word-visitor-a1b2c3d4e5f6" },
      body: JSON.stringify({ text: "Name: Test User\nManaged event operations", pdfUrl })
    });
    assert.equal(response.status, 201);
    const payload = await response.json();
    const fileResponse = await fetch(`http://127.0.0.1:${server.address().port}${payload.fileUrl}`);
    assert.equal(fileResponse.status, 200);
    const bytes = Buffer.from(await fileResponse.arrayBuffer());
    const zip = await JSZip.loadAsync(bytes);
    assert.ok(Object.keys(zip.files).some((name) => name.startsWith("word/media/")), "converted docx must keep the source image");
    const text = (await mammoth.extractRawText({ buffer: bytes })).value.replace(/\s+/g, " ").trim();
    assert.ok(text.includes("Test User"));
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test("export-word rejects requests without a resume source file", async () => {
  const uploadDir = await mkdtemp(join(tmpdir(), "resume-export-word-empty-"));
  const app = createApp(createStores().versionStore, createStores().interestStore, null, null, null, { uploadDir });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/export-word`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Visitor-Id": "word-visitor-a1b2c3d4e5f6" },
      body: JSON.stringify({ text: "姓名：张三\n教育背景" })
    });
    assert.equal(response.status, 400);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(uploadDir, { recursive: true, force: true });
  }
});
