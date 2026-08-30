import { useState, useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  Bug,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Database,
  ExternalLink,
  KeyRound,
  Play,
  RefreshCw,
  Search,
  Shield,
  SlidersHorizontal,
  Terminal,
  Trash2,
  UserCheck,
  XCircle,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { supabase } from "@/integrations/supabase/client";
import {
  useRuntimeDebugEvents,
  clearDebugEvents,
  logRuntimeRpc,
  type RuntimeDebugEvent,
} from "@/lib/runtime-debug";
import { ACCESS_CAPABILITIES, ACCESS_CAPABILITY_LABELS, AccessCapability } from "@/lib/rbac";
import { CLINIC_QUERY_KEYS, type ClinicDashboardAnalytics } from "@/hooks/queries/useClinicDataQueries";
import { formatMoneyCents } from "@/lib/session-operations";
import { useToast } from "@/hooks/use-toast";

import { appQueryClient } from "@/lib/query-client";

interface SimulationDebugPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SimulationDebugPanel({ open, onOpenChange }: SimulationDebugPanelProps) {
  const {
    can,
    clinic,
    clinicId,
    isPlatformOwner,
    isSuperAdmin,
    membership,
    operationalRole,
    platformAccess,
    platformMfaVerified,
    profile,
    simulatedRoleCapabilityOverrides = {},
    subscriptionPlan,
    user,
  } = useAuth();

  const location = useLocation();
  let queryClient = appQueryClient;
  try {
    const contextClient = useQueryClient();
    if (contextClient) queryClient = contextClient;
  } catch {
    queryClient = appQueryClient;
  }

  const { flagOverrides, flags, isFeatureEnabled } = useFeatureFlags();
  const { toast } = useToast();
  const debugEvents = useRuntimeDebugEvents();

  const [activeTab, setActiveTab] = useState<string>("diagnostico");
  const [logFilter, setLogFilter] = useState<"all" | "error" | "rpc" | "info">("all");
  const [logSearch, setLogSearch] = useState("");
  const [selectedQueryKey, setSelectedQueryKey] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Estado para teste em tempo real da RPC
  const [rpcTesting, setRpcTesting] = useState(false);
  const [rpcTestResult, setRpcTestResult] = useState<{
    status: "idle" | "success" | "error";
    durationMs?: number;
    data?: unknown;
    error?: unknown;
    timestamp?: string;
  }>({ status: "idle" });

  const errorCount = useMemo(
    () => debugEvents.filter((e) => e.type === "error").length,
    [debugEvents]
  );

  // Queries ativas no TanStack Query
  const [cacheQueries, setCacheQueries] = useState(() => queryClient.getQueryCache().getAll());

  useEffect(() => {
    if (!open) return;
    setCacheQueries(queryClient.getQueryCache().getAll());
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      setCacheQueries(queryClient.getQueryCache().getAll());
    });
    return unsubscribe;
  }, [open, queryClient]);

  // Analytics query atual do TanStack Query
  const currentYear = new Date().getFullYear();
  const analyticsQueryState = useMemo(() => {
    if (!clinicId) return null;
    const query = queryClient.getQueryCache().find({
      queryKey: CLINIC_QUERY_KEYS.analytics(clinicId, currentYear),
    });
    return query;
  }, [clinicId, currentYear, queryClient, cacheQueries]);

  const analyticsData = analyticsQueryState?.state?.data as ClinicDashboardAnalytics | undefined;

  // Executar teste manual da RPC
  const handleTestRpc = async () => {
    if (!clinicId) {
      toast({
        title: "Clínica não selecionada",
        description: "Não há um ID de clínica ativo no contexto.",
        variant: "destructive",
      });
      return;
    }

    setRpcTesting(true);
    const startTime = performance.now();
    try {
      const { data, error } = await supabase.rpc("get_clinic_dashboard_analytics", {
        _clinic_id: clinicId,
        _year: currentYear,
      });
      const durationMs = Math.round(performance.now() - startTime);

      if (error) {
        logRuntimeRpc("get_clinic_dashboard_analytics", { clinicId, year: currentYear }, "error", durationMs, null, error);
        setRpcTestResult({
          status: "error",
          durationMs,
          error,
          timestamp: new Date().toLocaleTimeString(),
        });
        toast({
          title: "Erro ao executar RPC",
          description: error.message || "A RPC retornou erro de execução.",
          variant: "destructive",
        });
      } else {
        logRuntimeRpc("get_clinic_dashboard_analytics", { clinicId, year: currentYear }, "success", durationMs, data);
        setRpcTestResult({
          status: "success",
          durationMs,
          data,
          timestamp: new Date().toLocaleTimeString(),
        });
        toast({
          title: "RPC executada com sucesso!",
          description: `Retornou em ${durationMs}ms com dados consolidados.`,
        });
      }
    } catch (err) {
      const durationMs = Math.round(performance.now() - startTime);
      setRpcTestResult({
        status: "error",
        durationMs,
        error: err,
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setRpcTesting(false);
    }
  };

  // Invalidação forçada de dados
  const handleInvalidateAll = async () => {
    await queryClient.invalidateQueries();
    toast({
      title: "Cache invalidado",
      description: "Todas as queries da aplicação estão sendo sincronizadas novamente.",
    });
  };

  // Copiar relatório completo de diagnóstico
  const handleCopyReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      route: location.pathname,
      search: location.search,
      clinic: {
        id: clinicId,
        name: clinic?.name,
        slug: clinic?.slug,
        routeKey: clinic?.route_key,
        plan: subscriptionPlan,
      },
      session: {
        userId: user?.id,
        email: user?.email,
        operationalRole,
        isPlatformOwner,
        platformMfaVerified,
        isSimulation: Boolean(platformAccess?.isSimulation),
        simulatedOverridesCount: Object.keys(simulatedRoleCapabilityOverrides).length,
      },
      analyticsRpcState: {
        status: analyticsQueryState?.state?.status,
        isFetching: analyticsQueryState?.state?.fetchStatus === "fetching",
        hasData: Boolean(analyticsData),
        data: analyticsData,
        error: analyticsQueryState?.state?.error,
      },
      activeQueries: cacheQueries.map((q) => ({
        key: q.queryKey,
        status: q.state.status,
        updatedAt: q.state.dataUpdatedAt ? new Date(q.state.dataUpdatedAt).toISOString() : null,
      })),
      recentLogs: debugEvents.slice(0, 15),
    };

    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    toast({
      title: "Relatório copiado!",
      description: "Os dados de diagnóstico foram copiados para a área de transferência.",
    });
  };

  // Filtragem de logs
  const filteredLogs = useMemo(() => {
    return debugEvents.filter((event) => {
      const matchesType = logFilter === "all" || event.type === logFilter;
      const matchesSearch =
        !logSearch ||
        event.scope.toLowerCase().includes(logSearch.toLowerCase()) ||
        event.message.toLowerCase().includes(logSearch.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [debugEvents, logFilter, logSearch]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl bg-neutral-950 border-neutral-800 text-neutral-100 shadow-2xl">
        {/* Header do Painel */}
        <DialogHeader className="p-4 sm:p-5 border-b border-neutral-800 bg-neutral-900/90 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Zap className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-white">
                    Painel de Debug & Diagnóstico em Tempo Real
                  </DialogTitle>
                  <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300 text-[10px] uppercase font-bold tracking-wider">
                    Backoffice
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-neutral-400 mt-0.5">
                  Análise e inspeção profunda de queries, RPCs, permissões e estado da página.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs bg-neutral-900 border-neutral-700 hover:bg-neutral-800 text-neutral-200 gap-1.5"
                onClick={handleCopyReport}
                title="Copiar relatório estruturado em JSON"
              >
                <Copy className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Copiar Relatório</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs bg-neutral-900 border-neutral-700 hover:bg-neutral-800 text-neutral-200 gap-1.5"
                onClick={handleInvalidateAll}
                title="Limpar e sincronizar todo o cache TanStack Query"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Recarregar Cache</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs de Navegação */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-4 sm:px-5 pt-3 border-b border-neutral-800/80 bg-neutral-900/40 shrink-0">
            <TabsList className="bg-neutral-900 border border-neutral-800 h-9 p-0.5 gap-1">
              <TabsTrigger
                value="diagnostico"
                onClick={() => setActiveTab("diagnostico")}
                className="data-[state=active]:bg-neutral-800 data-[state=active]:text-amber-400 text-xs px-3 py-1.5 gap-1.5"
              >
                <Activity className="h-3.5 w-3.5" />
                <span>Diagnóstico & Estatísticas</span>
              </TabsTrigger>
              <TabsTrigger
                value="permissoes"
                onClick={() => setActiveTab("permissoes")}
                className="data-[state=active]:bg-neutral-800 data-[state=active]:text-amber-400 text-xs px-3 py-1.5 gap-1.5"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>Papel & Permissões</span>
              </TabsTrigger>
              <TabsTrigger
                value="queries"
                onClick={() => setActiveTab("queries")}
                className="data-[state=active]:bg-neutral-800 data-[state=active]:text-amber-400 text-xs px-3 py-1.5 gap-1.5"
              >
                <Database className="h-3.5 w-3.5" />
                <span>React Query ({cacheQueries.length})</span>
              </TabsTrigger>
              <TabsTrigger
                value="flags"
                onClick={() => setActiveTab("flags")}
                className="data-[state=active]:bg-neutral-800 data-[state=active]:text-amber-400 text-xs px-3 py-1.5 gap-1.5"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Flags</span>
              </TabsTrigger>
              <TabsTrigger
                value="logs"
                onClick={() => setActiveTab("logs")}
                className="data-[state=active]:bg-neutral-800 data-[state=active]:text-amber-400 text-xs px-3 py-1.5 gap-1.5"
              >
                <Terminal className="h-3.5 w-3.5" />
                <span>Logs em Tempo Real</span>
                {errorCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-extrabold">
                    {errorCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ABA 1: Diagnóstico da Página & Estatísticas */}
          <TabsContent value="diagnostico" className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 m-0 focus-visible:outline-none">
            {/* Bloco de Contexto da Página Atual */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-1">
                <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Página / Rota Atual</p>
                <p className="text-xs font-mono text-amber-300 truncate" title={location.pathname}>
                  {location.pathname}
                </p>
                <p className="text-[10px] text-neutral-500">
                  {location.pathname.includes("dashboard")
                    ? "Estatísticas Completas da Clínica"
                    : location.pathname.startsWith("/clinica/")
                    ? "Homepage da Clínica (Prontuário)"
                    : "Área da Plataforma"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-1">
                <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Clínica Ativa</p>
                <p className="text-xs font-semibold text-white truncate" title={clinic?.name}>
                  {clinic?.name || "Nenhuma"}
                </p>
                <p className="text-[10px] font-mono text-neutral-400 truncate" title={clinicId ?? ""}>
                  ID: {clinicId ? `${clinicId.slice(0, 13)}...` : "Não definido"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-1">
                <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Modo de Operação</p>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="border-amber-400/30 bg-amber-400/10 text-amber-300 text-[10px]">
                    {platformAccess?.isSimulation ? "Simulação Backoffice" : "Suporte Ativo"}
                  </Badge>
                </div>
                <p className="text-[10px] text-neutral-400">
                  Plano Simulado: <span className="text-neutral-200 font-semibold">{subscriptionPlan ?? "clinic"}</span>
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-1">
                <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Status das Estatísticas</p>
                <div className="flex items-center gap-1.5">
                  {analyticsQueryState?.state?.status === "success" ? (
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Sincronizado
                    </Badge>
                  ) : analyticsQueryState?.state?.status === "error" ? (
                    <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-400 text-[10px]">
                      <XCircle className="h-3 w-3 mr-1" /> Erro na RPC
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-400 text-[10px]">
                      <Clock className="h-3 w-3 mr-1" /> Aguardando Consulta
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-neutral-400">
                  {analyticsData ? `${analyticsData.totalPatients} pacientes no cache` : "Sem dados no cache"}
                </p>
              </div>
            </div>

            {/* Diagnóstico Explicativo das Métricas */}
            <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                    <Database className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                      Diagnóstico Explicativo dos Dados
                    </h4>
                    <p className="text-[11px] text-neutral-400">
                      Entenda exatamente por que os números do dashboard aparecem como estão.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleTestRpc}
                  disabled={rpcTesting}
                  className="h-7 text-xs bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 gap-1.5"
                >
                  <Play className={`h-3 w-3 ${rpcTesting ? "animate-spin" : ""}`} />
                  <span>{rpcTesting ? "Testando RPC..." : "Testar RPC em Tempo Real"}</span>
                </Button>
              </div>

              {/* Explicação Inteligente dos Valores */}
              <div className="space-y-2 text-xs">
                {analyticsData ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80 space-y-1.5">
                      <div className="flex items-center justify-between text-neutral-300 font-semibold">
                        <span>Pacientes Cadastrados</span>
                        <span className="text-emerald-400 font-mono text-sm">{analyticsData.totalPatients}</span>
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        {analyticsData.totalPatients > 0
                          ? `✅ Foram encontrados ${analyticsData.totalPatients} pacientes na tabela 'patients' vinculados à clínica ${clinic?.name}.`
                          : "⚠️ Nenhum paciente foi encontrado com este clinic_id na tabela 'patients'."}
                      </p>
                      {analyticsData.patientStatusCounts && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {Object.entries(analyticsData.patientStatusCounts).map(([status, count]) => (
                            <Badge key={status} variant="secondary" className="bg-neutral-800 text-[10px]">
                              {status}: {count}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80 space-y-1.5">
                      <div className="flex items-center justify-between text-neutral-300 font-semibold">
                        <span>Atendimentos / Sessões</span>
                        <span className="text-emerald-400 font-mono text-sm">{analyticsData.totalSessions}</span>
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        {analyticsData.totalSessions > 0
                          ? `✅ ${analyticsData.totalSessions} sessões registradas (${analyticsData.paidSessions} pagas, ${analyticsData.canceledSessions} canceladas).`
                          : `ℹ️ Existem 0 atendimentos registrados na tabela 'sessions' para o clinic_id no ano ${currentYear}. Por este motivo, as receitas e gráficos de método de pagamento apresentam R$ 0,00 e 0.`}
                      </p>
                      <div className="text-[10px] text-neutral-400 pt-0.5">
                        Receita Prevista: <span className="text-white font-mono">{formatMoneyCents(analyticsData.financialTotals?.forecastRevenueCents ?? 0)}</span> · Quitado: <span className="text-emerald-400 font-mono">{formatMoneyCents(analyticsData.financialTotals?.paid ?? 0)}</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80 space-y-1.5">
                      <div className="flex items-center justify-between text-neutral-300 font-semibold">
                        <span>Agenda & Compromissos</span>
                        <span className="text-emerald-400 font-mono text-sm">{analyticsData.agendaCounts?.total ?? 0}</span>
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        {analyticsData.agendaCounts?.total > 0
                          ? `✅ ${analyticsData.agendaCounts.total} eventos ativos na tabela 'agenda_events' (${analyticsData.agendaCounts.confirmed} confirmados, ${analyticsData.agendaCounts.awaiting} aguardando).`
                          : "ℹ️ Nenhum agendamento futuro ou pendente na tabela 'agenda_events'."}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80 space-y-1.5">
                      <div className="flex items-center justify-between text-neutral-300 font-semibold">
                        <span>Grupos & Equipe</span>
                        <span className="text-emerald-400 font-mono text-sm">{analyticsData.topGroups?.length ?? 0} grupos</span>
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        {analyticsData.topGroups?.length > 0
                          ? `✅ ${analyticsData.topGroups.length} linhas de cuidado/grupos identificados nos atendimentos.`
                          : "ℹ️ Nenhum grupo com sessões associadas ainda."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-neutral-950/80 border border-amber-500/20 text-amber-200">
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 text-amber-400" />
                      Dados de analytics não carregados pelo React Query
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-1">
                      Clique no botão &quot;Testar RPC em Tempo Real&quot; acima para disparar uma requisição direta ao Supabase e inspecionar a resposta.
                    </p>
                  </div>
                )}
              </div>

              {/* Resultado do Teste Manual da RPC */}
              {rpcTestResult.status !== "idle" && (
                <div className="mt-3 p-3.5 rounded-lg bg-neutral-950 border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase text-neutral-400">Resultado do Teste RPC Direto</span>
                      {rpcTestResult.status === "success" ? (
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px]">
                          200 OK ({rpcTestResult.durationMs}ms)
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-300 text-[10px]">
                          ERRO ({rpcTestResult.durationMs}ms)
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-500">{rpcTestResult.timestamp}</span>
                  </div>

                  <pre className="p-3 rounded-md bg-neutral-900 text-[11px] font-mono text-neutral-300 overflow-x-auto max-h-56 border border-neutral-800/80">
                    {JSON.stringify(rpcTestResult.data || rpcTestResult.error, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ABA 2: Sessão, Papel & Permissões */}
          <TabsContent value="permissoes" className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 m-0 focus-visible:outline-none">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="p-4 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-amber-400" />
                  Identidade do Usuário
                </h4>
                <div className="space-y-1 text-xs text-neutral-300">
                  <p><span className="text-neutral-500">Nome:</span> {profile?.full_name || "Não informado"}</p>
                  <p><span className="text-neutral-500">Email:</span> {user?.email}</p>
                  <p><span className="text-neutral-500">User ID:</span> <span className="font-mono text-[11px]">{user?.id}</span></p>
                  <p><span className="text-neutral-500">Master / Platform Owner:</span> <span className={isPlatformOwner ? "text-emerald-400 font-bold" : "text-neutral-400"}>{isPlatformOwner ? "Sim" : "Não"}</span></p>
                  <p><span className="text-neutral-500">MFA AAL2:</span> <span className={platformMfaVerified ? "text-emerald-400" : "text-amber-400"}>{platformMfaVerified ? "Verificado" : "AAL1 (Padrão)"}</span></p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-400" />
                  Configuração da Simulação
                </h4>
                <div className="space-y-1 text-xs text-neutral-300">
                  <p><span className="text-neutral-500">Papel Simulado:</span> <Badge variant="outline" className="ml-1 border-amber-400/30 text-amber-300 text-[10px] uppercase font-bold">{operationalRole ?? "owner"}</Badge></p>
                  <p><span className="text-neutral-500">Plano Simulado:</span> <Badge variant="outline" className="ml-1 border-blue-400/30 text-blue-300 text-[10px] uppercase font-bold">{subscriptionPlan ?? "clinic"}</Badge></p>
                  <p><span className="text-neutral-500">Overrides de Permissão:</span> {Object.keys(simulatedRoleCapabilityOverrides).length} ativos</p>
                  <p><span className="text-neutral-500">Acesso Mestre Ativo:</span> {platformAccess ? "Sim (Sessão Registrada)" : "Não"}</p>
                </div>
              </div>
            </div>

            {/* Matriz de Avaliação RBAC em Tempo Real */}
            <div className="p-4 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-emerald-400" />
                Matriz de Avaliação RBAC na Página Atual
              </h4>
              <p className="text-[11px] text-neutral-400">
                Verificação em tempo real da função <code>can(capability)</code> para o papel e clínica simulados.
              </p>

              <div className="grid gap-2 sm:grid-cols-2">
                {ACCESS_CAPABILITIES.map((cap) => {
                  const allowed = can(cap);
                  const meta = ACCESS_CAPABILITY_LABELS[cap];
                  const isOverridden = cap in simulatedRoleCapabilityOverrides;

                  return (
                    <div
                      key={cap}
                      className="p-2.5 rounded-lg bg-neutral-950/70 border border-neutral-800/80 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-neutral-200">{meta?.label || cap}</span>
                          {isOverridden && (
                            <Badge variant="outline" className="border-amber-400/40 text-amber-300 text-[9px] px-1 py-0">
                              Override
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-neutral-500 font-mono truncate">{cap}</p>
                      </div>

                      {allowed ? (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] gap-1 shrink-0">
                          <CheckCircle2 className="h-3 w-3" /> Permitido
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] gap-1 shrink-0">
                          <XCircle className="h-3 w-3" /> Negado
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* ABA 3: React Query & Cache */}
          <TabsContent value="queries" className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 m-0 focus-visible:outline-none">
            <div className="flex items-center justify-between gap-2 border-b border-neutral-800 pb-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                  Cache TanStack Query ({cacheQueries.length} queries)
                </h4>
                <p className="text-[11px] text-neutral-400">
                  Inspeção em tempo real das queries em memória nesta janela do browser.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setCacheQueries(queryClient.getQueryCache().getAll())}
                className="h-7 text-xs bg-neutral-900 border-neutral-700 hover:bg-neutral-800 text-neutral-200 gap-1.5"
              >
                <RefreshCw className="h-3 w-3" />
                Atualizar Lista
              </Button>
            </div>

            <div className="space-y-2">
              {cacheQueries.map((query) => {
                const keyString = JSON.stringify(query.queryKey);
                const isSelected = selectedQueryKey === keyString;
                const status = query.state.status;
                const fetchStatus = query.state.fetchStatus;
                const data = query.state.data;
                const isArray = Array.isArray(data);
                const count = isArray ? data.length : data && typeof data === "object" ? Object.keys(data).length : null;

                return (
                  <div
                    key={keyString}
                    className="p-3 rounded-lg bg-neutral-900/70 border border-neutral-800 hover:border-neutral-700 transition-colors space-y-2"
                  >
                    <div
                      className="flex items-center justify-between gap-2 cursor-pointer"
                      onClick={() => setSelectedQueryKey(isSelected ? null : keyString)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isSelected ? <ChevronDown className="h-4 w-4 text-neutral-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-neutral-400 shrink-0" />}
                        <span className="text-xs font-mono text-amber-300 truncate" title={keyString}>
                          {keyString}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {count !== null && (
                          <Badge variant="secondary" className="bg-neutral-800 text-[10px] text-neutral-300">
                            {isArray ? `${count} itens` : `${count} campos`}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={
                            status === "success"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]"
                              : status === "error"
                              ? "border-rose-500/30 bg-rose-500/10 text-rose-400 text-[10px]"
                              : "border-blue-500/30 bg-blue-500/10 text-blue-400 text-[10px]"
                          }
                        >
                          {fetchStatus === "fetching" ? "Buscando..." : status}
                        </Badge>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="pt-2 border-t border-neutral-800/80 space-y-2">
                        <div className="flex items-center justify-between text-[10px] text-neutral-400">
                          <span>
                            Atualizado: {query.state.dataUpdatedAt ? new Date(query.state.dataUpdatedAt).toLocaleTimeString() : "Nunca"}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px] text-amber-400 hover:bg-neutral-800"
                            onClick={() => query.fetch()}
                          >
                            Refazer Fetch Agora
                          </Button>
                        </div>
                        <pre className="p-2.5 rounded bg-neutral-950 font-mono text-[11px] text-neutral-300 overflow-x-auto max-h-56 border border-neutral-800/80">
                          {JSON.stringify(query.state.data ?? query.state.error, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* ABA 4: Feature Flags */}
          <TabsContent value="flags" className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 m-0 focus-visible:outline-none">
            <div className="flex items-center justify-between gap-2 border-b border-neutral-800 pb-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                  Feature Flags da Sessão
                </h4>
                <p className="text-[11px] text-neutral-400">
                  Estado das funcionalidades ativadas para esta clínica e simulação.
                </p>
              </div>
              <Badge variant="outline" className="border-amber-400/30 bg-amber-400/10 text-amber-300 text-xs">
                {Object.keys(flagOverrides).length} overrides manuais
              </Badge>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(flags).map(([flagKey, isEnabled]) => {
                const isOverridden = flagKey in flagOverrides;
                return (
                  <div
                    key={flagKey}
                    className="p-2.5 rounded-lg bg-neutral-900/70 border border-neutral-800 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-neutral-200 truncate">{flagKey}</span>
                        {isOverridden && (
                          <Badge variant="outline" className="border-amber-400/40 text-amber-300 text-[9px] px-1 py-0">
                            Override
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Badge
                      className={
                        isEnabled
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px]"
                          : "bg-neutral-800 text-neutral-400 border border-neutral-700 text-[10px]"
                      }
                    >
                      {isEnabled ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* ABA 5: Logs em Tempo Real */}
          <TabsContent value="logs" className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 m-0 focus-visible:outline-none">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-lg border border-neutral-800">
                  <Button
                    type="button"
                    size="sm"
                    variant={logFilter === "all" ? "secondary" : "ghost"}
                    className="h-6 px-2 text-[10px]"
                    onClick={() => setLogFilter("all")}
                  >
                    Todos ({debugEvents.length})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={logFilter === "error" ? "secondary" : "ghost"}
                    className="h-6 px-2 text-[10px] text-rose-400"
                    onClick={() => setLogFilter("error")}
                  >
                    Erros ({errorCount})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={logFilter === "rpc" ? "secondary" : "ghost"}
                    className="h-6 px-2 text-[10px] text-amber-400"
                    onClick={() => setLogFilter("rpc")}
                  >
                    RPCs
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-40 sm:w-52">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
                  <Input
                    type="text"
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="Filtrar logs..."
                    className="h-7 pl-8 text-xs bg-neutral-900 border-neutral-800 text-neutral-200"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={clearDebugEvents}
                  className="h-7 px-2 text-neutral-400 hover:text-rose-400 hover:bg-neutral-900 gap-1 text-xs"
                  title="Limpar todos os logs da memória"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Limpar</span>
                </Button>
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-xs">
                Nenhum log ou evento capturado correspondente aos filtros.
              </div>
            ) : (
              <div className="space-y-2 font-mono text-xs">
                {filteredLogs.map((event) => {
                  const isExpanded = expandedLogId === event.id;
                  const isErr = event.type === "error";
                  const isRpc = event.type === "rpc";

                  return (
                    <div
                      key={event.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        isErr
                          ? "bg-rose-950/20 border-rose-900/50 text-rose-200"
                          : isRpc
                          ? "bg-amber-950/20 border-amber-900/50 text-amber-200"
                          : "bg-neutral-900/70 border-neutral-800 text-neutral-300"
                      }`}
                    >
                      <div
                        className="flex items-start justify-between gap-2 cursor-pointer"
                        onClick={() => setExpandedLogId(isExpanded ? null : event.id)}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-neutral-500">{event.timeString}</span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] uppercase font-bold px-1.5 py-0 ${
                                isErr
                                  ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                                  : isRpc
                                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                                  : "border-neutral-700 bg-neutral-800 text-neutral-300"
                              }`}
                            >
                              {event.type}
                            </Badge>
                            <span className="font-bold text-white text-[11px] truncate">{event.scope}</span>
                          </div>
                          <p className="text-xs leading-relaxed text-neutral-300 break-words">{event.message}</p>
                        </div>

                        {(event.context || event.errorDetails) && (
                          <span className="text-[10px] text-neutral-500 shrink-0">
                            {isExpanded ? "Fechar ▲" : "Detalhes ▼"}
                          </span>
                        )}
                      </div>

                      {isExpanded && (event.context || event.errorDetails) && (
                        <div className="mt-2.5 pt-2 border-t border-neutral-800 space-y-2">
                          {event.errorDetails?.stack && (
                            <pre className="p-2 rounded bg-neutral-950 text-[10px] text-rose-300/80 overflow-x-auto max-h-36">
                              {event.errorDetails.stack}
                            </pre>
                          )}
                          {event.context && (
                            <pre className="p-2 rounded bg-neutral-950 text-[10px] text-neutral-400 overflow-x-auto max-h-48">
                              {JSON.stringify(event.context, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
