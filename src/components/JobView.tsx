import { ArrowLeft, Play } from "lucide-react";
import { PageShell } from "./ProductShell";
import type { ResumeInput } from "../types";

type Props = {
  input: ResumeInput;
  onChange: (input: ResumeInput) => void;
  onBack: () => void;
  onAnalyze: () => void;
  isGenerating: boolean;
};

export function JobView({ input, onChange, onBack, onAnalyze, isGenerating }: Props) {
  const resumeReady = input.resumeText.trim().length > 20;
  const canAnalyze = resumeReady && input.targetRole.trim().length > 1;

  return (
    <PageShell
      active="job"
      title="填写求职方向"
      description="填一类相近岗位，生成一份通用投递版简历。"
      actions={
        <div className="flex gap-2">
          <button type="button" className="inline-flex h-10 items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={onBack}>
            <ArrowLeft size={14} />
            返回简历
          </button>
          <button type="button" className="inline-flex h-10 items-center gap-2 rounded-sm bg-slate-950 px-4 text-xs font-semibold text-white hover:bg-[#173c33] disabled:bg-slate-300" onClick={onAnalyze} disabled={!canAnalyze || isGenerating}>
            {isGenerating ? "正在精修…" : "生成通用投递版"}
            <Play size={14} />
          </button>
        </div>
      }
    >
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div>
          <label className="block bg-slate-50 p-5">
            <span className="text-xs font-semibold text-slate-500">求职方向</span>
            <p className="mt-2 text-xs text-slate-500">填一类相近岗位，不用填写公司 JD。</p>
            <input
              id="target-role-input"
              className="mt-3 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-sky-700"
              value={input.targetRole}
              onChange={(event) => onChange({ ...input, targetRole: event.target.value, jobDescription: "" })}
              placeholder="例如：内容运营、新媒体运营"
            />
          </label>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-600">基于真实经历，适合投递相近岗位。</p>
          <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-sky-700 px-5 text-xs font-semibold text-white hover:bg-sky-800 disabled:bg-slate-300" onClick={onAnalyze} disabled={!canAnalyze || isGenerating}>
            {isGenerating ? "正在精修…" : "生成通用投递版"}
            <Play size={14} />
          </button>
        </div>
      </div>
    </PageShell>
  );
}
