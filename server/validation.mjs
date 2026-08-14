import { z } from "zod";

// 集中式请求体校验:只做白名单与长度上限,字段一律可选,
// 避免打断客户端最小化提交,同时封住超大 payload 进入存储。

export const versionSchema = z.object({
  id: z.string().min(1).max(100),
  createdAt: z.string().max(40).optional(),
  updatedAt: z.string().max(40).optional(),
  name: z.string().max(100).optional(),
  title: z.string().max(100).optional(),
  experience: z.string().max(100_000).optional(),
  candidateName: z.string().max(80).optional(),
  targetRole: z.string().max(120).optional(),
  score: z.number().min(0).max(100).optional(),
  templateId: z.string().max(50).optional(),
  resumeText: z.string().max(100_000).optional(),
  jobDescription: z.string().max(40_000).optional(),
  optimizedText: z.string().max(100_000).optional(),
  changes: z
    .array(z.object({ before: z.string().max(2_000), after: z.string().max(2_000) }))
    .max(200)
    .optional(),
  originalResumeHtml: z.string().max(500_000).optional(),
  originalResumeFileName: z.string().max(200).optional(),
  originalResumeMimeType: z.string().max(100).optional(),
  originalResumeFileUrl: z.string().max(500).optional(),
  originalResumeDataUrl: z.string().max(3_000_000).optional()
});

export const interestSchema = z.object({
  id: z.string().max(64).optional(),
  createdAt: z.string().max(40).optional(),
  source: z.string().min(1).max(40),
  candidateName: z.string().max(80).optional(),
  targetRole: z.string().max(120).optional(),
  planId: z.string().min(1).max(80),
  contact: z.string().max(200).optional(),
  note: z.string().max(2_000).optional()
});
