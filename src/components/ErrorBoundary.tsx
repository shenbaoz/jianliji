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

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <section className="flex min-h-screen items-center justify-center bg-[#fafafa] px-6">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">这一页暂时没打开</h1>
              <p className="mt-3 text-sm text-slate-500">先回到首页，再继续处理你的简历。</p>
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
