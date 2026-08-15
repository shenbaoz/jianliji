import { memo } from "react";
import type { CSSProperties } from "react";
import { Mail, MapPin, Phone } from "lucide-react";
import type { ResumeTemplate } from "../types";

type Props = {
  text: string;
  template: ResumeTemplate;
  portraitDataUrl?: string;
};

const sectionTitles = new Set([
  "个人优势",
  "核心优势",
  "工作经历 / 实习经历",
  "工作经历",
  "实习经历",
  "实习及项目经历",
  "项目与实习经历",
  "核心经历",
  "关键成果",
  "代表成果",
  "项目经历",
  "校园项目",
  "校园经历",
  "教育经历",
  "教育背景",
  "技能关键词",
  "技能",
  "技能与优势",
  "专业技能",
  "个人技能",
  "技能与工具",
  "技能特长",
  "技能清单",
  "自我评价",
  "证书",
  "荣誉",
  "获奖经历",
  "奖项荣誉",
  "荣誉奖项",
  "可继续补充的真实证据",
  "投递版本建议",
  "优化说明"
]);

type ParsedSection = {
  title: string;
  lines: string[];
};

const hiddenDocumentSections = new Set(["关键成果", "可继续补充的真实证据", "投递版本建议", "优化说明"]);

function parseResumeText(text: string) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const firstLineParts = (lines[0] || "求职者").split(/｜|\|/).map((item) => item.trim()).filter(Boolean);
  const name = firstLineParts[0] || "求职者";
  const inferredCity = firstLineParts.find((item) => /北京|上海|广州|深圳|杭州|成都|武汉|南京|苏州|厦门|重庆|郑州|三亚|泉州/.test(item));
  const target = lines.find((line) => line.startsWith("求职目标："))?.replace("求职目标：", "") || firstLineParts.slice(1).join(" / ") || "目标岗位";
  const contactLine = lines.find((line) => line.startsWith("联系方式：")) || "";
  const contactParts = contactLine.replace("联系方式：", "").split(/｜|\|/).map((item) => item.trim()).filter(Boolean);
  const phone = contactParts.find((item) => /1[3-9]\d{9}/.test(item)) || "";
  const email = contactParts.find((item) => /@/.test(item)) || "";
  const age = contactParts.find((item) => /\d+\s*岁/.test(item));
  const contactCity = contactParts.find((item) => /北京|上海|广州|深圳|杭州|成都|武汉|南京|苏州|厦门|重庆|郑州|三亚|泉州|天津|西安|长沙|合肥|宁波|青岛|大连|佛山|东莞|无锡|常州|福州|昆明|南昌|沈阳|济南|哈尔滨|长春|南宁|贵阳|太原|石家庄/.test(item));
  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;

  lines.slice(1).forEach((line) => {
    if (line.startsWith("求职目标：") || line.startsWith("联系方式：")) return;
    if (/^技能[:：]/.test(line)) {
      current = { title: "技能关键词", lines: [line.replace(/^技能[:：]\s*/, "")] };
      sections.push(current);
      return;
    }
    if (sectionTitles.has(line)) {
      current = { title: line, lines: [] };
      sections.push(current);
      return;
    }
    if (!current) {
      current = { title: "个人优势", lines: [] };
      sections.push(current);
    }
    current.lines.push(line);
  });

  return {
    name,
    target,
    phone,
    email,
    city: [age, contactCity || inferredCity].filter(Boolean).join(" / "),
    sections: sections.filter((section) => section.lines.length > 0)
  };
}

function lineClassName(line: string) {
  if (/^\d+[.、]/.test(line)) return "resume-bullet numbered";
  if (/^-/.test(line)) return "resume-bullet";
  if (/^(20|19|项目\s*\d|「|【)/.test(line) || /[｜|]/.test(line)) {
    return "resume-entry-title";
  }
  return "resume-line";
}

export const ResumeDocument = memo(function ResumeDocument({ text, template, portraitDataUrl }: Props) {
  const parsed = parseResumeText(text);
  const visibleSections = parsed.sections.filter((section) => !hiddenDocumentSections.has(section.title));
  const templateClass = `resume-template-${template.id}`;

  return (
    <article className={`resume-document ${templateClass}`} style={{ "--resume-accent": template.accent } as CSSProperties}>
      <header className="resume-document-header">
        <div>
          <h2>{parsed.name}</h2>
          <p>{parsed.target}</p>
        </div>
        <ul aria-label="联系方式">
          {parsed.phone && <li>
            <Phone size={13} />
            {parsed.phone}
          </li>}
          {parsed.email && <li>
            <Mail size={13} />
            {parsed.email}
          </li>}
          {parsed.city && <li>
            <MapPin size={13} />
            {parsed.city}
          </li>}
        </ul>
        {portraitDataUrl && <img className="resume-document-portrait" src={portraitDataUrl} alt={`${parsed.name}的头像`} />}
      </header>

      <div className="resume-document-body">
        {visibleSections.map((section, sectionIndex) => (
          <section className="resume-section" key={`${section.title}-${sectionIndex}`}>
            <h3>{section.title}</h3>
            <div className="resume-section-content">
              {section.title === "技能关键词" ? (
                <div className="resume-skill-list">
                  {section.lines
                    .join("、")
                    .split(/、|，|,/)
                    .map((skill) => skill.trim())
                    .filter(Boolean)
                    .map((skill, skillIndex) => (
                      <span key={`${skill}-${skillIndex}`}>{skill}</span>
                    ))}
                </div>
              ) : (
                section.lines.map((line, index) => (
                  <p className={lineClassName(line)} key={`${section.title}-${index}`}>
                    {line.replace(/^-\s*/, "")}
                  </p>
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
});
