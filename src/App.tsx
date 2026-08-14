import { lazy, Suspense, useRef, useState } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Header } from "./components/Header";
import { LandingView } from "./components/LandingView";
import { optimizeWithDeepSeek } from "./services/aiOptimize";
import { ResumeStartView } from "./components/ResumeStartView";
import type { AppView, ResumeInput, SavedResumeVersion } from "./types";

const EditorView = lazy(() => import("./components/EditorView").then((module) => ({ default: module.EditorView })));

const initialInput: ResumeInput = { candidateName: "", targetRole: "", resumeText: "", jobDescription: "" };

export default function App() {
  const [view, setView] = useState<AppView>("home");
  const [input, setInput] = useState<ResumeInput>(initialInput);
  const [result, setResult] = useState<{ text: string; changes: Array<{ before: string; after: string }> } | null>(null);
  const [message, setMessage] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const inFlight = useRef(false);

  const go = (next: AppView) => {
    setView(next);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const updateInput = (next: ResumeInput) => {
    setInput({ ...next, jobDescription: "" });
    setResult(null);
  };
  const refine = async (nextInput: ResumeInput) => {
    if (inFlight.current || nextInput.resumeText.trim().length < 11) {
      setMessage(nextInput.sourceMode === "creator" ? "请先写下你做过的一件具体事情。" : "请先导入一份可读取的简历。");
      return;
    }
    inFlight.current = true;
    setIsRefining(true);
    setMessage("");
    try {
      const normalized = { ...nextInput, targetRole: nextInput.targetRole.trim() || "通用求职版" };
      const refined = await optimizeWithDeepSeek(normalized);
      if (!refined.safe || !refined.text.trim()) throw new Error(refined.suggestions?.[0] || "信息较少，请补充一件你具体做过的事后再试。");
      setInput(normalized);
      setResult({ text: refined.text, changes: refined.changes || [] });
      go("editor");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "暂时无法完成整理，请稍后再试。");
    } finally {
      inFlight.current = false;
      setIsRefining(false);
    }
  };
  const version: SavedResumeVersion | undefined = result ? {
    id: "current-refinement", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    name: input.candidateName || "简历", title: "通用简历", candidateName: input.candidateName || "简历", targetRole: "通用简历", score: 0, templateId: "classic",
    resumeText: input.resumeText, jobDescription: "", optimizedText: result.text, experience: result.text, changes: result.changes,
    originalResumeHtml: input.originalResumeHtml, originalResumeFileName: input.originalResumeFileName, originalResumeMimeType: input.originalResumeMimeType,
    originalResumeFileUrl: input.originalResumeFileUrl, originalResumeDataUrl: input.originalResumeDataUrl
  } : undefined;

  return <div className="public-editorial-shell min-h-screen bg-white font-sans text-[#20211f]">
    <Header onOpenHome={() => go("home")} onOpenWorkspace={() => go("workspace")} finalOnly={view === "editor"} />
    {message && <div className="app-toast" role="status">{message}</div>}
    {isRefining && <RefiningOverlay />}
    <main><ErrorBoundary><Suspense fallback={<div className="page-shell">正在打开…</div>}>
      {view === "home" && <LandingView onNavigate={go} />}
      {view === "workspace" && <ResumeStartView input={input} onChange={updateInput} onGenerate={refine} isGenerating={isRefining} />}
      {view === "editor" && version && <EditorView currentVersion={version} />}
      {view === "editor" && !version && <ResumeStartView input={input} onChange={updateInput} onGenerate={refine} isGenerating={isRefining} />}
    </Suspense></ErrorBoundary></main>
  </div>;
}

function RefiningOverlay() {
  return <div className="refining-overlay" role="status" aria-live="polite" aria-busy="true"><div className="refining-card"><div className="refining-spinner" /><p className="refining-kicker">正在整理</p><h2>正在整理你的简历</h2><p className="refining-note">请不要关闭页面，完成后会自动进入成稿页。</p></div></div>;
}
