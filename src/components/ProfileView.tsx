import { Trash2 } from "lucide-react";
import { deleteVersion, loadVersions } from "../services/storage";
import type { SavedResumeVersion } from "../types";

type Props = {
  versions: SavedResumeVersion[];
  onRefresh: () => void;
  onLoad: (version: SavedResumeVersion) => void;
};

export function ProfileView({ versions, onRefresh, onLoad }: Props) {
  const items = versions.length ? versions : loadVersions();

  return (
    <section className="page-shell">
      <div className="panel">
        <div className="panel-title">
          <div>
            <h1>我的版本</h1>
            <p>保存不同岗位的定制简历，后面可继续编辑和导出。</p>
          </div>
        </div>
        <div className="version-list">
          {items.length === 0 ? (
            <p className="empty-state">还没有保存版本。完成一次优化后，可以在模板编辑页保存。</p>
          ) : (
            items.map((version) => (
              <article key={version.id} className="version-row">
                <div>
                  <strong>{version.targetRole}</strong>
                  <span>{version.candidateName} · 匹配度 {version.score} · {new Date(version.createdAt).toLocaleString()}</span>
                </div>
                <div>
                  <button type="button" className="secondary-button" onClick={() => onLoad(version)}>
                    打开
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="删除版本"
                    onClick={() => {
                      deleteVersion(version.id);
                      onRefresh();
                    }}
                  >
                    <Trash2 size={17} />
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
