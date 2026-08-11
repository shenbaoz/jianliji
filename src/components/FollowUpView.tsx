import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { ChoiceButton, ChoiceGrid, ConversationCue, PageShell } from "./ProductShell";
import type { FollowUpQuestion } from "../types";
import { clampQuestionIndex } from "../services/followUpPager";

type Props = {
  questions: FollowUpQuestion[];
  answers: Record<string, string>;
  onChange: (answers: Record<string, string>) => void;
  onBack: () => void;
  onBackToJob: () => void;
  onGenerate: () => void;
};

export function FollowUpView({ questions, answers, onChange, onBack, onBackToJob, onGenerate }: Props) {
  const answeredCount = Object.values(answers).filter((answer) => answer.trim().length > 0).length;
  const hasAnswers = answeredCount > 0;
  const [activeIndex, setActiveIndex] = useState(0);
  const activeQuestion = questions[clampQuestionIndex(activeIndex, questions.length)];

  useEffect(() => {
    setActiveIndex((index) => clampQuestionIndex(index, questions.length));
  }, [questions.length]);

  return (
    <PageShell
      active="questions"
      title="第 4 步：补充真实证据"
      description="每次只回答一个问题。能写数字、范围、工具、结果就写；不确定的内容宁可留空。"
      actions={
        <div className="flex gap-2">
          <button type="button" className="inline-flex h-10 items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={onBack}>
            <ArrowLeft size={14} />
            返回诊断
          </button>
          <button type="button" className="inline-flex h-10 items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={onBackToJob}>修改岗位 JD</button>
          <button type="button" className="inline-flex h-10 items-center gap-2 rounded-sm bg-slate-950 px-4 text-xs font-semibold text-white hover:bg-[#173c33]" onClick={onGenerate}>
            {hasAnswers ? "生成定制版本" : "生成待补充草稿"}
            <ArrowRight size={14} />
          </button>
        </div>
      }
      aside={
        <div className="border border-slate-200 bg-white p-5">
          <span className="text-xs font-semibold text-slate-400">回答进度</span>
          <strong className="mt-4 block text-4xl font-semibold tracking-tight text-slate-950">
            {answeredCount} / {questions.length}
          </strong>
          <p className="mt-4 text-xs leading-6 text-slate-500">
            回答越具体，生成版本越像真实投递稿。跳过也可以，但不会自动补事实。
          </p>
        </div>
      }
    >
      <ConversationCue
        messages={[
          "下面这些问题只问岗位缺口，不问无关信息。",
          "没有上线数据很正常：课设、答辩评价、具体分工和比赛成果同样有效。"
        ]}
      >
        <ChoiceGrid>
          <ChoiceButton title="我愿意逐条补充" description="推荐。让成稿更完整，也更经得起面试追问。" onClick={() => document.getElementById(`question-${activeIndex}`)?.focus()} />
          <ChoiceButton title="先跳过，生成草稿" description="成稿会保留待补充提示，不会替你编数字。" onClick={onGenerate} />
        </ChoiceGrid>
      </ConversationCue>

      <div className="mt-8 border border-slate-200 bg-white">
        {activeQuestion ? (
          <label className="block p-6" key={activeQuestion.id}>
            <div className="mb-4 flex items-start gap-4">
              <span className="mt-1 text-xs font-semibold text-slate-400">{String(activeIndex + 1).padStart(2, "0")}</span>
              <div>
                <h2 className="text-base font-semibold tracking-tight text-slate-950">{activeQuestion.question}</h2>
                <p className="mt-2 text-xs leading-6 text-slate-500">{activeQuestion.reason}</p>
              </div>
            </div>
            <textarea
              id={`question-${activeIndex}`}
              rows={4}
              className="w-full resize-none rounded-sm border border-slate-200 bg-[#f8faf8] px-4 py-3 text-sm leading-7 text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-950 focus:bg-white"
              value={answers[activeQuestion.id] || ""}
              onChange={(event) => onChange({ ...answers, [activeQuestion.id]: event.target.value })}
              placeholder="例如：课程项目、竞赛、社团或志愿活动中，你负责了什么、用了什么工具、最后有什么结果。"
            />
            {activeQuestion.allowSkip && <button type="button" className="mt-3 text-xs font-semibold text-slate-600 underline underline-offset-4" onClick={() => { onChange({ ...answers, [activeQuestion.id]: "暂无相关经历：当前没有可验证的对应案例。" }); setActiveIndex((index) => clampQuestionIndex(index + 1, questions.length)); }}>{activeQuestion.skipLabel || "暂无相关经历，说明原因后跳过"}</button>}
            <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4">
              <button type="button" className="text-xs font-semibold text-slate-600 disabled:opacity-40" disabled={activeIndex === 0} onClick={() => setActiveIndex((index) => clampQuestionIndex(index - 1, questions.length))}>上一题</button>
              <span className="text-xs text-slate-400">第 {activeIndex + 1} / {questions.length} 题</span>
              <button type="button" className="text-xs font-semibold text-slate-900 disabled:opacity-40" disabled={activeIndex >= questions.length - 1} onClick={() => setActiveIndex((index) => clampQuestionIndex(index + 1, questions.length))}>下一题</button>
            </div>
          </label>
        ) : <p className="p-6 text-sm text-slate-500">当前岗位没有需要补充的问题，可以直接生成草稿。</p>}
      </div>
    </PageShell>
  );
}
