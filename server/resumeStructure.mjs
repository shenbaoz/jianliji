/**
 * 结构化简历解析：把纯文本简历解析为「章节 → 条目 → 行」三层结构，
 * 供 AI 精修 Prompt 使用，让模型清楚每条编号行的角色（章节标题/条目头/职责行），
 * 避免裸行编号导致的误判与结构丢失。
 */

const SECTION_PATTERN = /^(核心优势|个人优势|教育背景|教育经历|工作经历|工作经验|职业经历|实习经历|实习经验|项目经历|项目经验|校园经历|校园实践|校内经历|社会实践|实践经历|实践经验|兼职经历|兼职经验|经历|工作内容|技能|技能清单|技能与优势|证书|荣誉|自我评价|个人评价|获奖经历|相关经历|主要经历|专业技能|其他信息)\s*[:：]?$/;

const DATE_PATTERN = /(?:19|20)\d{2}\s*[./年-]\s*(?:\d{1,2}\s*[月/.\-])?\s*(?:至今|现在|今|当下)?|(?:至今|现在)\s*[—–-]\s*(?:19|20)\d{2}/;

const CONTACT_PATTERN = /^(邮箱|电话|手机|微信|联系|地址|籍贯|生日|年龄|性别|政治面貌)/;

export function parseResumeStructure(resumeText) {
  const rawLines = String(resumeText || "").split(/\r?\n/);
  const lines = rawLines.map((line) => line.trim()).filter(Boolean);
  const sections = [];
  let currentSection = null;
  let currentEntry = null;
  let pendingEntryLine = null;

  lines.forEach((line, index) => {
    const sectionMatch = line.match(SECTION_PATTERN);
    if (sectionMatch) {
      currentSection = {
        name: line.replace(/[:：]$/, ""),
        start: index,
        entries: [],
        standaloneLines: []
      };
      sections.push(currentSection);
      currentEntry = null;
      pendingEntryLine = null;
      return;
    }

    if (!currentSection) {
      currentSection = { name: "头部信息", start: 0, entries: [], standaloneLines: [] };
      sections.unshift(currentSection);
    }

    // 条目头：一行内同时含日期与公司/职位，或含职位与日期
    const isEntryHeader = DATE_PATTERN.test(line) && !CONTACT_PATTERN.test(line);
    const isLikelyRoleLine = /(?:实习生|专员|工程师|助理|经理|主管|负责人|运营|编辑|设计师|顾问|老师|店长|会计|出纳|程序员|开发|设计师|助教|班长|干事|部长|站长)/.test(line) && !SECTION_PATTERN.test(line);

    if (isEntryHeader && isLikelyRoleLine) {
      currentEntry = { header: line, start: index, bulletLines: [] };
      currentSection.entries.push(currentEntry);
      pendingEntryLine = null;
      return;
    }

    // 条目头可能是「日期 + 公司」两行或「公司 + 日期」格式：先暂存，若下一行是职位/职责则合并
    if (isEntryHeader) {
      if (pendingEntryLine !== null) {
        // 上一个暂存行未被后续行认领 → 视为独立条目头
        currentEntry = { header: lines[pendingEntryLine], start: pendingEntryLine, bulletLines: [] };
        currentSection.entries.push(currentEntry);
      }
      pendingEntryLine = index;
      return;
    }

    if (pendingEntryLine !== null) {
      currentEntry = { header: `${lines[pendingEntryLine]} ${line}`, start: pendingEntryLine, bulletLines: [] };
      currentSection.entries.push(currentEntry);
      pendingEntryLine = null;
      return;
    }

    if (currentEntry) currentEntry.bulletLines.push(index);
    else currentSection.standaloneLines.push(index);
  });

  // 处理末尾仍挂起的条目头
  if (pendingEntryLine !== null && currentSection) {
    currentSection.entries.push({ header: lines[pendingEntryLine], start: pendingEntryLine, bulletLines: [] });
  }

  // 归并 sections：头部信息若为空则移除
  const cleanSections = sections.filter((section) => section.name !== "头部信息" || section.entries.length || section.standaloneLines.length);

  return {
    lines,
    sections: cleanSections,
    entryCount: cleanSections.reduce((total, section) => total + section.entries.length, 0),
    // 行 → 角色标注（供 prompt 使用）
    lineRoles: buildLineRoles(lines, cleanSections)
  };
}

function buildLineRoles(lines, sections) {
  const roles = new Array(lines.length).fill("其他");
  for (const section of sections) {
    roles[section.start] = "章节标题";
    for (const entry of section.entries) {
      roles[entry.start] = `${section.name}·条目头`;
      for (const bulletIndex of entry.bulletLines) roles[bulletIndex] = `${section.name}·职责行`;
    }
    for (const index of section.standaloneLines) roles[index] = `${section.name}·内容行`;
  }
  return roles;
}

export function formatNumberedResumeWithRoles(resumeText) {
  const parsed = parseResumeStructure(resumeText);
  return parsed.lines.map((line, index) => {
    const role = parsed.lineRoles[index];
    return `${index}: [${role}] ${line}`;
  }).join("\n");
}
