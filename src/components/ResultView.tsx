import type { OptimizedResume } from "../types";

type Props = {
  resume: OptimizedResume;
  onBack: () => void;
  onEdit: () => void;
};

export function ResultView({ resume, onBack, onEdit }: Props) {
  return (
    <section className="page-shell">
      <div className="panel">
        <div className="panel-title">
          <div>
            <h1>优化结果</h1>
            <p>先看修改前后差异，再进入编辑器选择模板和导出。</p>
          </div>
        </div>
        <div className="compare-list">
          {resume.blocks.map((block) => (
            <article className="compare-card" key={block.title}>
              <h3>{block.title}</h3>
              <div className="compare-columns">
                <div>
                  <span>优化前</span>
                  <p>{block.before}</p>
                </div>
                <div>
                  <span>优化后</span>
                  <p>{block.after}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="panel">
        <h2>面试话术</h2>
        <ul className="clean-list">
          {resume.interviewScript.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <div className="sticky-actions">
        <button type="button" className="secondary-button" onClick={onBack}>
          返回追问
        </button>
        <button type="button" className="primary-button" onClick={onEdit}>
          进入模板编辑
        </button>
      </div>
    </section>
  );
}
