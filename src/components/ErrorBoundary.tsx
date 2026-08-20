import { Component, type ReactNode } from "react";

type Props = {
  fallback?: ReactNode;
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // 发布后旧页面可能还在内存中，而按需加载的旧脚本已经被新版本替换。
    // 自动刷新一次即可拿到同一版本的页面文件，避免用户落到错误页。
    const message = String(error?.message || "");
    const isStaleAsset = /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk/i.test(message);
    const recoveryKey = "resume-stale-asset-recovered";
    if (isStaleAsset && sessionStorage.getItem(recoveryKey) !== "1") {
      sessionStorage.setItem(recoveryKey, "1");
      window.location.reload();
      return;
    }
    sessionStorage.removeItem(recoveryKey);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <section className="flex min-h-screen items-center justify-center bg-[#fafafa] px-6">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">页面暂时无法打开</h1>
              <p className="mt-3 text-sm text-slate-500">请返回首页继续。</p>
              <button
                type="button"
                className="mt-6 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-medium text-white hover:bg-slate-800"
                onClick={() => {
                  this.setState({ hasError: false });
                  window.location.href = "/";
                }}
              >
                返回首页
              </button>
            </div>
          </section>
        )
      );
    }
    return this.props.children;
  }
}
