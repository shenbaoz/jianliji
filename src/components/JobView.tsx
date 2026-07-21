import { BriefcaseBusiness } from "lucide-react";
import type { ResumeInput } from "../types";

type Props = {
  input: ResumeInput;
  onChange: (input: ResumeInput) => void;
  onBack: () => void;
  onAnalyze: () => void;
};

export function JobView({ input, onChange, onBack, onAnalyze }: Props) {
  return (
    <section className="page-shell narrow">
      <div className="panel hero-panel">
        <div className="panel-title">
          <div>
            <h1>目标岗位</h1>
            <p>把你准备投递的岗位 JD 粘进来，后面所有优化都会围绕这个岗位展开。</p>
          </div>
          <BriefcaseBusiness size={22} />
        </div>
        <label className="field">
          <span>岗位名称</span>
          <input
            value={input.targetRole}
            onChange={(event) => onChange({ ...input, targetRole: event.target.value })}
            placeholder="例如：前端开发工程师、产品经理实习生、新媒体运营"
          />
        </label>
        <label className="field">
          <span>JD 文本</span>
          <textarea
            rows={16}
            value={input.jobDescription}
            onChange={(event) => onChange({ ...input, jobDescription: event.target.value })}
            placeholder="粘贴招聘岗位职责、任职要求、加分项..."
          />
        </label>
        <div className="action-row">
          <button type="button" className="secondary-button" onClick={onBack}>
            返回简历
          </button>
          <button type="button" className="primary-button" onClick={onAnalyze}>
            开始岗位分析
          </button>
        </div>
      </div>
      <aside className="side-note">
        <h3>这一步是差异化核心</h3>
        <p>普通工具只看简历，我们同时看“简历”和“岗位”，所以能生成这一岗专用版本。</p>
      </aside>
    </section>
  );
}
