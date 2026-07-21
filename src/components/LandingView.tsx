import { ArrowRight, FileText, History, LayoutTemplate, Sparkles } from "lucide-react";
import { sampleResumeCases } from "../data/sampleCases";
import type { WorkflowStep } from "../types";

type Props = {
  onNavigate: (step: WorkflowStep) => void;
};

export function LandingView({ onNavigate }: Props) {
  return (
    <section className="landing">
      <div className="landing-hero">
        <div>
          <h1>输入目标岗位，生成这一岗专用简历</h1>
          <p>
            从简历导入、岗位分析、AI 追问到模板导出，一步步完成一份可以直接投递的岗位定制简历。
          </p>
          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={() => onNavigate("workspace")}>
              开始优化
              <ArrowRight size={17} />
            </button>
            <button type="button" className="secondary-button" onClick={() => onNavigate("versions")}>
              查看我的版本
            </button>
          </div>
        </div>
        <div className="hero-preview">
          <span>优化预览</span>
          <div className="mini-compare">
            <p>负责社群运营。</p>
            <ArrowRight size={16} />
            <p>运营 3 个求职社群，累计覆盖 1200+ 用户，策划 8 场分享活动。</p>
          </div>
        </div>
      </div>
      <div className="landing-nav">
        <button type="button" onClick={() => onNavigate("workspace")}>
          <FileText size={22} />
          <strong>简历导入</strong>
          <span>上传或粘贴简历内容</span>
        </button>
        <button type="button" onClick={() => onNavigate("job")}>
          <Sparkles size={22} />
          <strong>岗位定制</strong>
          <span>粘贴 JD 后生成匹配分析</span>
        </button>
        <button type="button" onClick={() => onNavigate("editor")}>
          <LayoutTemplate size={22} />
          <strong>模板导出</strong>
          <span>选择模板并预览导出</span>
        </button>
        <button type="button" onClick={() => onNavigate("versions")}>
          <History size={22} />
          <strong>我的版本</strong>
          <span>找回不同岗位简历</span>
        </button>
      </div>
      <div className="panel">
        <div className="panel-title">
          <div>
            <h2>优秀案例库</h2>
            <p>已内置多行业匿名案例，参考公开职业中心简历样例的结构，内容为演示用原创数据。</p>
          </div>
          <button type="button" className="link-button" onClick={() => onNavigate("workspace")}>
            去导入案例
          </button>
        </div>
        <div className="case-grid">
          {sampleResumeCases.slice(0, 12).map((item) => (
            <article key={item.id} className="case-card">
              <span>{item.userType}</span>
              <strong>{item.title}</strong>
              <p>{item.summary}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
