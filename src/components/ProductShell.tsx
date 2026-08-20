import type { ReactNode } from "react";
import { Brain, CheckCircle2, FileUp, Target } from "lucide-react";
import type { WorkflowStep } from "../types";

type Stage = {
  id: WorkflowStep;
  label: string;
  helper: string;
  icon: ReactNode;
};

const workflowStages: Stage[] = [
  { id: "workspace", label: "导入简历", helper: "", icon: <FileUp size={16} /> },
  { id: "job", label: "求职方向", helper: "", icon: <Target size={16} /> },
  { id: "editor", label: "AI 生成简历", helper: "", icon: <Brain size={16} /> }
];

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
      <p className="workflow-progress-copy mb-2 text-right text-xs text-[#71706b]">第 {completed} / {workflowStages.length} 步</p>
      <p className="workflow-mobile-summary" aria-label={`当前是第 ${completed} 步，共 ${workflowStages.length} 步`}>
        当前步骤：{activeLabel}（第 {completed}/{workflowStages.length} 步）
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
