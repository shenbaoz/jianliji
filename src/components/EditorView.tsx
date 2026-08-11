import React, { useEffect, useRef, useState } from "react";
import { Download, Save } from "lucide-react";
import DOMPurify from "dompurify";
import { ResumeDocument } from "./ResumeDocument";
import { applyTextToDocxPreview } from "../services/docxFileEditor";
import { createEditedPdfPreview } from "../services/pdfFileEditor";
import { getVisibleResumeTemplates } from "../services/templates";
import { buildResumeChangeSet } from "../services/changeExamples";
import type { SavedResumeVersion } from "../types";

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["div", "span", "p", "br", "table", "tbody", "thead", "tr", "td", "th", "img", "ul", "ol", "li", "b", "strong", "i", "em", "u", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "section", "article"],
    ALLOWED_ATTR: ["class", "style", "src", "alt", "width", "height", "colspan", "rowspan", "id"],
    FORBID_TAGS: ["script", "iframe", "object", "embed", "link", "meta"],
    FORBID_ATTR: ["onload", "onerror", "onclick", "onmouseover", "onfocus", "onblur"]
  });
}

interface EditorViewProps {
  currentVersion?: SavedResumeVersion;
  onSave?: (version: SavedResumeVersion) => void;
  qualityPositive?: {
    experienceLineCount: number;
    strongVerbCoverage: number;
    quantifiedRatio: number;
    templatePhrases: string[];
    weakOpeners: string[];
    passHint: string;
  };
}

export const EditorView: React.FC<EditorViewProps> = ({ currentVersion, onSave, qualityPositive }) => {
  const pdfRef = useRef<HTMLDivElement>(null);
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const [exportMessage, setExportMessage] = useState("");
  const [previewScale, setPreviewScale] = useState(1);
  const [previewHeight, setPreviewHeight] = useState(0);
  const resumeExperience = currentVersion?.experience || "暂无成稿内容。请先放入简历、填写目标岗位并补充真实证据。";
  const sourceResume = currentVersion?.resumeText || "";
  const originalResumeHtml = currentVersion?.originalResumeHtml?.includes("original-pdf-document")
    ? undefined
    : currentVersion?.originalResumeHtml;
  const originalResumeFileUrl = currentVersion?.originalResumeFileUrl;
  const originalResumeMimeType = currentVersion?.originalResumeMimeType || "";
  const originalResumeDataUrl = currentVersion?.originalResumeDataUrl;
  const hasOriginalResumePreview = Boolean(originalResumeHtml || originalResumeFileUrl);
  const shouldShowOriginalFile = Boolean(originalResumeFileUrl && /pdf/i.test(originalResumeMimeType));
  const canSyncOriginalDocx = Boolean(/docx/i.test(originalResumeMimeType) && (originalResumeDataUrl || originalResumeFileUrl));
  const canSyncOriginalPdf = Boolean(shouldShowOriginalFile && originalResumeFileUrl);
  const generatedResumeText = stripNonResumeNotes(currentVersion?.optimizedText || resumeExperience);
  const [editableResumeText, setEditableResumeText] = useState(generatedResumeText);
  const [editableOriginalHtml, setEditableOriginalHtml] = useState("");
  const [editedPdfUrl, setEditedPdfUrl] = useState("");
  const [reviewPdfUrl, setReviewPdfUrl] = useState("");
  const [fileSyncMessage, setFileSyncMessage] = useState("");
  const template = getVisibleResumeTemplates().find((item) => item.id === currentVersion?.templateId) || getVisibleResumeTemplates()[0];
  const resumeChanges = currentVersion?.changes || buildResumeChangeSet(sourceResume, editableResumeText);
  const canPublish = canSyncOriginalPdf ? Boolean(editedPdfUrl) : true;

  useEffect(() => {
    setEditableResumeText(generatedResumeText);
    setEditableOriginalHtml(!shouldShowOriginalFile && originalResumeHtml ? originalResumeHtml : "");
  }, [generatedResumeText, originalResumeHtml, shouldShowOriginalFile]);

  useEffect(() => {
    if (!canSyncOriginalDocx) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setFileSyncMessage("正在同步到右侧版式...");
      try {
        const html = await applyTextToDocxPreview({ dataUrl: originalResumeDataUrl, fileUrl: originalResumeFileUrl }, editableResumeText);
        if (!cancelled) {
          setEditableOriginalHtml(html);
          setFileSyncMessage("已同步到右侧版式。");
        }
      } catch (error) {
        if (!cancelled) {
          setFileSyncMessage(error instanceof Error ? error.message : "同步失败，请重新上传 DOCX。");
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canSyncOriginalDocx, editableResumeText, originalResumeDataUrl, originalResumeFileUrl]);

  useEffect(() => {
    if (!canSyncOriginalPdf || !originalResumeFileUrl) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setFileSyncMessage("正在生成成品简历...");
      try {
        const nextUrls = await createEditedPdfPreview(originalResumeFileUrl, editableResumeText, resumeChanges);
        if (!cancelled) {
          setEditedPdfUrl(nextUrls.fileUrl);
          setReviewPdfUrl(nextUrls.reviewFileUrl);
          setFileSyncMessage(nextUrls.changedLineCount > 0 ? `已实际写回 ${nextUrls.changedLineCount} 处，右侧用红线标出。` : "未定位到可安全替换的原句，已保留原文件。");
        }
      } catch (error) {
        if (!cancelled) {
          setFileSyncMessage(error instanceof Error ? error.message : "PDF 同步失败。");
        }
      }
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canSyncOriginalPdf, editableResumeText, originalResumeFileUrl, sourceResume]);

  useEffect(() => {
    const viewport = previewViewportRef.current;
    const paper = pdfRef.current;
    if (!viewport || !paper) return;

    const updatePreviewScale = () => {
      const availableWidth = viewport.clientWidth;
      const paperWidth = paper.offsetWidth;
      if (!availableWidth || !paperWidth) return;
      const nextScale = Math.min(1, availableWidth / paperWidth);
      setPreviewScale(nextScale);
      setPreviewHeight(Math.ceil(paper.scrollHeight * nextScale));
    };

    updatePreviewScale();
    const observer = new ResizeObserver(updatePreviewScale);
    observer.observe(viewport);
    observer.observe(paper);
    window.addEventListener("resize", updatePreviewScale);
    const frame = window.requestAnimationFrame(updatePreviewScale);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePreviewScale);
      window.cancelAnimationFrame(frame);
    };
  }, [editableResumeText, editableOriginalHtml, editedPdfUrl, reviewPdfUrl]);

  const handleSaveVersion = () => {
    if (!onSave || !currentVersion) return;
    const finalText = getEditedResumeText();
    onSave({
      ...currentVersion,
      optimizedText: finalText,
      experience: finalText,
      updatedAt: new Date().toISOString()
    });
    setExportMessage("已保存版本，可在「我的版本」中查看。");
  };

  const handleDownloadPdf = () => {
    if (!pdfRef.current || !canPublish) {
      setExportMessage("成品简历正在生成，请稍候几秒。");
      return;
    }
    if (canSyncOriginalPdf) {
      if (!editedPdfUrl) {
        setExportMessage("成品 PDF 正在生成，请稍候几秒再下载。");
        return;
      }
      const link = document.createElement("a");
      link.href = editedPdfUrl;
      link.download = "优化后简历.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setExportMessage("已下载无红线的成品 PDF。");
      return;
    }
    setExportMessage("已打开浏览器打印窗口，请选择“保存为 PDF”。");
    window.print();
  };

  const getEditedResumeText = () => {
    if (hasOriginalResumePreview) return editableResumeText;
    const text = pdfRef.current?.innerText?.trim();
    return text ? stripNonResumeNotes(text) : editableResumeText;
  };

  const handlePreviewBlur = () => {
    if (hasOriginalResumePreview) return;
    setEditableResumeText(getEditedResumeText());
  };

  return (
    <section className="min-h-[calc(100vh-56px)] bg-slate-50 px-4 py-5 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-5 border-b border-slate-200 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">成品简历</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">已直接在上传的原版简历中完成文字优化，红线标出本次修改。</p>
            </div>
            <div className="editor-header-actions flex flex-wrap gap-2">
              <button type="button" onClick={handleSaveVersion} className="inline-flex h-10 items-center gap-2 rounded-sm border border-[#cbbcac] bg-white px-4 text-xs font-semibold text-[#1a3c34] hover:bg-[#f5f0eb]">
                <Save size={14} />
                保存版本
              </button>
              <button type="button" onClick={handleDownloadPdf} disabled={!canPublish} className="inline-flex h-10 items-center gap-2 rounded-sm bg-slate-950 px-4 text-xs font-semibold text-white hover:bg-[#173c33] disabled:cursor-not-allowed disabled:bg-slate-300">
                <Download size={14} />
                打印 / 保存 PDF
              </button>
            </div>
          </div>
          <p className={canPublish ? "mt-4 text-xs font-medium text-emerald-700" : "mt-4 text-xs font-medium text-amber-700"}>
            {exportMessage || fileSyncMessage || (canPublish ? "成品简历已生成，可导出无红线 PDF。" : "正在生成成品简历...")}
          </p>
        </div>
        <ChangeCompareCard changes={resumeChanges} />
        {qualityPositive && <QualityMeterCard positive={qualityPositive} />}
        <div className="border border-slate-200 bg-[#e9ece8] p-4 sm:p-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-950">成品简历预览</h2>
              <span className="text-xs text-slate-500">{hasOriginalResumePreview ? "原文件版式，展示优化后的内容" : "可直接点击文字修改"}</span>
            </div>
            <div
              ref={previewViewportRef}
              className="editor-preview-viewport mx-auto w-full max-w-[900px] overflow-auto custom-scrollbar"
              style={{ height: previewHeight > 0 ? `${previewHeight}px` : undefined }}
            >
              <div
                ref={pdfRef}
                className="resume-print-area mx-auto w-[210mm] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)] outline-none focus:ring-2 focus:ring-sky-500"
                style={{ transform: `scale(${previewScale})`, transformOrigin: "top left" }}
                contentEditable={!hasOriginalResumePreview}
                suppressContentEditableWarning
                spellCheck={false}
                onBlur={handlePreviewBlur}
                aria-label={hasOriginalResumePreview ? "原文件版式成品简历" : "可编辑成品简历"}
                title={hasOriginalResumePreview ? "原文件版式，展示优化后的内容" : "可直接点击文字修改"}
              >
                {shouldShowOriginalFile && originalResumeFileUrl ? (
                  <PdfFilePreview src={reviewPdfUrl || originalResumeFileUrl} isUpdating={Boolean(fileSyncMessage.startsWith("正在"))} />
                ) : editableOriginalHtml ? (
                  <div className="original-resume-preview" dangerouslySetInnerHTML={{ __html: sanitizeHtml(editableOriginalHtml) }} />
                ) : originalResumeFileUrl ? (
                  <iframe className="h-[297mm] w-full border-0 bg-white" src={originalResumeFileUrl} title="原始简历预览" />
                ) : (
                  <ResumeDocument text={editableResumeText} template={template} />
                )}
              </div>
            </div>
        </div>
      </div>
    </section>
  );
};

function PdfFilePreview({ src, isUpdating }: { src: string; isUpdating: boolean }) {
  const [renderedPages, setRenderedPages] = useState<Array<{ dataUrl: string; width: number; height: number }>>([]);
  const [previewError, setPreviewError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let loadingTask: { destroy: () => Promise<void>; promise: Promise<any> } | null = null;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;
    setRenderedPages([]);
    setPreviewError("");
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const workerUrl = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url);
        workerUrl.searchParams.set("mime", "application-javascript-v1");
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.toString();
        loadingTask = pdfjs.getDocument({ url: src, verbosity: 0 });
        const pdf = await loadingTask.promise;
        const nextPages: Array<{ dataUrl: string; width: number; height: number }> = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled) break;
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1.6 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d", { alpha: false });
          if (!context) throw new Error("Canvas is unavailable");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const nextRenderTask = page.render({ canvas, canvasContext: context, viewport });
          renderTask = nextRenderTask;
          await nextRenderTask.promise;
          nextPages.push({ dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height });
        }
        await loadingTask.destroy();
        loadingTask = null;
        if (cancelled) return;
        setRenderedPages(nextPages);
        setPreviewError("");
      } catch (error) {
        if (!cancelled) {
          console.error("PDF preview rendering failed", error);
          setPreviewError("PDF 预览加载失败，请重新上传。");
        }
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      void loadingTask?.destroy();
    };
  }, [src]);

  return (
    <div className="pdf-canvas-preview relative grid gap-4 bg-[#e9ece8]" aria-busy={isUpdating}>
      {renderedPages.map((page, index) => (
        <img
          key={`${src}-${index}`}
          src={page.dataUrl}
          width={page.width}
          height={page.height}
          className="block h-auto w-[210mm] max-w-full bg-white shadow-[0_16px_48px_rgba(15,23,42,0.12)]"
          alt={`简历第 ${index + 1} 页`}
        />
      ))}
      {!renderedPages.length && !previewError && <div className="grid h-[297mm] place-items-center bg-white text-sm text-slate-500">正在打开原简历…</div>}
      {previewError && <div className="grid h-[297mm] place-items-center bg-white text-sm text-rose-700">{previewError}</div>}
      {isUpdating && renderedPages.length > 0 && <div className="sticky bottom-4 mx-auto rounded-full bg-slate-950/90 px-4 py-2 text-xs font-medium text-white shadow-lg">正在同步优化文字…</div>}
    </div>
  );
}

function stripNonResumeNotes(text: string) {
  return text
    .replace(/\n改写说明\n[\s\S]*?(?=\n(?:个人优势|核心能力|工作经历|项目经历|教育经历|$))/g, "\n")
    .replace(/\n弱句升级示例\n[\s\S]*?(?=\n(?:个人优势|核心能力|工作经历|项目经历|教育经历|$))/g, "\n")
    .replace(/\n投递前补强建议\n[\s\S]*$/g, "")
    .split(/\n+/)
    .filter((line) => !/^\s*-?\s*(?:\[待补充\]|\[待确认\]|已有线索|成稿需改成|用户补充证据|目标岗位提到|尚未填写补充回答)/.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ChangeCompareCard({ changes }: { changes: Array<{ before: string; after: string }> }) {
  const [expanded, setExpanded] = useState(false);
  const visible = changes?.slice(0, expanded ? changes.length : 4) || [];
  if (!changes?.length) return null;

  return (
    <div className="mb-5 rounded-lg border border-[#d2e0d9] bg-[#f3f8f5] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#1a3c34]">
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1a3c34] px-1.5 text-[11px] font-bold text-white">
            {changes.length}
          </span>
          本次优化改动
        </h2>
        {changes.length > 4 && (
          <button type="button" className="text-xs font-medium text-[#71706b] hover:text-[#1a3c34]" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "收起" : `查看全部 ${changes.length} 处`}
          </button>
        )}
      </div>
      <div className="mt-3 space-y-2.5">
        {visible.map((change, index) => (
          <div key={index} className="grid grid-cols-1 gap-1.5 rounded-md border border-[#e1e9e4] bg-white p-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-3">
            <p className="text-xs leading-5 text-[#8a8a86] line-through decoration-[#b9b9b4] decoration-1">{change.before}</p>
            <span className="hidden text-[#b8860b] sm:block" aria-hidden="true">→</span>
            <span className="text-[#b8860b] sm:hidden" aria-hidden="true">↓</span>
            <p className="text-xs font-medium leading-5 text-[#1a3c34]">{change.after}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function QualityMeterCard({ positive }: { positive: { experienceLineCount: number; strongVerbCoverage: number; quantifiedRatio: number; templatePhrases: string[]; weakOpeners: string[]; passHint: string } }) {
  const metrics = [
    {
      label: "动词开头",
      value: positive.strongVerbCoverage,
      display: `${Math.round(positive.strongVerbCoverage * 100)}%`,
      hint: positive.experienceLineCount ? `已评估 ${positive.experienceLineCount} 条经历描述` : "暂无可评估的经历描述"
    },
    {
      label: "量化结果",
      value: positive.quantifiedRatio,
      display: `${Math.round(positive.quantifiedRatio * 100)}%`,
      hint: "含数字/比例/量词的经历占比"
    }
  ];
  const hasTemplate = positive.templatePhrases.length > 0;
  const hasWeak = positive.weakOpeners.length > 0;

  return (
    <div className="mb-5 rounded-lg border border-[#d2e0d9] bg-[#f3f8f5] p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-[#1a3c34]">成稿质量达标度</h2>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#20211f]">{metric.label}</span>
              <span className="font-semibold text-[#1a3c34]">{metric.display}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#e1e9e4]">
              <div className="h-full rounded-full bg-[#1a3c34]" style={{ width: `${Math.round(Math.min(1, Math.max(0, metric.value)) * 100)}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-[#71706b]">{metric.hint}</p>
          </div>
        ))}
      </div>
      {(hasTemplate || hasWeak) && (
        <div className="mt-3 rounded-md border border-[#ecdcc3] bg-[#faf4e8] p-3 text-xs leading-5 text-[#6b5b3e]">
          {hasTemplate && <p>· 删除空泛描述：{positive.templatePhrases.join("、")}</p>}
          {hasWeak && <p>· 弱开头待强化：{positive.weakOpeners.slice(0, 3).join("；")}</p>}
          {positive.passHint && <p>· 建议：{positive.passHint}</p>}
        </div>
      )}
    </div>
  );
}
