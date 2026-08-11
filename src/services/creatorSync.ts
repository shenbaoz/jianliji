export type CreatorSyncResult = "synced" | "server-error" | "network-error";

export function creatorSyncMessage(result: CreatorSyncResult) {
  if (result === "synced") return "草稿已自动保存";
  if (result === "network-error") return "网络不可用，内容仍保存在此设备";
  return "同步未完成，内容仍保存在此设备";
}
