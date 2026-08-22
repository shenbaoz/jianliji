import { memo } from "react";
import type { CSSProperties } from "react";
import { Mail, MapPin, Phone } from "lucide-react";
import type { ResumeTemplate } from "../types";

type Props = {
  text: string;
  template: ResumeTemplate;
  portraitDataUrl?: string;
  candidateName?: string;
};

const sectionTitles = new Set([
  "个人优势",
  "核心优势",
  "工作经历 / 实习经历",
  "工作经历",
  "工作经验",
  "职业经历",
  "实习经历",
  "实习经验",
  "实习及项目经历",
  "项目与实习经历",
  "核心经历",
  "关键成果",
  "代表成果",
  "项目经历",
  "项目经验",
  "校园项目",
  "校园经历",
  "校园实践",
  "校内经历",
  "校园实践经历",
  "社会实践经历",
  "社会实践",
  "实践经历",
  "实践经验",
  "社会经历",
  "兼职经历",
  "兼职经验",
  "经历",
  "在校经历",
  "学生工作经历",
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

type PersonalInfo = {
  label: string;
  value: string;
};

const hiddenDocumentSections = new Set(["关键成果", "可继续补充的真实证据", "投递版本建议", "优化说明"]);

const CITY_KEYWORDS =
  "北京|上海|广州|深圳|杭州|成都|武汉|南京|苏州|厦门|重庆|郑州|三亚|泉州|天津|西安|长沙|合肥|宁波|青岛|大连|佛山|东莞|无锡|常州|福州|昆明|南昌|沈阳|济南|哈尔滨|长春|南宁|贵阳|太原|石家庄";
const CITY_RE = new RegExp(CITY_KEYWORDS);

function parseResumeText(text: string, candidateName?: string) {
  const rawLines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const inlineHeadings = [...sectionTitles].sort((left, right) => right.length - left.length);
  const lines = rawLines.flatMap((line) => {
    const match = inlineHeadings
      .map((heading) => ({ heading, index: line.indexOf(heading) }))
      .filter(({ index }) => index > 0 && /(?:\s|[：:])$/.test(line.slice(0, index)))
      .sort((left, right) => left.index - right.index)[0];
    if (!match) return [line];
    return [line.slice(0, match.index).trim(), line.slice(match.index).trim()].filter(Boolean);
  });

  // 1) 优先从正文里提取"姓名：XXX"这一行作为姓名
  const explicitNameMatch = lines
    .map((line) => line.match(/^姓\s*名\s*[:：]\s*(.+)$/))
    .find(Boolean) as RegExpMatchArray | undefined;
  const explicitName = explicitNameMatch ? explicitNameMatch[1].trim() : "";

  const firstLine = lines[0] || "";
  const firstLineParts = firstLine.split(/｜|\|/).map((item) => item.trim()).filter(Boolean);

  // 首行如果是"求职目标/求职意向/联系方式/姓名："这类元信息行，不算姓名行
  const isMetaFirstLine = /^(?:求职目标|求职意向|联系方式|姓\s*名)\s*[:：]/.test(firstLine);

  // 姓名优先级：显式 candidateName > 正文里的"姓名：XXX" > 首行非元信息时的首段 > "求职者"
  let name = "求职者";
  if (candidateName?.trim()) {
    name = candidateName.trim();
  } else if (explicitName) {
    name = explicitName;
  } else if (!isMetaFirstLine) {
    name = firstLineParts[0] || "求职者";
  }

  const inferredCity = firstLineParts.find((item) => CITY_RE.test(item));

  // 目标岗位：只有真实存在求职意向/求职目标才展示；否则不展示（避免给用户看到"目标岗位"四个字）
  let target = "";
  const jobTargetMatch = lines
    .map((line) => line.match(/^(?:求职目标|求职意向|目标岗位)\s*[:：]\s*(.+)$/))
    .find(Boolean) as RegExpMatchArray | undefined;
  if (jobTargetMatch) {
    target = jobTargetMatch[1].trim();
  }
  if (!target && !isMetaFirstLine) {
    const rest = firstLineParts.slice(1).join(" / ").trim();
    // 过滤掉明显不是岗位名称的内容（电话、邮箱、城市、年龄等）
    const looksLikeRole =
      rest &&
      !/^\d/.test(rest) &&
      !/@/.test(rest) &&
      !CITY_RE.test(rest) &&
      !/\d+\s*岁/.test(rest) &&
      !/1[3-9]\d/.test(rest);
    if (looksLikeRole) target = rest;
  }

  const personalInfo = lines.flatMap(extractPersonalInfo);

  const contactLine = lines.find((line) => line.startsWith("联系方式：")) || "";
  const contactParts = contactLine.replace("联系方式：", "").split(/｜|\|/).map((item) => item.trim()).filter(Boolean);
  const phone = contactParts.find((item) => /1[3-9]\d[- ]?\d{4}[- ]?\d{4}/.test(item)) || "";
  const email = contactParts.find((item) => /@/.test(item)) || "";
  const age = contactParts.find((item) => /\d+\s*岁/.test(item));
  const contactCity = contactParts.find((item) => CITY_RE.test(item));

  // 个人信息字段标签：这些行属于基本信息区，绝不允许混进section里
  // 支持 "政治面貌：共青团员" 完整冒号格式，以及跨行拆分的单字行如"性"/"别"/"籍"/"贯"
  const personalFieldLineRe =
    /^(?:姓\s*名|名|性\s*别|别|政治面貌|籍\s*贯|贯|出生年月|出生日期|出生|年龄|婚否|婚姻状况|身高|体重|血型|户口|身份证|住址|通讯地址|地址|邮编|邮政编码|国籍|民族|电话|手机|联系方式|电子邮箱|邮箱|电\s*邮|E-mail|Email|电子邮件|求职意向|求职目标|目标岗位|期望职位|期望工作|期望地点|期望城市|期望薪资|薪资要求|可到岗时间|入职时间|毕业时间|毕业年份|毕业院校|学\s*历|专\s*业|学位|学院|系别|研究方向|导师|学制|学号|院\s*校|政治\s*面貌)\s*[:：]/;
  const personalSingleCharRe = /^(?:性|别|籍|贯|姓|名|学|专|电|邮|院|校)$/;
  function isPersonalInfoLine(line: string) {
    const t = line.trim();
    if (!t) return true;
    if (personalFieldLineRe.test(t)) return true;
    if (personalSingleCharRe.test(t)) return true;
    return false;
  }

  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;

  lines.slice(1).forEach((line) => {
    if (/^(?:求职目标|求职意向|目标岗位|联系方式|姓\s*名)\s*[:：]/.test(line)) return;
    // 修复：个人信息字段行（政治面貌/性别/籍贯/名/性/别等）不得混入"个人优势"等section
    if (isPersonalInfoLine(line)) return;
    const normalizedHeading = line.replace(/[：:]\s*$/, "");
    if (/^技能[:：]/.test(line)) {
      current = { title: "技能关键词", lines: [line.replace(/^技能[:：]\s*/, "")] };
      sections.push(current);
      return;
    }
    if (sectionTitles.has(normalizedHeading)) {
      current = { title: normalizedHeading, lines: [] };
      sections.push(current);
      return;
    }
    // 部分 PDF 的蓝色栏目条是图片，提取文字时会丢失标题。遇到“专业技能”
    // 后的日期行，开始一段实践经历，避免把教育和经历误称为个人优势。
    if (current?.title === "专业技能" && /^(?:19|20)\d{2}[.\-/]/.test(line)) {
      current = { title: "实践经历", lines: [] };
      sections.push(current);
    }
    // 没有栏目标题的 PDF 不能把所有日期行默认当成教育经历：
    // 教育段之后出现公司/职位日期行时，单独开启工作经历栏目。
    if (current && isEducationSection(current.title) && looksLikeExperienceLine(line)) {
      current = { title: "工作经历", lines: [] };
      sections.push(current);
    }
    if (!current) {
      current = { title: looksLikeEducationLine(line) ? "教育背景" : looksLikeExperienceLine(line) ? "工作经历" : "简历内容", lines: [] };
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
    personalInfo,
    sections: sections.filter((section) => section.lines.length > 0)
  };
}

function looksLikeEducationLine(line: string) {
  return /^(?:19|20)\d{2}[.\-/]/.test(line) || /(?:大学|学院|本科|硕士|博士)/.test(line);
}

function isEducationSection(title: string) {
  return title === "教育背景" || title === "教育经历";
}

function looksLikeExperienceLine(line: string) {
  if (!/^(?:19|20)\d{2}/.test(line) || /(?:大学|学院|本科|硕士|博士)/.test(line)) return false;
  return /(?:公司|集团|工作室|机构|门店|医院|学校|运营|专员|工程师|助理|经理|主管|负责人|编辑|设计师|程序员|开发|教师|老师|客服|销售|实习)/.test(line);
}

function extractPersonalInfo(line: string): PersonalInfo[] {
  const labelPattern = /(?:性别|别|政治面貌|籍贯|出生年月|出生日期|出生|年龄|电子邮箱|邮箱|E-mail|Email)\s*[:：]/g;
  const matches = [...line.matchAll(labelPattern)];
  return matches.map((match, index) => {
    const rawLabel = match[0].replace(/\s*[:：]$/, "");
    const label = rawLabel === "别" ? "性别" : rawLabel;
    const value = line.slice((match.index || 0) + match[0].length, matches[index + 1]?.index).trim();
    return { label, value };
  }).filter((item) => item.value);
}

function lineClassName(line: string) {
  if (/^\d+[.、]/.test(line)) return "resume-bullet numbered";
  if (/^-/.test(line)) return "resume-bullet";
  if (/(?:19|20)\d{2}[.年/\-]/.test(line) || /[｜|]/.test(line) || /^(项目\s*\d|「|【)/.test(line)) {
    return "resume-entry-title";
  }
  return "resume-line";
}

export const ResumeDocument = memo(function ResumeDocument({ text, template, portraitDataUrl, candidateName }: Props) {
  const parsed = parseResumeText(text, candidateName);
  const visibleSections = parsed.sections.filter((section) => !hiddenDocumentSections.has(section.title));
  const templateClass = `resume-template-${template.id}`;

  return (
    <article className={`resume-document ${templateClass}`} style={{ "--resume-accent": template.accent } as CSSProperties}>
      <header className="resume-document-header">
        <div>
          <h2>{parsed.name}</h2>
          {parsed.target && parsed.target !== "目标岗位" && <p>{parsed.target}</p>}
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
        {parsed.personalInfo.length > 0 && (
          <section className="resume-section">
            <h3>基础信息</h3>
            <div className="resume-section-content">
              {parsed.personalInfo.map((item, index) => (
                <p className="resume-line" key={`${item.label}-${index}`}>{item.label}：{item.value}</p>
              ))}
            </div>
          </section>
        )}
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
