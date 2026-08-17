export const unlockPlans = [
  {
    id: "basic",
    name: "完整优化版",
    price: "9.9",
    description: "解锁完整改写内容、修改依据和可复制成稿。",
    features: ["整份简历重写", "问题诊断展开", "保留真实经历边界"]
  },
  {
    id: "jd-fit",
    name: "岗位定制版",
    price: "19.9",
    description: "围绕目标岗位要求重新排序重点，补足岗位关键词。",
    features: ["岗位关键词匹配", "项目经历强化", "投递版本生成"]
  },
  {
    id: "complete",
    name: "求职材料包",
    price: "29.9",
    description: "简历、求职信和面试自我介绍一次生成。",
    features: ["简历成稿", "求职信", "面试话术"]
  }
] as const;
