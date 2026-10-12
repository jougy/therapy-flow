import React, { useState, useMemo } from "react";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Flame,
  Info,
  Layers,
  MessageSquare,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Terminal,
  Trash2,
  User,
  Zap,
  ZoomIn,
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

/**
 * Interface com os campos esperados no contexto para bugs reportados via WhatsApp
 */
export interface WhatsAppBugContext {
  source?: string;
  leadName?: string;
  userName?: string;
  clinicName?: string;
  phone?: string;
  message?: string;
  imageUrl?: string;
  [key: string]: unknown;
}

/**
 * Helper para verificar se um evento tem origem no WhatsApp
 */
export const isWhatsAppBugReport = (ev: RuntimeDebugEvent): boolean => {
  if (ev.context?.source === "whatsapp_bug_report") return true;
  if (ev.scope === "whatsapp_bug_report" || ev.scope.includes("whatsapp")) return true;
  return false;
};

/**
 * Formata telefone brasileiro amigavelmente: (11) 99999-9999
 */
export const formatWhatsAppPhone = (phone?: string): string => {
  if (!phone) return "Telefone não informado";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 13 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const num = digits.slice(4);
    return `+55 (${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
  }
  return phone;
};

/**
 * Valida se uma URL é HTTP ou HTTPS legítima, prevenindo esquemas perigosos como javascript: ou data:
 */
export const isSafeHttpUrl = (url?: string | null): boolean => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Gera URL direta do WhatsApp (wa.me/55...)
 */
export const getWhatsAppDeepLink = (phone?: string, leadName?: string): string => {
  if (!phone) return "#";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "#";
  const fullDigits = digits.startsWith("55") ? digits : `55${digits}`;
  const greeting = leadName ? `Olá ${leadName}, tudo bem?` : "Olá, tudo bem?";
  const text = `${greeting} Vi o seu relato de suporte/erro no Pluri-Health e estou entrando em contato para te ajudar.`;
  return `https://wa.me/${fullDigits}?text=${encodeURIComponent(text)}`;
};

export const PlatformErrorsLogsPage: React.FC = () => {
  const runtimeEvents = useRuntimeDebugEvents();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "app_errors" | "whatsapp">("all");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<{ url: string; alt: string } | null>(null);

  // Read telemetry local store state
  const telemetryStore = localTelemetryManager.getStore();

  // Filtered events
  const filteredEvents = useMemo(() => {
    return runtimeEvents.filter((ev) => {
      // Category quick filter
      const isWa = isWhatsAppBugReport(ev);
      if (categoryFilter === "whatsapp" && !isWa) {
        return false;
      }
      if (categoryFilter === "app_errors" && isWa) {
        return false;
      }

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
  }, [runtimeEvents, typeFilter, categoryFilter, searchTerm]);

  // Statistics counters
  const stats = useMemo(() => {
    let errorCount = 0;
    let warnCount = 0;
    let rpcCount = 0;
    let toastDestructiveCount = 0;
    let infoCount = 0;
    let whatsappBugCount = 0;

    for (const ev of runtimeEvents) {
      if (isWhatsAppBugReport(ev)) {
        whatsappBugCount += 1;
      }
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
      whatsappBugCount,
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
            Monitoramento em tempo real de falhas de runtime, relatos de bugs via WhatsApp, alertas do sistema e telemetria.
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
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs font-medium">Total de Eventos</CardDescription>
            <CardTitle className="text-xl font-bold flex items-center justify-between">
              {stats.total}
              <Layers className="w-4 h-4 text-slate-400" />
            </CardTitle>
          </CardHeader>
        </Card>

        {/* WhatsApp Reports Counter */}
        <Card
          className="border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm cursor-pointer hover:border-emerald-300"
          onClick={() => setCategoryFilter(categoryFilter === "whatsapp" ? "all" : "whatsapp")}
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

        <Card className="border-sky-200 dark:border-sky-900/40 bg-sky-50/20 dark:bg-sky-950/10 shadow-sm">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs font-medium text-sky-700 dark:text-sky-300">Avisos & Info</CardDescription>
            <CardTitle className="text-xl font-bold text-sky-700 dark:text-sky-400 flex items-center justify-between">
              {stats.warnCount + stats.infoCount}
              <Info className="w-4 h-4 text-sky-500" />
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

      {/* Quick Category Filter Bar + Search Bar */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardContent className="p-3.5 space-y-3">
          {/* Quick Filters Pill Selector */}
          <div className="flex flex-wrap items-center gap-2 pb-1 border-b border-slate-100 dark:border-slate-800/80">
            <span className="text-xs font-medium text-muted-foreground mr-1">Filtrar Origem:</span>
            <Button
              variant={categoryFilter === "all" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs font-medium"
              onClick={() => setCategoryFilter("all")}
            >
              Todos ({runtimeEvents.length})
            </Button>
            <Button
              variant={categoryFilter === "app_errors" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs font-medium gap-1.5"
              onClick={() => setCategoryFilter("app_errors")}
            >
              <Bug className="w-3 h-3 text-rose-500" />
              Erros de Aplicação (JS/Crash) ({runtimeEvents.length - stats.whatsappBugCount})
            </Button>
            <Button
              variant={categoryFilter === "whatsapp" ? "default" : "outline"}
              size="sm"
              className={`h-7 text-xs font-medium gap-1.5 ${
                categoryFilter === "whatsapp"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-300 dark:border-emerald-800"
              }`}
              onClick={() => setCategoryFilter("whatsapp")}
            >
              <MessageSquare className="w-3 h-3 text-emerald-500" />
              Relatos de Clientes (WhatsApp) ({stats.whatsappBugCount})
            </Button>
          </div>

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
      <div className="space-y-3">
        {filteredEvents.length === 0 ? (
          <Card className="border-dashed border-slate-200 dark:border-slate-800 p-8 text-center">
            <div className="max-w-sm mx-auto space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Nenhum evento encontrado</h3>
              <p className="text-xs text-muted-foreground">
                {searchTerm || typeFilter !== "all" || categoryFilter !== "all"
                  ? "Nenhum log corresponde aos filtros informados. Tente ajustar o termo de busca ou alternar o filtro de origem."
                  : "Nenhum erro de runtime ou exceção registrada nesta sessão. O sistema está estável."}
              </p>
            </div>
          </Card>
        ) : (
          filteredEvents.map((ev) => {
            const isExpanded = expandedEventId === ev.id;
            const isWa = isWhatsAppBugReport(ev);
            const ctx = (ev.context || {}) as WhatsAppBugContext;
            const hasExtraDetails = !!(ev.errorDetails?.stack || ev.context);

            const leadName = ctx.leadName || ctx.userName || "Cliente WhatsApp";
            const clinicName = ctx.clinicName || "Consultório";
            const phone = ctx.phone;
            const clientMessage = ctx.message || ev.message;
            const imageUrl = ctx.imageUrl;
            const waDeepLink = phone ? getWhatsAppDeepLink(phone, leadName) : null;

            // SPECIAL CARD FOR WHATSAPP BUG REPORTS
            if (isWa) {
              return (
                <Card
                  key={ev.id}
                  className="border-2 border-emerald-300 dark:border-emerald-800/80 bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/20 dark:from-emerald-950/30 dark:via-slate-900 dark:to-emerald-950/10 shadow-sm transition-all hover:border-emerald-400"
                >
                  <CardContent className="p-4 space-y-3">
                    {/* Header: WhatsApp Badge + Identification */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Green WhatsApp Badge with MessageSquare icon */}
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-2.5 py-1 text-xs gap-1.5 shadow-sm">
                          <MessageSquare className="w-3.5 h-3.5" />
                          Relato de Bug (WhatsApp)
                        </Badge>

                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 font-mono">
                          {ev.timeString}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {waDeepLink && (
                          <Button
                            asChild
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8 text-xs font-medium shadow-sm"
                          >
                            <a href={waDeepLink} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-3.5 h-3.5" />
                              Chamar no WhatsApp (+55...)
                            </a>
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-xs"
                          onClick={() => copyToClipboard(clientMessage, "Mensagem do cliente")}
                        >
                          <Copy className="w-3 h-3 mr-1" /> Copiar Mensagem
                        </Button>
                      </div>
                    </div>

                    {/* Customer Identification */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-md border border-emerald-100 dark:border-emerald-900/40">
                      <div className="flex items-center gap-1.5 font-medium">
                        <User className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Titular: <strong>{leadName}</strong></span>
                      </div>
                      <div className="text-slate-400 dark:text-slate-600">•</div>
                      <div>
                        Clínica: <strong>{clinicName}</strong>
                      </div>
                      <div className="text-slate-400 dark:text-slate-600">•</div>
                      <div>
                        Telefone: <strong>{formatWhatsAppPhone(phone)}</strong>
                      </div>
                    </div>

                    {/* Message Detailed View */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        Mensagem relatada pelo cliente:
                      </span>
                      <div className="p-3 rounded-md bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/50 text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
                        {clientMessage}
                      </div>
                    </div>

                    {/* Image Attachment Preview with Zoom */}
                    {imageUrl && isSafeHttpUrl(imageUrl) && (
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Print/Imagem anexada pelo cliente:
                        </span>
                        <div className="relative group w-fit">
                          <button
                            type="button"
                            onClick={() => setZoomedImage({ url: imageUrl, alt: `Print anexado por ${leadName}` })}
                            className="relative block rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 hover:border-emerald-500 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <img
                              src={imageUrl}
                              alt={`Print anexado por ${leadName}`}
                              className="max-h-48 max-w-xs object-cover rounded-md group-hover:scale-105 transition-transform duration-200"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-medium gap-1">
                              <ZoomIn className="w-4 h-4" />
                              Ampliar Imagem
                            </div>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Collapsible raw context / stack */}
                    {hasExtraDetails && (
                      <div className="pt-2 border-t border-emerald-100 dark:border-emerald-900/40">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs font-medium text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/50"
                          onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                        >
                          {isExpanded ? "Ocultar Dados Técnicos" : "Ver Dados Técnicos / Contexto"}
                        </Button>

                        {isExpanded && (
                          <div className="mt-2 space-y-2">
                            {ev.errorDetails?.stack && (
                              <pre className="p-2 rounded bg-slate-950 text-slate-100 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap max-h-40">
                                {ev.errorDetails.stack}
                              </pre>
                            )}
                            {ev.context && (
                              <pre className="p-2 rounded bg-slate-900 text-emerald-300 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap max-h-40">
                                {JSON.stringify(ev.context, null, 2)}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            }

            // STANDARD SYSTEM ERROR/EVENT CARD
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

      {/* Modal / Dialog de Zoom para Prints anexados */}
      <Dialog open={!!zoomedImage} onOpenChange={(open) => !open && setZoomedImage(null)}>
        <DialogContent className="max-w-3xl p-3 bg-slate-950 text-white border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-slate-200 flex items-center justify-between pr-6">
              <span>{zoomedImage?.alt || "Visualização de Imagem"}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-2 max-h-[80vh] overflow-auto">
            {zoomedImage && (
              <img
                src={zoomedImage.url}
                alt={zoomedImage.alt}
                className="max-h-[75vh] w-auto object-contain rounded-md"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

