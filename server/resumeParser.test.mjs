import assert from "node:assert/strict";
import test from "node:test";
import PDFDocument from "pdfkit";
import { parseResumeFile } from "./resumeParser.mjs";

test("parseResumeFile extracts text files", async () => {
  const result = await parseResumeFile({
    originalname: "resume.txt",
    mimetype: "text/plain",
    buffer: Buffer.from("张三\n前端工程师\nReact 项目经验", "utf8")
  });

  assert.equal(result.filename, "resume.txt");
  assert.equal(result.text, "张三\n前端工程师\nReact 项目经验");
});

test("parseResumeFile strips an inline education heading from the school name", async () => {
  const result = await parseResumeFile({
    originalname: "inline-education.txt",
    mimetype: "text/plain",
    buffer: Buffer.from("沈保自\n教育背景四川大学锦江学院\n四川大学锦江学院 | 计算机科学与技术 | 本科", "utf8")
  });

  assert.equal(result.basicInfo.school, "四川大学锦江学院");
});

test("parseResumeFile extracts PDF files", async () => {
  const buffer = await createPdfBuffer("Resume Candidate\nFrontend Engineer\nReact and TypeScript");

  const result = await parseResumeFile({
    originalname: "resume.pdf",
    mimetype: "application/pdf",
    buffer
  });

  assert.match(result.text, /Resume Candidate/);
  assert.match(result.text, /Frontend Engineer/);
  assert.doesNotMatch(result.text, /-- 1 of 1 --/);
});

test("parseResumeFile rejects empty extracted text", async () => {
  await assert.rejects(
    () =>
      parseResumeFile({
        originalname: "empty.txt",
        mimetype: "text/plain",
        buffer: Buffer.from("   ", "utf8")
      }),
    /没有提取到有效文本/
  );
});

test("parseResumeFile rejects unsupported formats", async () => {
  await assert.rejects(
    () =>
      parseResumeFile({
        originalname: "resume.png",
        mimetype: "image/png",
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff])
      }),
    /暂不支持/
  );
});

test("parseResumeFile uses file contents instead of extension or browser MIME", async () => {
  const pdf = await createPdfBuffer("Real PDF");
  const result = await parseResumeFile({
    originalname: "resume.txt",
    mimetype: "text/plain",
    buffer: pdf
  });

  assert.match(result.text, /Real PDF/);
});

test("parseResumeFile rejects active HTML disguised as an octet-stream text resume", async () => {
  await assert.rejects(
    () =>
      parseResumeFile({
        originalname: "resume.txt",
        mimetype: "application/octet-stream",
        buffer: Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>", "utf8")
      }),
    /真实文件类型|PDF、DOCX 或 TXT/
  );
});

test("parseResumeFile joins Chinese soft wraps without collapsing section boundaries", async () => {
  const result = await parseResumeFile({
    originalname: "resume.txt",
    mimetype: "text/plain",
    buffer: Buffer.from("杜 小 艳\n工作经历\n负责理\n货、盘点与陈列\n教育经历\n厦门大学", "utf8")
  });

  assert.match(result.text, /工作经历\n负责理货、盘点与陈列\n教育经历/);
  assert.doesNotMatch(result.text, /工作经历负责/);
  assert.equal(result.candidateName, "杜小艳");
});

test("parseResumeFile extracts a name from spaced labels used by exported PDFs", async () => {
  const result = await parseResumeFile({
    originalname: "resume.txt",
    mimetype: "text/plain",
    buffer: Buffer.from("姓 \t名 \t：杜小艳\n性 \t别 \t：女\n教育经历\n四川传媒学院", "utf8")
  });

  assert.equal(result.candidateName, "杜小艳");
});

test("parseResumeFile prefers a Chinese name joined to a role over a social-platform label", async () => {
  const result = await parseResumeFile({
    originalname: "public-android-resume.txt",
    mimetype: "text/plain",
    buffer: Buffer.from("1/4\n屈超安卓开发工程师\n联系电话：137-9848-1262\n电子邮箱：chao.qu521@gmail.com\nGitHub：github.com/JsonChao\n掘金\n：https://juejin.im/user/example\n专业技能", "utf8")
  });

  assert.equal(result.candidateName, "屈超");
});

test("parseResumeFile keeps multi-line personal fields separate and detects education details", async () => {
  const result = await parseResumeFile({
    originalname: "two-column-resume.txt",
    mimetype: "text/plain",
    buffer: Buffer.from("姓\n名：杜小艳\n性\n别：女\n政治面貌：共青团员\n籍\n贯：四川省绵阳市\n出生年月：2006.02\n电子邮箱：2127559788@qq.com\n联系方式：18880825628\n2024.09-2028.07\n四川传媒学院\n新闻学/ 本科\n专业技能：\n剪映", "utf8")
  });

  assert.match(result.text, /^姓名：杜小艳\n性别：女\n政治面貌：共青团员\n籍贯：四川省绵阳市/m);
  assert.equal(result.candidateName, "杜小艳");
  assert.deepEqual(result.basicInfo, {
    name: "杜小艳",
    phone: "18880825628",
    email: "2127559788@qq.com",
    school: "四川传媒学院",
    major: "新闻学",
    degree: "本科"
  });
});

function createPdfBuffer(text) {
  return new Promise((resolve) => {
    const chunks = [];
    const doc = new PDFDocument();
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.text(text);
    doc.end();
  });
}
