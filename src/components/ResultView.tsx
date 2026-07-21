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
                <div className="before-box">
                  <span>优化前</span>
                  <p>{block.before}</p>
                </div>
                <div className="after-box">
                  <span>优化后</span>
                  <p>{block.after}</p>
                  <small>为什么这样改：强化岗位关键词、个人贡献和可验证结果。</small>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="delivery-grid">
        <article>
          <strong>岗位定制简历</strong>
          <span>围绕目标岗位重排重点内容。</span>
        </article>
        <article>
          <strong>修改前后对比</strong>
          <span>让用户直观看到优化价值。</span>
        </article>
        <article>
          <strong>面试表达包</strong>
          <span>把简历内容转成可讲述的话术。</span>
        </article>
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
