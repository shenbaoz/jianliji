import React, { useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
import { ResumeDocument } from "./ResumeDocument";
import { getVisibleResumeTemplates } from "../services/templates";
import { buildResumeChangeSet } from "../services/changeExamples";
import { downloadResumeWord } from "../services/wordExporter";
import { saveExportFeedback } from "../services/storage";
import type { SavedResumeVersion } from "../types";

const EXPORT_UNLOCK_KEY = "jianliji_export_unlocked";

interface EditorViewProps {
  currentVersion?: SavedResumeVersion;
}

export const EditorView: React.FC<EditorViewProps> = ({ currentVersion }) => {
  const [exportMessage, setExportMessage] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [exportUnlocked, setExportUnlocked] = useState(() => {
    try { return localStorage.getItem(EXPORT_UNLOCK_KEY) === "1"; } catch { return false; }
  });
  const [gateAction, setGateAction] = useState<null | (() => void)>(null);

  const requestExport = (action: () => void) => {
    if (exportUnlocked) {
      action();
      return;
    }
    setGateAction(() => action);
  };

  const confirmUnlock = async (priceChoice: string, note: string) => {
    if (!priceChoice) return;
    setFeedbackError("");
    try {
      await saveExportFeedback({
        candidateName: currentVersion?.candidateName || "未命名用户",
        targetRole: currentVersion?.targetRole || "通用简历",
        planId: `feedback-${priceChoice}`,
        note
      });
    } catch (error) {
      setFeedbackError(error instanceof Error ? error.message : "反馈提交失败，请稍后重试。");
      return;
    }
    try { localStorage.setItem(EXPORT_UNLOCK_KEY, "1"); } catch { /* noop */ }
    setExportUnlocked(true);
    const pending = gateAction;
    setGateAction(null);
    pending?.();
  };

  const resumeExperience = currentVersion?.experience || "暂无成稿。请导入简历、填写目标岗位并补充真实证据。";
  const sourceResume = currentVersion?.resumeText || "";
  const originalResumeMimeType = currentVersion?.originalResumeMimeType || "";
  const isPdfResume = /pdf/i.test(originalResumeMimeType);
  const generatedResumeText = stripNonResumeNotes(currentVersion?.optimizedText || resumeExperience);
  const preparedPdf = currentVersion?.preparedPdf;
  const template = getVisibleResumeTemplates().find((item) => item.id === currentVersion?.templateId) || getVisibleResumeTemplates()[0];
  const resumeChanges = useMemo(
    () => currentVersion?.changes || buildResumeChangeSet(sourceResume, generatedResumeText),
    [currentVersion?.changes, sourceResume, generatedResumeText]
  );
  const canPublish = !isPdfResume || Boolean(preparedPdf?.fileUrl);

  const handleDownloadPdf = () => {
    if (!canPublish) {
      setExportMessage("成稿准备中，请稍候。");
      return;
    }
    if (preparedPdf?.fileUrl) {
      if (isMobileDownloadBrowser()) {
        window.location.assign(withDownloadFlag(preparedPdf.fileUrl));
        setExportMessage("正在下载 PDF；如果打开了预览，请使用浏览器菜单保存。");
        return;
      }
      const link = document.createElement("a");
      link.href = withDownloadFlag(preparedPdf.fileUrl);
      link.download = "优化后简历.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setExportMessage("已下载 PDF。");
      return;
    }
    setExportMessage("成品 PDF 准备中，请稍候。");
  };

  const handleDownloadWord = () => {
    try {
      // PDF 源：转换已精修的成品 PDF（保留原版式与照片）；DOCX 源：直接在源文档上替换文字
      const source = isPdfResume
        ? (preparedPdf?.fileUrl ? { pdfUrl: preparedPdf.fileUrl, deliveryMode: preparedPdf.deliveryMode } : undefined)
        : (/docx/i.test(originalResumeMimeType) && currentVersion?.originalResumeFileUrl
            ? { docxUrl: currentVersion.originalResumeFileUrl }
            : undefined);
      void downloadResumeWord(generatedResumeText, "优化后简历.docx", source).then((usedOriginalLayout) => {
        setExportMessage(usedOriginalLayout ? "已保留原版式与照片。" : "已下载 Word。");
      });
    } catch {
      setExportMessage("Word 导出失败，请刷新页面后重试。");
    }
  };

  return (
    <section className="editor-shell min-h-[calc(100vh-56px)] px-4 py-5 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-5 border-b border-slate-200 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">成稿</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">成稿已整理完成，可直接下载。</p>
            </div>
            <div className="editor-header-actions flex flex-wrap gap-2">
              <button type="button" onClick={() => requestExport(handleDownloadPdf)} disabled={!canPublish} className="editor-primary-export inline-flex h-10 items-center gap-2 rounded-sm bg-slate-950 px-4 text-xs font-semibold text-white hover:bg-[#173c33] disabled:cursor-not-allowed disabled:bg-slate-400">
                <FileText size={14} />
                下载 PDF
              </button>
              <button type="button" onClick={() => requestExport(handleDownloadWord)} className="inline-flex h-10 items-center gap-2 rounded-sm border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <Download size={14} />
                下载 Word
              </button>
            </div>
          </div>
        </div>
        <OptimizationHighlightsCard highlights={currentVersion?.highlights} />
        <ChangeCompareCard changes={resumeChanges} />
        <div className="editor-document-panel border border-slate-200 p-4 sm:p-8">
            <div className="mb-4 flex items-center justify-between"><span className="text-sm font-medium text-slate-800">可投递成稿</span><span className="editor-complete-label text-xs">已完成</span></div>
            <div className="editor-preview-viewport mx-auto w-full max-w-[900px] overflow-auto custom-scrollbar">
              <div className="resume-print-area mx-auto w-[210mm] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)] outline-none focus:ring-2 focus:ring-sky-500" spellCheck={false} aria-label="整理后的简历">
                <ResumeDocument text={generatedResumeText} template={template} portraitDataUrl={preparedPdf?.portraitDataUrl} candidateName={currentVersion?.candidateName} />
              </div>
            </div>
        </div>
      </div>
      {gateAction && (
        <ExportGateDialog
          onCancel={() => setGateAction(null)}
          onUnlock={confirmUnlock}
          error={feedbackError}
        />
      )}
    </section>
  );
};

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

function withDownloadFlag(fileUrl: string) {
  const url = new URL(fileUrl, window.location.href);
  url.searchParams.set("download", "1");
  return url.toString();
}

function isWeChatBrowser() {
  return /MicroMessenger|wxwork/i.test(navigator.userAgent);
}

function isMobileDownloadBrowser() {
  return isWeChatBrowser() || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function OptimizationHighlightsCard({ highlights }: { highlights?: string[] }) {
  const visible = highlights?.filter(Boolean).slice(0, 3) || [];
  if (!visible.length) return null;

  return (
    <div className="mb-5 rounded-lg border border-[#d2e0d9] bg-[#f3f8f5] p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-[#1a3c34]">本次优化重点</h2>
      <ul className="mt-3 space-y-2">
        {visible.map((item, index) => (
          <li key={index} className="flex items-start gap-2 text-xs leading-5 text-[#1a3c34]">
            <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#1a3c34]" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
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
          本次整理内容
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
            <span className="text-[11px] text-[#71706b]">{!change.after ? "已删减" : !change.before ? "已整理" : "已重写"}</span>
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

function ExportGateDialog({ onCancel, onUnlock, error }: { onCancel: () => void; onUnlock: (priceChoice: string, note: string) => void; error: string }) {
  const [priceChoice, setPriceChoice] = useState("");
  const [note, setNote] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const copyWechat = async () => {
    try {
      await navigator.clipboard.writeText("18142560091");
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 2200);
    }
  };

  return (
    <div className="export-gate-overlay" role="dialog" aria-modal="true" aria-label="导出前反馈引导">
      <div className="export-gate-card">
        <p className="export-gate-kicker">当前免费</p>
        <h2>想听你的判断</h2>
        <p className="export-gate-note">如果这份简历收费，你愿意付多少？</p>
        <p className="export-gate-contact">微信：<strong>18142560091</strong><button type="button" onClick={() => void copyWechat()} aria-label="复制微信号">{copyState === "copied" ? "已复制" : copyState === "failed" ? "复制失败" : "复制"}</button></p>
        <div className="export-gate-actions export-gate-price-options" role="radiogroup" aria-label="付费意愿">
          {[
            ["not-willing", "不愿意付费"],
            ["9-9", "9.9 元"],
            ["19-9-plus", "19.9 元及以上"]
          ].map(([value, label]) => (
            <button key={value} type="button" role="radio" aria-checked={priceChoice === value} className={priceChoice === value ? "export-gate-copy is-selected" : "export-gate-copy"} onClick={() => setPriceChoice(value)}>{label}</button>
          ))}
        </div>
        <label className="export-gate-feedback-label">哪里让你觉得值，或不值？<span>可不填</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="写一句就行" /></label>
        {error && <p className="export-gate-error" role="alert">{error}</p>}
        <button type="button" className="export-gate-confirm" disabled={!priceChoice} onClick={() => onUnlock(priceChoice, note)}>提交并免费下载</button>
        <button type="button" className="export-gate-skip" onClick={onCancel}>
          暂不导出
        </button>
      </div>
    </div>
  );
}
