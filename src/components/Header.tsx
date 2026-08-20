import { ArrowRight } from "lucide-react";

export function Header({ onOpenHome, onOpenWorkspace, finalOnly = false }: { onOpenHome: () => void; onOpenWorkspace: () => void; finalOnly?: boolean }) {
  return <header className="topbar"><button type="button" className="brand-button" onClick={onOpenHome}><span className="brand-mark">简</span><strong>简历记</strong></button><nav className="top-actions" aria-label="导航"><button type="button" onClick={onOpenHome}>首页</button>{!finalOnly && <button type="button" className="user-button primary-button" onClick={onOpenWorkspace}>开始优化 <ArrowRight size={14} /></button>}</nav></header>;
}
