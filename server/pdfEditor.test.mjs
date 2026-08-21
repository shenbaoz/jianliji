import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import PDFDocument from "pdfkit";
import { PDFDict, PDFDocument as PdfLibDocument, PDFName } from "pdf-lib";
import { createEditedPdfVersions, createGeneratedResumePdf } from "./pdfEditor.mjs";
import { parseResumeFile } from "./resumeParser.mjs";

const execFileAsync = promisify(execFile);

test("createEditedPdfVersions preserves the original page and image while producing review and clean files", async () => {
  const uploadDir = await mkdtemp(join(tmpdir(), "resume-pdf-editor-"));
  const sourceName = `test-source-${Date.now()}.pdf`;
  const sourcePath = join(uploadDir, sourceName);
  const sourceBuffer = await createPdfBuffer(["Name: Test User", "Education: Test University", "Managed event operations"], true);
  await writeFile(sourcePath, sourceBuffer);

  try {
    await parseResumeFile({ buffer: sourceBuffer, originalname: "resume.pdf", mimetype: "application/pdf" });
    const result = await createEditedPdfVersions({
      originalResumeFileUrl: `/api/resume-files/${sourceName}`,
      text: "Name: Test User\nLed event operations",
      changes: [{ before: "Managed event operations", after: "Led event operations" }],
      uploadDir
    });

    assert.match(result.cleanOutputName, /\.pdf$/);
    assert.match(result.reviewOutputName, /\.pdf$/);
    assert.notEqual(result.cleanOutputName, result.reviewOutputName);
    assert.equal(result.changedLineCount, 1, "only the explicitly matched source line should be replaced");
    assert.deepEqual(result.appliedChanges, [
      { before: "Managed event operations", after: "Led event operations" }
    ], "the API must report only changes actually written into the PDF");
    assert.equal(result.pageCountVerified, true, "the editor must explicitly report its page-count verification");
    assert.equal(result.portraitApplied, true, "an existing source portrait should be preserved for the result preview");
    assert.match(result.portraitDataUrl || "", /^data:image\//, "the result preview should receive the extracted source portrait");
    assert.deepEqual(result.unchangedPages, [], "a safely edited page must not be reported as rolled back");

    const sourcePdf = await PdfLibDocument.load(sourceBuffer);
    const cleanBytes = await readFile(join(uploadDir, result.cleanOutputName));
    const reviewBytes = await readFile(join(uploadDir, result.reviewOutputName));
    const cleanPdf = await PdfLibDocument.load(cleanBytes);

    assert.equal(cleanPdf.getPageCount(), sourcePdf.getPageCount());
    assert.deepEqual(cleanPdf.getPage(0).getSize(), sourcePdf.getPage(0).getSize());
    assert.ok(countImageResources(sourcePdf) > 0, "test fixture should contain an embedded image");
    assert.ok(countImageResources(cleanPdf) > 0, "clean output should preserve the embedded image");
    assert.deepEqual(
      await imageGeometry(join(uploadDir, result.cleanOutputName)),
      await imageGeometry(sourcePath),
      "clean output must preserve every image position and dimension"
    );
    assert.notDeepEqual(reviewBytes, cleanBytes, "review output should contain visible review marks");
  } finally {
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test("createEditedPdfVersions restores a page when reflow intersects a fixed image", async () => {
  const uploadDir = await mkdtemp(join(tmpdir(), "resume-pdf-image-collision-"));
  const sourceName = `image-collision-${Date.now()}.pdf`;
  const sourcePath = join(uploadDir, sourceName);
  const before = "Managed event operations";
  const after = "Led event operations across communities and regional campaigns";
  const sourceBuffer = await createImageCollisionPdfBuffer(before);
  await writeFile(sourcePath, sourceBuffer);

  try {
    const result = await createEditedPdfVersions({
      originalResumeFileUrl: `/api/resume-files/${sourceName}`,
      text: after,
      changes: [{ before, after }],
      uploadDir
    });

    assert.deepEqual(result.unchangedPages, [0], "an unsafe page must be restored and identified by its zero-based index");
    assert.equal(result.pageCountVerified, true);
    assert.equal(result.changedLineCount, 0);
    assert.equal(result.deliveryMode, "generated-template");
    assert.deepEqual(result.appliedChanges, []);

    const cleanPath = join(uploadDir, result.cleanOutputName);
    const cleanBytes = await readFile(cleanPath);
    const parsed = await parseResumeFile({ buffer: cleanBytes, originalname: "clean.pdf", mimetype: "application/pdf" });
    assert.match(parsed.text.replace(/\s+/g, ""), /Ledeventoperationsacrosscommunitiesandregionalcampaigns/, "fallback must contain the verified optimized text");
  } finally {
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test("createEditedPdfVersions replaces a source sentence that wraps across multiple PDF lines", async () => {
  const uploadDir = await mkdtemp(join(tmpdir(), "resume-pdf-wrapped-"));
  const sourceName = `wrapped-source-${Date.now()}.pdf`;
  const sourcePath = join(uploadDir, sourceName);
  const before = "Managed campaign strategy across channels and communities, coordinating content and reporting.";
  const after = "Led campaign strategy across channels and communities, coordinating content and reporting.";
  const sourceBuffer = await createWrappedPdfBuffer(before);
  await writeFile(sourcePath, sourceBuffer);

  try {
    const result = await createEditedPdfVersions({
      originalResumeFileUrl: `/api/resume-files/${sourceName}`,
      text: after,
      changes: [{ before, after }],
      uploadDir
    });

    assert.equal(result.changedLineCount, 1, "a real multi-line rewrite must not be silently skipped");
    assert.deepEqual(result.appliedChanges, [{ before, after }]);
    const cleanBytes = await readFile(join(uploadDir, result.cleanOutputName));
    const parsed = await parseResumeFile({ buffer: cleanBytes, originalname: "clean.pdf", mimetype: "application/pdf" });
    assert.match(parsed.text.replace(/\s+/g, ""), /Ledcampaignstrategyacrosschannelsandcommunities,coordinatingcontentandreporting\./);
    assert.doesNotMatch(parsed.text.replace(/\s+/g, ""), /Managedcampaignstrategy/);
  } finally {
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test("createEditedPdfVersions skips a drastic short rewrite that would leave a multi-line hole", async () => {
  const uploadDir = await mkdtemp(join(tmpdir(), "resume-pdf-short-rewrite-"));
  const sourceName = `short-rewrite-${Date.now()}.pdf`;
  const sourcePath = join(uploadDir, sourceName);
  const before = "Managed campaign strategy across channels and communities, coordinating content and reporting.";
  const after = "Led campaigns.";
  const sourceBuffer = await createWrappedPdfBuffer(before);
  await writeFile(sourcePath, sourceBuffer);

  try {
    const result = await createEditedPdfVersions({
      originalResumeFileUrl: `/api/resume-files/${sourceName}`,
      text: after,
      changes: [{ before, after }],
      uploadDir
    });

    assert.equal(result.changedLineCount, 0);
    assert.equal(result.deliveryMode, "generated-template");
    assert.deepEqual(result.appliedChanges, []);
    const cleanBytes = await readFile(join(uploadDir, result.cleanOutputName));
    const parsed = await parseResumeFile({ buffer: cleanBytes, originalname: "clean.pdf", mimetype: "application/pdf" });
    assert.match(parsed.text.replace(/\s+/g, ""), /Ledcampaigns/);
  } finally {
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test("createEditedPdfVersions accepts a concise substantive rewrite across wrapped source lines", async () => {
  const uploadDir = await mkdtemp(join(tmpdir(), "resume-pdf-concise-rewrite-"));
  const sourceName = `concise-rewrite-${Date.now()}.pdf`;
  const sourcePath = join(uploadDir, sourceName);
  const before = "Managed campaign strategy across channels and communities, coordinating content and reporting.";
  const after = "Led campaign strategy across channels, coordinating content and reporting.";
  await writeFile(sourcePath, await createWrappedPdfBuffer(before));

  try {
    const result = await createEditedPdfVersions({
      originalResumeFileUrl: `/api/resume-files/${sourceName}`,
      text: after,
      changes: [{ before, after }],
      uploadDir
    });

    assert.equal(result.changedLineCount, 1);
    assert.equal(result.appliedChanges.length, 1);
  } finally {
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test("createEditedPdfVersions keeps the original text when a replacement cannot fit its PDF text box", async () => {
  const uploadDir = await mkdtemp(join(tmpdir(), "resume-pdf-overflow-"));
  const sourceName = `overflow-source-${Date.now()}.pdf`;
  const sourcePath = join(uploadDir, sourceName);
  const sourceBuffer = await createPdfBuffer(["Managed event operations"]);
  await writeFile(sourcePath, sourceBuffer);
  const oversizedReplacement = "Planned and delivered event operations across landing pages, communities, analytics, lifecycle campaigns, and regional growth programs.";

  try {
    const result = await createEditedPdfVersions({
      originalResumeFileUrl: `/api/resume-files/${sourceName}`,
      text: oversizedReplacement,
      changes: [{ before: "Managed event operations", after: oversizedReplacement }],
      uploadDir
    });

    assert.equal(result.changedLineCount, 0, "an unsafe source-template replacement must not be squeezed into the original line");
    assert.equal(result.deliveryMode, "generated-template");
    const cleanBytes = await readFile(join(uploadDir, result.cleanOutputName));
    const parsed = await parseResumeFile({ buffer: cleanBytes, originalname: "clean.pdf", mimetype: "application/pdf" });
    assert.match(parsed.text.replace(/\s+/g, ""), /regionalgrowthprograms/, "generated fallback must retain the optimized content");
  } finally {
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test("createEditedPdfVersions generates a readable optimized PDF when no source sentence is safely replaceable", async () => {
  const uploadDir = await mkdtemp(join(tmpdir(), "resume-pdf-generated-fallback-"));
  const sourceName = `generated-fallback-${Date.now()}.pdf`;
  await writeFile(join(uploadDir, sourceName), await createPdfBuffer(["Original event experience"]));

  try {
    const result = await createEditedPdfVersions({
      originalResumeFileUrl: `/api/resume-files/${sourceName}`,
      text: "测试用户\n核心优势\n- 独立策划并落地活动执行，沉淀现场协同清单。",
      changes: [{ before: "PDF 中不存在的原句", after: "独立策划并落地活动执行，沉淀现场协同清单。" }],
      uploadDir
    });

    assert.equal(result.deliveryMode, "generated-template");
    const parsed = await parseResumeFile({
      buffer: await readFile(join(uploadDir, result.cleanOutputName)),
      originalname: "generated.pdf",
      mimetype: "application/pdf"
    });
    assert.match(parsed.text.replace(/[\s\x00，。]/g, ""), /独立策划并落地活动执行沉淀现场协同清单/);
    assert.doesNotMatch(parsed.text, /□|�/);
  } finally {
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test("createGeneratedResumePdf keeps labeled names clean and uses printable list markers", async () => {
  const uploadDir = await mkdtemp(join(tmpdir(), "resume-generated-export-"));
  try {
    const result = await createGeneratedResumePdf({
      text: "姓 名 ： 测试用户\n核心优势\n 完成内容\x00运营与活动策划。",
      uploadDir
    });
    const parsed = await parseResumeFile({
      buffer: await readFile(join(uploadDir, result.cleanOutputName)),
      originalname: "generated.pdf",
      mimetype: "application/pdf"
    });
    assert.match(parsed.text, /^测试用户/m);
    assert.doesNotMatch(parsed.text, /姓\s*名\s*：/);
    assert.doesNotMatch(parsed.text, /[\x00□�]/);
  } finally {
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test("createGeneratedResumePdf keeps a long one-page draft readable without dropping content", async () => {
  const uploadDir = await mkdtemp(join(tmpdir(), "resume-generated-long-export-"));
  const longText = [
    "杜小艳",
    "核心优势",
    ...Array.from({ length: 55 }, (_, index) => `${2024 + (index % 3)}.${String((index % 12) + 1).padStart(2, "0")}｜负责活动运营与内容策划，完成用户触达、社群维护、数据复盘和素材优化，持续提升活动效果与内容传播质量。`),
    "荣誉奖项",
    "第十三届全国大学生新媒体创意大赛《美丽中国》融媒刊创作二等奖"
  ].join("\n");
  try {
    const result = await createGeneratedResumePdf({ text: longText, uploadDir });
    const parsed = await parseResumeFile({
      buffer: await readFile(join(uploadDir, result.cleanOutputName)),
      originalname: "generated-long.pdf",
      mimetype: "application/pdf"
    });
    assert.match(parsed.text, /杜小艳/);
    assert.match(parsed.text, /融媒刊创作二等奖/);
    const pdf = await PdfLibDocument.load(await readFile(join(uploadDir, result.cleanOutputName)));
    assert.equal(pdf.getPageCount(), 1);
  } finally {
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test("createGeneratedResumePdf separates a section heading accidentally appended to the name line", async () => {
  const uploadDir = await mkdtemp(join(tmpdir(), "resume-generated-header-wrap-"));
  const text = [
    "中文姓名 核心优势 - 美国麻省理工学院化学工程博士，具备跨国实习经验",
    "教育背景",
    "美国麻省理工学院｜化学工程博士｜2005-2008",
    "工作经历",
    "参与制药与食品生产优化项目，完成数据分析与流程改进。"
  ].join("\n");
  try {
    const result = await createGeneratedResumePdf({ text, uploadDir });
    const parsed = await parseResumeFile({
      buffer: await readFile(join(uploadDir, result.cleanOutputName)),
      originalname: "generated-header-wrap.pdf",
      mimetype: "application/pdf"
    });
    assert.match(parsed.text, /中文姓名\s*\n/);
    assert.match(parsed.text, /核心优势/);
    assert.doesNotMatch(parsed.text, /^中文姓名.*核心优势/m);
  } finally {
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test("createGeneratedResumePdf rejects an effectively empty AI draft", async () => {
  const uploadDir = await mkdtemp(join(tmpdir(), "resume-generated-empty-export-"));
  await assert.rejects(
    createGeneratedResumePdf({
      text: "中文姓名\n联系方式：chchlee@mit.edu"
    , uploadDir }),
    /generated resume content is too short/
  );
  await rm(uploadDir, { recursive: true, force: true });
});

test("createGeneratedResumePdf uses the parsed candidate name instead of a generic AI heading", async () => {
  const uploadDir = await mkdtemp(join(tmpdir(), "resume-generated-candidate-name-"));
  try {
    const result = await createGeneratedResumePdf({
      text: "简历\n核心优势\n具备内容运营与项目执行经验，能够独立完成任务交付。",
      candidateName: "WAI KWONG (CHARLES) LEE",
      uploadDir
    });
    const parsed = await parseResumeFile({
      buffer: await readFile(join(uploadDir, result.cleanOutputName)),
      originalname: "generated-name.pdf",
      mimetype: "application/pdf"
    });
    assert.match(parsed.text, /^WAI\s*KWONG\s*\(CHARLES\)\s*LEE/m);
    assert.doesNotMatch(parsed.text, /^简历/m);
  } finally {
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test("createEditedPdfVersions can force the generated resume format", async () => {
  const uploadDir = await mkdtemp(join(tmpdir(), "resume-pdf-forced-generated-"));
  const sourceName = `forced-generated-${Date.now()}.pdf`;
  await writeFile(join(uploadDir, sourceName), await createPdfBuffer(["原始简历内容"]));
  try {
    const result = await createEditedPdfVersions({
      originalResumeFileUrl: `/api/resume-files/${sourceName}`,
      text: "测试用户\n核心优势\n- 独立完成内容运营。",
      outputMode: "generated-template",
      uploadDir
    });
    assert.equal(result.deliveryMode, "generated-template");
    const parsed = await parseResumeFile({
      buffer: await readFile(join(uploadDir, result.cleanOutputName)),
      originalname: "generated.pdf",
      mimetype: "application/pdf"
    });
    assert.match(parsed.text.replace(/\s+/g, ""), /测试用户.*独立完成内容运营/);
  } finally {
    await rm(uploadDir, { recursive: true, force: true });
  }
});

function countImageResources(pdf) {
  return pdf.getPages().reduce((total, page) => {
    const resources = page.node.Resources();
    const xObjects = resources?.lookupMaybe(PDFName.of("XObject"), PDFDict);
    if (!xObjects) return total;
    return total + xObjects.keys().filter((key) => {
      const object = xObjects.lookup(key);
      return object?.dict?.get(PDFName.of("Subtype"))?.toString() === "/Image";
    }).length;
  }, 0);
}

function createPdfBuffer(lines, includeImage = false) {
  return new Promise((resolve) => {
    const chunks = [];
    const doc = new PDFDocument();
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    if (includeImage) {
      doc.image(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"), 455, 45, { width: 54, height: 54 });
    }
    lines.forEach((line) => doc.text(line));
    doc.end();
  });
}

function createWrappedPdfBuffer(text) {
  return new Promise((resolve) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 72 });
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.fontSize(11).text(text, 72, 96, { width: 300, lineGap: 0 });
    doc.end();
  });
}

function createImageCollisionPdfBuffer(text) {
  return new Promise((resolve) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 72 });
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.fontSize(11).text(text, 72, 96, { width: 230, lineGap: 0 });
    doc.image(
      Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
      72,
      112,
      { width: 230, height: 32 }
    );
    doc.end();
  });
}

async function imageGeometry(pdfPath) {
  const python = process.env.PYMUPDF_PYTHON || (process.platform === "win32" ? "python" : "python3");
  const script = [
    "import json, sys, pymupdf",
    "doc = pymupdf.open(sys.argv[1])",
    "result = []",
    "for page_number, page in enumerate(doc):",
    "    for image in page.get_images(full=True):",
    "        xref, width, height = image[0], image[2], image[3]",
    "        for rect in page.get_image_rects(xref):",
    "            result.append([page_number, width, height] + [round(value, 4) for value in rect])",
    "print(json.dumps(sorted(result)))"
  ].join("\n");
  const { stdout } = await execFileAsync(python, ["-c", script, pdfPath], {
    encoding: "utf8",
    env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" }
  });
  return JSON.parse(stdout);
}
