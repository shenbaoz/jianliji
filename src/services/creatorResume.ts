import type { ResumeInput } from "../types";

export type CreatorBasics = { name: string; targetRole: string; email: string; phone: string; location: string };
export type CreatorEducation = { school: string; degree: string; major: string; graduation: string; gpa: string };
export type CreatorExperience = { id: string; type: string; title: string; organization: string; startDate: string; endDate: string; detail: string };
export type CreatorSkills = { skills: string; certificates: string };
export type CreatorProfile = { basics: CreatorBasics; education: CreatorEducation; experiences: CreatorExperience[]; skills: CreatorSkills; step: number; updatedAt?: string };

export function validateCreatorProfile(profile: CreatorProfile) {
  const missing: string[] = [];
  if (!profile.basics.name.trim()) missing.push("真实姓名");
  if (!profile.basics.targetRole.trim()) missing.push("目标岗位");
  if (!/1[3-9]\d{9}/.test(profile.basics.phone.replace(/\s/g, "")) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.basics.email.trim())) missing.push("有效手机号或邮箱");
  if (!profile.education.school.trim() || !profile.education.major.trim()) missing.push("学校和专业");
  if (!profile.experiences.some((item) => item.title.trim() && item.detail.trim()) && !profile.skills.skills.trim()) missing.push("至少一项真实经历或技能");
  return { valid: missing.length === 0, missing };
}

export function creatorProfileToResumeInput(profile: CreatorProfile): ResumeInput {
  const experiences = profile.experiences.filter((item) => item.title.trim() || item.detail.trim()).map((item) => [`经历类型：${item.type || "项目与实践"}`, `名称：${item.title}`, `角色/组织：${item.organization || "未填写"}`, `时间：${[item.startDate, item.endDate].filter(Boolean).join(" - ") || "未填写"}`, `用户原述：${item.detail}`].join("\n")).join("\n\n");
  const resumeText = [`姓名：${profile.basics.name}`, `联系方式：${[profile.basics.phone, profile.basics.email].filter(Boolean).join(" / ")}`, `期望地点：${profile.basics.location || "未填写"}`, `求职目标：${profile.basics.targetRole}`, "教育事实", `${profile.education.school}｜${profile.education.degree}｜${profile.education.major}｜${profile.education.graduation}`, profile.education.gpa ? `GPA/排名：${profile.education.gpa}` : "", "真实经历事实", experiences || "无", "真实技能与证书", profile.skills.skills || "无", profile.skills.certificates || ""].filter(Boolean).join("\n");
  return { candidateName: profile.basics.name, targetRole: profile.basics.targetRole, candidateType: "graduate", sourceMode: "creator", resumeText, jobDescription: "" };
}
