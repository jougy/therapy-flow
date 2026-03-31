import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logRuntimeError } from "@/lib/runtime-debug";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logRuntimeError("react.error_boundary", error, {
      componentStack: errorInfo.componentStack,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
          <div className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-slate-900">Algo deu errado nesta tela</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              O erro foi registrado no console do navegador com detalhes para depuração. Você pode recarregar a
              aplicação para tentar novamente.
            </p>
            <Button className="mt-6 gap-2" onClick={this.handleReload} type="button">
              <RefreshCcw className="h-4 w-4" />
              Recarregar
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
