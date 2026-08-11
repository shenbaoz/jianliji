import { memo, useState, type ReactNode } from "react";
import { ArrowRight, Eye, FileUp, Lock, PenLine, RotateCcw } from "lucide-react";
import { ResumeDocument } from "./ResumeDocument";
import { PageShell } from "./ProductShell";
import { sampleResumeCases } from "../data/sampleCases";
import { parseResumeFile } from "../services/resumeFileParser";
import { createOriginalResumePreview } from "../services/resumeOriginalPreview";
import { getVisibleResumeTemplates } from "../services/templates";
import type { ResumeInput, SampleResumeCase, WorkflowStep } from "../types";

const resumeUploadLimitBytes = 10 * 1024 * 1024;
const resumeUploadLimitText = "10MB";

type Props = {
  input: ResumeInput;
  onChange: (input: ResumeInput) => void;
  onNext: () => void;
  onLoadSample: (sample: SampleResumeCase, nextStep?: WorkflowStep) => void;
};

type MobileTab = "edit" | "preview";

export const HomeView = memo(function HomeView({ input, onChange, onNext, onLoadSample }: Props) {
  const [fileStatus, setFileStatus] = useState("");
  const [tab, setTab] = useState<MobileTab>("edit");
  const resumeLength = input.resumeText.trim().length;
  const canContinue = resumeLength > 20;
  const previewTemplate = getVisibleResumeTemplates()[0];

  const update = (field: keyof ResumeInput, value: string) => {
    onChange({ ...input, [field]: value });
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > resumeUploadLimitBytes) {
      setFileStatus(`文件过大，请上传 ${resumeUploadLimitText} 以内的 PDF、DOCX 或 TXT 简历。`);
      return;
    }
    setFileStatus(`正在解析：${file.name}`);
    try {
      const [parsedResume, originalPreview] = await Promise.all([
        parseResumeFile(file),
        createOriginalResumePreview(file)
      ]);
      onChange({
        ...input,
        candidateName: input.candidateName.trim() || parsedResume.candidateName || "",
        resumeText: parsedResume.text,
        originalResumeHtml: originalPreview.html,
        originalResumeFileName: parsedResume.originalResumeFileName || originalPreview.fileName,
        originalResumeMimeType: parsedResume.originalResumeMimeType || originalPreview.mimeType,
        originalResumeFileUrl: parsedResume.originalResumeFileUrl || originalPreview.fileUrl,
        originalResumeDataUrl: originalPreview.dataUrl
      });
      setFileStatus(`已解析：${file.name}`);
      setTab("preview");
    } catch (error) {
      setFileStatus(error instanceof Error ? error.message : "简历解析失败，请换一个文件试试。");
    }
  };

  const handleClearResume = () => {
    onChange({ ...input, candidateName: "", resumeText: "", originalResumeHtml: undefined, originalResumeFileName: undefined, originalResumeMimeType: undefined, originalResumeFileUrl: undefined, originalResumeDataUrl: undefined });
    setFileStatus("");
    setTab("edit");
  };

  return (
    <PageShell
      active="workspace"
      title="导入简历"
      description="上传 PDF、DOCX，或直接粘贴文字；没有正式简历，也可以用样稿开始。"
      actions={
        <div className="flex gap-2">
          {resumeLength > 0 && (
            <button type="button" className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={handleClearResume}>
              <RotateCcw size={14} />
              清除
            </button>
          )}
          <button type="button" className="inline-flex h-9 items-center gap-2 rounded-md bg-sky-700 px-4 text-xs font-semibold text-white hover:bg-sky-800 disabled:bg-slate-300" onClick={onNext} disabled={!canContinue}>
            继续
            <ArrowRight size={14} />
          </button>
        </div>
      }
    >
      <div className="grid min-h-[calc(100vh-164px)] grid-cols-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm lg:grid-cols-[minmax(360px,0.44fr)_minmax(520px,0.56fr)]">
        <section className={tab === "edit" ? "flex min-h-0 flex-col lg:flex" : "hidden min-h-0 flex-col lg:flex"}>
          <div className="flex min-h-14 items-center justify-between border-b border-slate-200 px-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">导入已有简历</h2>
              <p className="text-xs text-slate-500">{resumeLength} 字 · 上传文件使用随机临时链接并按期清理</p>
            </div>
            {resumeLength > 0 && <span className="text-xs font-medium text-emerald-700">已就绪</span>}
          </div>

          <div className="border-b border-slate-200 p-5">
            <label className="flex min-h-44 cursor-pointer justify-center rounded-md border-2 border-dashed border-slate-300 px-6 py-9 hover:border-sky-400">
              <span className="text-center">
                <FileUp size={44} className="mx-auto text-sky-700" />
                <strong className="mt-4 block text-lg font-semibold text-slate-800">选择文件，或拖到这里</strong>
                <span className="mt-2 flex items-center justify-center text-sm text-slate-500">
                  <Lock size={13} className="mr-1 text-slate-400" />
                  PDF / DOCX / TXT，{resumeUploadLimitText} 以内
                </span>
                <em className="mt-4 inline-flex rounded-full bg-sky-700 px-6 py-2 text-sm font-semibold not-italic text-white">选择文件</em>
                {fileStatus && <span className="mt-4 block text-xs leading-6 text-sky-900">{fileStatus}</span>}
              </span>
              <input className="sr-only" type="file" accept=".txt,.pdf,.docx" onChange={(event) => handleFile(event.target.files?.[0])} />
            </label>

            {!canContinue && (
              <div className="mx-[-1.25rem] flex items-center pb-4 pt-6" aria-hidden="true">
                <div className="flex-grow border-t border-slate-200" />
                <span className="mx-2 mt-[-2px] flex-shrink text-sm text-slate-400">或</span>
                <div className="flex-grow border-t border-slate-200" />
              </div>
            )}

            {!canContinue && (
              <button type="button" className="mx-auto block rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => onLoadSample(sampleResumeCases[0], "job")}>
                用样稿继续
              </button>
            )}
          </div>

          <textarea
            className="min-h-[420px] flex-1 resize-none bg-white px-5 py-5 text-sm leading-8 text-slate-700 outline-none placeholder:text-slate-400 lg:min-h-0"
            value={input.resumeText}
            onChange={(event) => update("resumeText", event.target.value)}
            placeholder="也可以直接把简历文字粘贴到这里。"
          />
        </section>

        <section className={tab === "preview" ? "flex min-h-0 flex-col border-l border-slate-200 bg-slate-100 lg:flex" : "hidden min-h-0 flex-col border-l border-slate-200 bg-slate-100 lg:flex"}>
          <div className="flex min-h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">纸张预览</h2>
              <p className="text-xs text-slate-500">简历记实时预览</p>
            </div>
            <span className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500">A4</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4 custom-scrollbar sm:p-6">
            <div className="mx-auto max-w-[760px]">
              {resumeLength > 0 ? (
                <ResumeDocument text={input.resumeText} template={previewTemplate} />
              ) : (
                <div className="flex min-h-[560px] items-center justify-center border border-dashed border-slate-300 bg-white text-center text-sm leading-7 text-slate-400">
                  简历内容会在这里以纸张形式预览。
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <nav className="mobile-view-tabs fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="简历导入视图">
        <MobileTabButton active={tab === "edit"} icon={<PenLine size={19} />} label="编辑" onClick={() => setTab("edit")} />
        <MobileTabButton active={tab === "preview"} icon={<Eye size={19} />} label="预览" onClick={() => setTab("preview")} />
      </nav>
    </PageShell>
  );
});

function MobileTabButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-current={active ? "page" : undefined} className={active ? "flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold text-sky-700" : "flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs text-slate-500"} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
