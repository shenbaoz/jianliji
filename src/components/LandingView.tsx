import { memo } from "react";
import type { WorkflowStep } from "../types";

export const LandingView = memo(function LandingView({ onNavigate }: { onNavigate: (step: WorkflowStep) => void }) {
  return <section className="editorial-landing"><div className="editorial-hero-canvas"><h1>把简历整理成<br />真正能投递的版本。</h1><div className="editorial-light-band" aria-hidden="true" /><p className="editorial-description">上传 PDF、Word 或 TXT 文件，自动提炼经历、整理结构和表达；不编造经历。</p><div className="editorial-actions"><button onClick={() => onNavigate("workspace")}>开始优化 <span aria-hidden="true">→</span></button></div></div></section>;
});
