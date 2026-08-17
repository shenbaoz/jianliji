import type { BasicInfo } from "../types";

type Props = {
  value: BasicInfo;
  onChange: (next: BasicInfo) => void;
  collapsed?: boolean;
};

const degreeOptions = ["高中", "大专", "本科", "硕士", "博士"];

export function BasicInfoFields({ value, onChange, collapsed = false }: Props) {
  const update = (field: keyof BasicInfo, next: string) => {
    onChange({ ...value, [field]: next });
  };

  if (collapsed) {
    const summary = [value.name, value.school, value.phone, value.email].filter(Boolean).join(" · ");
    return (
      <details className="mt-5 rounded-lg border border-slate-200 bg-white">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-800">
          基础信息（已从简历自动识别，可修改）
          {summary && <span className="ml-2 font-normal text-slate-500">{summary}</span>}
        </summary>
        <div className="border-t border-slate-100 px-4 pb-4 pt-3">
          <BasicInfoGrid value={value} onChange={onChange} update={update} />
        </div>
      </details>
    );
  }

  return (
    <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-800">基础信息（选填）</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">姓名和学校会显示在简历顶部与教育背景里，电话邮箱会合并到联系方式中；不填也能生成。</p>
      <div className="mt-3">
        <BasicInfoGrid value={value} onChange={onChange} update={update} />
      </div>
    </div>
  );
}

function BasicInfoGrid({ value, onChange, update }: { value: BasicInfo; onChange: (next: BasicInfo) => void; update: (field: keyof BasicInfo, next: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="姓名" value={value.name} placeholder="例如：张三" onChange={(next) => update("name", next)} />
      <Field label="电话" type="tel" value={value.phone} placeholder="选填" onChange={(next) => update("phone", next)} />
      <Field label="学校 / 毕业院校" value={value.school} placeholder="选填" onChange={(next) => update("school", next)} />
      <Field label="专业" value={value.major} placeholder="选填" onChange={(next) => update("major", next)} />
      <Field label="学历" value={value.degree} placeholder="选填" list="resume-degree-options" onChange={(next) => update("degree", next)} />
      <Field label="邮箱" type="email" value={value.email} placeholder="选填" onChange={(next) => update("email", next)} />
      <datalist id="resume-degree-options">
        {degreeOptions.map((degree) => <option key={degree} value={degree} />)}
      </datalist>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", list }: { label: string; value: string; onChange: (next: string) => void; placeholder?: string; type?: string; list?: string }) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <input
        className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal text-slate-900 outline-none focus:border-sky-500"
        type={type}
        value={value}
        list={list}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={120}
      />
    </label>
  );
}
