import { useEffect, useMemo, useState } from "react";
import { AdminView } from "./components/AdminView";
import { EditorView } from "./components/EditorView";
import { FollowUpView } from "./components/FollowUpView";
import { Header } from "./components/Header";
import { HomeView } from "./components/HomeView";
import { JobView } from "./components/JobView";
import { LandingView } from "./components/LandingView";
import { ProfileView } from "./components/ProfileView";
import { ReportView } from "./components/ReportView";
import { ResultView } from "./components/ResultView";
import { WorkflowStepper } from "./components/WorkflowStepper";
import { resumeTemplates } from "./data/templates";
import {
  analyzeResume,
  generateFollowUpQuestions,
  generateOptimizedResume
} from "./services/resumeAnalyzer";
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

const initialInput: ResumeInput = {
  candidateName: "",
  targetRole: "",
  resumeText: "",
  jobDescription: ""
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

  useEffect(() => {
    setVersions(loadVersions());
    const applyHash = () => {
      setView(window.location.hash === "#/admin" ? "admin" : "home");
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  const visibleStep: WorkflowStep = view === "admin" ? "home" : view;

  const canAnalyze = useMemo(
    () => input.resumeText.trim().length > 20 && input.jobDescription.trim().length > 20,
    [input.jobDescription, input.resumeText]
  );

  const go = (step: WorkflowStep) => {
    window.history.replaceState(null, "", window.location.pathname);
    setView(step);
  };

  const runAnalysis = () => {
    if (!canAnalyze) {
      alert("请先填写简历内容和目标岗位 JD，内容稍微完整一点分析会更准确。");
      return;
    }
    const nextReport = analyzeResume(input);
    const nextQuestions = generateFollowUpQuestions(input, nextReport);
    setReport(nextReport);
    setQuestions(nextQuestions);
    setView("analysis");
  };

  const runGeneration = () => {
    if (!report) return;
    const nextOptimized = generateOptimizedResume(input, report, answers);
    setOptimized(nextOptimized);
    setEditedText(nextOptimized.fullText);
    setView("result");
  };

  const refreshVersions = () => setVersions(loadVersions());

  const loadVersion = (version: SavedResumeVersion) => {
    setInput({
      candidateName: version.candidateName,
      targetRole: version.targetRole,
      resumeText: version.resumeText,
      jobDescription: version.jobDescription
    });
    setTemplateId(version.templateId);
    setEditedText(version.optimizedText);
    setOptimized({
      summary: `${version.targetRole} 的已保存版本`,
      skills: [],
      blocks: [
        {
          title: "已保存版本",
          before: version.resumeText.slice(0, 120),
          after: version.optimizedText.slice(0, 180)
        }
      ],
      fullText: version.optimizedText,
      interviewScript: ["这是已保存的简历版本，可以继续编辑或导出。"]
    });
    setView("editor");
  };

  const loadSampleCase = (sample: SampleResumeCase, nextStep: WorkflowStep = "workspace") => {
    const sampleInput = {
      candidateName: sample.resumeText.split("｜")[0],
      targetRole: sample.targetRole,
      resumeText: sample.resumeText,
      jobDescription: sample.jobDescription
    };
    setInput(sampleInput);
    setAnswers({});
    setOptimized(null);
    setEditedText("");
    if (nextStep === "analysis") {
      const nextReport = analyzeResume(sampleInput);
      setReport(nextReport);
      setQuestions(generateFollowUpQuestions(sampleInput, nextReport));
      setView("analysis");
      return;
    }
    setReport(null);
    go(nextStep);
  };

  return (
    <div className="app">
      <Header />
      <div className="app-body">
        {view !== "admin" && <WorkflowStepper active={visibleStep} onSelect={go} />}
        <main className={view === "admin" ? "content admin-content" : "content"}>
          {view === "home" && <LandingView onNavigate={go} onLoadSample={loadSampleCase} />}
          {view === "workspace" && (
            <HomeView input={input} onChange={setInput} onNext={() => go("job")} onLoadSample={loadSampleCase} />
          )}
          {view === "job" && (
            <JobView input={input} onChange={setInput} onBack={() => go("workspace")} onAnalyze={runAnalysis} />
          )}
          {view === "analysis" && report && (
            <ReportView report={report} onBack={() => go("job")} onNext={() => go("questions")} />
          )}
          {view === "analysis" && !report && <EmptyState onStart={() => go("workspace")} />}
          {view === "questions" && report && (
            <FollowUpView
              questions={questions}
              answers={answers}
              onChange={setAnswers}
              onBack={() => go("analysis")}
              onGenerate={runGeneration}
            />
          )}
          {view === "questions" && !report && <EmptyState onStart={() => go("workspace")} />}
          {view === "result" && optimized && (
            <ResultView resume={optimized} onBack={() => go("questions")} onEdit={() => go("editor")} />
          )}
          {view === "result" && !optimized && <EmptyState onStart={() => go("workspace")} />}
          {view === "editor" && optimized && (
            <EditorView
              input={input}
              optimized={optimized}
              templateId={templateId}
              onTemplateChange={setTemplateId}
              editedText={editedText}
              onEditedTextChange={setEditedText}
              score={report?.score || 0}
              onSaved={() => {
                refreshVersions();
                go("versions");
              }}
            />
          )}
          {view === "editor" && !optimized && <EmptyState onStart={() => go("workspace")} />}
          {view === "versions" && (
            <ProfileView versions={versions} onRefresh={refreshVersions} onLoad={loadVersion} />
          )}
          {view === "admin" && <AdminView />}
        </main>
      </div>
    </div>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <section className="page-shell narrow">
      <div className="panel empty-panel">
        <h1>还没有可展示的内容</h1>
        <p>请先完成简历导入和目标岗位输入，系统才能继续生成后面的页面。</p>
        <button type="button" className="primary-button" onClick={onStart}>
          从简历导入开始
        </button>
      </div>
    </section>
  );
}
