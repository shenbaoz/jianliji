export type CandidateType = "graduate" | "experienced" | "career-change";
export type RoleCategory = "tech" | "product" | "operations" | "content" | "design" | "business" | "functional";

export type GuidedQuestion = {
  id: string;
  question: string;
  reason: string;
  allowSkip: boolean;
  skipLabel: string;
};

export type MatchItem = {
  requirement: string;
  evidence: string;
  status: "matched" | "missing";
};

const skipLabel = "暂无相关经历，说明原因后跳过";

export function classifyRole(role: string, jobDescription = ""): RoleCategory {
  const text = `${role} ${jobDescription}`;
  if (/前端|后端|Java|React|TypeScript|JavaScript|开发|工程师|算法|测试开发|运维|数据库|小程序.{0,8}开发|开发.{0,8}小程序/.test(text)) return "tech";
  if (/产品经理|产品|需求|原型|PRD|用户体验|竞品/.test(text)) return "product";
  if (/剪辑|摄影|后期|编导|文案|编辑|新媒体|短视频|内容/.test(text)) return "content";
  if (/UI|视觉|平面|交互设计|设计师/.test(text)) return "design";
  if (/运营|投放|社群|私域|电商|店铺|活动|用户增长|小程序/.test(text)) return "operations";
  if (/销售|商务|客户成功|BD|市场/.test(text)) return "business";
  return "functional";
}

export function buildEvidenceQuestions(category: RoleCategory, candidateType: CandidateType): GuidedQuestion[] {
  const graduate = candidateType === "graduate";
  const opening: Record<RoleCategory, [string, string, string]> = {
    tech: ["技术项目", "性能、稳定性、接口耗时、交付质量或迭代效率", "模块分工、技术方案、联调和问题排查"],
    product: ["产品项目", "调研结论、原型数量、上线周期、使用反馈或转化变化", "需求判断、原型设计和推进协作"],
    operations: ["运营动作", "访问、点击、下单、转化、留存或复购", "活动策划、页面配置、用户触达和复盘"],
    content: ["作品或内容项目", "出片量、播放、互动、完成度、老师/客户评价或采用情况", "选题、脚本、拍摄剪辑和发布复盘"],
    design: ["设计项目", "页面/作品数量、组件沉淀、评审反馈或上线效果", "调研、方案、设计规范和交付协作"],
    business: ["业务项目", "客户数、沟通量、转化、回款或满意度", "获客、沟通、方案与跟进"],
    functional: ["代表性经历", "处理量、准确率、效率、评价或改善结果", "具体任务、协作和问题解决"]
  };
  const [subject, metric, contribution] = opening[category];
  const firstQuestion = graduate
    ? `选一段${subject}（课设、比赛、社团或作品也可以）：你实现了什么功能或产出？有没有${metric}；没有数据也没关系，可以写老师评价、比赛成绩或验收结果。`
    : `你最想展示的一段${subject}，有没有${metric}等可验证结果？可以填写大概区间。`;
  return [
    { id: "result", question: firstQuestion, reason: "把经历从职责描述变成可验证的结果。", allowSkip: true, skipLabel },
    { id: "contribution", question: `这段经历里你本人具体负责哪些部分？请拆清${contribution}。`, reason: "让招聘者看清你的个人贡献。", allowSkip: true, skipLabel },
    { id: "challenge", question: graduate ? "过程中最难的地方是什么？你如何解决，或从中学到了什么？" : "过程中最难的地方是什么？你如何判断问题并推动解决？", reason: "补足面试中可继续展开的真实细节。", allowSkip: true, skipLabel }
  ];
}

export function buildMatchItems(jobDescription: string, resumeText: string): MatchItem[] {
  const requirements = extractRequirements(jobDescription);
  return requirements.map((requirement) => {
    const matched = normalize(resumeText).includes(normalize(requirement));
    return { requirement, evidence: matched ? findEvidence(resumeText, requirement) : "简历中未体现", status: matched ? "matched" : "missing" };
  });
}

function extractRequirements(text: string) {
  const source = text.replace(/[；;。\n]/g, "、");
  const direct = source
    .split(/[、，,：:]/)
    .flatMap((item) => item.split(/与|和|及/))
    .map(cleanRequirement)
    .filter((item) => item && !isSectionHeading(item) && (/[A-Za-z]/.test(item) || /\d+年/.test(item) || /^[\u4e00-\u9fa5]{4,18}$/.test(item)));
  const chineseResponsibilities = text.match(/(?:协助|负责|支持|具备|能够|完成)[^；;。\n，,]{4,24}/g)?.map(cleanRequirement) || [];
  const skills = ["React", "Vue", "JavaScript", "TypeScript", "HTML", "CSS", "Java", "Python", "SQL", "Excel", "Figma", "Git", "Vite", "Webpack", "Node.js", "微信小程序"].filter((item) => {
    const pattern = item === "Java"
      ? /Java(?!Script)/i
      : new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    return pattern.test(text);
  });
  const experience = text.match(/\d+\s*年以上(?:工作)?经验/g) || [];
  const seen = new Set<string>();
  return [...skills, ...experience, ...direct, ...chineseResponsibilities]
    .filter((item) => !isSectionHeading(item))
    .filter((item) => item.length <= 24)
    .filter((item) => { const key = normalize(item); if (!key || seen.has(key)) return false; seen.add(key); return true; })
    .slice(0, 12);
}

function isSectionHeading(value: string) {
  return /^(?:岗位职责|工作职责|职位描述|任职要求|岗位要求|资格条件|职位要求|我们希望你|工作内容)$/.test(value.trim());
}

function cleanRequirement(value: string) {
  return value.trim().replace(/^(?:要求|熟悉|使用|具备|能够|负责|协助|支持)/, "").replace(/^(?:或|和|及)/, "").trim();
}

function findEvidence(resumeText: string, requirement: string) {
  const line = resumeText.split(/\n+/).find((item) => normalize(item).includes(normalize(requirement)));
  return line?.trim() || `已提及 ${requirement}`;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, "").replace(/[·、，,。.：:；;]/g, "");
}
