export type WorkflowStep =
  | "home"
  | "workspace"
  | "job"
  | "editor";

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
