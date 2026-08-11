import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("public workflow uses the approved editorial motion shell without consent gates", async () => {
  const [app, creator, job, css] = await Promise.all([
    read("src/App.tsx"),
    read("src/components/CreatorView.tsx"),
    read("src/components/JobView.tsx"),
    read("src/styles.css")
  ]);

  assert.match(app, /public-editorial-shell/);
  assert.match(css, /editorial-light-band/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(creator, /aiConsent|onAiConsentChange|同意使用 DeepSeek/);
  assert.doesNotMatch(job, /aiConsent|onAiConsentChange|同意使用 DeepSeek/);
});

test("the production landing hero fills the first viewport with larger primary content", async () => {
  const css = await read("src/styles.css");

  assert.match(css, /\.public-editorial-shell \.editorial-landing \{[^}]*min-height:\s*calc\(100svh - 52px\)/s);
  assert.match(css, /\.public-editorial-shell \.editorial-hero-canvas \{[^}]*min-height:\s*max\(640px,\s*calc\(100svh - 108px\)\)/s);
  assert.match(css, /\.public-editorial-shell \.editorial-hero-canvas h1 \{[^}]*font-size:\s*clamp\(56px,\s*6\.6vw,\s*96px\)/s);
  assert.match(css, /\.public-editorial-shell \.editorial-actions button \{[^}]*min-height:\s*52px/s);
});
