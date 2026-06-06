import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] 渲染错误:', error.message);
    console.error('[ErrorBoundary] 组件栈:', errorInfo.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="h-screen w-screen bg-surface-950 flex flex-col items-center justify-center text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
            <span className="text-2xl">!</span>
          </div>
          <h2 className="text-lg font-semibold text-surface-100 mb-2">界面渲染异常</h2>
          <p className="text-sm text-surface-400 mb-6 max-w-md">
            {this.state.error?.message || '发生了未知错误'}
          </p>
          <button
            className="btn-primary"
            onClick={this.handleRetry}
          >
            重试
          </button>
          <p className="text-xs text-surface-600 mt-4">
            请打开开发者工具（F12）查看 Console 获取详细错误信息
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
