import type { ReactNode } from "react";
import { CheckCircle2, Circle, FileText, PenLine, Target } from "lucide-react";
import type { WorkflowStep } from "../types";

type Stage = {
  id: WorkflowStep;
  label: string;
  helper: string;
  icon: ReactNode;
};

export const workflowStages: Stage[] = [
  { id: "workspace", label: "导入简历", helper: "填写材料", icon: <FileText size={16} /> },
  { id: "job", label: "求职方向", helper: "填写方向", icon: <Target size={16} /> },
  { id: "editor", label: "AI 生成简历", helper: "AI 精修后编辑导出", icon: <PenLine size={16} /> }
];

const INK = "#20211f";
const ACCENT = "#1a3c34";
const ACCENT_DARK = "#112923";
const ACCENT_SOFT = "#eef4f1";
const ACCENT_LINE = "#c9d8d1";
const LINE = "#e1d9cf";
const LINE_STRONG = "#cbbcac";
const SURFACE = "#fffdf9";
const SURFACE_SOFT = "#f5f0eb";
const MUTED = "#71706b";
const MUTED_SOFT = "#6b655c";
const BRASS = "#b8860b";
const WARNING = "#8b5f2c";
const DANGER = "#8f2f22";

export function PageShell({
  active,
  title,
  description,
  aside,
  children,
  actions
}: {
  active: WorkflowStep;
  title: string;
  description: string;
  aside?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="page-shell">
      <div className="panel workspace-heading">
        <div className="panel-title">
          <div>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <div className="workspace-heading-actions">
            <div className="workflow-rail-wrap">
              <WorkflowRail active={active} />
            </div>
            {actions}
          </div>
        </div>
      </div>
      <div className={aside ? "workspace-layout with-aside" : "workspace-layout"}>
        {aside && (
          <aside className="workspace-aside">
            <div>{aside}</div>
          </aside>
        )}
        <div className="workspace-content">{children}</div>
      </div>
    </section>
  );
}

export function WorkflowRail({ active }: { active: WorkflowStep }) {
  const activeIndex = workflowStages.findIndex((step) => step.id === active);
  const completed = activeIndex >= 0 ? activeIndex + 1 : workflowStages.length;
  const activeLabel = activeIndex >= 0 ? workflowStages[activeIndex].label : "历史版本";

  return (
    <div>
      <p className="workflow-progress-copy mb-2 text-right text-xs text-[#71706b]">已完成 {completed} / {workflowStages.length} 步 · 约还需 2 分钟</p>
      <p className="workflow-mobile-summary" aria-label={`当前是第 ${completed} 步，共 ${workflowStages.length} 步`}>
        <span>第 {completed}/{workflowStages.length} 步</span>
        <strong>{activeLabel}</strong>
      </p>
      <ol className="workflow-rail">
        {workflowStages.map((step, index) => {
          const isActive = step.id === active;
          const isDone = index < activeIndex;
          return (
            <li key={step.id}>
              <div
                className={["workflow-stage", isActive ? "is-active" : isDone ? "is-done" : ""].join(" ")}
              >
                <span className="workflow-stage-icon">
                  {isDone ? <CheckCircle2 size={15} /> : step.icon}
                </span>
                <span className="hidden min-w-0 lg:block">{step.label}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function InsightCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-md border border-[#e1d9cf] bg-[#fffdf9] p-4">
      <span className="text-xs font-medium text-[#6b655c]">{label}</span>
      <strong className="mt-2 block text-2xl font-semibold tracking-tight text-[#20211f]">{value}</strong>
      <p className="mt-2 text-xs leading-6 text-[#71706b]">{helper}</p>
    </div>
  );
}

export function GuardNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-[#e6d3b0] border-l-4 border-l-[#b8860b] bg-[#f7f1e6] p-4 text-xs leading-6 text-[#615b4b]">
      <div className="mb-2 flex items-center gap-2 font-semibold text-[#8b5f2c]">
        <Circle size={9} fill="currentColor" />
        投递前原则
      </div>
      {children}
    </div>
  );
}

export function ConversationCue({
  messages,
  children
}: {
  messages: string[];
  children?: ReactNode;
}) {
  return (
    <div className="rounded-md border border-[#e1d9cf] bg-[#fffdf9]">
      <div className="grid gap-2 border-b border-[#e1d9cf] p-5">
        {messages.map((message, index) => (
          <p
            key={`${message}-${index}`}
            className={index === 0 ? "text-base font-semibold text-[#20211f]" : "text-sm leading-6 text-[#71706b]"}
          >
            {message}
          </p>
        ))}
      </div>
      {children && <div className="p-5">{children}</div>}
    </div>
  );
}

export function ChoiceGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid max-w-[920px] grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
  );
}

export function ChoiceButton({
  title,
  description,
  onClick,
  disabled
}: {
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="min-h-24 rounded-md border border-[#e1d9cf] bg-[#fffdf9] p-4 text-left transition-colors hover:border-[#c9d8d1] hover:bg-[#f5f0eb] disabled:cursor-not-allowed disabled:opacity-45"
      onClick={onClick}
      disabled={disabled}
    >
      <strong className="block text-base font-semibold text-[#20211f]">{title}</strong>
      <span className="mt-2 block text-xs leading-6 text-[#71706b]">{description}</span>
    </button>
  );
}
