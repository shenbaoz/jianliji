import { memo } from "react";
import type { WorkflowStep } from "../types";

export const LandingView = memo(function LandingView({ onNavigate }: { onNavigate: (step: WorkflowStep) => void }) {
  return <section className="editorial-landing"><div className="editorial-hero-canvas"><p className="editorial-kicker">免费生成 · 免费优化 · 免费导出</p><h1>没有简历，也能开始。<br />有简历，直接优化。</h1><div className="editorial-light-band" aria-hidden="true" /><p className="editorial-description">不需要岗位 JD，只把你的真实经历整理成可投递版本。</p><div className="editorial-actions"><button onClick={() => onNavigate("workspace")}>开始做简历</button></div></div></section>;
});
