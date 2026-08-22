import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createApp } from "./app.mjs";

async function withServer(app, run) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("production build loads assets from the independent domain root", async () => {
  const html = await readFile("dist/index.html", "utf8");
  assert.doesNotMatch(html, /\/resume-fit\//);
  assert.match(html, /(?:src|href)="\/assets\//);
});

test("nginx serves only the isolated znhil deployment directory", async () => {
  const nginx = await readFile("deploy/nginx-znhil.conf", "utf8");
  assert.match(nginx, /root \/www\/wwwroot\/znhil-resume-app\/dist;/);
  assert.doesNotMatch(nginx, /\/www\/wwwroot\/znhil\.xyz/);
  assert.doesNotMatch(nginx, /leka-showcase/);
  assert.match(nginx, /proxy_pass http:\/\/127\.0\.0\.1:3102;/);
  assert.match(nginx, /listen 443 ssl http2;/);
  assert.match(nginx, /ssl_certificate \/www\/server\/panel\/vhost\/cert\/znhil\.xyz\/fullchain\.pem;/);
});

test("resume-fit nginx snippet proxies the same backend port as the main config", async () => {
  const main = await readFile("deploy/nginx-znhil.conf", "utf8");
  const fit = await readFile("deploy/nginx-resume-fit.conf", "utf8");
  const mainPort = main.match(/proxy_pass http:\/\/127\.0\.0\.1:(\d+);/)?.[1];
  const fitPort = fit.match(/proxy_pass http:\/\/127\.0\.0\.1:(\d+);/)?.[1];
  assert.ok(mainPort, "main config must define a backend port");
  assert.equal(fitPort, mainPort, "resume-fit snippet must proxy the same backend port as the main config");
});

test("nginx serves PDF.js module workers with a JavaScript MIME type", async () => {
  const nginx = await readFile("deploy/nginx-znhil.conf", "utf8");
  assert.match(
    nginx,
    /location\s+~\*\s+\\\.mjs\$\s*\{[\s\S]*?default_type\s+application\/javascript;/,
    ".mjs assets must not fall back to application/octet-stream when nosniff is enabled"
  );
});

test("production administrator routes reject unauthenticated access across the independent domain", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  delete process.env.NODE_ENV;
  const app = createApp({ listAll: async () => [] });

  try {
    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/admin/versions`);
      assert.equal(response.status, 401);
    });
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});
