import { readFile, writeFile } from "node:fs/promises";

const target = process.argv[2];
if (!target) throw new Error("usage: node patch-production-ai-route.mjs <server-app-file>");

const before = `      const { resumeText, targetRole, jobDescription, evidenceAnswers = [] } = req.body || {};
      if (![resumeText, targetRole, jobDescription].every((value) => typeof value === "string" && value.trim())) {
        res.status(400).json({ error: "请补齐简历内容、目标岗位和岗位 JD。" });
        return;
      }`;

const after = `      const { resumeText, targetRole, jobDescription = "", evidenceAnswers = [] } = req.body || {};
      if (
        typeof resumeText !== "string" || !resumeText.trim() ||
        typeof targetRole !== "string" || !targetRole.trim() ||
        typeof jobDescription !== "string"
      ) {
        res.status(400).json({ error: "请补齐简历内容和求职方向。" });
        return;
      }`;

const source = await readFile(target, "utf8");
const occurrences = source.split(before).length - 1;
let patched = source;
if (occurrences === 1) {
  patched = patched.replace(before, after);
} else if (!patched.includes(after)) {
  throw new Error(`expected the legacy or current AI route validation block, found ${occurrences}`);
}

const responseBefore = `      const result = await aiGate.run(() => aiClient.optimize({ resumeText, targetRole, jobDescription, evidenceAnswers: safeEvidenceAnswers }));
      res.json(result);`;

const responseAfter = `      const result = await aiGate.run(() => aiClient.optimize({ resumeText, targetRole, jobDescription, evidenceAnswers: safeEvidenceAnswers }));
      const text = typeof result?.text === "string"
        ? result.text
          .replace(/\\{\\{(?:PHONE|EMAIL)_\\d+\\}\\}/g, "")
          .split(/\\r?\\n/)
          .filter((line) => !/^(?:(?:联系方式|电话|手机|邮箱)\\s*[:：]?)?[\\s|｜·/,，-]*$/.test(line))
          .join("\\n")
          .trim()
        : result?.text;
      res.json({ ...result, text });`;

const responseOccurrences = patched.split(responseBefore).length - 1;
if (responseOccurrences === 1) {
  patched = patched.replace(responseBefore, responseAfter);
} else if (!patched.includes(responseAfter)) {
  throw new Error(`expected the legacy or current AI response block, found ${responseOccurrences}`);
}

await writeFile(target, patched, "utf8");
