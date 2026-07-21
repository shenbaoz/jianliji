import { Download, Save } from "lucide-react";
import { resumeTemplates } from "../data/templates";
import { saveVersion } from "../services/storage";
import type { OptimizedResume, ResumeInput, ResumeTemplate } from "../types";

type Props = {
  input: ResumeInput;
  optimized: OptimizedResume;
  templateId: string;
  onTemplateChange: (templateId: string) => void;
  editedText: string;
  onEditedTextChange: (value: string) => void;
  score: number;
  onSaved: () => void;
};

export function EditorView({
  input,
  optimized,
  templateId,
  onTemplateChange,
  editedText,
  onEditedTextChange,
  score,
  onSaved
}: Props) {
  const activeTemplate = resumeTemplates.find((template) => template.id === templateId) || resumeTemplates[0];

  const handleSave = () => {
    saveVersion({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      candidateName: input.candidateName || "未命名用户",
      targetRole: input.targetRole || "目标岗位",
      score,
      templateId,
      resumeText: input.resumeText,
      jobDescription: input.jobDescription,
      optimizedText: editedText || optimized.fullText
    });
    onSaved();
  };

  return (
    <section className="editor-grid">
      <div className="panel">
        <h1>模板与编辑</h1>
        <p className="muted-text">这里先用浏览器打印保存 PDF。微信支付暂不接入，付费导出位置已保留。</p>
        <label className="field">
          <span>简历内容</span>
          <textarea rows={19} value={editedText} onChange={(event) => onEditedTextChange(event.target.value)} />
        </label>
        <div className="template-grid">
          {resumeTemplates.map((template) => (
            <TemplateButton
              key={template.id}
              template={template}
              active={template.id === templateId}
              onClick={() => onTemplateChange(template.id)}
            />
          ))}
        </div>
        <div className="action-row">
          <button type="button" className="primary-button" onClick={handleSave}>
            <Save size={17} />
            保存版本
          </button>
          <button type="button" className="secondary-button" onClick={() => window.print()}>
            <Download size={17} />
            打印 / 保存 PDF
          </button>
        </div>
      </div>
      <div className="resume-preview" style={{ borderTopColor: activeTemplate.accent }}>
        <span>{activeTemplate.name}</span>
        <pre>{editedText || optimized.fullText}</pre>
      </div>
    </section>
  );
}

function TemplateButton({
  template,
  active,
  onClick
}: {
  template: ResumeTemplate;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={active ? "template-card active" : "template-card"} onClick={onClick}>
      <i style={{ background: template.accent }} />
      <strong>{template.name}</strong>
      <span>{template.description}</span>
    </button>
  );
}
