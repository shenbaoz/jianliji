import { lazy, Suspense, useRef, useState } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Header } from "./components/Header";
import { LandingView } from "./components/LandingView";
import { optimizeUniversalResume } from "./services/aiOptimize";
import type { AppView, ResumeInput, SavedResumeVersion } from "./types";

const HomeView = lazy(() => import("./components/HomeView").then((module) => ({ default: module.HomeView })));
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
    setInput({ ...next, targetRole: "", jobDescription: "" });
    setResult(null);
  };
  const refine = async () => {
    if (inFlight.current || input.resumeText.trim().length < 21) {
      setMessage("请先导入一份可读取的简历。");
      return;
    }
    inFlight.current = true;
    setIsRefining(true);
    setMessage("");
    try {
      const refined = await optimizeUniversalResume(input.resumeText);
      if (!refined.safe || !refined.changes.length) throw new Error("这份简历暂未找到可安全整理的内容，原文件不会被改动。");
      setResult({ text: refined.text, changes: refined.changes });
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
      {view === "workspace" && <HomeView input={input} onChange={updateInput} onRefine={refine} isRefining={isRefining} />}
      {view === "editor" && version && <EditorView currentVersion={version} />}
      {view === "editor" && !version && <HomeView input={input} onChange={updateInput} onRefine={refine} isRefining={isRefining} />}
    </Suspense></ErrorBoundary></main>
  </div>;
}

function RefiningOverlay() {
  return <div className="refining-overlay" role="status" aria-live="polite" aria-busy="true"><div className="refining-card"><div className="refining-spinner" /><p className="refining-kicker">正在整理</p><h2>正在整理你的简历</h2><p className="refining-note">请不要关闭页面，完成后会自动进入成稿页。</p></div></div>;
}
