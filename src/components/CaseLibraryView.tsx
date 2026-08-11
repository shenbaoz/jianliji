import { memo, useMemo, useState } from "react";
import { ArrowLeft, FileSearch } from "lucide-react";
import { filterSampleCases, sampleResumeCases } from "../data/sampleCases";
import type { SampleResumeCase, WorkflowStep } from "../types";
import { classifyRole } from "../services/careerGuidance";

type Props = {
  onBackHome: () => void;
  onNavigate: (step: WorkflowStep) => void;
  onLoadSample: (sample: SampleResumeCase, nextStep?: WorkflowStep) => void;
};

export const CaseLibraryView = memo(function CaseLibraryView({ onBackHome, onNavigate, onLoadSample }: Props) {
  const [activeType, setActiveType] = useState("全部");
  const [audience, setAudience] = useState<"全部" | "应届/实习" | "社招">("全部");
  const [selected, setSelected] = useState<SampleResumeCase | null>(null);
  const typicalCases = useMemo(() => getTypicalCases(), []);
  const caseTypes = useMemo(() => ["全部", ...Array.from(new Set(typicalCases.map((item) => classifyRole(item.targetRole, item.jobDescription))))], [typicalCases]);
  const filteredCases = filterSampleCases(typicalCases, activeType, audience);

  const changeType = (type: string) => {
    setActiveType(type);
  };

  return (
    <section className="apple-utility-page min-h-[calc(100vh-56px)] bg-slate-50 px-5 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <button type="button" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-sky-800" onClick={onBackHome}>
              <ArrowLeft size={16} />
              返回首页
            </button>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">案例库</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">先查看完整样稿，再决定是否用它体验匹配流程。姓名和公司均已打码。</p>
          </div>
          <button type="button" className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-100" onClick={() => onNavigate("workspace")}>
            <FileSearch size={16} />
            导入我的简历
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {["全部", "应届/实习", "社招"].map((item) => <button type="button" key={item} className={audience === item ? "rounded-full bg-[#1a3c34] px-4 py-2 text-xs font-semibold text-white" : "rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"} onClick={() => setAudience(item as typeof audience)}>{item}</button>)}
        </div>
        <div className="mb-6 flex flex-wrap gap-2">
          {caseTypes.map((type) => (
            <button
              type="button"
              key={type}
              className={activeType === type ? "rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white" : "rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"}
              onClick={() => changeType(type)}
            >
              {type === "全部" ? "全部方向" : ({ tech: "技术", product: "产品", operations: "运营", content: "内容", design: "设计", business: "市场/销售", functional: "职能" }[type] || type)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredCases.map((item, index) => (
            <article key={item.id} className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm hover:-translate-y-0.5 hover:shadow-lg">
              <button type="button" className="block w-full text-left" onClick={() => setSelected(item)}>
                <CaseResumeThumbnail item={item} accent={getCaseAccent(index)} />
              </button>
              <div className="border-t border-slate-200 p-5">
                <span className="text-xs font-medium text-slate-500">{item.candidateType === "graduate" || /应届|实习|在校/.test(item.resumeText) ? "应届 / 实习" : "社招"} · {item.userType}</span>
                <h2 className="mt-2 text-base font-bold leading-snug text-slate-900">{item.title}</h2>
                <p className="mt-2 min-h-14 text-sm leading-6 text-slate-600">{item.summary}</p>
                <div className="mt-4 flex gap-4"><button type="button" className="text-sm font-semibold text-sky-700 hover:text-sky-900" onClick={() => setSelected(item)}>查看简历</button><button type="button" className="text-sm font-semibold text-slate-700 hover:text-slate-950" onClick={() => onLoadSample(item, "analysis")}>以此为模板优化 →</button></div>
              </div>
            </article>
          ))}
        </div>
        {filteredCases.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <strong className="text-base text-slate-900">当前筛选下暂无案例</strong>
            <p className="mt-2 text-sm text-slate-500">可以查看全部方向，或直接导入你的简历开始分析。</p>
            <button type="button" className="mt-5 rounded-md bg-[#1a3c34] px-5 py-2.5 text-sm font-semibold text-white" onClick={() => { setActiveType("全部"); setAudience("全部"); }}>
              查看全部案例
            </button>
          </div>
        )}
        {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-5" onClick={() => setSelected(null)}><article className="max-h-[88vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-7 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-5 border-b border-slate-200 pb-5"><div><p className="text-xs text-slate-500">只读样稿</p><h2 className="mt-1 text-xl font-bold">{selected.title}</h2></div><button type="button" className="text-sm text-slate-500" onClick={() => setSelected(null)}>关闭</button></div><pre className="whitespace-pre-wrap py-6 text-sm leading-7 text-slate-700">{selected.resumeText}</pre><div className="border-t border-slate-200 pt-5"><button type="button" className="rounded-md bg-[#1a3c34] px-4 py-2 text-sm font-semibold text-white" onClick={() => onLoadSample(selected, "analysis")}>以此为模板优化</button></div></article></div>}
      </div>
    </section>
  );
});

function getTypicalCases() {
  const ids = [
    "graduate-data-analyst",
    "shared-student-project-resume",
    "graduate-frontend",
    "graduate-product",
    "graduate-content",
    "graduate-marketing",
    "shared-data-analyst-resume",
    "shared-product-manager-resume",
    "shared-backend-resume",
    "mini-program-ops-local-life",
    "mini-program-frontend",
    "taobao-tmall-ops",
    "pinduoduo-ops",
    "meituan-dianping-ops",
    "shared-hr-recruiter-resume",
    "shared-accountant-resume",
    "shared-editor-resume"
  ];
  const featured = ids
    .map((id) => sampleResumeCases.find((item) => item.id === id))
    .filter((item): item is SampleResumeCase => Boolean(item));
  const featuredIds = new Set(featured.map((item) => item.id));
  return [...featured, ...sampleResumeCases.filter((item) => !featuredIds.has(item.id))];
}

export function CaseResumeThumbnail({ item, accent }: { item: SampleResumeCase; accent: string }) {
  const lines = getResumePreviewLines(item.resumeText);
  return (
    <div className="h-72 bg-slate-100 p-4">
      <div className="mx-auto h-full max-w-[190px] overflow-hidden bg-white px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.15)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold leading-none" style={{ color: accent }}>
              个人简历
            </p>
            <div className="mt-2 h-1.5 w-24" style={{ background: accent }} />
          </div>
          <div className="h-12 w-10 shrink-0 overflow-hidden border border-slate-200 bg-slate-100">
            <div className="h-5 bg-slate-200" />
            <div className="mx-auto mt-1 h-4 w-4 rounded-full bg-slate-400" />
            <div className="mx-auto mt-1 h-3 w-7 rounded-t-full bg-slate-500" />
          </div>
        </div>
        <div className="mt-4 space-y-2 text-[8px] leading-4 text-slate-700">
          <div className="inline-flex px-2 py-0.5 text-white" style={{ background: accent }}>
            基本信息
          </div>
          {lines.slice(0, 4).map((line) => (
            <p className="truncate" key={line}>{line}</p>
          ))}
          <div className="inline-flex px-2 py-0.5 text-white" style={{ background: accent }}>
            经历亮点
          </div>
          {lines.slice(4, 10).map((line) => (
            <p className="max-h-8 overflow-hidden" key={line}>{line}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

export function getResumePreviewLines(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[\-•·\d.、\s]+/, "").trim())
    .filter((line) => line && !/^(个人优势|工作经历|项目经历|教育经历|技能|证书)$/.test(line));
}

export function getCaseAccent(index: number) {
  return ["#174a7c", "#0f766e", "#7c2d12", "#4338ca"][index % 4];
}
