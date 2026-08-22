import { memo } from "react";
import type { WorkflowStep } from "../types";

export const LandingView = memo(function LandingView({ onNavigate }: { onNavigate: (step: WorkflowStep) => void }) {
  return <section className="apple-style-home">
    <section className="apple-hero-page">
      <div className="apple-page-copy"><span className="apple-eyebrow">简历记</span><h1>把真实经历，整理成<br /><em>更适合投递的简历。</em></h1><p>不编造经历，只把你做过的事写得更具体、更有重点。</p><button onClick={() => onNavigate("workspace")}>开始整理简历 <span aria-hidden="true">↗</span></button></div>
      <div className="apple-resume-visual" aria-hidden="true">
        <div className="resume-paper">
          <div className="resume-paper-top"><div><strong>张思远</strong><span>产品经理</span></div><div className="resume-paper-mark">RESUME</div></div>
          <div className="resume-paper-rule" />
          <div className="resume-paper-columns">
            <div className="resume-paper-main"><span className="paper-label">经历</span><h2>产品经理 · 远山科技</h2><p className="paper-date">2022.06 — 至今</p><p>负责核心产品从需求分析到上线迭代，协同设计、研发与运营团队，持续改善用户体验。</p><div className="paper-lines"><i /><i /><i /></div><h2>产品助理 · 云起网络</h2><p className="paper-date">2020.07 — 2022.05</p><p>参与用户研究、竞品分析与产品方案设计，推动多个功能从概念落地。</p></div>
            <aside className="resume-paper-side"><span className="paper-label">联系</span><p>北京 · 138 0000 0000</p><p>hello@example.com</p><span className="paper-label">教育</span><p>信息管理 · 本科</p></aside>
          </div>
        </div>
        <div className="resume-stage-shadow" aria-hidden="true" />
      </div>
    </section>
  </section>;
});
