import type { FollowUpQuestion } from "../types";

type Props = {
  questions: FollowUpQuestion[];
  answers: Record<string, string>;
  onChange: (answers: Record<string, string>) => void;
  onBack: () => void;
  onGenerate: () => void;
};

export function FollowUpView({ questions, answers, onChange, onBack, onGenerate }: Props) {
  return (
    <section className="page-shell narrow">
      <div className="panel hero-panel">
        <div className="panel-title">
          <div>
            <h1>AI 追问挖经历</h1>
            <p>这一步专门把“负责、参与、协助”这类普通描述挖出真实证据。</p>
          </div>
        </div>
        <div className="question-list">
          {questions.map((item, index) => (
            <label className="question-card" key={item.id}>
              <span>{index + 1}. {item.question}</span>
              <small>{item.reason}</small>
              <textarea
                rows={3}
                value={answers[item.id] || ""}
                onChange={(event) => onChange({ ...answers, [item.id]: event.target.value })}
                placeholder="按真实情况回答，不需要夸张，系统会帮你组织表达。"
              />
            </label>
          ))}
        </div>
        <div className="action-row">
          <button type="button" className="secondary-button" onClick={onBack}>
            返回报告
          </button>
          <button type="button" className="primary-button" onClick={onGenerate}>
            生成岗位定制简历
          </button>
        </div>
      </div>
    </section>
  );
}
