import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, FileText, Sparkles } from "lucide-react";
import { HomeView } from "./HomeView";
import { BasicInfoFields } from "./BasicInfoFields";
import { emptyBasicInfo, type BasicInfo, type ResumeInput } from "../types";

type Props = {
  input: ResumeInput;
  onChange: (input: ResumeInput) => void;
  onGenerate: (input: ResumeInput, evidenceAnswers?: string[]) => Promise<void>;
  isGenerating: boolean;
  followUpQuestions?: string[];
};

type Mode = "choose" | "optimize" | "create";

export function ResumeStartView({ input, onChange, onGenerate, isGenerating, followUpQuestions = [] }: Props) {
  const [mode, setMode] = useState<Mode>("choose");
  const [direction, setDirection] = useState("");
  const [facts, setFacts] = useState("");
  const [basicInfo, setBasicInfo] = useState<BasicInfo>({ ...emptyBasicInfo, ...(input.basicInfo || {}) });
  const [answers, setAnswers] = useState<string[]>([]);
  const [allAnswers, setAllAnswers] = useState<string[]>([]);
  useEffect(() => {
    setAnswers(followUpQuestions.map(() => ""));
  }, [followUpQuestions.join("|")]);
  const submitWithAnswers = () => {
    const combined = [...allAnswers, ...answers.filter(Boolean)];
    setAllAnswers(combined);
    onGenerate({ candidateName: basicInfo.name, targetRole: direction.trim(), resumeText: facts.trim(), jobDescription: "", sourceMode: "creator", candidateType: "graduate", basicInfo }, combined);
  };
  if (mode === "optimize") {
    return <div className="start-view-wrap">
      <button type="button" className="start-mode-back" onClick={() => setMode("choose")}>换一种方式</button>
      <HomeView
        input={{ ...input, targetRole: input.targetRole || "通用求职版", sourceMode: "resume" }}
        onChange={onChange}
        onRefine={() => onGenerate({ ...input, targetRole: input.targetRole.trim() || "通用求职版", sourceMode: "resume" })}
        isRefining={isGenerating}
      />
    </div>;
  }
  if (mode === "create") {
    const canGenerate = direction.trim().length > 1 && facts.trim().length > 10;
    return <section className="start-create-view mx-auto max-w-2xl px-5 py-10 sm:py-16">
      <button type="button" className="start-mode-back mb-8" onClick={() => setMode("choose")}><ArrowLeft size={15} className="mr-1 inline" />换一种方式</button>
      <p className="start-create-kicker text-sm font-semibold">从零创建</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">从经历开始</h1>
      <p className="mt-3 leading-7 text-slate-600">课程、社团、实习和工具都可以写。</p>
      <BasicInfoFields value={basicInfo} onChange={setBasicInfo} />
      <label className="start-create-field mt-8 block text-sm font-semibold">求职方向<input value={direction} onChange={(event) => setDirection(event.target.value)} placeholder="例如：内容运营、行政助理、前端开发" /></label>
      <label className="start-create-field mt-5 block text-sm font-semibold">你的经历<textarea value={facts} onChange={(event) => setFacts(event.target.value)} placeholder="例如：在学院新媒体中心负责活动推文排版；组织过迎新活动，现场负责签到和引导；会使用剪映和 Excel。" /></label>
      {followUpQuestions.length > 0 && (
        <div className="start-follow-up mt-6">
          <p className="text-sm font-semibold">为使简历更具体，请回答以下问题（可跳过）：</p>
          {followUpQuestions.map((question, index) => (
            <label key={index} className="start-create-field mt-4 block text-sm font-semibold">{question}<textarea value={answers[index] || ""} onChange={(event) => setAnswers((prev) => { const next = [...prev]; next[index] = event.target.value; return next; })} placeholder="例如：平均阅读量 800+，负责选题与排版" /></label>
          ))}
          <button type="button" disabled={isGenerating} onClick={submitWithAnswers} className="public-primary-button mt-5 inline-flex items-center gap-2">{isGenerating ? "生成中…" : "继续生成"}<ArrowRight size={17} /></button>
        </div>
      )}
      <button type="button" disabled={!canGenerate || isGenerating} onClick={() => onGenerate({ candidateName: basicInfo.name, targetRole: direction.trim(), resumeText: facts.trim(), jobDescription: "", sourceMode: "creator", candidateType: "graduate", basicInfo })} className="public-primary-button mt-6 inline-flex items-center gap-2">{isGenerating ? "生成中…" : "生成简历"}<ArrowRight size={17} /></button>
    </section>;
  }
  return <section className="start-choose">
    <h1 className="start-choose-title">选择开始方式</h1>
    <div className="start-choose-grid">
      <button type="button" onClick={() => setMode("optimize")} className="start-choose-card start-choose-card-optimize"><strong>已有简历</strong><span>上传文件后自动整理。</span><small className="start-choose-card-meta">PDF / DOCX / TXT</small></button>
      <button type="button" onClick={() => setMode("create")} className="start-choose-card start-choose-card-create"><strong>从零创建</strong><span>填写目标方向和真实经历。</span><small className="start-choose-card-meta">适合还没有完整简历的人</small></button>
    </div>
  </section>;
}
