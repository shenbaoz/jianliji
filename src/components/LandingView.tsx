import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, FileText, History, LayoutTemplate, Sparkles } from "lucide-react";
import { sampleResumeCases } from "../data/sampleCases";
import type { SampleResumeCase, WorkflowStep } from "../types";

type Props = {
  onNavigate: (step: WorkflowStep) => void;
  onLoadSample: (sample: SampleResumeCase, nextStep?: WorkflowStep) => void;
};

const categories = ["全部", "应届生", "转行", "互联网", "技术岗", "运营/市场", "金融/咨询", "通用岗位"];

function caseMatchesCategory(item: SampleResumeCase, category: string) {
  if (category === "全部") return true;
  if (category === "应届生") return ["应届生", "校招"].includes(item.userType);
  if (category === "转行") return item.userType === "转行";
  if (category === "互联网") return /产品|运营|前端|后端|测试|AI|数据|设计/.test(item.title);
  if (category === "技术岗") return /前端|后端|测试|机械/.test(item.title);
  if (category === "运营/市场") return /运营|市场|品牌|内容|跨境/.test(item.title);
  if (category === "金融/咨询") return /金融|咨询|商业分析|财务/.test(item.title);
  return /行政|HR|销售|客服|教师|法务|供应链|项目助理/.test(item.title);
}

export function LandingView({ onNavigate, onLoadSample }: Props) {
  const [activeCategory, setActiveCategory] = useState("全部");
  const filteredCases = useMemo(
    () => sampleResumeCases.filter((item) => caseMatchesCategory(item, activeCategory)),
    [activeCategory]
  );

  return (
    <section className="landing">
      <div className="landing-hero">
        <div>
          <h1>别再用一份简历投所有岗位</h1>
          <p>
            输入目标岗位，生成这一岗专用简历。先免费查看岗位匹配和主要问题，再通过追问挖出真实经历证据。
          </p>
          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={() => onNavigate("workspace")}>
              免费体验一次
              <ArrowRight size={17} />
            </button>
            <button type="button" className="secondary-button" onClick={() => onLoadSample(sampleResumeCases[0], "analysis")}>
              用案例直接看效果
            </button>
          </div>
          <div className="hero-proof">
            {["岗位匹配报告", "AI追问挖经历", "修改前后对比", "面试话术"].map((item) => (
              <span key={item}>
                <CheckCircle2 size={15} />
                {item}
              </span>
            ))}
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
            <p>选择一个岗位案例，自动填入简历和 JD，直接体验完整优化流程。</p>
          </div>
          <button type="button" className="link-button" onClick={() => onNavigate("workspace")}>
            自己上传简历
          </button>
        </div>
        <div className="filter-row">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={category === activeCategory ? "filter-chip active" : "filter-chip"}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="case-grid">
          {filteredCases.slice(0, 12).map((item) => (
            <article key={item.id} className="case-card">
              <span>{item.userType}</span>
              <strong>{item.title}</strong>
              <p>{item.summary}</p>
              <button type="button" className="case-action" onClick={() => onLoadSample(item, "analysis")}>
                一键体验
                <ArrowRight size={15} />
              </button>
            </article>
          ))}
        </div>
      </div>
      <div className="value-grid">
        <article>
          <strong>免费先看到问题</strong>
          <span>先展示基础匹配报告、关键词缺口和核心问题，用户确认有价值后再深入优化。</span>
        </article>
        <article>
          <strong>不编造经历</strong>
          <span>所有优化只基于用户提供的信息，缺少数据时通过追问补充真实证据。</span>
        </article>
        <article>
          <strong>最后给一套交付包</strong>
          <span>不止是一份简历，还包含自我介绍、项目讲述和面试追问建议。</span>
        </article>
      </div>
    </section>
  );
}
