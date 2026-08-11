import { memo } from "react";
import type { WorkflowStep } from "../types";

const steps: Array<{ id: WorkflowStep; label: string; hint: string; mark: string }> = [
  { id: "workspace", label: "导入简历", hint: "上传或粘贴内容", mark: "稿" },
  { id: "job", label: "粘贴岗位", hint: "复制岗位要求", mark: "岗" },
  { id: "editor", label: "生成简历", hint: "编辑后导出", mark: "成" }
];

type Props = {
  active: WorkflowStep;
  onSelect: (step: WorkflowStep) => void;
  canSelect: (step: WorkflowStep) => boolean;
};

export const WorkflowStepper = memo(function WorkflowStepper({ active, onSelect, canSelect }: Props) {
  return (
    <aside className="sidebar">
      <button className="workspace-button" type="button" onClick={() => onSelect("workspace")}>
        <span className="nav-mark" aria-hidden="true">开</span>
        开始吧
      </button>
      <ol className="step-list">
        {steps.map((step) => {
          const locked = !canSelect(step.id);
          return (
            <li key={step.id}>
              <button
                type="button"
                className={[
                  "step-item",
                  active === step.id ? "active" : "",
                  locked ? "locked" : ""
                ].filter(Boolean).join(" ")}
                onClick={() => onSelect(step.id)}
                data-locked={locked ? "true" : undefined}
                title={locked ? "完成前一步后开放，点击会回到当前可操作步骤" : step.hint}
              >
                <span className="step-index">{step.mark}</span>
                <span className="step-copy">
                  <strong>{step.label}</strong>
                  <small>{active === step.id ? "当前步骤" : step.hint}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <button className="version-button" type="button" onClick={() => onSelect("versions")}>
        <span className="nav-mark" aria-hidden="true">存</span>
        历史版本
      </button>
    </aside>
  );
});
