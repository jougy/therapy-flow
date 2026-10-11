import React, { useState, useMemo } from "react";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Copy,
  Download,
  Filter,
  Flame,
  Info,
  Layers,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Terminal,
  Trash2,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import {
  useRuntimeDebugEvents,
  clearDebugEvents,
  logRuntimeError,
  logRuntimeRpc,
  type DebugEventType,
} from "@/lib/runtime-debug";
import { localTelemetryManager } from "@/lib/telemetry-local-store";

export const PlatformErrorsLogsPage: React.FC = () => {
  const runtimeEvents = useRuntimeDebugEvents();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Read telemetry local store state
  const telemetryStore = localTelemetryManager.getStore();

  // Filtered events
  const filteredEvents = useMemo(() => {
    return runtimeEvents.filter((ev) => {
      // Type filtering
      if (typeFilter !== "all" && ev.type !== typeFilter) {
        return false;
      }

      // Search term filtering
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesScope = ev.scope.toLowerCase().includes(query);
        const matchesMessage = ev.message.toLowerCase().includes(query);
        const matchesStack = ev.errorDetails?.stack?.toLowerCase().includes(query);
        const matchesContext = ev.context ? JSON.stringify(ev.context).toLowerCase().includes(query) : false;

        if (!matchesScope && !matchesMessage && !matchesStack && !matchesContext) {
          return false;
        }
      }

      return true;
    });
  }, [runtimeEvents, typeFilter, searchTerm]);

  // Statistics counters
  const stats = useMemo(() => {
    let errorCount = 0;
    let warnCount = 0;
    let rpcCount = 0;
    let toastDestructiveCount = 0;
    let infoCount = 0;

    for (const ev of runtimeEvents) {
      if (ev.type === "error") {
        errorCount += 1;
        if (ev.scope.includes("toast") || ev.scope.includes("ui.toast")) {
          toastDestructiveCount += 1;
        }
      } else if (ev.type === "warn") {
        warnCount += 1;
      } else if (ev.type === "rpc") {
        rpcCount += 1;
      } else if (ev.type === "info") {
        infoCount += 1;
      }
    }

    return {
      total: runtimeEvents.length,
      errorCount,
      warnCount,
      rpcCount,
      toastDestructiveCount,
      infoCount,
    };
  }, [runtimeEvents]);

  // Copy to clipboard helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado para a área de transferência",
      description: `${label} copiado com sucesso.`,
    });
  };

  // Export logs to JSON file
  const exportLogsAsJson = () => {
    try {
      const dataStr = JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          telemetryStoreState: telemetryStore,
          events: runtimeEvents,
        },
        null,
        2
      );
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pluri-health-logs-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Logs exportados",
        description: "Arquivo JSON gerado e baixado com sucesso.",
      });
    } catch (e) {
      toast({
        title: "Falha na exportação",
        description: e instanceof Error ? e.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  // Clear all in-memory events
  const handleClearLogs = () => {
    clearDebugEvents();
    localTelemetryManager.clearRecentErrors();
    toast({
      title: "Logs limpos",
      description: "Todos os eventos de diagnóstico em memória foram limpos.",
    });
  };

  // Force Telemetry Sync
  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      await localTelemetryManager.flushImmediate({ triggerReason: "manual" });
      toast({
        title: "Sincronização executada",
        description: "Lote de telemetria descarregado com sucesso.",
      });
    } catch (e) {
      toast({
        title: "Erro de sincronização",
        description: e instanceof Error ? e.message : "Falha ao enviar lote",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Test simulation actions
  const simulateError = (type: "runtime" | "unhandled" | "toast_destructive" | "rpc_fail") => {
    switch (type) {
      case "runtime":
        logRuntimeError("test.simulation", new Error("Erro simulado para validação de telemetria e captura"), {
          simulationTime: new Date().toISOString(),
          source: "PlatformErrorsLogsPage",
        });
        toast({
          title: "Erro de teste disparado",
          description: "Evento registrado e sincronizado via telemetria.",
        });
        break;
      case "toast_destructive":
        toast({
          title: "Alerta Crítico de Simulação",
          description: "Falha de validação ou conflito simulado para teste de telemetria.",
          variant: "destructive",
        });
        break;
      case "rpc_fail":
        logRuntimeRpc(
          "simulate_edge_failure",
          { sampleParam: true },
          "error",
          240,
          undefined,
          new Error("RPC Timeout 504 simulado")
        );
        toast({
          title: "Falha RPC simulada",
          description: "Registro de falha gravado no log.",
        });
        break;
      case "unhandled":
        window.dispatchEvent(
          new ErrorEvent("error", {
            error: new Error("Unhandled Exception Simulada"),
            message: "Unhandled Exception Simulada",
            filename: "simulated-test.ts",
            lineno: 42,
          })
        );
        break;
    }
  };

  const getBadgeVariant = (type: DebugEventType) => {
    switch (type) {
      case "error":
        return "destructive";
      case "warn":
        return "secondary";
      case "rpc":
        return "outline";
      case "info":
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Info & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Bug className="w-6 h-6 text-rose-600" />
            Erros & Logs de Diagnóstico
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoramento em tempo real de falhas de runtime, alertas do sistema, auditoria de exceções e telemetria.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 border-rose-200 hover:bg-rose-50 dark:border-rose-900/50">
                <Play className="w-3.5 h-3.5 text-rose-600" />
                Simular Evento
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => simulateError("runtime")}>
                <Bug className="w-4 h-4 mr-2 text-rose-600" /> Erro de Runtime (Console/Error)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => simulateError("toast_destructive")}>
                <Flame className="w-4 h-4 mr-2 text-amber-600" /> Toast Destrutivo (UI Alert)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => simulateError("rpc_fail")}>
                <Terminal className="w-4 h-4 mr-2 text-indigo-600" /> Falha de RPC / Timeout
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => simulateError("unhandled")}>
                <AlertTriangle className="w-4 h-4 mr-2 text-red-600" /> Exceção Global (Window Error)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={exportLogsAsJson} className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Exportar JSON
          </Button>

          <Button variant="outline" size="sm" onClick={handleClearLogs} className="gap-1.5 text-muted-foreground hover:text-rose-600">
            <Trash2 className="w-3.5 h-3.5" />
            Limpar
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs font-medium">Total de Eventos</CardDescription>
            <CardTitle className="text-xl font-bold flex items-center justify-between">
              {stats.total}
              <Layers className="w-4 h-4 text-slate-400" />
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-rose-200 dark:border-rose-900/40 bg-rose-50/20 dark:bg-rose-950/10 shadow-sm">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs font-medium text-rose-700 dark:text-rose-300">Erros Críticos</CardDescription>
            <CardTitle className="text-xl font-bold text-rose-700 dark:text-rose-400 flex items-center justify-between">
              {stats.errorCount}
              <Bug className="w-4 h-4 text-rose-500" />
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-amber-200 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/10 shadow-sm">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs font-medium text-amber-700 dark:text-amber-300">Alertas UI (Toasts)</CardDescription>
            <CardTitle className="text-xl font-bold text-amber-700 dark:text-amber-400 flex items-center justify-between">
              {stats.toastDestructiveCount}
              <Flame className="w-4 h-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/20 dark:bg-indigo-950/10 shadow-sm">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Chamadas RPC</CardDescription>
            <CardTitle className="text-xl font-bold text-indigo-700 dark:text-indigo-400 flex items-center justify-between">
              {stats.rpcCount}
              <Terminal className="w-4 h-4 text-indigo-500" />
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Avisos & Info</CardDescription>
            <CardTitle className="text-xl font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
              {stats.warnCount + stats.infoCount}
              <Info className="w-4 h-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Telemetry Local Engine Status */}
      <Card className="border-blue-200 dark:border-blue-900/40 bg-gradient-to-r from-blue-50/40 via-sky-50/20 to-transparent dark:from-blue-950/20 shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                  Motor de Telemetria Local & Lote Inteligente
                </h4>
                {telemetryStore.isSpamBlocked ? (
                  <Badge variant="destructive" className="text-xs font-medium">Anti-Spam Ativo</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <ShieldCheck className="w-3 h-3 mr-1" /> Saudável
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Acúmulo local offline-first com disparo por lote ({telemetryStore.unsyncedActionsCount || 0}/15 ações pendentes) ou gatilhos de alto valor (gravação clínica, reconexão online, erros críticos).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <Button
              size="sm"
              variant="default"
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-sm"
              onClick={handleForceSync}
              disabled={isSyncing}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              Descarregar Lote Agora
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters and Search Bar */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardContent className="p-3.5">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filtrar por mensagem, escopo ou stack..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 w-full sm:w-44 text-xs font-medium">
                  <SelectValue placeholder="Tipo de Evento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos ({runtimeEvents.length})</SelectItem>
                  <SelectItem value="error">Erros ({stats.errorCount})</SelectItem>
                  <SelectItem value="warn">Avisos ({stats.warnCount})</SelectItem>
                  <SelectItem value="rpc">Chamadas RPC ({stats.rpcCount})</SelectItem>
                  <SelectItem value="info">Informativos ({stats.infoCount})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Feed List */}
      <div className="space-y-2.5">
        {filteredEvents.length === 0 ? (
          <Card className="border-dashed border-slate-200 dark:border-slate-800 p-8 text-center">
            <div className="max-w-sm mx-auto space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Nenhum evento encontrado</h3>
              <p className="text-xs text-muted-foreground">
                {searchTerm || typeFilter !== "all"
                  ? "Nenhum log corresponde aos filtros informados. Tente ajustar o termo de busca."
                  : "Nenhum erro de runtime ou exceção registrada nesta sessão. O sistema está estável."}
              </p>
            </div>
          </Card>
        ) : (
          filteredEvents.map((ev) => {
            const isExpanded = expandedEventId === ev.id;
            const hasExtraDetails = !!(ev.errorDetails?.stack || ev.context);

            return (
              <Card
                key={ev.id}
                className={`border transition-all ${
                  ev.type === "error"
                    ? "border-rose-200 dark:border-rose-900/50 bg-rose-50/10 hover:border-rose-300"
                    : ev.type === "warn"
                    ? "border-amber-200 dark:border-amber-900/50 bg-amber-50/10 hover:border-amber-300"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                }`}
              >
                <CardContent className="p-3.5 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getBadgeVariant(ev.type)} className="text-[11px] uppercase font-mono px-2 py-0.5">
                        {ev.type}
                      </Badge>
                      <code className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                        {ev.scope}
                      </code>
                      <span className="text-xs text-muted-foreground font-mono">
                        {ev.timeString}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100"
                        onClick={() => copyToClipboard(ev.message, "Mensagem do log")}
                      >
                        <Copy className="w-3 h-3 mr-1" /> Copiar
                      </Button>
                      {hasExtraDetails && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs font-medium"
                          onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                        >
                          {isExpanded ? "Ocultar Detalhes" : "Ver Detalhes"}
                        </Button>
                      )}
                    </div>
                  </div>

                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 break-words font-sans">
                    {ev.message}
                  </p>

                  {/* Expanded Stack Trace and Context */}
                  {isExpanded && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
                      {ev.errorDetails?.stack && (
                        <div>
                          <div className="flex items-center justify-between pb-1">
                            <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">Stack Trace:</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-[11px]"
                              onClick={() => copyToClipboard(ev.errorDetails?.stack || "", "Stack trace")}
                            >
                              <Copy className="w-3 h-3 mr-1" /> Copiar Stack
                            </Button>
                          </div>
                          <pre className="p-2.5 rounded-md bg-slate-950 text-slate-100 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap max-h-48">
                            {ev.errorDetails.stack}
                          </pre>
                        </div>
                      )}

                      {ev.context && (
                        <div>
                          <div className="flex items-center justify-between pb-1">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Contexto do Evento:</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-[11px]"
                              onClick={() => copyToClipboard(JSON.stringify(ev.context, null, 2), "Contexto")}
                            >
                              <Copy className="w-3 h-3 mr-1" /> Copiar JSON
                            </Button>
                          </div>
                          <pre className="p-2.5 rounded-md bg-slate-900 text-sky-300 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap max-h-48">
                            {JSON.stringify(ev.context, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
