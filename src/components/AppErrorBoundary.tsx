import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Copy, Info, RotateCcw, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logRuntimeError } from "@/lib/runtime-debug";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  componentStack: string;
  errorMessage: string;
  errorName: string;
  errorStack: string;
  hasError: boolean;
  showDetails: boolean;
  timestamp: string;
  url: string;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    componentStack: "",
    errorMessage: "",
    errorName: "",
    errorStack: "",
    hasError: false,
    showDetails: false,
    timestamp: "",
    url: "",
  };

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return {
      errorMessage: error.message,
      errorName: error.name,
      errorStack: error.stack ?? "",
      hasError: true,
      timestamp: new Date().toISOString(),
      url: typeof window === "undefined" ? "" : window.location.href,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ componentStack: errorInfo.componentStack ?? "" });
    logRuntimeError("react.error_boundary", error, {
      componentStack: errorInfo.componentStack,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleRetryRender = () => {
    this.setState({
      componentStack: "",
      errorMessage: "",
      errorName: "",
      errorStack: "",
      hasError: false,
      showDetails: false,
      timestamp: "",
      url: "",
    });
  };

  handleCopyDebugLog = async () => {
    const debugLog = this.getDebugLog();

    try {
      await navigator.clipboard.writeText(debugLog);
    } catch {
      logRuntimeError("react.error_boundary.copy_failed", new Error("Could not copy debug log"));
    }
  };

  getDebugLog = () => {
    const { componentStack, errorMessage, errorName, errorStack, timestamp, url } = this.state;

    return [
      `URL: ${url}`,
      `Horário: ${timestamp}`,
      `Erro: ${errorName}: ${errorMessage}`,
      "",
      "Stack:",
      errorStack || "Sem stack disponível.",
      "",
      "Component stack:",
      componentStack || "Sem component stack disponível.",
      "",
      `User agent: ${typeof navigator === "undefined" ? "" : navigator.userAgent}`,
    ].join("\n");
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
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button className="gap-2" onClick={this.handleReload} type="button">
                <RefreshCcw className="h-4 w-4" />
                Recarregar
              </Button>
              <Button className="gap-2" onClick={this.handleRetryRender} type="button" variant="outline">
                <RotateCcw className="h-4 w-4" />
                Tentar de novo
              </Button>
              <Button
                className="gap-2"
                onClick={() => this.setState((current) => ({ showDetails: !current.showDetails }))}
                type="button"
                variant="outline"
              >
                <Info className="h-4 w-4" />
                Debug
              </Button>
            </div>
            {this.state.showDetails && (
              <div className="mt-6 text-left">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detalhes do erro</span>
                  <Button className="h-8 gap-2" onClick={this.handleCopyDebugLog} size="sm" type="button" variant="outline">
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </Button>
                </div>
                <pre className="max-h-80 overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                  {this.getDebugLog()}
                </pre>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
