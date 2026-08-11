import { useEffect, useState, type ReactNode } from "react";
import { makeSectionItem } from "../vendor/reactiveResumeSectionItem";
import { creatorProfileToResumeInput, validateCreatorProfile, type CreatorBasics as Basics, type CreatorEducation as Education, type CreatorExperience as Experience, type CreatorProfile, type CreatorSkills as Skills } from "../services/creatorResume";
import type { ResumeInput } from "../types";

const key = "resume-notes-creator";
const labels = ["基本信息", "教育背景", "项目与实践", "技能证书"];
const emptyBasics: Basics = { name: "", targetRole: "", email: "", phone: "", location: "" };
const emptyEducation: Education = { school: "", degree: "", major: "", graduation: "", gpa: "" };
const emptySkills: Skills = { skills: "", certificates: "" };
const newExperience = (): Experience => makeSectionItem({ id: "", type: "课程项目", title: "", organization: "", startDate: "", endDate: "", detail: "" });

function loadProfile(): CreatorProfile {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "{}") as Partial<CreatorProfile>;
    return {
      basics: { ...emptyBasics, ...saved.basics },
      education: { ...emptyEducation, ...saved.education },
      experiences: saved.experiences?.length ? saved.experiences.map((experience) => {
        const legacy = experience as Experience & { period?: string };
        const dates = legacy.period?.split(/\s*[—–-]\s*/) || [];
        return { ...newExperience(), ...experience, startDate: experience.startDate || dates[0] || "", endDate: experience.endDate || dates[1] || "" };
      }) : [newExperience()],
      skills: { ...emptySkills, ...saved.skills },
      step: Math.min(3, Math.max(0, saved.step || 0)),
      updatedAt: saved.updatedAt
    };
  } catch {
    return { basics: emptyBasics, education: emptyEducation, experiences: [newExperience()], skills: emptySkills, step: 0 };
  }
}

type CreatorViewProps = {
  onBack: () => void;
  onGenerate: (input: ResumeInput) => Promise<void>;
};

export function CreatorView({ onBack, onGenerate }: CreatorViewProps) {
  const [profile, setProfile] = useState<CreatorProfile>(loadProfile);
  const [saved, setSaved] = useState("已自动保存到此设备，不会上传服务器");
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const { basics, education, experiences, skills, step } = profile;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextProfile = { ...profile, updatedAt: new Date().toISOString() };
      localStorage.setItem(key, JSON.stringify(nextProfile));
      setSaved("已自动保存到此设备，不会上传服务器");
    }, 500);
    return () => window.clearTimeout(timer);
  }, [profile]);

  const updateBasics = (field: keyof Basics, value: string) => setProfile((item) => ({ ...item, basics: { ...item.basics, [field]: value } }));
  const updateEducation = (field: keyof Education, value: string) => setProfile((item) => ({ ...item, education: { ...item.education, [field]: value } }));
  const updateSkills = (field: keyof Skills, value: string) => setProfile((item) => ({ ...item, skills: { ...item.skills, [field]: value } }));
  const updateExperience = (id: string, field: keyof Omit<Experience, "id">, value: string) => setProfile((item) => ({ ...item, experiences: item.experiences.map((experience) => experience.id === id ? { ...experience, [field]: value } : experience) }));
  const changeStep = (nextStep: number) => setProfile((item) => ({ ...item, step: Math.min(3, Math.max(0, nextStep)) }));

  return <section className="creator-page">
    <header className="creator-top">
      <button onClick={onBack} className="creator-brand">简历记</button>
      <nav>{labels.map((label, index) => <button type="button" className={index === step ? "active" : ""} onClick={() => changeStep(index)} key={label}>{String(index + 1).padStart(2, "0")} {label}</button>)}</nav>
      <div><small aria-live="polite">{saved}</small><button onClick={() => setPreview(true)}>预览简历</button><button className="creator-link" onClick={onBack}>保存退出</button></div>
    </header>
    <main className="creator-form">
      <p className="creator-kicker creator-step-progress" aria-live="polite">第 {step + 1} 步 / 共 {labels.length} 步 · {labels[step]}</p>
      <h1>{["写下你的名字，开启第一份简历", "把学校经历写清楚", "没有实习，也有值得写的经历", "让招聘者一眼看见你的基础"][step]}</h1>
      <p className="creator-lead">{["没有正式工作经历也没关系。课程项目、社团、竞赛、志愿活动，都是你的真实起点。", "成绩、课程和毕业时间按真实情况填写；排名和 GPA 都是可选项。", "优先写课程项目、竞赛、学生工作或志愿活动。只写你能在面试里讲清楚的内容。", "把会用的工具、语言和已有证书写出来。不会的不用凑。 "][step]}</p>
      {step === 0 && <BasicsForm basics={basics} onChange={updateBasics} />}
      {step === 1 && <EducationForm education={education} onChange={updateEducation} />}
      {step === 2 && <ExperienceForm experiences={experiences} onChange={updateExperience} onAdd={() => setProfile((item) => ({ ...item, experiences: [...item.experiences, newExperience()] }))} onRemove={(id) => setProfile((item) => ({ ...item, experiences: item.experiences.length === 1 ? item.experiences : item.experiences.filter((experience) => experience.id !== id) }))} />}
      {step === 3 && <SkillsForm skills={skills} onChange={updateSkills} />}
      {step === 3 && <p className="creator-ai-note">AI 会基于你的资料生成初稿；联系方式不会发送给 AI，生成后请核对真实内容。</p>}
      {error && <p className="text-sm font-semibold text-rose-700">还需要填写：{error}</p>}
      <footer className="creator-form-actions"><button className="creator-link" onClick={() => step === 0 ? onBack() : changeStep(step - 1)}>{step === 0 ? "返回" : "上一步"}</button><button className="creator-next" onClick={async () => { if (step !== 3) return changeStep(step + 1); const validation = validateCreatorProfile(profile); if (validation.missing.length) { setError(validation.missing.join("、")); return; } setError(""); await onGenerate(creatorProfileToResumeInput(profile)); }}>{step === 3 ? "生成我的第一份简历" : `下一步：${labels[step + 1]} →`}</button></footer>
    </main>
    {preview && <ResumePreview profile={profile} onClose={() => setPreview(false)} />}
  </section>;
}

function BasicsForm({ basics, onChange }: { basics: Basics; onChange: (field: keyof Basics, value: string) => void }) {
  return <div className="creator-fields"><label>真实姓名<input value={basics.name} onChange={(event) => onChange("name", event.target.value)} placeholder="请输入您的真实姓名" /></label><label>求职方向<small>填一类相近岗位即可，例如“内容运营、新媒体运营”。</small><input value={basics.targetRole} onChange={(event) => onChange("targetRole", event.target.value)} placeholder="例如：内容运营、新媒体运营" /></label><div className="creator-pair"><label>电子邮箱<input value={basics.email} onChange={(event) => onChange("email", event.target.value)} placeholder="yourname@qq.com" /></label><label>手机号码<input value={basics.phone} onChange={(event) => onChange("phone", event.target.value)} placeholder="138 0000 0000" /></label></div><label>期望工作地点 <em>可稍后补充</em><input value={basics.location} onChange={(event) => onChange("location", event.target.value)} placeholder="例如：成都 / 上海 / 接受远程" /></label></div>;
}

function EducationForm({ education, onChange }: { education: Education; onChange: (field: keyof Education, value: string) => void }) {
  return <div className="creator-fields"><label>学校名称<input value={education.school} onChange={(event) => onChange("school", event.target.value)} placeholder="例如：四川大学" /></label><div className="creator-pair"><label>学历<input value={education.degree} onChange={(event) => onChange("degree", event.target.value)} placeholder="例如：本科" /></label><label>专业<input value={education.major} onChange={(event) => onChange("major", event.target.value)} placeholder="例如：新闻传播学" /></label></div><div className="creator-pair"><label>毕业时间<input value={education.graduation} onChange={(event) => onChange("graduation", event.target.value)} placeholder="例如：2026.06" /></label><label>GPA / 排名 <em>可选</em><small>体现学习能力；可填 3.6/4.0 或专业前 20%。</small><input value={education.gpa} onChange={(event) => onChange("gpa", event.target.value)} placeholder="例如：3.6/4.0，专业前 20%" /></label></div></div>;
}

function ExperienceForm({ experiences, onChange, onAdd, onRemove }: { experiences: Experience[]; onChange: (id: string, field: keyof Omit<Experience, "id">, value: string) => void; onAdd: () => void; onRemove: (id: string) => void }) {
  return <div className="creator-fields creator-experiences">{experiences.map((experience, index) => <section className="creator-experience" key={experience.id}><div className="creator-experience-head"><strong>经历 {String(index + 1).padStart(2, "0")}</strong>{experiences.length > 1 && <button type="button" onClick={() => onRemove(experience.id)}>删除</button>}</div><label>项目 / 活动名称<input value={experience.title} onChange={(event) => onChange(experience.id, "title", event.target.value)} placeholder="例如：校园二手交易小程序课程项目" /></label><label>你的角色 / 组织<input value={experience.organization} onChange={(event) => onChange(experience.id, "organization", event.target.value)} placeholder="例如：产品与运营负责人" /></label><div className="creator-pair"><label>开始时间<input value={experience.startDate} onChange={(event) => onChange(experience.id, "startDate", event.target.value)} placeholder="例如：2025.03" /></label><label>结束时间<input value={experience.endDate} onChange={(event) => onChange(experience.id, "endDate", event.target.value)} placeholder="例如：2025.06 / 至今" /></label></div><label>你实际做了什么，结果如何<textarea value={experience.detail} onChange={(event) => onChange(experience.id, "detail", event.target.value)} placeholder="例如：访谈 12 名同学梳理需求；完成页面原型和活动推广，首周获得 80 名用户。" /></label></section>)}<button type="button" className="creator-add" onClick={onAdd}>+ 再添加一段项目或实践</button></div>;
}

function SkillsForm({ skills, onChange }: { skills: Skills; onChange: (field: keyof Skills, value: string) => void }) {
  return <div className="creator-fields"><label>技能与工具<textarea value={skills.skills} onChange={(event) => onChange("skills", event.target.value)} placeholder="例如：Excel（数据透视表）、Figma、剪映、Python 基础、英语 CET-6；用逗号或换行分开" /></label><label>证书 / 获奖 <em>可选</em><textarea value={skills.certificates} onChange={(event) => onChange("certificates", event.target.value)} placeholder="例如：全国大学生市场调查与分析大赛省级二等奖、普通话二甲" /></label></div>;
}

function ResumePreview({ profile, onClose }: { profile: CreatorProfile; onClose: () => void }) {
  const { basics, education, experiences, skills } = profile;
  return <div className="creator-modal" onClick={onClose}><article onClick={(event) => event.stopPropagation()}><button onClick={onClose}>关闭预览</button><p>RESUME NOTES</p><h2>{basics.name || "你的名字"}</h2><span>{basics.targetRole || "目标岗位"}{basics.location ? ` · ${basics.location}` : ""}</span><div className="creator-contact">{[basics.phone, basics.email].filter(Boolean).join(" · ")}</div><PreviewSection title="教育经历">{education.school ? <div><strong>{education.school}</strong><span>{[education.degree, education.major, education.graduation].filter(Boolean).join(" · ")}</span>{education.gpa && <small>{education.gpa}</small>}</div> : <PreviewHint text="补充学校、专业和毕业时间后会显示在这里。" />}</PreviewSection><PreviewSection title="项目与实践">{experiences.some((item) => item.title) ? experiences.filter((item) => item.title).map((item) => <div key={item.id}><strong>{item.title}</strong><span>{[item.organization, item.startDate, item.endDate].filter(Boolean).join(" · ")}</span>{item.detail && <small>{item.detail}</small>}</div>) : <PreviewHint text="课程项目、竞赛、社团和志愿活动都可以写。" />}</PreviewSection><PreviewSection title="技能证书">{skills.skills || skills.certificates ? <div><small>{[skills.skills, skills.certificates].filter(Boolean).join(" · ")}</small></div> : <PreviewHint text="只写你真实掌握的工具和证书。" />}</PreviewSection></article></div>;
}

function PreviewSection({ title, children }: { title: string; children: ReactNode }) { return <section className="creator-preview-section"><h3>{title}</h3>{children}</section>; }
function PreviewHint({ text }: { text: string }) { return <small className="creator-preview-hint">{text}</small>; }
