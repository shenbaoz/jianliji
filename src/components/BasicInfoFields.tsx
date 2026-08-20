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
      <details className="basic-info-summary">
        <summary className="cursor-pointer select-none">
          基础信息（自动识别）
          {summary && <span className="basic-info-summary-preview">{summary}</span>}
        </summary>
        <div className="basic-info-summary-body">
          <BasicInfoGrid value={value} onChange={onChange} update={update} />
        </div>
      </details>
    );
  }

  return (
    <div className="basic-info-card">
      <p className="basic-info-title">基础信息（自动识别）</p>
      <div className="basic-info-card-body">
        <BasicInfoGrid value={value} onChange={onChange} update={update} />
      </div>
    </div>
  );
}

function BasicInfoGrid({ value, onChange, update }: { value: BasicInfo; onChange: (next: BasicInfo) => void; update: (field: keyof BasicInfo, next: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="姓名" value={value.name} placeholder="例如：张三" onChange={(next) => update("name", next)} />
      <Field label="电话" type="tel" value={value.phone} placeholder="未识别" onChange={(next) => update("phone", next)} />
      <Field label="学校/毕业院校" value={value.school} placeholder="未识别" onChange={(next) => update("school", next)} />
      <Field label="专业" value={value.major} placeholder="未识别" onChange={(next) => update("major", next)} />
      <Field label="学历" value={value.degree} placeholder="未识别" list="resume-degree-options" onChange={(next) => update("degree", next)} />
      <Field label="邮箱" type="email" value={value.email} placeholder="未识别" onChange={(next) => update("email", next)} />
      <datalist id="resume-degree-options">
        {degreeOptions.map((degree) => <option key={degree} value={degree} />)}
      </datalist>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", list }: { label: string; value: string; onChange: (next: string) => void; placeholder?: string; type?: string; list?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        className="field-input"
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
