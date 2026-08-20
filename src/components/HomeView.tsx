import { memo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Eye, FileUp, PenLine, RotateCcw } from "lucide-react";
import { ResumeDocument } from "./ResumeDocument";
import { PageShell } from "./ProductShell";
import { BasicInfoFields } from "./BasicInfoFields";
import { parseResumeFile } from "../services/resumeFileParser";
import { createOriginalResumePreview } from "../services/resumeOriginalPreview";
import { getVisibleResumeTemplates } from "../services/templates";
import { emptyBasicInfo, type BasicInfo, type ResumeInput } from "../types";

const resumeUploadLimitBytes = 10 * 1024 * 1024;
const resumeUploadLimitText = "10MB";

type Props = {
  input: ResumeInput;
  onChange: (input: ResumeInput) => void;
  onRefine: () => void;
  isRefining: boolean;
};

type MobileTab = "edit" | "preview";

export const HomeView = memo(function HomeView({ input, onChange, onRefine, isRefining }: Props) {
  const [fileStatus, setFileStatus] = useState("");
  const [tab, setTab] = useState<MobileTab>("edit");
  const [basicInfo, setBasicInfo] = useState<BasicInfo>({ ...emptyBasicInfo, ...(input.basicInfo || {}) });
  const uploadSeq = useRef(0);
  const resumeLength = input.resumeText.trim().length;
  const canContinue = resumeLength > 20;
  const previewTemplate = getVisibleResumeTemplates()[0];

  const update = (field: keyof ResumeInput, value: string) => {
    onChange({ ...input, [field]: value });
  };

  const updateBasicInfo = (next: BasicInfo) => {
    setBasicInfo(next);
    onChange({ ...input, candidateName: next.name.trim() || input.candidateName, basicInfo: next });
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > resumeUploadLimitBytes) {
      setFileStatus(`文件过大，请上传 ${resumeUploadLimitText} 以内的 PDF、DOCX 或 TXT。`);
      return;
    }
    const seq = ++uploadSeq.current;
    setFileStatus(`正在解析：${file.name}`);
    try {
      const [parsedResume, originalPreview] = await Promise.all([
        parseResumeFile(file),
        createOriginalResumePreview(file)
      ]);
      if (seq !== uploadSeq.current) return;
      const nextBasicInfo = prefillBasicInfo(parsedResume.text, parsedResume.candidateName, parsedResume.basicInfo, basicInfo);
      setBasicInfo(nextBasicInfo);
      onChange({
        ...input,
        candidateName: input.candidateName.trim() || parsedResume.candidateName || "",
        basicInfo: nextBasicInfo,
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
      if (seq !== uploadSeq.current) return;
      setFileStatus(error instanceof Error ? error.message : "解析失败，请更换文件重试。");
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
      description="上传文件或粘贴文字。系统会识别内容并生成可编辑版本。"
      actions={
        <div className="flex gap-2">
          {resumeLength > 0 && (
            <button type="button" className="secondary-button" onClick={handleClearResume}>
              <RotateCcw size={14} />
              清除
            </button>
          )}
          <button type="button" className="primary-button" onClick={onRefine} disabled={!canContinue || isRefining}>
            {isRefining ? "整理中…" : "开始整理"}
            <ArrowRight size={14} />
          </button>
        </div>
      }
    >
      <div className="workspace-split">
        <section className={tab === "edit" ? "workspace-pane workspace-pane-edit" : "workspace-pane workspace-pane-edit is-hidden-mobile"}>
          <header className="workspace-pane-header">
            <div>
              <h2>导入简历</h2>
              <p>{resumeLength} 字 · 文件临时保存并定期清理</p>
            </div>
          </header>
          <div className="workspace-pane-body upload-stage">
            <label className="field job-direction">
              <span>求职方向 <em>（可选）</em></span>
              <input
                value={input.targetRole === "通用求职版" ? "" : input.targetRole}
                onChange={(event) => update("targetRole", event.target.value)}
                placeholder="例如：新媒体运营；不填则生成通用版本"
              />
            </label>
            <label className="upload-card">
              <input className="sr-only" type="file" accept=".txt,.pdf,.docx" onChange={(event) => handleFile(event.target.files?.[0])} />
              <span className="upload-card-inner">
                <FileUp size={40} className="upload-card-icon" />
                <strong className="upload-card-title">选择文件，或拖到这里</strong>
                <span className="upload-card-meta">PDF / DOCX / TXT，{resumeUploadLimitText} 以内</span>
                <em className="upload-card-button">选择文件</em>
                {fileStatus && <span className="upload-card-status">{fileStatus}</span>}
              </span>
            </label>
            <BasicInfoFields value={basicInfo} onChange={updateBasicInfo} collapsed />
          </div>
        </section>

        <section className={tab === "preview" ? "workspace-pane workspace-pane-preview" : "workspace-pane workspace-pane-preview is-hidden-mobile"}>
          <header className="workspace-pane-header">
            <div>
              <h2>纸张预览</h2>
              <p>实时预览</p>
            </div>
            <span className="paper-badge">A4</span>
          </header>
          <div className="workspace-pane-body">
            <div className="resume-viewport custom-scrollbar">
              {resumeLength > 0 ? (
                <ResumeDocument text={input.resumeText} template={previewTemplate} candidateName={input.candidateName} />
              ) : (
                <div className="resume-empty-state"><div className="resume-empty-state-skeleton" aria-hidden="true"><i /><i /><i /><i /><i /></div><span>上传后将在这里生成预览</span></div>
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
    <button type="button" aria-current={active ? "page" : undefined} className={active ? "mobile-view-tab is-active" : "mobile-view-tab"} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function prefillBasicInfo(text: string, candidateName: string | undefined, serverBasicInfo: Partial<BasicInfo> | undefined, current: BasicInfo): BasicInfo {
  // 服务端已从简历自动解析：优先采用，用户已手填的值不被覆盖
  const phone = serverBasicInfo?.phone || text.match(/1[3-9]\d[- ]?\d{4}[- ]?\d{4}/)?.[0] || "";
  const email = serverBasicInfo?.email || text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] || "";
  const school = serverBasicInfo?.school || extractSchoolName(text);
  return {
    ...current,
    name: current.name || candidateName || serverBasicInfo?.name || "",
    phone: current.phone || phone,
    email: current.email || email,
    school: current.school || school,
    major: current.major || serverBasicInfo?.major || "",
    degree: current.degree || serverBasicInfo?.degree || ""
  };
}

function extractSchoolName(text: string) {
  const lines = text.split(/\n+/).slice(0, 15);
  for (const line of lines) {
    const match = line.match(/([\u4e00-\u9fff]{2,10}(?:大学|学院))/);
    if (match && !/(公司|集团|研究院|培训|机构)/.test(match[1])) return match[1];
  }
  return "";
}
