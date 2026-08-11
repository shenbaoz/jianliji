import { memo } from "react";
import type { WorkflowStep } from "../types";

type Props = {
  onNavigate: (step: WorkflowStep) => void;
  onOpenCreator: () => void;
};

export const LandingView = memo(function LandingView({ onNavigate, onOpenCreator }: Props) {
  return <section className="editorial-landing">
    <div className="editorial-hero-canvas">
      <h1>把经历写清楚。<br />直接生成简历。</h1>
      <div className="editorial-light-band" aria-hidden="true" />
      <div className="editorial-actions"><button onClick={() => onNavigate("workspace")}>开始生成</button><button onClick={() => onOpenCreator()}>从 0 开始</button></div>
    </div>
  </section>;
});
