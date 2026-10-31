import React, { useState, useMemo, useEffect } from "react";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Copy,
  Download,
  Filter,
  Flame,
  Layers,
  MessageSquare,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Terminal,
  Trash2,
  Sparkles,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  useRuntimeDebugEvents,
  clearDebugEvents,
  logRuntimeError,
  logRuntimeRpc,
  type DebugEventType,
  type RuntimeDebugEvent,
} from "@/lib/runtime-debug";
import { localTelemetryManager } from "@/lib/telemetry-local-store";
import { supabase } from "@/integrations/supabase/client";
import { queryAxiomLogs, type AxiomLogRecord } from "@/lib/telemetry/axiom-client";

// Modular subcomponents
import type { GroupedIssue, WhatsAppBugContext } from "./errors-logs/types";
import {
  isWhatsAppBugReport,
  formatWhatsAppPhone,
  isSafeHttpUrl,
  getWhatsAppDeepLink,
  groupEventsIntoIssues,
} from "./errors-logs/helpers";
import { IssuesList } from "./errors-logs/IssuesList";
import { IssueDetailModal } from "./errors-logs/IssueDetailModal";
import { WhatsAppReportsList } from "./errors-logs/WhatsAppReportsList";
import { SystemEventsFeed } from "./errors-logs/SystemEventsFeed";

// Re-export helpers for backwards compatibility with tests
export { isWhatsAppBugReport, formatWhatsAppPhone, isSafeHttpUrl, getWhatsAppDeepLink };
export type { WhatsAppBugContext };

export const PlatformErrorsLogsPage: React.FC = () => {
  const runtimeEvents = useRuntimeDebugEvents();
  const [dbEvents, setDbEvents] = useState<RuntimeDebugEvent[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "app_errors" | "whatsapp">("all");
  const [activeTab, setActiveTab] = useState<"issues" | "feed" | "whatsapp">("feed");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<GroupedIssue | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<{ url: string; alt: string } | null>(null);

  // Read telemetry local store state
  const telemetryStore = localTelemetryManager.getStore();

  // Load persistent errors from Axiom Cloud (with fallback to Supabase if Axiom not configured)
  useEffect(() => {
    let isMounted = true;
    const fetchLogs = async () => {
      try {
        // 1. Tentar consultar Axiom Cloud em tempo real
        const axiomLogs = await queryAxiomLogs({ limit: 100 });
        if (axiomLogs && axiomLogs.length > 0 && isMounted) {
          const mapped: RuntimeDebugEvent[] = axiomLogs.map((item: AxiomLogRecord) => {
            const date = new Date(item._time);
            const timeString = `${date.getHours().toString().padStart(2, "0")}:${date
              .getMinutes()
              .toString()
              .padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;

            return {
              id: item.id,
              timestamp: date.getTime(),
              timeString,
              type: (item.event_type as DebugEventType) || "error",
              scope: item.scope || "runtime",
              message: item.message || "Evento sem mensagem",
              context: {
                ...(typeof item.context === "object" && item.context !== null ? item.context : {}),
                user_id: item.user_id,
                clinic_id: item.clinic_id,
                route: item.route,
                service: item.service,
                environment: item.environment,
              },
              errorDetails: item.stack
                ? {
                    message: item.message || "Erro",
                    stack: item.stack,
                  }
                : undefined,
            };
          });
          setDbEvents(mapped);
          return;
        }

        // 2. Fallback caso Axiom não esteja configurado localmente
        const { data, error } = await supabase.rpc("list_platform_error_logs", {
          _limit: 100,
          _error_type: null,
          _search: null,
        });

        if (error) {
          console.warn("[PlatformErrorsLogsPage] Falha ao buscar logs do Supabase:", error.message);
          return;
        }

        if (data && isMounted) {
          const mapped: RuntimeDebugEvent[] = data.map((item: any) => {
            const date = new Date(item.created_at);
            const timeString = `${date.getHours().toString().padStart(2, "0")}:${date
              .getMinutes()
              .toString()
              .padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;

            return {
              id: item.id,
              timestamp: date.getTime(),
              timeString,
              type: "error",
              scope: item.scope || "runtime",
              message: item.message,
              context: {
                ...(typeof item.context === "object" && item.context !== null ? item.context : {}),
                user_id: item.user_id,
                userName: item.user_name,
                userEmail: item.user_email,
                clinic_id: item.clinic_id,
                clinicName: item.clinic_name,
                route: item.route,
              },
              errorDetails: item.stack_trace
                ? {
                    message: item.message,
                    stack: item.stack_trace,
                  }
                : undefined,
            };
          });
          setDbEvents(mapped);
        }
      } catch (err) {
        console.warn("[PlatformErrorsLogsPage] Exceção ao consultar logs:", err);
      }
    };

    void fetchLogs();
    return () => {
      isMounted = false;
    };
  }, []);

  // Merge runtime events with database events (deduplicate by id or scope+message+timestamp)
  const allEvents = useMemo(() => {
    const seen = new Set<string>();
    const merged: RuntimeDebugEvent[] = [];

    for (const ev of [...runtimeEvents, ...dbEvents]) {
      const key = ev.id;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(ev);
      }
    }

    return merged.sort((a, b) => b.timestamp - a.timestamp);
  }, [runtimeEvents, dbEvents]);

  // WhatsApp reports vs App events
  const { whatsappReports, appEvents } = useMemo(() => {
    const wa: RuntimeDebugEvent[] = [];
    const app: RuntimeDebugEvent[] = [];

    for (const ev of allEvents) {
      if (isWhatsAppBugReport(ev)) {
        wa.push(ev);
      } else {
        app.push(ev);
      }
    }

    return { whatsappReports: wa, appEvents: app };
  }, [allEvents]);

  // Grouped issues for the Sentry-style view
  const groupedIssues = useMemo(() => {
    return groupEventsIntoIssues(appEvents);
  }, [appEvents]);

  // Filtered issues based on search and type
  const filteredIssues = useMemo(() => {
    return groupedIssues.filter((issue) => {
      if (typeFilter !== "all" && issue.type !== typeFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          issue.scope.toLowerCase().includes(q) ||
          issue.message.toLowerCase().includes(q) ||
          (issue.stack && issue.stack.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [groupedIssues, typeFilter, searchTerm]);

  // Filtered timeline feed
  const filteredFeedEvents = useMemo(() => {
    return allEvents.filter((ev) => {
      const isWa = isWhatsAppBugReport(ev);
      if (categoryFilter === "whatsapp" && !isWa) return false;
      if (categoryFilter === "app_errors" && isWa) return false;

      if (typeFilter !== "all" && ev.type !== typeFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesScope = ev.scope.toLowerCase().includes(q);
        const matchesMessage = ev.message.toLowerCase().includes(q);
        const matchesStack = ev.errorDetails?.stack?.toLowerCase().includes(q);
        const matchesContext = ev.context ? JSON.stringify(ev.context).toLowerCase().includes(q) : false;
        return matchesScope || matchesMessage || matchesStack || matchesContext;
      }
      return true;
    });
  }, [allEvents, categoryFilter, typeFilter, searchTerm]);

  // Filtered WhatsApp reports
  const filteredWhatsAppReports = useMemo(() => {
    return whatsappReports.filter((ev) => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const ctx = (ev.context || {}) as WhatsAppBugContext;
        return (
          ev.message.toLowerCase().includes(q) ||
          (ctx.leadName && ctx.leadName.toLowerCase().includes(q)) ||
          (ctx.clinicName && ctx.clinicName.toLowerCase().includes(q)) ||
          (ctx.phone && ctx.phone.includes(q))
        );
      }
      return true;
    });
  }, [whatsappReports, searchTerm]);

  // Statistics counters
  const stats = useMemo(() => {
    let errorCount = 0;
    let warnCount = 0;
    let rpcCount = 0;
    let toastDestructiveCount = 0;
    let infoCount = 0;

    for (const ev of allEvents) {
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
      total: allEvents.length,
      issuesCount: groupedIssues.length,
      errorCount,
      warnCount,
      rpcCount,
      toastDestructiveCount,
      infoCount,
      whatsappBugCount: whatsappReports.length,
    };
  }, [allEvents, groupedIssues, whatsappReports]);

  // Copy to clipboard helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado para a área de transferência",
      description: `${label} copiado com sucesso.`,
    });
  };

  // Export logs to JSON
  const exportLogsAsJson = () => {
    try {
      const dataStr = JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          telemetryStoreState: telemetryStore,
          events: allEvents,
          issues: groupedIssues,
        },
        null,
        2
      );
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `erros-e-bugs-${new Date().toISOString().slice(0, 10)}.json`;
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

  // Clear in-memory logs
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
  const simulateError = (type: "runtime" | "unhandled" | "toast_destructive" | "rpc_fail" | "whatsapp_report") => {
    switch (type) {
      case "whatsapp_report":
        logRuntimeError(
          "whatsapp.client_report",
          new Error("Não consigo emitir recibo para o paciente João da Silva, botão fica desabilitado"),
          {
            source: "whatsapp_bug_report",
            leadName: "Dra. Carolina Mendes",
            userName: "Dra. Carolina Mendes",
            clinicName: "Clínica FisioLife Pilates",
            phone: "11987654321",
            message: "Olá equipe, estou tentando emitir um recibo para a consulta de ontem mas o botão salvar permanece cinza. Segue o print da tela do erro.",
            imageUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=60",
          }
        );
        toast({
          title: "Relato de WhatsApp Simulado",
          description: "Relato de bug de cliente via WhatsApp registrado no feed.",
        });
        break;
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
            Monitoramento de erros e bugs em tempo real, agrupamento de issues, trilha de passos do usuário e telemetria.
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
              <DropdownMenuItem onClick={() => simulateError("whatsapp_report")}>
                <MessageSquare className="w-4 h-4 mr-2 text-emerald-600" /> Relato WhatsApp (Cliente)
              </DropdownMenuItem>
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-slate-300" onClick={() => setActiveTab("feed")}>
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs font-medium">Total de Eventos</CardDescription>
            <CardTitle className="text-xl font-bold flex items-center justify-between">
              {stats.total}
              <Layers className="w-4 h-4 text-slate-400" />
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Unique Issues Card */}
        <Card className="border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/20 dark:bg-indigo-950/10 shadow-sm cursor-pointer hover:border-indigo-300" onClick={() => setActiveTab("issues")}>
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
              Issues Únicas
            </CardDescription>
            <CardTitle className="text-xl font-bold text-indigo-700 dark:text-indigo-400 flex items-center justify-between">
              {stats.issuesCount}
              <Sparkles className="w-4 h-4 text-indigo-600" />
            </CardTitle>
          </CardHeader>
        </Card>

        {/* WhatsApp Reports Counter */}
        <Card
          className="border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm cursor-pointer hover:border-emerald-300"
          onClick={() => setActiveTab("whatsapp")}
        >
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
              Relatos WhatsApp
            </CardDescription>
            <CardTitle className="text-xl font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
              {stats.whatsappBugCount}
              <MessageSquare className="w-4 h-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-rose-200 dark:border-rose-900/40 bg-rose-50/20 dark:bg-rose-950/10 shadow-sm">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs font-medium text-rose-700 dark:text-rose-300">Erros Críticos</CardDescription>
            <CardTitle className="text-xl font-bold text-rose-700 dark:text-rose-400 flex items-center justify-between">
              {stats.errorCount}
              <Bug className="w-4 h-4 text-rose-600" />
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-amber-200 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/10 shadow-sm">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs font-medium text-amber-700 dark:text-amber-300">Alertas UI (Toasts)</CardDescription>
            <CardTitle className="text-xl font-bold text-amber-700 dark:text-amber-400 flex items-center justify-between">
              {stats.toastDestructiveCount}
              <Flame className="w-4 h-4 text-amber-600" />
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs font-medium">Chamadas RPC</CardDescription>
            <CardTitle className="text-xl font-bold flex items-center justify-between">
              {stats.rpcCount}
              <Terminal className="w-4 h-4 text-slate-400" />
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Telemetry Status Banner */}
      <Card className="bg-gradient-to-r from-blue-50/50 via-indigo-50/20 to-transparent dark:from-blue-950/20 dark:via-indigo-950/10 border-blue-100 dark:border-blue-900/40 shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
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
                Acúmulo local offline-first com disparo por lote ({telemetryStore.unsyncedActionsCount || 0}/15 ações pendentes) e sincronização com platform_error_logs.
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

      {/* Tabs and Search Controls */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardContent className="p-3.5 space-y-3">
          {/* Main Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 pb-1 border-b border-slate-100 dark:border-slate-800/80">
            <span className="text-xs font-medium text-muted-foreground mr-1">Visualização:</span>
            <Button
              variant={categoryFilter === "all" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs font-medium"
              onClick={() => {
                setCategoryFilter("all");
                setActiveTab("feed");
              }}
            >
              Todos ({allEvents.length})
            </Button>
            <Button
              variant={categoryFilter === "app_errors" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs font-medium gap-1.5"
              onClick={() => {
                setCategoryFilter("app_errors");
                setActiveTab("feed");
              }}
            >
              <Bug className="w-3.5 h-3.5 text-rose-500" />
              Erros de Aplicação (JS/Crash) ({appEvents.length})
            </Button>
            <Button
              variant={categoryFilter === "whatsapp" ? "default" : "outline"}
              size="sm"
              className={`h-7 text-xs font-medium gap-1.5 ${
                categoryFilter === "whatsapp"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-300 dark:border-emerald-800"
              }`}
              onClick={() => {
                setCategoryFilter("whatsapp");
                setActiveTab("whatsapp");
              }}
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
              Relatos de Clientes (WhatsApp) ({whatsappReports.length})
            </Button>
            <Button
              variant={activeTab === "issues" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs font-medium gap-1.5 border-indigo-200 text-indigo-700 dark:border-indigo-800 dark:text-indigo-300"
              onClick={() => {
                setCategoryFilter("all");
                setActiveTab("issues");
              }}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              Issues Agrupadas ({groupedIssues.length})
            </Button>
          </div>

          {/* Search bar & Type filter */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filtrar por mensagem, escopo, lead ou telefone..."
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
                  <SelectItem value="all">Todos os tipos ({allEvents.length})</SelectItem>
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

      {/* Main Content Area */}
      <div>
        {activeTab === "issues" ? (
          filteredIssues.length === 0 ? (
            <Card className="border-dashed border-slate-200 dark:border-slate-800 p-8 text-center">
              <div className="max-w-sm mx-auto space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Nenhuma issue encontrada</h3>
                <p className="text-xs text-muted-foreground">
                  Nenhum erro de aplicação registrado no momento. Todos os módulos operando com estabilidade.
                </p>
              </div>
            </Card>
          ) : (
            <IssuesList issues={filteredIssues} onSelectIssue={setSelectedIssue} />
          )
        ) : (
          filteredFeedEvents.length === 0 ? (
            <Card className="border-dashed border-slate-200 dark:border-slate-800 p-8 text-center">
              <div className="max-w-sm mx-auto space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Nenhum evento registrado</h3>
                <p className="text-xs text-muted-foreground">
                  Nenhum log corresponde aos filtros informados.
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredFeedEvents.map((ev) => {
                if (isWhatsAppBugReport(ev)) {
                  return (
                    <WhatsAppReportsList
                      key={ev.id}
                      reports={[ev]}
                      expandedId={expandedEventId}
                      onToggleExpand={(id) => setExpandedEventId(expandedEventId === id ? null : id)}
                      onZoomImage={setZoomedImage}
                      onCopy={copyToClipboard}
                    />
                  );
                }
                return (
                  <SystemEventsFeed
                    key={ev.id}
                    events={[ev]}
                    expandedId={expandedEventId}
                    onToggleExpand={(id) => setExpandedEventId(expandedEventId === id ? null : id)}
                    onCopy={copyToClipboard}
                  />
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Sentry-Style Issue Detail Modal */}
      <IssueDetailModal
        issue={selectedIssue}
        isOpen={!!selectedIssue}
        onClose={() => setSelectedIssue(null)}
      />

      {/* Image Zoom Dialog */}
      {zoomedImage && (
        <Dialog open={!!zoomedImage} onOpenChange={(open) => !open && setZoomedImage(null)}>
          <DialogContent className="max-w-3xl p-2 bg-slate-950 border-slate-800">
            <DialogHeader className="p-2 pb-0">
              <DialogTitle className="text-xs text-slate-400 font-mono">
                {zoomedImage.alt}
              </DialogTitle>
            </DialogHeader>
            <div className="relative overflow-hidden rounded flex items-center justify-center p-2">
              <img
                src={zoomedImage.url}
                alt={zoomedImage.alt}
                className="max-h-[80vh] w-auto object-contain rounded"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
