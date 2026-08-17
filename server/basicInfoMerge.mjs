// 基础信息合并：把用户填写的姓名/联系方式/教育信息确定性地合并进成稿，
// 保证"填了就有"，不依赖 AI 是否记得输出姓名行。

const nameLinePattern = /^姓\s*名\s*[:：]\s*(.+)$/;
const contactLinePattern = /^联系方式\s*[:：]\s*(.+)$/;
const educationSectionHeadingPattern = /^(?:教育背景|教育经历)$/;
// 没有教育栏目时的兜底插入位置：技能/证书等尾部栏目之前
const tailSectionHeadings = ["技能关键词", "专业技能", "技能与优势", "技能特长", "技能与工具", "技能清单", "技能", "证书", "荣誉", "获奖经历", "荣誉奖项", "奖项荣誉"];

const maxLengths = {
  name: 40,
  school: 80,
  major: 40,
  degree: 20,
  phone: 40,
  email: 120,
  city: 40
};

export function normalizeBasicInfo(raw) {
  const source = (raw && typeof raw === "object") ? raw : {};
  const pick = (key) => {
    const value = typeof source[key] === "string" ? source[key].trim() : "";
    const cap = maxLengths[key];
    return value ? value.slice(0, cap) : "";
  };
  return {
    name: pick("name"),
    school: pick("school"),
    major: pick("major"),
    degree: pick("degree"),
    phone: pick("phone"),
    email: pick("email"),
    city: pick("city")
  };
}

export function hasBasicInfo(basicInfo) {
  return Object.values(normalizeBasicInfo(basicInfo)).some(Boolean);
}

export function mergeBasicInfo(text, rawBasicInfo) {
  const info = normalizeBasicInfo(rawBasicInfo);
  const source = String(text || "").trim();
  if (!source || !hasBasicInfo(info)) return source;

  let lines = source.split(/\n+/).map((line) => line.trim()).filter(Boolean);

  // ---- 姓名：保证顶部有"姓名：xxx"行 ----
  if (info.name) {
    const firstLine = lines[0] || "";
    const firstNameMatch = firstLine.match(nameLinePattern);
    const firstNameValue = firstNameMatch ? firstNameMatch[1].replace(/\s+/g, "") : "";
    if (firstNameMatch) {
      if (firstNameValue !== info.name) lines[0] = `姓名：${info.name}`;
    } else if (firstLine === info.name) {
      // 顶部已是独立姓名行，保留
    } else if (isLikelyStandaloneName(firstLine)) {
      lines[0] = `姓名：${info.name}`;
    } else {
      lines.unshift(`姓名：${info.name}`);
    }
    // 去掉正文里多余的"姓名：xxx"行（保留顶部那一个）
    const target = `姓名：${info.name}`;
    lines = lines.filter((line, index) => index === 0 || !(nameLinePattern.test(line) && line.replace(/\s+/g, "") === target.replace(/\s+/g, "")));
  }

  // ---- 联系方式：保证"联系方式：电话｜邮箱"存在 ----
  const contactParts = [info.phone, info.email, info.city].filter(Boolean);
  if (contactParts.length > 0) {
    // 正文里已出现的部分不重复添加
    const missingParts = contactParts.filter((part) => !source.includes(part));
    if (missingParts.length > 0) {
      const contactIndex = lines.findIndex((line) => contactLinePattern.test(line));
      if (contactIndex >= 0) {
        const existing = lines[contactIndex].match(contactLinePattern)[1];
        const toAdd = missingParts.filter((part) => !existing.includes(part));
        if (toAdd.length > 0) {
          lines[contactIndex] = `联系方式：${[...existing.split(/[｜|]/), ...toAdd].join("｜")}`;
        }
      } else {
        const insertAt = (lines[0] && (nameLinePattern.test(lines[0]) || isLikelyStandaloneName(lines[0]))) ? 1 : 0;
        lines.splice(insertAt, 0, `联系方式：${missingParts.join("｜")}`);
      }
    }
  }

  // ---- 教育背景：保证学校/专业/学历出现在教育栏目（各自去重） ----
  const eduParts = [];
  if (info.school && !source.includes(info.school)) eduParts.push(`学校：${info.school}`);
  if (info.major && !source.includes(info.major)) eduParts.push(`专业：${info.major}`);
  if (info.degree && !source.includes(info.degree)) eduParts.push(`学历：${info.degree}`);
  if (eduParts.length > 0) {
    const educationLine = eduParts.join("｜");
    const headingIndex = lines.findIndex((line) => educationSectionHeadingPattern.test(line));
    if (headingIndex >= 0) {
      lines.splice(headingIndex + 1, 0, educationLine);
    } else {
      let insertIndex = lines.findIndex((line) => tailSectionHeadings.includes(line));
      if (insertIndex < 0) insertIndex = lines.length;
      lines.splice(insertIndex, 0, "教育背景", educationLine);
    }
  }

  return lines.join("\n");
}

function isLikelyStandaloneName(line) {
  if (!line) return false;
  if (nameLinePattern.test(line)) return true;
  if (/^(?:求职目标|求职意向|联系方式)\s*[:：]/.test(line)) return false;
  if (/[｜|]/.test(line)) return false;
  // 2-4 个中文字符的独立短行视为姓名行
  return /^[\u4e00-\u9fff·]{2,4}$/.test(line) && !/^(?:个人简历|求职简历|简历|求职者)$/.test(line);
}
