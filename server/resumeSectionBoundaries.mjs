const EXPERIENCE_HEADINGS = new Set([
  "工作经历",
  "工作经验",
  "职业经历",
  "实习经历",
  "实习经验",
  "项目经历",
  "项目经验",
  "校园经历",
  "校园实践",
  "校内经历",
  "社会实践",
  "实践经历",
  "实践经验",
  "兼职经历",
  "兼职经验",
  "经历",
  "相关经历",
  "主要经历"
]);

const ALL_SECTION_HEADINGS = new Set([
  ...EXPERIENCE_HEADINGS,
  "核心优势",
  "个人优势",
  "教育背景",
  "教育经历",
  "技能",
  "技能清单",
  "技能与优势",
  "专业技能",
  "证书",
  "荣誉",
  "获奖经历",
  "自我评价",
  "个人评价",
  "其他信息"
]);

function headingOf(line) {
  return String(line || "").trim().replace(/[：:]\s*$/, "");
}

function extractExperienceBlocks(text) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const heading = headingOf(lines[index]);
    if (!EXPERIENCE_HEADINGS.has(heading)) continue;
    const content = [];
    let cursor = index + 1;
    while (cursor < lines.length && !ALL_SECTION_HEADINGS.has(headingOf(lines[cursor]))) {
      content.push(lines[cursor]);
      cursor += 1;
    }
    if (content.length > 0) blocks.push([heading, ...content]);
    index = cursor - 1;
  }
  return blocks;
}

function hasExperienceHeading(text) {
  return String(text || "")
    .split(/\r?\n/)
    .some((line) => EXPERIENCE_HEADINGS.has(headingOf(line)));
}

export function preserveExperienceSections(draftText, sourceText) {
  const draft = String(draftText || "").trim();
  if (!draft) return draft;
  if (hasExperienceHeading(draft)) return draft;

  const blocks = extractExperienceBlocks(sourceText);
  if (blocks.length === 0) return draft;

  return `${draft}\n\n${blocks.map((block) => block.join("\n")).join("\n\n")}`.trim();
}

const SECTION_HEADING_PATTERN = "核心优势|个人优势|教育背景|教育经历|工作经历|工作经验|职业经历|实习经历|实习经验|项目经历|项目经验|校园经历|校园实践|校内经历|社会实践|实践经历|实践经验|兼职经历|兼职经验|经历|相关经历|主要经历|技能|技能清单|技能与优势|专业技能|证书|荣誉|获奖经历|自我评价|个人评价|其他信息";

export function normalizeSectionHeadingLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .flatMap((line) => {
      let current = line.trim();
      if (!current) return [""];
      for (const heading of ALL_SECTION_HEADINGS) {
        const spacedHeading = new RegExp(heading.split("").map((character) => character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*"), "g");
        current = current.replace(spacedHeading, heading);
      }
      const headingAtEnd = new RegExp(`^(.+?)\\s+(${SECTION_HEADING_PATTERN})\\s*[:：]?\\s*$`);
      const headingBeforeList = new RegExp(`^(.+?)\\s+(${SECTION_HEADING_PATTERN})\\s*[:：]?\\s+([-•*·▪●]|\\d+[.)、])`);
      const headingBeforeEntry = new RegExp(`^(.+?)\\s+(${SECTION_HEADING_PATTERN})\\s*(?:[:：]\\s*)?(.+)$`);
      const headingAtStart = new RegExp(`^(${SECTION_HEADING_PATTERN})\\s*[:：]?\\s+([-•*·▪●]|\\d+[.)、])\\s*(.*)$`);
      const endMatch = current.match(headingAtEnd);
      if (endMatch) return [endMatch[1].trim(), endMatch[2]];
      const beforeListMatch = current.match(headingBeforeList);
      if (beforeListMatch) return [beforeListMatch[1].trim(), beforeListMatch[2], `${beforeListMatch[3]}${current.slice(beforeListMatch[0].length)}`.trim()];
      const beforeEntryMatch = current.match(headingBeforeEntry);
      if (beforeEntryMatch && /^(?:[-•*·▪●]|\d{4}[./年]|[\u4e00-\u9fff]{2,20}(?:大学|学院|研究所|研究院|科学院|气象局|公司|中心|学校|单位))/.test(beforeEntryMatch[3].trim())) {
        return [beforeEntryMatch[1].trim(), beforeEntryMatch[2], beforeEntryMatch[3].trim()];
      }
      const startMatch = current.match(headingAtStart);
      if (startMatch) return [startMatch[1], `${startMatch[2]} ${startMatch[3]}`.trim()];
      return [current];
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
