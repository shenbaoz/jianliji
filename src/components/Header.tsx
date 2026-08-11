import { ArrowRight, Home } from "lucide-react";

export function Header({ onOpenHome, onOpenWorkspace, finalOnly = false }: { onOpenHome: () => void; onOpenWorkspace: () => void; finalOnly?: boolean }) {
  return <header className="topbar"><button type="button" className="brand-button" onClick={onOpenHome}><span className="brand-mark">简</span><div><strong>简历记</strong><span className="brand-tag">保留模板，整理内容</span></div></button><nav className="top-actions" aria-label="导航"><button type="button" onClick={onOpenHome}><Home size={16} />返回首页</button>{!finalOnly && <button type="button" className="user-button" onClick={onOpenWorkspace}>开始整理<ArrowRight size={16} /></button>}</nav></header>;
}
