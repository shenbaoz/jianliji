import type { ResumeTemplate } from "../types";

export const resumeTemplates: ResumeTemplate[] = [
  {
    id: "fresh",
    name: "应届生·清爽单页",
    category: "应届生",
    description: "教育背景、校园项目、可迁移能力。",
    accent: "#0f8f7f"
  },
  {
    id: "career-change",
    name: "转行·能力迁移",
    category: "转行",
    description: "弱化差异，强调岗位证据。",
    accent: "#2563eb"
  },
  {
    id: "internet-ops",
    name: "运营·结果导向",
    category: "运营/市场",
    description: "用户增长、社群、新媒体、活动运营。",
    accent: "#d97706"
  },
  {
    id: "product",
    name: "产品·项目型",
    category: "产品",
    description: "需求分析、协作推进、产品结果。",
    accent: "#7c3aed"
  },
  {
    id: "engineer",
    name: "技术·工程实践",
    category: "技术开发",
    description: "技术栈、项目复杂度、工程成果。",
    accent: "#0f766e"
  },
  {
    id: "business",
    name: "商务·专业版",
    category: "通用",
    description: "稳重克制，正式投递。",
    accent: "#334155"
  }
];
