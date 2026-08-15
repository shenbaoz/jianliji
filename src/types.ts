export type WorkflowStep =
  | "home"
  | "workspace"
  | "job"
  | "analysis"
  | "questions"
  | "editor"
  | "versions"
  | "cases"
  | "privacy"
  | "creator";

export type AppView = WorkflowStep;

export type ResumeInput = {
  candidateName: string;
  targetRole: string;
  candidateType?: "graduate" | "experienced" | "career-change";
  resumeText: string;
  jobDescription: string;
  sourceMode?: "resume" | "creator";
  originalResumeHtml?: string;
  originalResumeFileName?: string;
  originalResumeMimeType?: string;
  originalResumeFileUrl?: string;
  originalResumeDataUrl?: string;
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
  matchItems: MatchItem[];
};

export type MatchItem = {
  requirement: string;
  evidence: string;
  status: "matched" | "missing";
};

export type FollowUpQuestion = {
  id: string;
  question: string;
  reason: string;
  allowSkip?: boolean;
  skipLabel?: string;
};

export type OptimizedBlock = {
  title: string;
  before: string;
  after: string;
};

export type ResumeQualityPositive = {
  experienceLineCount: number;
  strongVerbCoverage: number;
  quantifiedRatio: number;
  templatePhrases: string[];
  weakOpeners: string[];
  passHint: string;
};

export type ResumeQuality = {
  verdict: "ready" | "needs_evidence";
  score: number;
  checks: string[];
  positive?: ResumeQualityPositive;
};

export type OptimizedResume = {
  summary: string;
  skills: string[];
  blocks: OptimizedBlock[];
  fullText: string;
  interviewScript: string[];
  suggestions?: string[];
  quality?: ResumeQuality;
  provider?: "deepseek" | "kimi";
  model?: string;
  changes?: Array<{ before: string; after: string }>;
};

export type UniversalRefinement = {
  text: string;
  changes: Array<{ before: string; after: string }>;
  quality: {
    verdict: "ready" | "unchanged";
    checks: string[];
  };
  safe: boolean;
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
  updatedAt?: string;
  name?: string;
  title?: string;
  experience?: string;
  candidateName: string;
  targetRole: string;
  score: number;
  templateId: string;
  resumeText: string;
  jobDescription: string;
  optimizedText: string;
  changes?: Array<{ before: string; after: string }>;
  highlights?: string[];
  originalResumeHtml?: string;
  originalResumeFileName?: string;
  originalResumeMimeType?: string;
  originalResumeFileUrl?: string;
  originalResumeDataUrl?: string;
};

export type UnlockInterest = {
  id: string;
  createdAt: string;
  source: "analysis" | "result" | "editor";
  candidateName: string;
  targetRole: string;
  planId: string;
  contact: string;
  note: string;
};

export type SampleResumeCase = {
  id: string;
  title: string;
  userType: string;
  targetRole: string;
  summary: string;
  resumeText: string;
  jobDescription: string;
  candidateType?: "graduate" | "experienced" | "career-change";
  roleCategory?: "tech" | "product" | "operations" | "content" | "design" | "business" | "functional";
};
