import React from "react";
import { ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";
import { ChoiceButton, ChoiceGrid, ConversationCue } from "./ProductShell";
import type { MatchItem } from "../types";

interface ReportViewProps {
  score?: number;
  matchedKeywords?: string[];
  missingKeywords?: string[];
  matchItems?: MatchItem[];
  onBackToEdit?: () => void;
}

export const ReportView: React.FC<ReportViewProps> = ({
  score = 0,
  matchedKeywords = [],
  missingKeywords = [],
  matchItems = [],
  onBackToEdit
}) => {
  const level = score >= 85 ? "优秀：已比较接近目标岗位" : score >= 65 ? "良好：方向对了，但证据还不够" : score >= 45 ? "中等：需要补齐关键经历" : score > 0 ? "偏低：建议先补齐基础证据" : "正在分析中，请稍候";
  const isReady = score > 0;

  return (
    <section className="page-shell">
      <ConversationCue
        messages={[
          "我先给你一个岗位匹配判断。",
          "下一步不用一次改完整份简历，先选：补真实证据，还是直接生成一版带待确认提示的草稿。"
        ]}
      >
        <ChoiceGrid>
          <ChoiceButton title="补充真实证据" description="推荐。回答几个关键问题后，成稿会更像你本人。" onClick={() => onBackToEdit?.()} />
          <ChoiceButton title="先生成草稿" description="适合快速预览，但缺口会保留待确认提示。" onClick={() => onBackToEdit?.()} />
        </ChoiceGrid>
      </ConversationCue>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="panel">
          <span className="section-label">匹配参考</span>
          <div className="score-row">
            <strong>{score}</strong>
            <div>
              <p className="text-sm font-semibold text-[#20211f]">匹配度评分</p>
              <p className="mt-1 text-sm">{level}</p>
            </div>
          </div>
          <div className="bar-row mt-5">
            <div>
              <i style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <KeywordPanel title="已经对上的内容" tags={matchedKeywords} positive />
          <KeywordPanel title="需要补真实证据" tags={missingKeywords} />
        </div>
      </div>

      <div className="mt-4 rounded-md border border-[#c9d8d1] bg-[#eef4f1] px-5 py-4 text-sm leading-6 text-[#34534a]">
        {score >= 65 ? "基础已经具备。补 2 条最相关的项目证据后，这份简历会更有说服力。" : "先别被分数影响：把最相关的一段经历补具体，就能显著改善第一印象。"}
      </div>

      <div className="panel">
        <div className="panel-title compact"><div><h2>岗位要求与简历对照</h2><p>左侧来自岗位描述，右侧只展示你简历中已有的真实证据。</p></div></div>
        {matchItems.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[580px] text-left text-sm"><thead className="border-b border-[#e1d9cf] text-xs text-[#71706b]"><tr><th className="pb-3 font-medium">岗位要求</th><th className="pb-3 font-medium">你的简历中对应内容</th><th className="pb-3 font-medium">状态</th></tr></thead><tbody>{matchItems.map((item) => <tr className="border-b border-[#eee8e1] align-top" key={item.requirement}><td className="py-4 font-medium text-[#20211f]">{item.requirement}</td><td className={item.status === "missing" ? "py-4 text-[#a34232]" : "py-4 text-[#4e5b55]"}>{item.evidence}</td><td className={item.status === "missing" ? "py-4 font-semibold text-[#a34232]" : "py-4 font-semibold text-[#1d4a40]"}>{item.status === "missing" ? "未体现 ✗" : "已对上 √"}</td></tr>)}</tbody></table></div> : <div className="mt-4 rounded-md border border-dashed border-[#cbbcac] bg-[#f7f1e6] p-4 text-sm leading-6 text-[#615b4b]">该简历与岗位的关键词重合度较低。建议先补充项目职责、技能工具和可验证成果，再重新诊断。</div>}
      </div>

      <div className="panel">
        <div className="panel-title compact">
          <div>
            <h2>接下来只做一个动作</h2>
            <p>先补关键证据，再生成校对版。系统不会替你编造公司、项目或数字。</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="secondary-button" onClick={onBackToEdit}>
              <RotateCcw size={14} />
              返回修改
            </button>
            <button type="button" className="primary-button" onClick={onBackToEdit}>
              补充证据
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

function KeywordPanel({ title, tags, positive }: { title: string; tags: string[]; positive?: boolean }) {
  return (
    <div className="panel">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[#20211f]">
        <CheckCircle2 size={16} className={positive ? "text-[#1d4a40]" : "text-[#b8860b]"} />
        {title}
      </h3>
      <div className={positive ? "tag-list" : "tag-list muted"}>
        {tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
    </div>
  );
}
