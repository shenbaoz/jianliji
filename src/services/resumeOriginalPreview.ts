export type OriginalResumePreview = {
  html?: string;
  fileUrl?: string;
  dataUrl?: string;
  fileName: string;
  mimeType: string;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export async function createOriginalResumePreview(file: File): Promise<OriginalResumePreview> {
  const mimeType = file.type || inferMimeType(file.name);

  if (/\.pdf$/i.test(file.name)) {
    return {
      fileUrl: URL.createObjectURL(file),
      fileName: file.name,
      mimeType
    };
  }

  const dataUrl = await fileToDataUrl(file);

  if (/\.docx$/i.test(file.name)) {
    const { html } = await createDocxPreviewHtml(file);

    return {
      html,
      dataUrl,
      fileName: file.name,
      mimeType
    };
  }

  if (/\.txt$/i.test(file.name)) {
    const text = await file.text();
    return {
      html: `<pre class="original-resume-text">${escapeHtml(text)}</pre>`,
      dataUrl,
      fileName: file.name,
      mimeType
    };
  }

  return {
    fileUrl: URL.createObjectURL(file),
    dataUrl,
    fileName: file.name,
    mimeType
  };
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("原文件保存失败，请重新上传。"));
    reader.readAsDataURL(file);
  });
}

function inferMimeType(fileName: string) {
  if (/\.pdf$/i.test(fileName)) return "application/pdf";
  if (/\.docx$/i.test(fileName)) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (/\.txt$/i.test(fileName)) return "text/plain";
  return "application/octet-stream";
}

async function createDocxPreviewHtml(file: File) {
  const docx = await import("docx-preview");
  const bodyContainer = document.createElement("div");
  const styleContainer = document.createElement("div");

  await docx.renderAsync(await file.arrayBuffer(), bodyContainer, styleContainer, {
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

  return {
    html: `<div class="original-resume-document original-docx-document"><style>${styleContainer.innerHTML}</style>${bodyContainer.innerHTML}</div>`
  };
}
