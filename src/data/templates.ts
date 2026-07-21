import type { ResumeTemplate } from "../types";

export const resumeTemplates: ResumeTemplate[] = [
  {
    id: "fresh",
    name: "应届生清爽单页",
    category: "应届生",
    description: "突出教育背景、校园项目和可迁移能力。",
    accent: "#0f8f7f"
  },
  {
    id: "career-change",
    name: "转行能力迁移",
    category: "转行",
    description: "弱化行业差异，强调目标岗位相关证据。",
    accent: "#2563eb"
  },
  {
    id: "internet-ops",
    name: "互联网运营结果导向",
    category: "运营/市场",
    description: "适合用户增长、社群、新媒体和活动运营。",
    accent: "#d97706"
  },
  {
    id: "product",
    name: "产品经理项目型",
    category: "产品",
    description: "强调需求分析、协作推进和产品结果。",
    accent: "#7c3aed"
  },
  {
    id: "engineer",
    name: "技术岗工程实践",
    category: "技术开发",
    description: "突出技术栈、项目复杂度和工程成果。",
    accent: "#0f766e"
  },
  {
    id: "business",
    name: "商务专业版",
    category: "通用",
    description: "稳重、克制，适合正式投递场景。",
    accent: "#334155"
  }
];
