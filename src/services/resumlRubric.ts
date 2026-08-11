/*
 * ATS tier weighting adapted directly from phoinixi/resuml (ISC License).
 * Source: https://github.com/phoinixi/resuml/blob/main/src/ats/scoring.ts
 * Copyright (c) 2024 phoinixi. The ISC license notice is retained in
 * docs/third-party-licenses/resuml-ISC.txt.
 */

type Weight = "high" | "medium" | "low";

type Check = { score: number; weight: Weight };

const weightMultiplier: Record<Weight, number> = { high: 3, medium: 2, low: 1 };

// Direct adaptation of resuml's computeTierScore.
function computeTierScore(checks: Check[]): number {
  if (!checks.length) return 0;
  let weighted = 0;
  let total = 0;
  for (const check of checks) {
    const multiplier = weightMultiplier[check.weight];
    weighted += check.score * multiplier;
    total += 100 * multiplier;
  }
  return total ? Math.round((weighted / total) * 100) : 0;
}

// Direct adaptation of resuml's default tier weights: parsing 30, match 50,
// recruiter readability 20. Chinese resumes are assessed by character count
// where the original project uses whitespace-separated word count.
export function scoreWithResumlRubric({
  resume,
  jobDescription,
  matchedKeywords,
  missingKeywords,
  hasTargetTitle
}: {
  resume: string;
  jobDescription: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  hasTargetTitle: boolean;
}) {
  const lines = resume.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const actionLines = lines.filter((line) => /^(?:[-•·]\s*)?(负责|主导|独立|参与|完成|搭建|优化|推动|设计|开发|分析|管理|协调|制定|实施|维护)/.test(line));
  const metricLines = actionLines.filter((line) => /(\d+|%|万|千|百|提升|降低|增长|减少|累计|ROI|GMV|转化|复购|曝光|播放|下单|核销)/.test(line));
  const sectionCount = ["工作经历", "实习经历", "项目经历", "教育经历", "技能", "个人优势", "自我评价"]
    .filter((heading) => resume.includes(heading)).length;
  const hasContact = /(?:\+?86[-\s]?)?1[3-9]\d{9}/.test(resume) || /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(resume);
  const quantification = actionLines.length ? Math.min(100, Math.round((metricLines.length / actionLines.length) * 200)) : 0;
  const jdSkillCount = matchedKeywords.length + missingKeywords.length;
  const keywordOverlap = jdSkillCount ? Math.round((matchedKeywords.length / jdSkillCount) * 100) : 0;
  const idealLength = resume.length >= 400 && resume.length <= 1600 ? 100 : resume.length >= 280 && resume.length <= 2200 ? 70 : 35;

  const parsing = computeTierScore([
    { score: sectionCount >= 3 ? 100 : sectionCount >= 2 ? 60 : 20, weight: "high" },
    { score: hasContact ? 100 : 0, weight: "high" }
  ]);
  const match = jobDescription.trim()
    ? computeTierScore([
      { score: keywordOverlap, weight: "high" },
      { score: hasTargetTitle ? 100 : 0, weight: "high" }
    ])
    : 0;
  const recruiter = computeTierScore([
    { score: actionLines.length ? Math.round((actionLines.length / lines.length) * 100) : 0, weight: "medium" },
    { score: quantification, weight: "high" },
    { score: idealLength, weight: "low" }
  ]);
  const score = jobDescription.trim()
    ? Math.round((parsing * 30 + match * 50 + recruiter * 20) / 100)
    : Math.round((parsing * 40 + recruiter * 60) / 100);

  return { score, parsing, match, recruiter, keywordOverlap, quantification, hasContact, sectionCount };
}
