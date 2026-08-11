import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Header } from "./components/Header";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LandingView } from "./components/LandingView";
import { resumeTemplates } from "./data/templates";
import { saveVersion } from "./services/storage";
import { optimizeWithDeepSeek } from "./services/aiOptimize";
import { loadVersions } from "./services/storage";
import type {
  AnalysisReport,
  AppView,
  FollowUpQuestion,
  OptimizedResume,
  ResumeInput,
  SampleResumeCase,
  SavedResumeVersion,
  WorkflowStep
} from "./types";

const EditorView = lazy(() => import("./components/EditorView").then((module) => ({ default: module.EditorView })));
const CaseLibraryView = lazy(() => import("./components/CaseLibraryView").then((module) => ({ default: module.CaseLibraryView })));
const FollowUpView = lazy(() => import("./components/FollowUpView").then((module) => ({ default: module.FollowUpView })));
const HomeView = lazy(() => import("./components/HomeView").then((module) => ({ default: module.HomeView })));
const JobView = lazy(() => import("./components/JobView").then((module) => ({ default: module.JobView })));
const CreatorView = lazy(() => import("./components/CreatorView").then((module) => ({ default: module.CreatorView })));
const ProfileView = lazy(() => import("./components/ProfileView").then((module) => ({ default: module.ProfileView })));
const ReportView = lazy(() => import("./components/ReportView").then((module) => ({ default: module.ReportView })));

const initialInput: ResumeInput = {
  candidateName: "",
  targetRole: "",
  resumeText: "",
  jobDescription: ""
};

const inferCandidateName = (input: ResumeInput) => {
  if (input.candidateName.trim()) return input.candidateName.trim();
  const firstLine = input.resumeText
    .split(/\n+/)
    .map((line) => line.trim())
    .find(Boolean);
  const firstPart = firstLine?.split(/｜|\|/)[0]?.trim();
  return firstPart && /^[\u4e00-\u9fa5A-Za-z·]{2,12}$/.test(firstPart) ? firstPart : "未命名人才";
};

export default function App() {
  const [view, setView] = useState<AppView>("home");
  const [input, setInput] = useState<ResumeInput>(initialInput);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [questions, setQuestions] = useState<FollowUpQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [optimized, setOptimized] = useState<OptimizedResume | null>(null);
  const [editedText, setEditedText] = useState("");
  const [templateId, setTemplateId] = useState(resumeTemplates[0].id);
  const [versions, setVersions] = useState<SavedResumeVersion[]>([]);
  const [validationMessage, setValidationMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const generationInFlight = useRef(false);

  useEffect(() => {
    void refreshVersions();
  }, []);

  useEffect(() => {
    if (!validationMessage) return;
    const timer = window.setTimeout(() => setValidationMessage(""), 4000);
    return () => window.clearTimeout(timer);
  }, [validationMessage]);

  const canAnalyze = useMemo(
    () => input.resumeText.trim().length > 20 && input.targetRole.trim().length > 1,
    [input.resumeText, input.targetRole]
  );

  const hasResume = input.resumeText.trim().length > 20;
  const isDark = false;

  const go = (step: WorkflowStep) => {
    window.history.replaceState(null, "", window.location.pathname);
    setView(step);
    window.setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }), 0);
  };

  const clearGeneratedState = () => {
    setReport(null);
    setQuestions([]);
    setAnswers({});
    setOptimized(null);
    setEditedText("");
  };

  const updateResumeInput = (nextInput: ResumeInput) => {
    const resumeChanged = nextInput.resumeText !== input.resumeText;
    if (resumeChanged) {
      setInput({ ...nextInput, targetRole: "", jobDescription: "" });
      clearGeneratedState();
      return;
    }
    setInput(nextInput);
  };

  const updateJobInput = (nextInput: ResumeInput) => {
    const jobChanged = nextInput.targetRole !== input.targetRole;
    setInput({ ...nextInput, jobDescription: "" });
    if (jobChanged) {
      clearGeneratedState();
    }
  };

  const openHome = () => {
    go("home");
  };

  const openWorkspace = () => {
    go("workspace");
  };

  const openCaseLibrary = () => {
    go("cases");
  };
  const openCreator = () => go("creator");

  const startJobStep = () => {
    if (!hasResume) {
      setValidationMessage("先粘贴简历文本，或使用一份样稿继续。");
      return;
    }
    go("job");
  };

  const runAnalysis = async () => {
    if (generationInFlight.current) return;
    if (!canAnalyze) {
      setValidationMessage("请先填写简历内容和求职方向。");
      return;
    }
    const { analyzeResume } = await import("./services/resumeAnalyzer");
    const universalInput = { ...input, jobDescription: "" };
    setInput(universalInput);
    const nextReport = analyzeResume(universalInput);
    setReport(nextReport);
    await runGeneration(universalInput, nextReport, {}, true);
  };

  const runGeneration = async (generationInput = input, generationReport = report, generationAnswers = answers, allowExternalAi = true) => {
    if (!generationReport) return;
    const { generateOptimizedResume } = await import("./services/resumeAnalyzer");
    const ruleOptimized = generateOptimizedResume(generationInput, generationReport, generationAnswers);
    let nextOptimized = ruleOptimized;
    if (!allowExternalAi) {
      setOptimized(ruleOptimized);
      setEditedText(ruleOptimized.fullText);
      setValidationMessage("已使用本地规则生成初稿，简历内容未发送给外部 AI。");
      go("editor");
      return;
    }
    if (generationInFlight.current) return;
    generationInFlight.current = true;
    setIsGenerating(true);
    try {
      const evidenceAnswers = Object.values(generationAnswers).map((value) => value.trim()).filter(Boolean);
      const aiResult = await optimizeWithDeepSeek(generationInput, evidenceAnswers);
      if (aiResult.safe === false) {
        throw new Error("AI 草稿包含无法从原简历核实的信息，已拦截并使用本地规则初稿。");
      }
      nextOptimized = { ...ruleOptimized, fullText: aiResult.text, changes: aiResult.changes, summary: `已由 ${aiResult.provider === "deepseek" ? "DeepSeek" : "Kimi"} ${aiResult.model} 一键完成岗位分析、强力重写和招聘者质检。`, suggestions: aiResult.suggestions, quality: aiResult.quality, provider: aiResult.provider, model: aiResult.model };
    } catch (error) {
      setValidationMessage(error instanceof Error ? `${error.message} 已使用本地规则生成初稿。` : "AI 优化暂不可用，已使用本地规则生成初稿。");
    } finally {
      generationInFlight.current = false;
      setIsGenerating(false);
    }
    setOptimized(nextOptimized);
    setEditedText(nextOptimized.fullText);
    go("editor");
  };

  const generateFromCreator = async (nextInput: ResumeInput) => {
    setInput(nextInput);
    setAnswers({});
    const { analyzeResume, generateFollowUpQuestions } = await import("./services/resumeAnalyzer");
    const nextReport = analyzeResume(nextInput);
    setReport(nextReport);
    setQuestions(generateFollowUpQuestions(nextInput, nextReport));
    await runGeneration(nextInput, nextReport, {}, true);
  };

  const refreshVersions = async () => setVersions(await loadVersions());

  const loadVersion = (version: SavedResumeVersion) => {
    setInput({
      candidateName: version.candidateName,
      targetRole: version.targetRole,
      resumeText: version.resumeText,
      jobDescription: version.jobDescription,
      originalResumeHtml: version.originalResumeHtml,
      originalResumeFileName: version.originalResumeFileName,
      originalResumeMimeType: version.originalResumeMimeType,
      originalResumeFileUrl: version.originalResumeFileUrl
    });
    setTemplateId(version.templateId);
    setEditedText(version.optimizedText);
    setOptimized({
      summary: `${version.targetRole} 的已保存版本`,
      skills: [],
      blocks: [{ title: "已保存版本", before: version.resumeText.slice(0, 120), after: version.optimizedText.slice(0, 180) }],
      fullText: version.optimizedText,
      interviewScript: ["这是已保存的简历版本，可以继续编辑或导出。"]
    });
    go("editor");
  };

  const loadSampleCase = async (sample: SampleResumeCase, nextStep: WorkflowStep = "workspace") => {
    const sampleInput = {
      candidateName: sample.resumeText.split("｜")[0],
      targetRole: sample.targetRole,
      candidateType: sample.candidateType || (/应届|实习|在校/.test(sample.resumeText) ? "graduate" : "experienced"),
      resumeText: sample.resumeText,
      jobDescription: sample.jobDescription
    };
    setInput(sampleInput);
    clearGeneratedState();
    if (nextStep === "analysis") {
      const { analyzeResume, generateFollowUpQuestions } = await import("./services/resumeAnalyzer");
      const nextReport = analyzeResume(sampleInput);
      setReport(nextReport);
      setQuestions(generateFollowUpQuestions(sampleInput, nextReport));
      go("analysis");
      return;
    }
    if (nextStep === "job") {
      go("workspace");
      window.setTimeout(() => go("job"), 420);
      return;
    }
    go(nextStep);
  };

  const loadDefaultSample = async (nextStep: WorkflowStep = "analysis") => {
    const { sampleResumeCases } = await import("./data/sampleCases");
    await loadSampleCase(sampleResumeCases[0], nextStep);
  };

  return (
    <div className={isDark ? "public-editorial-shell min-h-screen font-sans antialiased app-dark" : "public-editorial-shell min-h-screen bg-white font-sans antialiased text-[#20211f]"}>
      {view !== "creator" && <Header onOpenHome={openHome} onOpenCases={openCaseLibrary} onOpenWorkspace={openWorkspace} onOpenCreator={openCreator} finalOnly={view === "editor"} dark={isDark} />}
      {validationMessage && (
        <div className="app-toast" role="status" aria-live="polite">
          {validationMessage}
        </div>
      )}
      {isGenerating && <AiRefiningOverlay />}
      <main>
        <ErrorBoundary>
        <Suspense fallback={<LoadingState />}>
        {view === "home" && <LandingView onNavigate={go} onOpenCreator={openCreator} />}
        {view === "creator" && <CreatorView onBack={openHome} onGenerate={generateFromCreator} />}
        {view === "cases" && <CaseLibraryView onBackHome={openHome} onNavigate={go} onLoadSample={loadSampleCase} />}
        {view === "workspace" && <HomeView input={input} onChange={updateResumeInput} onNext={startJobStep} onLoadSample={loadSampleCase} />}
        {view === "job" && <JobView input={input} onChange={updateJobInput} onBack={() => go("workspace")} onAnalyze={runAnalysis} isGenerating={isGenerating} />}
        {view === "analysis" && report && (
          <ReportView
            score={report.score}
            matchedKeywords={report.matchedKeywords}
            missingKeywords={report.missingKeywords}
            matchItems={report.matchItems}
            onBackToEdit={() => go("questions")}
          />
        )}
        {view === "analysis" && !report && <EmptyState onStart={() => go("workspace")} />}
        {view === "questions" && report && (
          <FollowUpView questions={questions} answers={answers} onChange={setAnswers} onBack={() => go("analysis")} onBackToJob={() => go("job")} onGenerate={() => void runGeneration()} />
        )}
        {view === "questions" && !report && <EmptyState onStart={() => go("workspace")} />}
        {view === "editor" && optimized && (
          <EditorView
            qualityPositive={optimized.quality?.positive}
            currentVersion={{
              id: "current-draft",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              name: inferCandidateName(input),
              title: input.targetRole || "目标岗位",
              experience: editedText || optimized.fullText,
              candidateName: inferCandidateName(input),
              targetRole: input.targetRole || "目标岗位",
              score: report?.score || 0,
              templateId,
              resumeText: input.resumeText,
              jobDescription: input.jobDescription,
              optimizedText: editedText || optimized.fullText,
              changes: optimized.changes,
              originalResumeHtml: input.originalResumeHtml,
              originalResumeFileName: input.originalResumeFileName,
              originalResumeMimeType: input.originalResumeMimeType,
              originalResumeFileUrl: input.originalResumeFileUrl,
              originalResumeDataUrl: input.originalResumeDataUrl
            }}
            onSave={async (version) => {
              await saveVersion({
                ...version,
                id: crypto.randomUUID(),
                createdAt: new Date().toISOString(),
                candidateName: version.candidateName || version.name || "未命名人才",
                targetRole: version.targetRole || version.title || "目标岗位",
                score: version.score || report?.score || 0,
                templateId: version.templateId || templateId,
                resumeText: version.resumeText || input.resumeText,
                jobDescription: version.jobDescription || input.jobDescription,
                optimizedText: version.optimizedText || version.experience || "",
                originalResumeHtml: version.originalResumeHtml || input.originalResumeHtml,
                originalResumeFileName: version.originalResumeFileName || input.originalResumeFileName,
                originalResumeMimeType: version.originalResumeMimeType || input.originalResumeMimeType,
                originalResumeFileUrl: version.originalResumeFileUrl || input.originalResumeFileUrl
              });
              await refreshVersions();
              go("versions");
            }}
          />
        )}
        {view === "editor" && !optimized && <EmptyState onStart={() => go("workspace")} />}
        {view === "versions" && <ProfileView versions={versions} onRefresh={refreshVersions} onLoad={loadVersion} />}
        </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}

function AiRefiningOverlay() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="refining-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="refining-card">
        <div className="refining-spinner" aria-hidden="true" />
        <p className="refining-kicker">正在精修</p>
        <h2>正在精修你的简历</h2>
        <p className="refining-time">
          已等待 {elapsedSeconds} 秒 · {elapsedSeconds < 60 ? "通常需要 30–60 秒" : "内容较多时会稍慢"}
        </p>
        <div className="refining-progress" aria-hidden="true"><span /></div>
        <p className="refining-note">请不要关闭页面，完成后会自动进入成稿页。</p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <section className="page-shell" aria-live="polite" aria-busy="true">
      <div className="panel mx-auto max-w-[560px] text-center">
        <p className="text-sm text-slate-600">正在打开工作区…</p>
      </div>
    </section>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <section className="page-shell">
      <div className="panel mx-auto max-w-[560px] text-center">
        <h1 className="text-2xl font-semibold tracking-tight">暂时没有内容</h1>
        <p className="mt-3 text-sm">先看看你的简历，再告诉我你想去哪。</p>
        <button type="button" className="primary-button mt-6" onClick={onStart}>
          从简历导入开始
        </button>
      </div>
    </section>
  );
}
