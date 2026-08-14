import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Download,
  Eye,
  FileText,
  PackageCheck,
  RefreshCcw,
  Search,
  ShoppingCart,
  Trash2,
  UsersRound,
  WalletCards
} from "lucide-react";
import { resumeTemplates } from "../data/templates";
import { loadPricePlans, resetPricePlans, savePricePlans, type EditableUnlockPlan } from "../services/pricing";
import {
  deleteUnlockInterest,
  deleteAdminVersion,
  getStorageHealth,
  hasAdminSession,
  loadUnlockInterest,
  loadAdminVersions,
  loginAdmin,
  logoutAdmin,
  type StorageHealth
} from "../services/storage";
import {
  loadManagedTemplates,
  resetManagedTemplates,
  saveManagedTemplates,
  type ManagedResumeTemplate
} from "../services/templates";
import type { SavedResumeVersion, UnlockInterest } from "../types";

type AdminTab =
  | "overview"
  | "users"
  | "orders"
  | "templates"
  | "pricing"
  | "versions";

const tabs: Array<{ id: AdminTab; label: string; icon: typeof BarChart3 }> = [
  { id: "overview", label: "总览", icon: BarChart3 },
  { id: "users", label: "用户管理", icon: UsersRound },
  { id: "orders", label: "订单线索", icon: ShoppingCart },
  { id: "templates", label: "模板", icon: PackageCheck },
  { id: "pricing", label: "价格", icon: WalletCards },
  { id: "versions", label: "简历版本", icon: FileText }
];

const sourceLabel: Record<UnlockInterest["source"], string> = {
  analysis: "分析页",
  result: "结果页",
  editor: "编辑页"
};

export function AdminView() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [active, setActive] = useState<AdminTab>("overview");
  const [versions, setVersions] = useState<SavedResumeVersion[]>([]);
  const [interest, setInterest] = useState<UnlockInterest[]>([]);
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [pricePlans, setPricePlans] = useState<EditableUnlockPlan[]>(() => loadPricePlans());
  const [pricingSavedAt, setPricingSavedAt] = useState("");
  const [managedTemplates, setManagedTemplates] = useState<ManagedResumeTemplate[]>(() => loadManagedTemplates());
  const [templatesSavedAt, setTemplatesSavedAt] = useState("");
  const [storageHealth, setStorageHealth] = useState<StorageHealth | null>(null);

  const selectedVersion = versions.find((item) => item.id === selectedVersionId) || versions[0] || null;

  const refresh = async () => {
    const [nextVersions, nextInterest] = await Promise.all([loadAdminVersions(), loadUnlockInterest()]);
    setVersions(nextVersions);
    setInterest(nextInterest);
    setSelectedVersionId((current) => current || nextVersions[0]?.id || "");
    setUpdatedAt(new Date().toLocaleString("zh-CN", { hour12: false }));
  };

  useEffect(() => {
    void hasAdminSession()
      .then(setAuthenticated)
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    void refresh().catch((error) => {
      setLoginError(error instanceof Error ? error.message : "读取后台数据失败。");
      setAuthenticated(false);
    });
    void getStorageHealth().then(setStorageHealth);
  }, [authenticated]);

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError("");
    try {
      await loginAdmin(password);
      setPassword("");
      setAuthenticated(true);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "登录失败，请稍后重试。");
    }
  };

  const signOut = async () => {
    await logoutAdmin();
    setAuthenticated(false);
    setVersions([]);
    setInterest([]);
  };

  const planName = (planId: string) => pricePlans.find((plan) => plan.id === planId)?.name || planId;

  const filteredInterest = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return interest.filter((item) => {
      const matchesPlan = planFilter === "all" || item.planId === planFilter;
      const text = `${item.candidateName} ${item.targetRole} ${item.contact} ${item.note} ${planName(item.planId)}`.toLowerCase();
      return matchesPlan && (!keyword || text.includes(keyword));
    });
  }, [interest, planFilter, pricePlans, query]);

  const filteredVersions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return versions.filter((item) => {
      const text = `${item.candidateName} ${item.targetRole} ${item.templateId} ${item.resumeText} ${item.optimizedText}`.toLowerCase();
      return !keyword || text.includes(keyword);
    });
  }, [query, versions]);

  const users = useMemo(() => buildUsers(versions, interest, query), [versions, interest, query]);

  const userCount = new Set([...versions.map((item) => item.candidateName), ...interest.map((item) => item.candidateName)]).size;
  const orderCount = interest.length;
  const avgScore = versions.length
    ? Math.round(versions.reduce((total, item) => total + item.score, 0) / versions.length)
    : 0;

  const exportExcel = () => {
    downloadFile(
      "zhihengsuo-admin-data.xls",
      toExcelWorkbook({
        updatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
        versions,
        interest,
        templates: managedTemplates,
        prices: pricePlans,
        planName
      }),
      "application/vnd.ms-excel;charset=utf-8"
    );
  };

  const exportCsv = () => {
    const rows = [
      ["时间", "姓名", "目标岗位", "套餐", "来源", "联系方式", "备注"],
      ...filteredInterest.map((item) => [
        formatDate(item.createdAt),
        item.candidateName,
        item.targetRole,
        planName(item.planId),
        sourceLabel[item.source],
        item.contact || "-",
        item.note || "-"
      ])
    ];
    downloadFile("unlock-interest.csv", toCsv(rows), "text/csv;charset=utf-8");
  };

  const handleAdminError = (error: unknown) => {
    const message = error instanceof Error ? error.message : "操作失败，请稍后重试。";
    if (message.includes("重新登录")) setAuthenticated(false);
    window.alert(message);
  };

  const removeInterest = async (id: string) => {
    if (!window.confirm("确定删除这条解锁意向？")) return;
    try {
      await deleteUnlockInterest(id);
      await refresh();
    } catch (error) {
      handleAdminError(error);
    }
  };

  const removeVersion = async (id: string) => {
    if (!window.confirm("确定删除这个简历版本？")) return;
    try {
      await deleteAdminVersion(id);
      await refresh();
    } catch (error) {
      handleAdminError(error);
    }
  };

  const updatePricePlan = (id: string, field: keyof Omit<EditableUnlockPlan, "id" | "features">, value: string) => {
    setPricePlans((plans) => plans.map((plan) => (plan.id === id ? { ...plan, [field]: value } : plan)));
  };

  const updatePricePlanFeatures = (id: string, value: string) => {
    setPricePlans((plans) =>
      plans.map((plan) =>
        plan.id === id
          ? {
              ...plan,
              features: value
                .split(/[、/，,]/)
                .map((feature) => feature.trim())
                .filter(Boolean)
            }
          : plan
      )
    );
  };

  const savePricing = () => {
    try {
      savePricePlans(pricePlans);
      setPricingSavedAt(new Date().toLocaleString("zh-CN", { hour12: false }));
      alert("价格配置已保存，前台付费入口会使用这份配置。");
    } catch {
      alert("保存失败：浏览器存储空间不足，请清理后重试。");
    }
  };

  const restorePricing = () => {
    if (!window.confirm("确定恢复默认价格配置？")) return;
    setPricePlans(resetPricePlans());
    setPricingSavedAt(new Date().toLocaleString("zh-CN", { hour12: false }));
  };

  const updateTemplate = (id: string, field: keyof Omit<ManagedResumeTemplate, "id">, value: string | boolean) => {
    setManagedTemplates((templates) => templates.map((template) => (template.id === id ? { ...template, [field]: value } : template)));
  };

  const saveTemplates = () => {
    try {
      saveManagedTemplates(managedTemplates);
      setTemplatesSavedAt(new Date().toLocaleString("zh-CN", { hour12: false }));
      alert("模板配置已保存，前台编辑器会使用已上架模板。");
    } catch {
      alert("保存失败：浏览器存储空间不足，请清理后重试。");
    }
  };

  const restoreTemplates = () => {
    if (!window.confirm("确定恢复默认模板配置？")) return;
    setManagedTemplates(resetManagedTemplates());
    setTemplatesSavedAt(new Date().toLocaleString("zh-CN", { hour12: false }));
  };

  if (checkingSession) {
    return <main className="page-shell admin-shell"><section className="panel"><p>正在检查管理台登录状态…</p></section></main>;
  }

  if (!authenticated) {
    return (
      <main className="page-shell admin-shell">
        <section className="panel admin-hero-panel">
          <span className="eyebrow">管理台</span>
          <h1>管理台登录</h1>
          <p>请使用管理员密码访问用户留资与简历数据。</p>
          <form className="admin-login-form" onSubmit={submitLogin}>
            <label>
              管理员密码
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
            </label>
            {loginError && <p role="alert">{loginError}</p>}
            <button type="submit" className="primary-button">登录管理台</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-topbar">
        <div className="brand">
          <span className="brand-mark">衡</span>
          <div>
            <strong>简历记管理台</strong>
            <span>用户、订单线索、版本、模板和价格</span>
          </div>
        </div>
        <div className="admin-actions">
          <button type="button" className="secondary-button" onClick={signOut}>退出登录</button>
          <button type="button" className="secondary-button" onClick={exportExcel}>
            <Download size={16} />
            导出Excel
          </button>
          <button type="button" className="primary-button" onClick={refresh}>
            <RefreshCcw size={16} />
            刷新数据
          </button>
        </div>
      </header>

      <main className="page-shell admin-shell">
        <section className="panel admin-hero-panel">
          <div className="panel-title admin-title">
            <div>
              <span className="eyebrow">控制台</span>
              <h1>管理总览</h1>
              <p>只保留日常经营最常用的数据：用户、订单线索、简历版本、模板和价格。</p>
            </div>
          </div>

          <div className="admin-grid" aria-label="后台核心数据">
            <Stat label="用户数" value={userCount} note="按姓名去重统计" />
            <Stat label="订单线索" value={orderCount} note="用户提交的解锁意向" />
            <Stat label="简历版本" value={versions.length} note={`平均评分 ${avgScore}`} />
            <Stat
              label="保存状态"
              value={storageHealth?.online ? "在线" : "本机"}
              note={storageHealth?.label || "正在检测"}
            />
          </div>
          <p className="admin-sync-line">最近刷新：{updatedAt || "正在读取数据"}</p>
        </section>

        <nav className="admin-tabs" aria-label="后台模块">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                className={active === tab.id ? "active" : ""}
                onClick={() => setActive(tab.id)}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {active === "overview" && (
          <section className="panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">总览</span>
                <h2>数据总览</h2>
              </div>
            </div>
            <div className="admin-two-column">
              <ModuleGrid onOpen={setActive} />
              <div>
                <h3>套餐热度</h3>
                <PlanStats interest={interest} plans={pricePlans} />
              </div>
            </div>
          </section>
        )}

        {active === "users" && (
          <section className="panel">
            <PanelHeading eyebrow="用户" title="用户管理" />
            <FilterBar
              query={query}
              onQuery={setQuery}
              planFilter={planFilter}
              onPlanFilter={setPlanFilter}
              plans={pricePlans}
              onExport={exportCsv}
            />
            <div className="admin-table">
              {users.map((user) => (
                <article className="admin-record-row" key={user.name}>
                  <div>
                    <strong>{user.name}</strong>
                    <span>{user.targetRole} · {user.versionCount} 个简历版本 · {user.interestCount} 条订单线索</span>
                    <em>最近活动：{formatDate(user.latestAt)}</em>
                  </div>
                </article>
              ))}
              {users.length === 0 && <EmptyRow title="没有匹配用户" />}
            </div>
          </section>
        )}

        {active === "orders" && (
          <section className="panel">
            <PanelHeading eyebrow="订单" title="订单线索" />
            <FilterBar
              query={query}
              onQuery={setQuery}
              planFilter={planFilter}
              onPlanFilter={setPlanFilter}
              plans={pricePlans}
              onExport={exportCsv}
            />
            <InterestRows rows={filteredInterest} planName={planName} onDelete={removeInterest} />
          </section>
        )}

        {active === "templates" && (
          <section className="panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">模板</span>
                <h2>模板上下架</h2>
                <p>关闭上架后，前台编辑器不会再显示这个模板。</p>
              </div>
              <div className="admin-actions">
                <button type="button" className="secondary-button" onClick={restoreTemplates}>
                  恢复默认
                </button>
                <button type="button" className="primary-button" onClick={saveTemplates}>
                  保存模板
                </button>
              </div>
            </div>
            <div className="admin-template-grid">
              {managedTemplates.map((template) => (
                <article className="admin-module-card admin-template-card" key={template.id}>
                  <i style={{ background: template.accent }} />
                  <label className="admin-switch-row">
                    <span>{template.enabled ? "已上架" : "已下架"}</span>
                    <input
                      type="checkbox"
                      checked={template.enabled}
                      onChange={(event) => updateTemplate(template.id, "enabled", event.target.checked)}
                    />
                  </label>
                  <label>
                    <span>模板名称</span>
                    <input value={template.name} onChange={(event) => updateTemplate(template.id, "name", event.target.value)} />
                  </label>
                  <label>
                    <span>分类</span>
                    <input value={template.category} onChange={(event) => updateTemplate(template.id, "category", event.target.value)} />
                  </label>
                  <label>
                    <span>说明</span>
                    <textarea value={template.description} onChange={(event) => updateTemplate(template.id, "description", event.target.value)} />
                  </label>
                  <label>
                    <span>主题色</span>
                    <input type="color" value={template.accent} onChange={(event) => updateTemplate(template.id, "accent", event.target.value)} />
                  </label>
                  <em>ID：{template.id}</em>
                </article>
              ))}
            </div>
            <p className="admin-sync-line">{templatesSavedAt ? `最近保存：${templatesSavedAt}` : "修改后请点击保存模板。"}</p>
          </section>
        )}

        {active === "pricing" && (
          <section className="panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">价格</span>
                <h2>价格配置</h2>
                <p>修改后点保存，前台的解锁套餐会同步显示新价格和文案。</p>
              </div>
              <div className="admin-actions">
                <button type="button" className="secondary-button" onClick={restorePricing}>
                  恢复默认
                </button>
                <button type="button" className="primary-button" onClick={savePricing}>
                  保存价格
                </button>
              </div>
            </div>
            <div className="admin-price-grid">
              {pricePlans.map((plan) => (
                <article className="admin-module-card admin-price-card" key={plan.id}>
                  <i style={{ background: "#064d3e" }} />
                  <label>
                    <span>套餐名称</span>
                    <input value={plan.name} onChange={(event) => updatePricePlan(plan.id, "name", event.target.value)} />
                  </label>
                  <label>
                    <span>价格</span>
                    <input value={plan.price} inputMode="decimal" onChange={(event) => updatePricePlan(plan.id, "price", event.target.value)} />
                  </label>
                  <label>
                    <span>说明</span>
                    <textarea value={plan.description} onChange={(event) => updatePricePlan(plan.id, "description", event.target.value)} />
                  </label>
                  <label>
                    <span>权益，用顿号或逗号分隔</span>
                    <textarea value={plan.features.join(" / ")} onChange={(event) => updatePricePlanFeatures(plan.id, event.target.value)} />
                  </label>
                  <em>ID：{plan.id}</em>
                </article>
              ))}
            </div>
            <p className="admin-sync-line">{pricingSavedAt ? `最近保存：${pricingSavedAt}` : "修改后请点击保存价格。"}</p>
          </section>
        )}

        {active === "versions" && (
          <section className="panel">
            <PanelHeading eyebrow="版本" title="简历版本" />
            <FilterBar
              query={query}
              onQuery={setQuery}
              planFilter={planFilter}
              onPlanFilter={setPlanFilter}
              plans={pricePlans}
              onExport={exportCsv}
            />
            <div className="admin-detail-grid">
              <div className="admin-table">
                {filteredVersions.map((version) => (
                  <article className="admin-record-row" key={version.id}>
                    <div>
                      <strong>{version.candidateName} · {version.targetRole}</strong>
                      <span>评分 {version.score} · 模板 {version.templateId}</span>
                      <em>{formatDate(version.createdAt)}</em>
                    </div>
                    <div className="admin-row-actions">
                      <button type="button" className="secondary-button" onClick={() => setSelectedVersionId(version.id)}>
                        <Eye size={16} />
                        预览
                      </button>
                      <button type="button" className="icon-button danger-button" aria-label="删除版本" onClick={() => removeVersion(version.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))}
                {filteredVersions.length === 0 && <EmptyRow title="没有匹配版本" />}
              </div>
              <VersionPreview version={selectedVersion} />
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: number | string; note: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{note}</em>
    </div>
  );
}

function PanelHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="panel-title">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
    </div>
  );
}

function FilterBar({
  query,
  onQuery,
  planFilter,
  onPlanFilter,
  plans,
  onExport
}: {
  query: string;
  onQuery: (value: string) => void;
  planFilter: string;
  onPlanFilter: (value: string) => void;
  plans: EditableUnlockPlan[];
  onExport: () => void;
}) {
  return (
    <div className="admin-filter-bar">
      <label>
        <Search size={16} />
        <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="搜索姓名、岗位、联系方式、备注" />
      </label>
      <select value={planFilter} onChange={(event) => onPlanFilter(event.target.value)} aria-label="套餐筛选">
        <option value="all">全部套餐</option>
        {plans.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {plan.name}
          </option>
        ))}
      </select>
      <button type="button" className="secondary-button" onClick={onExport}>
        <Download size={16} />
        导出表格
      </button>
    </div>
  );
}

function ModuleGrid({ onOpen }: { onOpen: (tab: AdminTab) => void }) {
  return (
    <div className="admin-card-grid">
      {tabs.slice(1).map((tab) => {
        const Icon = tab.icon;
        return (
          <button type="button" className="admin-module-card" key={tab.id} onClick={() => onOpen(tab.id)}>
            <Icon size={22} />
            <strong>{tab.label}</strong>
            <span>点击进入模块</span>
          </button>
        );
      })}
    </div>
  );
}

function PlanStats({ interest, plans }: { interest: UnlockInterest[]; plans: EditableUnlockPlan[] }) {
  const max = Math.max(1, ...plans.map((plan) => interest.filter((item) => item.planId === plan.id).length));
  return (
    <div className="admin-stat-list">
      {plans.map((plan) => {
        const count = interest.filter((item) => item.planId === plan.id).length;
        return (
          <div className="admin-stat-row" key={plan.id}>
            <span>{plan.name}</span>
            <div>
              <i style={{ width: `${Math.round((count / max) * 100)}%` }} />
            </div>
            <strong>{count}</strong>
          </div>
        );
      })}
    </div>
  );
}

function InterestRows({
  rows,
  planName,
  onDelete
}: {
  rows: UnlockInterest[];
  planName: (planId: string) => string;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="admin-table">
      {rows.map((item) => (
        <article className="admin-record-row" key={item.id}>
          <div>
            <strong>{item.candidateName} · {item.targetRole}</strong>
            <span>{planName(item.planId)} · {sourceLabel[item.source]} · {item.contact || "未留联系方式"}</span>
            <em>{item.note || "无备注"} · {formatDate(item.createdAt)}</em>
          </div>
          <div className="admin-row-actions">
            <button type="button" className="secondary-button" onClick={() => void navigator.clipboard?.writeText(item.contact || "").catch(() => window.alert("复制失败，请手动复制。"))}>
              复制联系
            </button>
            <button type="button" className="icon-button danger-button" aria-label="删除线索" onClick={() => onDelete(item.id)}>
              <Trash2 size={16} />
            </button>
          </div>
        </article>
      ))}
      {rows.length === 0 && <EmptyRow title="暂无数据" />}
    </div>
  );
}

function VersionPreview({ version }: { version: SavedResumeVersion | null }) {
  return (
    <aside className="panel admin-preview-panel">
      <div className="panel-title">
        <div>
          <span className="eyebrow">预览</span>
          <h2>版本预览</h2>
        </div>
      </div>
      {version ? (
        <div className="admin-preview">
          <span>{version.candidateName} · {version.targetRole} · 评分 {version.score}</span>
          <h3>优化后简历</h3>
          <pre>{version.optimizedText}</pre>
          <h3>原始简历</h3>
          <pre>{version.resumeText}</pre>
        </div>
      ) : (
        <div className="admin-preview">
          <span>还没有可预览的简历版本。</span>
        </div>
      )}
    </aside>
  );
}

function EmptyRow({ title }: { title: string }) {
  return (
    <div className="admin-empty-row">
      <strong>{title}</strong>
      <span>刷新后会自动显示最新记录。</span>
    </div>
  );
}

function buildUsers(versions: SavedResumeVersion[], interest: UnlockInterest[], query: string) {
  const map = new Map<string, { name: string; targetRole: string; versionCount: number; interestCount: number; latestAt: string }>();
  versions.forEach((item) => {
    const current = map.get(item.candidateName) || {
      name: item.candidateName,
      targetRole: item.targetRole,
      versionCount: 0,
      interestCount: 0,
      latestAt: item.createdAt
    };
    current.versionCount += 1;
    current.latestAt = current.latestAt > item.createdAt ? current.latestAt : item.createdAt;
    map.set(item.candidateName, current);
  });
  interest.forEach((item) => {
    const current = map.get(item.candidateName) || {
      name: item.candidateName,
      targetRole: item.targetRole,
      versionCount: 0,
      interestCount: 0,
      latestAt: item.createdAt
    };
    current.interestCount += 1;
    current.latestAt = current.latestAt > item.createdAt ? current.latestAt : item.createdAt;
    map.set(item.candidateName, current);
  });
  const keyword = query.trim().toLowerCase();
  return [...map.values()]
    .filter((item) => !keyword || `${item.name} ${item.targetRole}`.toLowerCase().includes(keyword))
    .sort((a, b) => b.latestAt.localeCompare(a.latestAt));
}

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function toCsv(rows: string[][]) {
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function toExcelWorkbook({
  updatedAt,
  versions,
  interest,
  templates,
  prices,
  planName
}: {
  updatedAt: string;
  versions: SavedResumeVersion[];
  interest: UnlockInterest[];
  templates: ManagedResumeTemplate[];
  prices: EditableUnlockPlan[];
  planName: (planId: string) => string;
}) {
  const sections = [
    {
      title: "数据总览",
      rows: [
        ["导出时间", updatedAt],
        ["用户数", String(new Set([...versions.map((item) => item.candidateName), ...interest.map((item) => item.candidateName)]).size)],
        ["真实订单", String(interest.length)],
        ["简历版本", String(versions.length)],
        ["上架模板", String(templates.filter((template) => template.enabled).length)],
        ["价格方案", String(prices.length)]
      ]
    },
    {
      title: "真实订单与解锁意向",
      rows: [
        ["时间", "姓名", "目标岗位", "套餐", "来源", "联系方式", "备注"],
        ...interest.map((item) => [
          formatDate(item.createdAt),
          item.candidateName,
          item.targetRole,
          planName(item.planId),
          sourceLabel[item.source],
          item.contact || "",
          item.note || ""
        ])
      ]
    },
    {
      title: "简历版本",
      rows: [
        ["时间", "姓名", "目标岗位", "评分", "模板ID", "原始简历", "优化后简历"],
        ...versions.map((item) => [
          formatDate(item.createdAt),
          item.candidateName,
          item.targetRole,
          String(item.score),
          item.templateId,
          item.resumeText,
          item.optimizedText
        ])
      ]
    },
    {
      title: "模板配置",
      rows: [
        ["模板ID", "模板名称", "分类", "说明", "主题色", "状态"],
        ...templates.map((template) => [
          template.id,
          template.name,
          template.category,
          template.description,
          template.accent,
          template.enabled ? "已上架" : "已下架"
        ])
      ]
    },
    {
      title: "价格配置",
      rows: [
        ["套餐ID", "套餐名称", "价格", "说明", "权益"],
        ...prices.map((plan) => [plan.id, plan.name, plan.price, plan.description, plan.features.join(" / ")])
      ]
    }
  ];

  const body = sections
    .map(
      (section) => `
        <h2>${escapeHtml(section.title)}</h2>
        <table>
          ${section.rows
            .map((row, index) => {
              const tag = index === 0 ? "th" : "td";
              return `<tr>${row.map((cell) => `<${tag}>${escapeHtml(cell)}</${tag}>`).join("")}</tr>`;
            })
            .join("")}
        </table>
      `
    )
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body { font-family: "Microsoft YaHei", Arial, sans-serif; }
      h2 { margin: 24px 0 8px; }
      table { border-collapse: collapse; margin-bottom: 18px; width: 100%; }
      th, td { border: 1px solid #999; padding: 8px; text-align: left; vertical-align: top; mso-number-format:"\\@"; }
      th { background: #eef3f0; font-weight: 700; }
    </style>
  </head>
  <body>${body}</body>
</html>`;
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
