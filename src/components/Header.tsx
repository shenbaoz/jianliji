import { Bell, CircleHelp, UserRound } from "lucide-react";

export function Header() {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">岗</span>
        <div>
          <strong>一岗一简历</strong>
          <span>输入目标岗位，生成这一岗专用简历</span>
        </div>
      </div>
      <nav className="top-actions" aria-label="辅助导航">
        <button type="button">
          <CircleHelp size={16} />
          使用指南
        </button>
        <button type="button">
          <Bell size={16} />
          通知
        </button>
        <button type="button" className="user-button">
          <UserRound size={16} />
          张同学
        </button>
      </nav>
    </header>
  );
}
