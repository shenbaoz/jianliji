import { lazy, Suspense, useRef, useState } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { LandingView } from "./components/LandingView";
import { optimizeWithDeepSeek } from "./services/aiOptimize";
import { createEditedPdfPreview, createGeneratedPdf } from "./services/pdfFileEditor";
import { ResumeStartView } from "./components/ResumeStartView";
import type { AppView, PreparedPdf, ResumeInput, SavedResumeVersion } from "./types";

const EditorView = lazy(() => import("./components/EditorView").then((module) => ({ default: module.EditorView })));

const initialInput: ResumeInput = { candidateName: "", targetRole: "", resumeText: "", jobDescription: "" };

export default function App() {
  const [view, setView] = useState<AppView>("home");
  const [input, setInput] = useState<ResumeInput>(initialInput);
  const [result, setResult] = useState<{ text: string; changes: Array<{ before: string; after: string }>; highlights?: string[]; preparedPdf?: PreparedPdf } | null>(null);
  const [message, setMessage] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [followUpRounds, setFollowUpRounds] = useState(0);
  const inFlight = useRef(false);

  const go = (next: AppView) => {
    setView(next);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const updateInput = (next: ResumeInput) => {
    setInput({ ...next, jobDescription: "" });
    setResult(null);
    setFollowUpQuestions([]);
    setFollowUpRounds(0);
  };
  const refine = async (nextInput: ResumeInput, evidenceAnswers: string[] = []) => {
    if (inFlight.current || nextInput.resumeText.trim().length < 11) {
      setMessage(nextInput.sourceMode === "creator" ? "请先写下一件你做过的事。" : "请先导入可读取的简历。");
      return;
    }
    inFlight.current = true;
    setIsRefining(true);
    setMessage("");
    try {
      const normalized = { ...nextInput, targetRole: nextInput.targetRole.trim() || "通用求职版" };
      // 追问页上的再次提交：回答为空视为用户跳过追问（不再强制追问，靠质检兜底防编造）
      const isFollowUpRound = followUpQuestions.length > 0;
      const refined = await optimizeWithDeepSeek(normalized, evidenceAnswers, { skippedFollowUp: isFollowUpRound && evidenceAnswers.length === 0 });
      if (!refined.safe || !refined.text.trim()) {
        const questions = (refined.suggestions || []).filter(Boolean);
        if (nextInput.sourceMode === "creator" && questions.length > 0 && followUpRounds < 2) {
          // 从零流程：AI 需要补充信息时展示追问（最多两轮），由用户回答后继续生成
          setFollowUpQuestions(questions);
          setFollowUpRounds((rounds) => rounds + 1);
          return;
        }
        throw new Error(refined.reviewFlags?.[0] || questions[0] || "信息不足，请补充具体经历。");
      }
      const preparedPdf = normalized.originalResumeFileUrl && /pdf/i.test(normalized.originalResumeMimeType || "")
        ? await createEditedPdfPreview(normalized.originalResumeFileUrl, refined.text, refined.changes || [])
        : await createGeneratedPdf(refined.text, normalized.portraitDataUrl, normalized.candidateName);
      setInput(normalized);
      setFollowUpQuestions([]);
      setFollowUpRounds(0);
      setResult({ text: refined.text, changes: refined.changes || [], highlights: refined.highlights || [], preparedPdf });
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
    name: input.candidateName || "简历", title: "通用简历", candidateName: input.candidateName || "简历", targetRole: "通用简历", score: 0, templateId: "fresh",
    resumeText: input.resumeText, jobDescription: "", optimizedText: result.text, experience: result.text, changes: result.changes, highlights: result.highlights,
    basicInfo: input.basicInfo,
    originalResumeHtml: input.originalResumeHtml, originalResumeFileName: input.originalResumeFileName, originalResumeMimeType: input.originalResumeMimeType,
    originalResumeFileUrl: input.originalResumeFileUrl, originalResumeDataUrl: input.originalResumeDataUrl,
    preparedPdf: result.preparedPdf
  } : undefined;

  return <div className="public-editorial-shell min-h-screen bg-white font-sans text-[#20211f]">
    <Header onOpenHome={() => go("home")} onOpenWorkspace={() => go("workspace")} finalOnly={view === "editor"} />
    {message && <div className="app-toast" role="status">{message}</div>}
    {isRefining && <RefiningOverlay />}
    <main><ErrorBoundary><Suspense fallback={<div className="page-shell">加载…</div>}>
      {view === "home" && <LandingView onNavigate={go} />}
      {view === "workspace" && <ResumeStartView input={input} onChange={updateInput} onGenerate={refine} isGenerating={isRefining} followUpQuestions={followUpQuestions} />}
      {view === "editor" && version && <EditorView currentVersion={version} />}
      {view === "editor" && !version && <ResumeStartView input={input} onChange={updateInput} onGenerate={refine} isGenerating={isRefining} followUpQuestions={followUpQuestions} />}
    </Suspense></ErrorBoundary></main>
    <Footer />
  </div>;
}

function RefiningOverlay() {
  return <div className="refining-overlay" role="status" aria-live="polite" aria-busy="true"><div className="refining-card"><div className="refining-spinner" /><p className="refining-kicker">整理中</p><h2>正在生成简历</h2><p className="refining-note">完成后自动进入成稿页。</p></div></div>;
}
