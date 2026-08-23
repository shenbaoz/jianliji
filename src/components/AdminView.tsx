import { FormEvent, useEffect, useState } from "react";
import { Download, LogOut, RefreshCcw, Trash2 } from "lucide-react";
import {
  deleteUnlockInterest,
  hasAdminSession,
  loadUnlockInterest,
  loadAdminUsageStats,
  loginAdmin,
  logoutAdmin
} from "../services/storage";
import type { AdminUsageStats, UnlockInterest } from "../types";

const planLabels: Record<string, string> = {
  "feedback-9-9": "9.9 元",
  "feedback-19-9": "19.9 元",
  "feedback-29-9": "29.9 元"
};

export function AdminView() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [rows, setRows] = useState<UnlockInterest[]>([]);
  const [query, setQuery] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [usageStats, setUsageStats] = useState<AdminUsageStats>({ optimizationUsers: 0, optimizationRuns: 0, creatorUsers: 0, creatorRuns: 0, recentEvents: [] });
  const [loadError, setLoadError] = useState("");

  const refresh = async () => {
    setLoadError("");
    const [feedbackResult, usageResult] = await Promise.allSettled([loadUnlockInterest(), loadAdminUsageStats()]);
    if (feedbackResult.status === "fulfilled") setRows(feedbackResult.value);
    if (usageResult.status === "fulfilled") setUsageStats(usageResult.value);
    const errors = [feedbackResult, usageResult].filter((item): item is PromiseRejectedResult => item.status === "rejected");
    if (errors.some((item) => isAdminSessionError(item.reason))) {
      setAuthenticated(false);
      setRows([]);
      setUsageStats({ optimizationUsers: 0, optimizationRuns: 0, creatorUsers: 0, creatorRuns: 0, recentEvents: [] });
      setLoadError("管理员登录已失效，请重新登录。");
      return;
    }
    if (errors.length > 0) setLoadError(errors.map((item) => item.reason instanceof Error ? item.reason.message : "后台数据读取失败，请刷新重试。").join(" "));
    setUpdatedAt(new Date().toLocaleString("zh-CN", { hour12: false }));
  };

  useEffect(() => {
    void hasAdminSession()
      .then((active) => {
        setAuthenticated(active);
        if (active) return refresh();
      })
      .catch(() => setAuthenticated(false))
      .finally(() => setChecking(false));
  }, []);

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError("");
    try {
      await loginAdmin(password);
      setAuthenticated(true);
      setPassword("");
      await refresh();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "登录失败，请稍后重试。");
    }
  };

  const removeRow = async (id: string) => {
    if (!window.confirm("确定删除这条顾客反馈？")) return;
    try {
      await deleteUnlockInterest(id);
      await refresh();
    } catch (error) {
      if (isAdminSessionError(error)) {
        setAuthenticated(false);
        setLoadError("管理员登录已失效，请重新登录。");
        return;
      }
      setLoadError(error instanceof Error ? error.message : "删除反馈失败，请稍后重试。");
    }
  };

  const signOut = async () => {
    try {
      await logoutAdmin();
      setAuthenticated(false);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "退出登录失败，请稍后重试。");
    }
  };

  const exportCsv = () => {
    const filtered = filterRows(rows, query);
    const csv = [
      ["时间", "姓名", "目标岗位", "价格选择", "来源", "联系方式", "反馈"],
      ...filtered.map((row) => [
        formatDate(row.createdAt),
        row.candidateName,
        row.targetRole,
        planLabels[row.planId] || row.planId,
        row.source,
        row.contact || "-",
        row.note || "-"
      ])
    ].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "customer-feedback.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (checking) return <main className="page-shell admin-shell"><section className="panel"><p>正在加载后台…</p></section></main>;

  if (!authenticated) {
    return (
      <main className="page-shell admin-shell">
        <section className="panel admin-login-panel">
          <span className="eyebrow">简历记管理台</span>
          <h1>管理员登录</h1>
          <p>登录后查看顾客提交的下载反馈。</p>
          <form onSubmit={submitLogin} className="admin-login-form">
            <label>后台密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
            {loginError && <p className="admin-error" role="alert">{loginError}</p>}
            <button type="submit" className="primary-button">登录后台</button>
          </form>
        </section>
      </main>
    );
  }

  const filtered = filterRows(rows, query);
  const votes = ["feedback-9-9", "feedback-19-9", "feedback-29-9"].map((planId) => ({
    planId,
    label: planLabels[planId],
    count: rows.filter((row) => row.planId === planId).length
  }));
  const maxVotes = Math.max(1, ...votes.map((item) => item.count));
  return (
    <div className="admin-page">
      <header className="admin-topbar">
        <div className="brand"><span className="brand-mark">衡</span><div><strong>简历记管理台</strong><span>顾客反馈</span></div></div>
        <div className="admin-actions">
          <button type="button" className="secondary-button" onClick={exportCsv}><Download size={16} />导出反馈</button>
          <button type="button" className="secondary-button" onClick={() => void refresh()}><RefreshCcw size={16} />刷新</button>
          <button type="button" className="secondary-button" onClick={() => void signOut()}><LogOut size={16} />退出</button>
        </div>
      </header>
      <main className="page-shell admin-shell">
        <section className="panel admin-hero-panel">
          <span className="eyebrow">顾客反馈</span>
          <h1>下载前反馈</h1>
          <p>顾客在网址提交的价格选择、备注和联系方式会显示在这里。</p>
          {loadError && <p className="admin-error" role="alert">{loadError}</p>}
          <div className="admin-grid" aria-label="反馈和使用统计">
            <Stat label="已有简历优化人数" value={usageStats.optimizationUsers} note={`成功优化 ${usageStats.optimizationRuns} 次`} />
            <Stat label="小白生成简历人数" value={usageStats.creatorUsers} note={`成功生成 ${usageStats.creatorRuns} 次`} />
            <Stat label="反馈数量" value={rows.length} note={updatedAt ? `最近刷新 ${updatedAt}` : "尚未刷新"} />
          </div>
        </section>
        <section className="panel admin-vote-panel">
          <div className="panel-title"><div><span className="eyebrow">投票</span><h2>投票统计</h2><p>顾客在下载前选择的价格分布。</p></div></div>
          <div className="admin-vote-chart" role="img" aria-label="价格投票柱形图">
            {votes.map((item) => <div className="admin-vote-column" key={item.planId}><strong>{item.count}</strong><div className="admin-vote-track"><i className="admin-vote-bar" style={{ height: `${Math.max(4, (item.count / maxVotes) * 100)}%` }} /></div><span>{item.label}</span></div>)}
          </div>
        </section>
        <section className="panel">
          <div className="panel-title"><div><span className="eyebrow">最近使用</span><h2>用户基础信息</h2><p>只显示成功生成记录，不保存简历正文和联系方式。</p></div></div>
          <div className="admin-table">
            {usageStats.recentEvents.map((event) => <article className="admin-record-row" key={event.id}><div><strong>{event.candidateName || "未填写姓名"}</strong><span>{event.eventType === "creator_generate" ? "小白生成" : "已有简历优化"} · {event.targetRole || "未填写方向"} · {formatDate(event.createdAt)}</span><em>{[event.school, event.major, event.degree].filter(Boolean).join(" · ") || "未填写学校、专业或学历"}</em></div></article>)}
            {usageStats.recentEvents.length === 0 && <div className="admin-empty-row">暂时没有使用记录。</div>}
          </div>
        </section>
        <section className="panel">
          <div className="admin-filter-bar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、岗位、反馈或联系方式" /></div>
          <div className="admin-table">
            {filtered.map((row) => <article className="admin-record-row" key={row.id}><div><strong>{row.candidateName || "未命名用户"}</strong><span>{row.targetRole || "未填写岗位"} · {planLabels[row.planId] || row.planId} · {formatDate(row.createdAt)}</span><em>{row.note || "顾客未填写备注"}{row.contact ? ` · 联系方式：${row.contact}` : ""}</em></div><button type="button" className="icon-button danger-button" aria-label="删除反馈" onClick={() => void removeRow(row.id)}><Trash2 size={16} /></button></article>)}
            {filtered.length === 0 && <div className="admin-empty-row">暂时没有顾客反馈。</div>}
          </div>
        </section>
      </main>
    </div>
  );
}

function filterRows(rows: UnlockInterest[], query: string) {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return rows;
  return rows.filter((row) => `${row.candidateName} ${row.targetRole} ${row.contact} ${row.note} ${planLabels[row.planId] || row.planId}`.toLowerCase().includes(keyword));
}

function isAdminSessionError(error: unknown) {
  return error instanceof Error && error.message.includes("管理员登录已失效");
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}

function Stat({ label, value, note }: { label: string; value: number; note: string }) {
  return <div><span>{label}</span><strong>{value}</strong><em>{note}</em></div>;
}
