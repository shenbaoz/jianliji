import type { AnalysisReport } from "../types";

type Props = {
  report: AnalysisReport;
  onBack: () => void;
  onNext: () => void;
};

export function ReportView({ report, onBack, onNext }: Props) {
  return (
    <section className="page-shell">
      <div className="panel score-panel">
        <span className="section-label">岗位匹配报告</span>
        <div className="score-row">
          <strong>{report.score}</strong>
          <div>
            <h1>匹配度：{report.level}</h1>
            <p>这是基于当前简历和岗位 JD 的原型分析，后续会接正式 AI 服务。</p>
          </div>
        </div>
        <div className="keyword-grid">
          <div>
            <h3>已匹配关键词</h3>
            <div className="tag-list">
              {(report.matchedKeywords.length ? report.matchedKeywords : ["项目", "协作"]).map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
          <div>
            <h3>待补充关键词</h3>
            <div className="tag-list muted">
              {(report.missingKeywords.length ? report.missingKeywords : ["量化结果", "岗位证据"]).map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="report-grid">
        <div className="panel">
          <h2>主要优势</h2>
          <ul className="clean-list">
            {report.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="panel">
          <h2>简历问题</h2>
          <ul className="clean-list warning">
            {report.issues.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="panel span-2">
          <h2>能力覆盖</h2>
          <div className="bars">
            {report.skillScores.map((skill) => (
              <div className="bar-row" key={skill.label}>
                <span>{skill.label}</span>
                <div>
                  <i style={{ width: `${skill.score}%` }} />
                </div>
                <em>{skill.score}%</em>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="sticky-actions">
        <button type="button" className="secondary-button" onClick={onBack}>
          返回修改岗位
        </button>
        <button type="button" className="primary-button" onClick={onNext}>
          下一步：AI 追问
        </button>
      </div>
    </section>
  );
}
