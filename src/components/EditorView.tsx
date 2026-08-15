import React, { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { ResumeDocument } from "./ResumeDocument";
import { getVisibleResumeTemplates } from "../services/templates";
import { buildResumeChangeSet } from "../services/changeExamples";
import type { SavedResumeVersion } from "../types";

interface EditorViewProps {
  currentVersion?: SavedResumeVersion;
}

export const EditorView: React.FC<EditorViewProps> = ({ currentVersion }) => {
  const [exportMessage, setExportMessage] = useState("");
  const resumeExperience = currentVersion?.experience || "暂无成稿内容。请先放入简历、填写目标岗位并补充真实证据。";
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
      setExportMessage("成品简历正在准备，请稍候。");
      return;
    }
    if (isPdfResume && preparedPdf?.fileUrl) {
      const link = document.createElement("a");
      link.href = preparedPdf.fileUrl;
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

  return (
    <section className="min-h-[calc(100vh-56px)] bg-slate-50 px-4 py-5 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-5 border-b border-slate-200 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">成品简历</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">已按专业求职结构整理，重点突出真实经历与成果。</p>
            </div>
            <div className="editor-header-actions flex flex-wrap gap-2">
              <button type="button" onClick={handleDownloadPdf} disabled={!canPublish} className="inline-flex h-10 items-center gap-2 rounded-sm bg-slate-950 px-4 text-xs font-semibold text-white hover:bg-[#173c33] disabled:cursor-not-allowed disabled:bg-slate-300">
                <Download size={14} />
                打印 / 保存 PDF
              </button>
            </div>
          </div>
          <p className={canPublish ? "mt-4 text-xs font-medium text-emerald-700" : "mt-4 text-xs font-medium text-amber-700"}>
            {exportMessage || (canPublish ? "成品简历已生成，可导出无红线 PDF。" : "正在生成成品简历...")}
          </p>
        </div>
        <OptimizationHighlightsCard highlights={currentVersion?.highlights} />
        <ChangeCompareCard changes={resumeChanges} />
        <div className="border border-slate-200 bg-[#e9ece8] p-4 sm:p-8">
            <div className="mb-4 flex items-center justify-between"><span className="text-sm font-medium text-slate-800">可投递成稿</span><span className="text-xs text-slate-500">已完成</span></div>
            <div className="editor-preview-viewport mx-auto w-full max-w-[900px] overflow-auto custom-scrollbar">
              <div className="resume-print-area mx-auto w-[210mm] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)] outline-none focus:ring-2 focus:ring-sky-500" spellCheck={false} aria-label="整理后的简历">
                <ResumeDocument text={generatedResumeText} template={template} portraitDataUrl={preparedPdf?.portraitDataUrl} />
              </div>
            </div>
        </div>
      </div>
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
