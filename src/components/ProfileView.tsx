import { FolderOpen, Trash2 } from "lucide-react";
import { deleteVersion } from "../services/storage";
import type { SavedResumeVersion } from "../types";

type Props = {
  versions: SavedResumeVersion[];
  onRefresh: () => void | Promise<void>;
  onLoad: (version: SavedResumeVersion) => void;
};

export function ProfileView({ versions, onRefresh, onLoad }: Props) {
  return (
    <section className="min-h-[calc(100vh-74px)] bg-[#f6f7f4] px-4 py-6 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-6 border border-slate-200 bg-white p-6">
          <h1 className="text-3xl font-semibold tracking-tight">历史版本</h1>
          <p className="mt-3 text-sm leading-7 text-slate-500">每个岗位保留一份可继续打开、校对和导出的投递稿。</p>
        </div>

        <div className="border border-slate-200 bg-white">
          {versions.length === 0 ? (
            <div className="p-10 text-center">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">还没有保存版本</h2>
              <p className="mt-3 text-sm text-slate-500">完成一次校对并确认真实性后，可以在这里归档。</p>
            </div>
          ) : (
            versions.map((version) => (
              <article key={version.id} className="flex flex-col gap-4 border-b border-slate-200 p-6 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-400">{new Date(version.createdAt).toLocaleString()}</span>
                  <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">{version.targetRole}</h2>
                  <p className="mt-2 text-xs text-slate-500">
                    {version.candidateName} · 匹配度 {version.score}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="inline-flex h-10 items-center gap-2 rounded-sm border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => onLoad(version)}>
                    <FolderOpen size={14} />
                    打开
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-10 items-center gap-2 rounded-sm bg-slate-950 px-4 text-xs font-semibold text-white hover:bg-rose-700"
                    aria-label="删除版本"
                    onClick={async () => {
                      if (!window.confirm("确定删除这个历史版本吗？删除后无法恢复。")) return;
                      await deleteVersion(version.id);
                      await onRefresh();
                    }}
                  >
                    <Trash2 size={14} />
                    删除
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
