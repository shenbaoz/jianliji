import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import PDFDocument from "pdfkit";
import { PDFDict, PDFDocument as PdfLibDocument, PDFName } from "pdf-lib";
import { createEditedPdfVersions } from "./pdfEditor.mjs";
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
    assert.deepEqual(result.appliedChanges, []);

    const cleanPath = join(uploadDir, result.cleanOutputName);
    const cleanBytes = await readFile(cleanPath);
    const parsed = await parseResumeFile({ buffer: cleanBytes, originalname: "clean.pdf", mimetype: "application/pdf" });
    assert.match(parsed.text, /Managed event operations/, "rollback must restore the page's source text");
    assert.doesNotMatch(parsed.text, /regional campaigns/, "unsafe replacement text must not survive rollback");
    assert.deepEqual(await imageGeometry(cleanPath), await imageGeometry(sourcePath));
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
    assert.deepEqual(result.appliedChanges, []);
    const cleanBytes = await readFile(join(uploadDir, result.cleanOutputName));
    const parsed = await parseResumeFile({ buffer: cleanBytes, originalname: "clean.pdf", mimetype: "application/pdf" });
    assert.match(parsed.text.replace(/\s+/g, ""), /Managedcampaignstrategy/);
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

    assert.equal(result.changedLineCount, 0, "an unsafe replacement must be skipped instead of squeezed into the original line");
    const cleanBytes = await readFile(join(uploadDir, result.cleanOutputName));
    const parsed = await parseResumeFile({ buffer: cleanBytes, originalname: "clean.pdf", mimetype: "application/pdf" });
    assert.match(parsed.text, /Managed event operations/, "skipping an unsafe replacement must preserve the original text");
    assert.doesNotMatch(parsed.text, /regional growth programs/, "oversized replacement text must not be drawn over neighboring content");
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
