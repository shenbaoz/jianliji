import { ArrowRight, BookOpen, Home } from "lucide-react";

type HeaderProps = {
  onOpenHome: () => void;
  onOpenCases: () => void;
  onOpenWorkspace: () => void;
  onOpenCreator: () => void;
  finalOnly?: boolean;
  dark?: boolean;
};

export function Header({ onOpenHome, onOpenCases, onOpenWorkspace, onOpenCreator, finalOnly = false, dark }: HeaderProps) {
  return (
    <header className={dark ? "topbar topbar-dark" : "topbar"}>
      <button type="button" className="brand-button" onClick={onOpenHome}>
        <span className={dark ? "brand-mark brand-mark-dark" : "brand-mark"}>简</span>
        <div>
          <strong>简历记</strong>
          <span className="brand-tag">一份一投的简历</span>
        </div>
      </button>
      <nav className="top-actions" aria-label="辅助导航">
        <button type="button" onClick={onOpenHome}>
          <Home size={16} />
          返回首页
        </button>
        {!finalOnly && (
          <>
            <button type="button" onClick={onOpenCases}>
              <BookOpen size={16} />
              打开案例库
            </button>
            <button type="button" onClick={onOpenCreator}>从 0 创建</button>
            <button type="button" className="user-button" onClick={onOpenWorkspace}>
              开始优化
              <ArrowRight size={16} />
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
