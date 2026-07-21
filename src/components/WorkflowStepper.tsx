import {
  BarChart3,
  BriefcaseBusiness,
  FilePenLine,
  Files,
  LayoutTemplate,
  MessageSquareText
} from "lucide-react";
import type { WorkflowStep } from "../types";

const steps: Array<{ id: WorkflowStep; label: string; icon: typeof BriefcaseBusiness }> = [
  { id: "home", label: "首页导航", icon: BriefcaseBusiness },
  { id: "workspace", label: "简历导入", icon: BriefcaseBusiness },
  { id: "job", label: "目标岗位", icon: FilePenLine },
  { id: "analysis", label: "岗位分析", icon: BarChart3 },
  { id: "questions", label: "AI追问", icon: MessageSquareText },
  { id: "result", label: "优化结果", icon: FilePenLine },
  { id: "editor", label: "模板导出", icon: LayoutTemplate },
  { id: "versions", label: "我的版本", icon: Files }
];

type Props = {
  active: WorkflowStep;
  onSelect: (step: WorkflowStep) => void;
};

export function WorkflowStepper({ active, onSelect }: Props) {
  return (
    <aside className="sidebar">
      <button className="workspace-button" type="button" onClick={() => onSelect("workspace")}>
        <BriefcaseBusiness size={18} />
        工作空间
      </button>
      <ol className="step-list">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.id}>
              <button
                type="button"
                className={active === step.id ? "step-item active" : "step-item"}
                onClick={() => onSelect(step.id)}
              >
                <span className="step-index">{index + 1}</span>
                <Icon size={17} />
                {step.label}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="payment-disabled">
        <span>支付中心</span>
        <strong>暂未接入</strong>
        <small>已预留后续微信支付位置</small>
      </div>
      <div className="usage-card">
        <span>AI 优化次数</span>
        <strong>8 / 10</strong>
        <div>
          <i style={{ width: "80%" }} />
        </div>
      </div>
    </aside>
  );
}
