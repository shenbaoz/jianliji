import { FileText, WandSparkles } from "lucide-react";
import { sampleResumeCases } from "../data/sampleCases";
import type { ResumeInput, SampleResumeCase, WorkflowStep } from "../types";

type Props = {
  input: ResumeInput;
  onChange: (input: ResumeInput) => void;
  onNext: () => void;
  onLoadSample: (sample: SampleResumeCase, nextStep?: WorkflowStep) => void;
};

export function HomeView({ input, onChange, onNext, onLoadSample }: Props) {
  const update = (field: keyof ResumeInput, value: string) => {
    onChange({ ...input, [field]: value });
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      update("resumeText", await file.text());
      return;
    }
    update("resumeText", `${input.resumeText}\n\n已选择文件：${file.name}\n当前版本先支持文本提取演示，PDF/Word 正式解析会接入后端服务。`.trim());
  };

  return (
    <section className="page-shell narrow">
      <div className="panel hero-panel">
        <div className="panel-title">
          <div>
            <h1>简历导入</h1>
            <p>第一步只放你的简历。下一页再输入目标岗位，系统会按岗位逐步分析。</p>
          </div>
          <button type="button" className="link-button">
            查看示例
          </button>
        </div>
        <label className="field">
          <span>候选人名称</span>
          <input value={input.candidateName} onChange={(event) => update("candidateName", event.target.value)} />
        </label>
        <label className="upload-box">
          <FileText size={22} />
          <strong>上传简历文件</strong>
          <span>支持 txt 演示读取，PDF/Word 解析后续接后端</span>
          <input type="file" accept=".txt,.pdf,.doc,.docx" onChange={(event) => handleFile(event.target.files?.[0])} />
        </label>
        <label className="field">
          <span>简历文本</span>
          <textarea
            rows={15}
            value={input.resumeText}
            onChange={(event) => update("resumeText", event.target.value)}
            placeholder="粘贴你的简历内容，例如教育经历、项目经历、工作经历、技能清单..."
          />
        </label>
        <div className="action-row">
          <button type="button" className="primary-button" onClick={onNext}>
            下一步：输入岗位
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              onChange({
                candidateName: "张同学",
                targetRole: "前端开发工程师",
                resumeText:
                  "前端开发实习生，参与公司后台管理系统开发，负责部分页面和接口联调。熟悉 React、JavaScript、HTML、CSS，了解 Git。参与电商平台项目，完成商品列表、购物车、订单等页面开发。",
                jobDescription:
                  "岗位职责：负责公司前端产品的设计与开发，基于 React/TypeScript 构建高质量用户界面；与产品、设计、后端团队协作，推动技术方案落地；优化前端性能、体验与可维护性。要求：React、TypeScript、JavaScript、前端工程化、用户体验、团队协作。"
              })
            }
          >
            使用完整示例
          </button>
        </div>
      </div>
      <aside className="side-note">
        <WandSparkles size={20} />
        <h3>为什么不一页展示完？</h3>
        <p>正式产品会按步骤推进：先拿到简历，再看目标岗位，再给分析和追问。这样用户更容易完成。</p>
        <div className="sample-stack">
          <h3>优秀案例库</h3>
          {sampleResumeCases.slice(0, 6).map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => onLoadSample(item, "job")}
            >
              <strong>{item.title}</strong>
              <span>{item.userType}</span>
            </button>
          ))}
        </div>
      </aside>
    </section>
  );
}
