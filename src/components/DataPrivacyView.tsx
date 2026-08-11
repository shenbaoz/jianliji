import { useEffect, useState } from "react";
import { clearLocalResumeData, deleteAllCloudVersions, getStorageHealth, type StorageHealth } from "../services/storage";

type Props = {
  onBack: () => void;
  onCleared: () => void | Promise<void>;
};

const defaultHealth: StorageHealth = {
  online: false,
  mode: "unknown",
  label: "正在检测",
  persistent: false
};

export function DataPrivacyView({ onBack, onCleared }: Props) {
  const [health, setHealth] = useState<StorageHealth>(defaultHealth);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void getStorageHealth().then(setHealth);
  }, []);

  const handleClearLocal = async () => {
    if (!window.confirm("确定清除这台电脑浏览器里的简历缓存和历史版本吗？已经云端保存的版本不会因此删除。")) return;
    clearLocalResumeData();
    await onCleared();
    setMessage("本机浏览器缓存已清除。");
  };

  const handleDeleteCloud = async () => {
    if (!window.confirm("确定删除当前浏览器身份保存的全部云端简历版本和关联上传文件吗？此操作不可撤销。")) return;
    setMessage("正在删除云端数据…");
    try {
      await deleteAllCloudVersions();
      await onCleared();
      setMessage("云端简历版本、关联文件和本机缓存已删除。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "云端数据删除失败，请稍后重试。");
    }
  };

  return (
    <section className="apple-utility-page min-h-[calc(100vh-74px)] bg-[#fafafa] px-4 py-8 font-sans text-slate-900 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.03)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Data & Privacy</span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">数据与隐私</h1>
            <p className="mt-2 text-sm leading-7 text-slate-500">简历是敏感资料。这里直接说明保存位置、使用边界和删除方式。</p>
          </div>
          <button type="button" className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50" onClick={onBack}>
            返回工作台
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
            <span className={health.online ? "text-xs font-semibold text-emerald-600" : "text-xs font-semibold text-amber-600"}>
              {health.online ? "云端保存已可用" : "当前使用本机保存"}
            </span>
            <h2 className="mt-4 text-xl font-bold tracking-tight text-slate-950">{health.label}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              {health.mode === "mysql"
                ? "确认后的版本会保存到云端，并按当前浏览器身份隔离历史版本。"
                : health.mode === "file"
                  ? "确认后的版本会保存到服务端文件记录。"
                  : "当前只保存到这台电脑的浏览器缓存。换设备或清缓存后，历史版本可能不可见。"}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-100 bg-[#fcfcfc] p-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Mode</span>
                <strong className="mt-2 block text-sm text-slate-950">{health.mode}</strong>
              </div>
              <div className="rounded-xl border border-slate-100 bg-[#fcfcfc] p-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Persistence</span>
                <strong className="mt-2 block text-sm text-slate-950">{health.persistent ? "持久保存" : "本机临时"}</strong>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
            <h2 className="text-xl font-bold tracking-tight text-slate-950">我们怎么处理简历</h2>
            <div className="mt-5 grid gap-4">
              {[
                ["只为当前流程使用", "上传文件只用于读取文字、分析岗位差距和生成可校对草稿。"],
                ["第三方 AI 的数据边界", "生成草稿时会发送经历、学校、公司、项目和岗位 JD；姓名、手机号、邮箱、身份证号和详细地址会先脱敏。主服务为 DeepSeek，临时故障时可能使用 Kimi。"],
                ["不把岗位当事实", "JD 只帮助判断取舍。没有你确认过的经历，不会写进正式成稿。"],
                ["先本机后云端", "编辑时会先保留本机副本，云端可用时再同步保存，避免刷新丢稿。"],
                ["你可以清除本机缓存", "清除后，这台浏览器里的历史版本和意向记录会被移除。"]
              ].map(([title, desc]) => (
                <div key={title} className="rounded-xl border border-slate-100 bg-[#fcfcfc] p-4">
                  <strong className="text-sm text-slate-950">{title}</strong>
                  <p className="mt-2 text-xs leading-6 text-slate-500">{desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-amber-100 bg-amber-50 p-4">
              <strong className="text-sm text-amber-950">删除与保留</strong>
              <p className="mt-2 text-xs leading-6 text-amber-900/80">本机缓存可随时清除；云端版本和上传原文件需要通过下方的云端删除操作一并移除。服务器还会按保留期限自动清理过期上传文件。</p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={handleClearLocal}>
                  仅清除本机缓存
                </button>
                <button type="button" className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50" onClick={handleDeleteCloud}>
                  删除全部云端数据
                </button>
              </div>
              {message && <span className="text-xs font-medium text-emerald-700">{message}</span>}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
