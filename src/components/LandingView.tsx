import { memo } from "react";
import type { WorkflowStep } from "../types";

export const LandingView = memo(function LandingView({ onNavigate }: { onNavigate: (step: WorkflowStep) => void }) {
  return <section className="editorial-landing"><div className="editorial-hero-canvas"><p className="editorial-kicker">保留原模板 · 整理真实经历</p><h1>上传旧简历。<br />整理成可投递版本。</h1><div className="editorial-light-band" aria-hidden="true" /><p className="editorial-description">不改图片，不增加页数，只把已有经历写清楚。</p><div className="editorial-actions"><button onClick={() => onNavigate("workspace")}>开始整理</button></div></div></section>;
});
