import { randomUUID } from "node:crypto";

// 两个留资存储(文件版/MySQL 版)共用的字段规范化,保证语义一致。
const limits = {
  id: 64,
  source: 40,
  candidateName: 80,
  targetRole: 120,
  planId: 80,
  contact: 200,
  note: 2000,
  createdAt: 40
};

export function normalizeLead(lead) {
  if (!lead || typeof lead !== "object") {
    throw new Error("Interest payload is required");
  }

  const source = optionalText(lead.source).slice(0, limits.source);
  const planId = optionalText(lead.planId).slice(0, limits.planId);
  if (!source || !planId) {
    throw new Error("source and planId are required");
  }

  return {
    id: (optionalText(lead.id) || randomUUID()).slice(0, limits.id),
    createdAt: (optionalText(lead.createdAt) || new Date().toISOString()).slice(0, limits.createdAt),
    source,
    candidateName: optionalText(lead.candidateName).slice(0, limits.candidateName) || "未命名用户",
    targetRole: optionalText(lead.targetRole).slice(0, limits.targetRole) || "目标岗位",
    planId,
    contact: optionalText(lead.contact).slice(0, limits.contact),
    note: optionalText(lead.note).slice(0, limits.note)
  };
}

function optionalText(value) {
  return typeof value === "string" ? value.trim() : "";
}
