export type WorkflowStep =
  | "home"
  | "workspace"
  | "job"
  | "editor";

export type AppView = WorkflowStep;

export type BasicInfo = {
  name: string;
  school: string;
  major: string;
  degree: string;
  phone: string;
  email: string;
  city: string;
};

export const emptyBasicInfo: BasicInfo = {
  name: "",
  school: "",
  major: "",
  degree: "",
  phone: "",
  email: "",
  city: ""
};

export type ResumeInput = {
  candidateName: string;
  targetRole: string;
  candidateType?: "graduate" | "experienced" | "career-change";
  resumeText: string;
  jobDescription: string;
  sourceMode?: "resume" | "creator";
  basicInfo?: BasicInfo;
  originalResumeHtml?: string;
  originalResumeFileName?: string;
  originalResumeMimeType?: string;
  originalResumeFileUrl?: string;
  originalResumeDataUrl?: string;
  portraitDataUrl?: string;
};

export type ResumeTemplate = {
  id: string;
  name: string;
  category: string;
  description: string;
  accent: string;
};

export type PreparedPdf = {
  fileUrl: string;
  reviewFileUrl: string;
  changedLineCount: number;
  appliedChanges: Array<{ before: string; after: string }>;
  deliveryMode: "source-template" | "generated-template";
  portraitApplied: boolean;
  portraitDataUrl?: string;
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
  basicInfo?: BasicInfo;
  changes?: Array<{ before: string; after: string }>;
  highlights?: string[];
  originalResumeHtml?: string;
  originalResumeFileName?: string;
  originalResumeMimeType?: string;
  originalResumeFileUrl?: string;
  originalResumeDataUrl?: string;
  preparedPdf?: PreparedPdf;
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
