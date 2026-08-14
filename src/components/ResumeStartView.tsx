import { useState } from "react";
import { ArrowLeft, ArrowRight, FileText, Sparkles } from "lucide-react";
import { HomeView } from "./HomeView";
import type { ResumeInput } from "../types";

type Props = {
  input: ResumeInput;
  onChange: (input: ResumeInput) => void;
  onGenerate: (input: ResumeInput) => Promise<void>;
  isGenerating: boolean;
};

type Mode = "choose" | "optimize" | "create";

export function ResumeStartView({ input, onChange, onGenerate, isGenerating }: Props) {
  const [mode, setMode] = useState<Mode>("choose");
  const [direction, setDirection] = useState("");
  const [facts, setFacts] = useState("");
  if (mode === "optimize") {
    return <div className="page-shell">
      <button type="button" className="mb-4 text-sm text-slate-600" onClick={() => setMode("choose")}><ArrowLeft size={15} className="mr-1 inline" />换一种方式</button>
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
    return <section className="mx-auto max-w-2xl px-5 py-10 sm:py-16">
      <button type="button" className="mb-8 text-sm text-slate-600" onClick={() => setMode("choose")}><ArrowLeft size={15} className="mr-1 inline" />返回</button>
      <p className="text-sm font-semibold text-sky-700">从零生成</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">说说你做过什么，剩下的交给我</h1>
      <p className="mt-3 leading-7 text-slate-600">不需要写得像简历。课程作业、社团、兼职、活动、实习和会用的工具都可以。</p>
      <label className="mt-8 block text-sm font-semibold text-slate-800">求职方向<input className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" value={direction} onChange={(event) => setDirection(event.target.value)} placeholder="例如：内容运营、行政助理、前端开发" /></label>
      <label className="mt-5 block text-sm font-semibold text-slate-800">你做过什么<textarea className="mt-2 min-h-44 w-full rounded-lg border border-slate-300 p-3 font-normal leading-7" value={facts} onChange={(event) => setFacts(event.target.value)} placeholder="例如：在学院新媒体中心负责活动推文排版；组织过迎新活动，现场负责签到和引导；会使用剪映和 Excel。" /></label>
      <button type="button" disabled={!canGenerate || isGenerating} onClick={() => onGenerate({ candidateName: "", targetRole: direction.trim(), resumeText: facts.trim(), jobDescription: "", sourceMode: "creator", candidateType: "graduate" })} className="mt-6 inline-flex h-12 items-center gap-2 rounded-lg bg-slate-950 px-5 font-semibold text-white disabled:bg-slate-300">{isGenerating ? "正在生成…" : "生成我的第一份简历"}<ArrowRight size={17} /></button>
    </section>;
  }
  return <section className="mx-auto max-w-4xl px-5 py-12 sm:py-20">
    <p className="text-center text-sm font-semibold text-sky-700">免费生成 · 免费优化 · 免费导出</p>
    <h1 className="mt-3 text-center text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">先拿到一份能投的简历</h1>
    <p className="mx-auto mt-4 max-w-xl text-center leading-7 text-slate-600">不用 JD，不用登录。选择一种开始方式，几分钟得到可编辑的简历。</p>
    <div className="mt-10 grid gap-4 md:grid-cols-2">
      <button type="button" onClick={() => setMode("optimize")} className="rounded-2xl border border-slate-200 bg-white p-7 text-left shadow-sm transition hover:border-sky-500 hover:shadow-md"><FileText className="text-sky-700" /><strong className="mt-5 block text-xl text-slate-950">我有简历，帮我优化</strong><span className="mt-2 block leading-7 text-slate-600">上传或粘贴已有内容，选择想投的方向，直接生成优化版。</span></button>
      <button type="button" onClick={() => setMode("create")} className="rounded-2xl border border-slate-200 bg-white p-7 text-left shadow-sm transition hover:border-sky-500 hover:shadow-md"><Sparkles className="text-sky-700" /><strong className="mt-5 block text-xl text-slate-950">我是小白，从零开始</strong><span className="mt-2 block leading-7 text-slate-600">说出目标岗位和你做过的事，直接生成第一份简历。</span></button>
    </div>
  </section>;
}

