import JSZip from "jszip";

export async function applyTextToDocxPreview(source: { dataUrl?: string; fileUrl?: string }, text: string) {
  const blob = await loadDocxBlob(source);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("没有找到 DOCX 正文内容。");

  const doc = new DOMParser().parseFromString(documentXml, "application/xml");
  const paragraphs = Array.from(doc.getElementsByTagName("w:p"))
    .map((paragraph) => ({
      paragraph,
      textNodes: Array.from(paragraph.getElementsByTagName("w:t"))
    }))
    .filter((item) => item.textNodes.some((node) => node.textContent?.trim()));
  const lines = getResumeLines(text);
  let lineIndex = 0;

  paragraphs.forEach(({ textNodes }) => {
    if (lineIndex >= lines.length) return;
    const [firstNode, ...restNodes] = textNodes;
    firstNode.textContent = lines[lineIndex];
    restNodes.forEach((node) => {
      node.textContent = "";
    });
    lineIndex += 1;
  });

  zip.file("word/document.xml", new XMLSerializer().serializeToString(doc));
  const editedBlob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });

  return renderDocxBlobToHtml(editedBlob);
}

async function loadDocxBlob(source: { dataUrl?: string; fileUrl?: string }) {
  if (source.dataUrl) {
    const response = await fetch(source.dataUrl);
    return response.blob();
  }
  if (source.fileUrl) {
    const response = await fetch(source.fileUrl);
    if (!response.ok) throw new Error("原 DOCX 文件加载失败。");
    return response.blob();
  }
  throw new Error("没有可编辑的 DOCX 原文件。");
}

async function renderDocxBlobToHtml(blob: Blob) {
  const docx = await import("docx-preview");
  const bodyContainer = document.createElement("div");
  const styleContainer = document.createElement("div");

  await docx.renderAsync(await blob.arrayBuffer(), bodyContainer, styleContainer, {
    className: "original-docx",
    inWrapper: false,
    ignoreWidth: false,
    ignoreHeight: false,
    ignoreFonts: false,
    breakPages: true,
    renderHeaders: true,
    renderFooters: true,
    useBase64URL: true
  });

  return `<div class="original-resume-document original-docx-document"><style>${styleContainer.innerHTML}</style>${bodyContainer.innerHTML}</div>`;
}

function getResumeLines(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[\-•·]\s*/, "").trim())
    .filter(Boolean);
}
