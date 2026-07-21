export type WorkflowStep =
  | "home"
  | "workspace"
  | "job"
  | "analysis"
  | "questions"
  | "result"
  | "editor"
  | "versions";

export type AppView = WorkflowStep | "admin";

export type ResumeInput = {
  candidateName: string;
  targetRole: string;
  resumeText: string;
  jobDescription: string;
};

export type SkillScore = {
  label: string;
  score: number;
};

export type AnalysisReport = {
  score: number;
  level: "低" | "中" | "高";
  matchedKeywords: string[];
  missingKeywords: string[];
  strengths: string[];
  issues: string[];
  fixes: string[];
  skillScores: SkillScore[];
};

export type FollowUpQuestion = {
  id: string;
  question: string;
  reason: string;
};

export type OptimizedBlock = {
  title: string;
  before: string;
  after: string;
};

export type OptimizedResume = {
  summary: string;
  skills: string[];
  blocks: OptimizedBlock[];
  fullText: string;
  interviewScript: string[];
};

export type ResumeTemplate = {
  id: string;
  name: string;
  category: string;
  description: string;
  accent: string;
};

export type SavedResumeVersion = {
  id: string;
  createdAt: string;
  candidateName: string;
  targetRole: string;
  score: number;
  templateId: string;
  resumeText: string;
  jobDescription: string;
  optimizedText: string;
};

export type SampleResumeCase = {
  id: string;
  title: string;
  userType: string;
  targetRole: string;
  summary: string;
  resumeText: string;
  jobDescription: string;
};
