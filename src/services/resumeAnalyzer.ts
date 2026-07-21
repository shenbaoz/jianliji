import type {
  AnalysisReport,
  FollowUpQuestion,
  OptimizedResume,
  ResumeInput
} from "../types";

const keywordBank = [
  "React",
  "TypeScript",
  "JavaScript",
  "数据",
  "增长",
  "运营",
  "用户",
  "项目",
  "沟通",
  "协作",
  "复盘",
  "转化",
  "留存",
  "产品",
  "需求",
  "设计",
  "后端",
  "前端",
  "Python",
  "SQL",
  "AIGC",
  "AI",
  "内容",
  "社群",
  "活动",
  "销售",
  "客户"
];

const hasMetric = (text: string) => /(\d+|%|万|千|百|提升|降低|增长|减少|超过|累计)/.test(text);

export function analyzeResume(input: ResumeInput): AnalysisReport {
  const resume = input.resumeText || "";
  const jd = input.jobDescription || "";
  const matchedKeywords = keywordBank.filter(
    (word) =>
      resume.toLowerCase().includes(word.toLowerCase()) &&
      jd.toLowerCase().includes(word.toLowerCase())
  );
  const missingKeywords = keywordBank
    .filter(
      (word) =>
        jd.toLowerCase().includes(word.toLowerCase()) &&
        !resume.toLowerCase().includes(word.toLowerCase())
    )
    .slice(0, 8);

  const lengthScore = Math.min(24, Math.round(resume.length / 80));
  const keywordScore = Math.min(38, matchedKeywords.length * 6);
  const metricScore = hasMetric(resume) ? 18 : 6;
  const structureScore = /项目|经历|教育|技能|实习|工作/.test(resume) ? 16 : 8;
  const score = Math.max(38, Math.min(96, lengthScore + keywordScore + metricScore + structureScore));

  const issues = [
    !hasMetric(resume) ? "经历里缺少数字结果，HR 很难判断影响力。" : "",
    missingKeywords.length ? `目标岗位提到 ${missingKeywords.slice(0, 3).join("、")}，简历里还没有明显覆盖。` : "",
    resume.length < 260 ? "简历内容偏短，项目细节和个人贡献可能不够充分。" : "",
    !/负责|参与|独立|主导|协作|优化|搭建/.test(resume)
      ? "经历动作不够清晰，建议补充你具体做了什么。"
      : ""
  ].filter(Boolean);

  return {
    score,
    level: score >= 82 ? "高" : score >= 62 ? "中" : "低",
    matchedKeywords: matchedKeywords.slice(0, 10),
    missingKeywords,
    strengths: [
      matchedKeywords.length ? "简历已经覆盖部分目标岗位关键词。" : "已有基础经历，可以进一步向目标岗位靠拢。",
      hasMetric(resume) ? "简历包含部分数据结果，适合继续强化成果表达。" : "经历内容可以通过追问补充量化证据。",
      "当前内容适合生成一版岗位定制简历。"
    ],
    issues: issues.length ? issues : ["整体基础不错，下一步重点提升岗位相关性和表达密度。"],
    fixes: [
      "优先把最匹配目标岗位的项目放到前面。",
      "把职责描述改成“动作 + 方法 + 结果”的表达。",
      "补充人数、次数、增长、转化、效率等可验证信息。",
      "删除和目标岗位关系较弱的泛泛描述。"
    ],
    skillScores: keywordBank.slice(0, 10).map((label) => ({
      label,
      score: jd.includes(label) ? (resume.includes(label) ? 88 : 48) : Math.max(42, 70 - label.length * 2)
    }))
  };
}

export function generateFollowUpQuestions(input: ResumeInput, report: AnalysisReport): FollowUpQuestion[] {
  const jd = `${input.targetRole} ${input.jobDescription}`;
  const base: FollowUpQuestion[] = [
    {
      id: "metric",
      question: "你最想重点展示的一段经历，有没有人数、金额、增长率、阅读量、转化率或效率提升数据？",
      reason: "把普通职责变成更可信的结果表达。"
    },
    {
      id: "role",
      question: "这段经历里，哪些事情是你本人独立完成或主要负责的？",
      reason: "避免简历只写团队成果，看不出你的个人贡献。"
    },
    {
      id: "difficulty",
      question: "这个项目当时最难的地方是什么，你用了什么方法解决？",
      reason: "补充解决问题能力，让经历更像面试可追问的材料。"
    }
  ];

  if (report.missingKeywords.length) {
    base.push({
      id: "keywords",
      question: `目标岗位很看重 ${report.missingKeywords.slice(0, 3).join("、")}，你有没有相关经历可以补充？`,
      reason: "补齐岗位关键词，提高岗位匹配度。"
    });
  }

  if (/前端|后端|Java|React|TypeScript|测试|软件|工程师/.test(jd)) {
    base.push({
      id: "tech-depth",
      question: "这个技术项目里，你遇到过最具体的技术难点是什么？例如性能、接口、状态管理、数据库、并发或测试问题。",
      reason: "技术岗需要看到工程难度，而不只是写用了哪些技术栈。"
    });
  }

  if (/运营|新媒体|社群|内容|市场|品牌|销售|客户/.test(jd)) {
    base.push({
      id: "growth-result",
      question: "这段运营/市场经历有没有曝光、阅读、粉丝、转化、成交、到场或留存数据？哪怕是大概区间也可以。",
      reason: "运营市场岗最需要用数据证明结果。"
    });
  }

  if (/产品|需求|用户体验|原型|竞品/.test(jd)) {
    base.push({
      id: "product-thinking",
      question: "你做需求或原型时，依据是什么？来自用户反馈、数据、竞品、业务目标，还是团队讨论？",
      reason: "产品岗需要体现判断依据和取舍能力。"
    });
  }

  if (/金融|投研|咨询|商业分析|财务|数据分析/.test(jd)) {
    base.push({
      id: "analysis-output",
      question: "你最终产出了什么分析结果？例如报告页数、图表、结论、建议，或被团队采用的判断。",
      reason: "分析类岗位需要展示信息整理后的结论产出。"
    });
  }

  return base.slice(0, 6);
}

export function generateOptimizedResume(
  input: ResumeInput,
  report: AnalysisReport,
  answers: Record<string, string>
): OptimizedResume {
  const role = input.targetRole || "目标岗位";
  const evidence = Object.values(answers).filter(Boolean).join("；");
  const keywords = [...report.matchedKeywords, ...report.missingKeywords.slice(0, 4)].filter(Boolean);
  const summary = `面向${role}的求职者，具备${keywords.slice(0, 5).join("、") || "项目执行、沟通协作、学习转化"}相关基础，能够结合岗位要求完成任务拆解、执行推进和结果复盘。`;

  const blocks = [
    {
      title: "个人简介",
      before: input.resumeText.split("\n").find(Boolean) || "暂无明确个人简介。",
      after: summary
    },
    {
      title: "核心经历",
      before: input.resumeText.slice(0, 130) || "暂无经历内容。",
      after: `围绕${role}要求，梳理已有经历中的关键任务，突出个人负责部分、执行方法与结果产出。${evidence ? `补充证据：${evidence}` : "建议继续补充量化数据和个人贡献。"}`.slice(0, 260)
    },
    {
      title: "技能清单",
      before: report.matchedKeywords.join("、") || "技能关键词不明显。",
      after: keywords.length ? keywords.join("、") : "岗位关键词、工具技能、项目能力、沟通协作"
    }
  ];

  const fullText = [
    input.candidateName || "求职者",
    `求职目标：${role}`,
    "",
    "个人优势",
    summary,
    "",
    "核心经历",
    blocks[1].after,
    "",
    "技能关键词",
    blocks[2].after,
    "",
    "优化说明",
    "以上内容基于用户提供的简历、岗位 JD 和补充回答生成，正式投递前请核对所有数据真实性。"
  ].join("\n");

  return {
    summary,
    skills: keywords,
    blocks,
    fullText,
    interviewScript: [
      `我正在投递${role}，过往经历中和岗位最相关的是项目执行、问题拆解和结果复盘。`,
      "如果面试官追问项目细节，可以按“背景、任务、行动、结果”的顺序回答。",
      evidence ? `可重点展开的证据：${evidence}` : "建议补充一个最有代表性的项目数据，作为面试时的主要案例。"
    ]
  };
}
