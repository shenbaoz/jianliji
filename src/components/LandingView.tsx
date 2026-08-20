import { memo } from "react";
import type { WorkflowStep } from "../types";

export const LandingView = memo(function LandingView({ onNavigate }: { onNavigate: (step: WorkflowStep) => void }) {
  return <section className="editorial-landing"><div className="editorial-hero-canvas"><p className="editorial-kicker">当前免费开放</p><h1>把简历整理成<br />能投递的版本。</h1><div className="editorial-light-band" aria-hidden="true" /><p className="editorial-description">上传简历后，识别内容、整理结构和表达；不编造经历。</p><div className="editorial-actions"><button onClick={() => onNavigate("workspace")}>开始优化</button></div></div></section>;
});
