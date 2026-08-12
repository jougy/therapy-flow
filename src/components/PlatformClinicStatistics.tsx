import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  FileText,
  Printer,
  Camera,
  Eye,
  Clock,
  User,
  Sparkles,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface TelemetryRecord {
  id: string;
  clinic_id: string;
  user_id: string | null;
  user_name: string | null;
  event_type: "print_screen" | "document_print" | "page_view" | "export_pdf" | string;
  pathname: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface PlatformClinicStatisticsProps {
  clinicId: string;
  counts?: {
    sessions?: number;
    patients?: number;
    collaborators?: number;
    forms?: number;
  };
}

const formatPrecisionTimestamp = (isoString: string) => {
  if (!isoString) return "-";
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}.${ms}`;
};

const getEventBadge = (eventType: string) => {
  switch (eventType) {
    case "print_screen":
      return (
        <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900 flex items-center gap-1.5 font-medium">
          <Camera className="w-3.5 h-3.5 text-red-600" /> Captura de Tela (Print)
        </Badge>
      );
    case "document_print":
      return (
        <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900 flex items-center gap-1.5 font-medium">
          <Printer className="w-3.5 h-3.5 text-blue-600" /> Impressão de Doc
        </Badge>
      );
    case "export_pdf":
      return (
        <Badge className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900 flex items-center gap-1.5 font-medium">
          <Download className="w-3.5 h-3.5 text-purple-600" /> Exportação PDF
        </Badge>
      );
    case "page_view":
    default:
      return (
        <Badge variant="outline" className="bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-neutral-500" /> Navegação
        </Badge>
      );
  }
};

export const PlatformClinicStatistics: React.FC<PlatformClinicStatisticsProps> = ({
  clinicId,
  counts,
}) => {
  const [telemetryEvents, setTelemetryEvents] = useState<TelemetryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");

  const loadTelemetry = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("list_platform_telemetry_events", {
        _clinic_id: clinicId,
        _limit: 250,
      });

      if (error) throw error;
      setTelemetryEvents((data || []) as TelemetryRecord[]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao carregar telemetria";
      toast({
        title: "Erro na telemetria",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    void loadTelemetry();
  }, [loadTelemetry]);

  // Derived Analytics Metrics
  const metrics = useMemo(() => {
    let printsCount = 0;
    let printsDetected = 0;
    let docsPrinted = 0;
    let pdfExported = 0;
    let totalPageViews = 0;

    const pageStatsMap: Record<string, { views: number; totalDwellSeconds: number }> = {};
    const userStatsMap: Record<string, { views: number; prints: number; dwelledSeconds: number }> = {};

    telemetryEvents.forEach((ev) => {
      const uName = ev.user_name || "Anônimo";

      if (!userStatsMap[uName]) {
        userStatsMap[uName] = { views: 0, prints: 0, dwelledSeconds: 0 };
      }

      if (ev.event_type === "print_screen") {
        printsDetected += 1;
        printsCount += 1;
        userStatsMap[uName].prints += 1;
      } else if (ev.event_type === "document_print") {
        docsPrinted += 1;
      } else if (ev.event_type === "export_pdf") {
        pdfExported += 1;
      } else if (ev.event_type === "page_view") {
        totalPageViews += 1;
        userStatsMap[uName].views += 1;

        const dwell = Number(ev.metadata?.dwell_time_seconds || 0);
        if (dwell > 0) {
          userStatsMap[uName].dwelledSeconds += dwell;
        }

        const path = ev.pathname || "/";
        if (!pageStatsMap[path]) {
          pageStatsMap[path] = { views: 0, totalDwellSeconds: 0 };
        }
        pageStatsMap[path].views += 1;
        pageStatsMap[path].totalDwellSeconds += dwell;
      }
    });

    // Top Pages ranking
    const topPages = Object.entries(pageStatsMap)
      .map(([path, data]) => ({
        path,
        views: data.views,
        avgDwellSeconds: Math.round(data.totalDwellSeconds / Math.max(1, data.views)),
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    // Top Users ranking
    const topUsers = Object.entries(userStatsMap)
      .map(([name, data]) => ({
        name,
        views: data.views,
        prints: data.prints,
        avgDwellMinutes: Math.round((data.dwelledSeconds / Math.max(1, data.views)) / 60),
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    return {
      printsDetected,
      docsPrinted,
      pdfExported,
      totalPageViews,
      topPages,
      topUsers,
    };
  }, [telemetryEvents]);

  // Filtered Telemetry Logs
  const filteredEvents = useMemo(() => {
    return telemetryEvents.filter((ev) => {
      if (eventTypeFilter !== "all" && ev.event_type !== eventTypeFilter) {
        return false;
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchName = (ev.user_name || "").toLowerCase().includes(q);
        const matchPath = (ev.pathname || "").toLowerCase().includes(q);
        const matchType = (ev.event_type || "").toLowerCase().includes(q);
        return matchName || matchPath || matchType;
      }
      return true;
    });
  }, [telemetryEvents, eventTypeFilter, searchQuery]);

  // Intelligent Narrative Report
  const narrativeReport = useMemo(() => {
    const totalSessions = counts?.sessions || 0;
    const totalPatients = counts?.patients || 0;

    let narrative = `No período analisado, a clínica realizou um total de ${totalSessions} atendimentos cadastrados para ${totalPatients} pacientes ativos na plataforma. `;

    if (metrics.printsDetected > 0) {
      narrativaAlerta: narrative += `⚠️ ATENÇÃO DE SEGURANÇA: O sistema de proteção interceptou ${metrics.printsDetected} tentativa(s) de captura de tela (print screen) em áreas confidenciais. `;
    } else {
      narrative += `🔒 Nenhuma tentativa de captura não autorizada de tela foi detectada. A integridade dos prontuários foi preservada. `;
    }

    if (metrics.docsPrinted > 0 || metrics.pdfExported > 0) {
      narrative += `Foram registradas ${metrics.docsPrinted} impressões diretas de documentos e ${metrics.pdfExported} exportações formais em formato PDF. `;
    }

    if (metrics.topPages.length > 0) {
      narrative += `A rota com maior índice de permanência e engajamento da equipe foi "${metrics.topPages[0].path}" (tempo médio de permanência de ${metrics.topPages[0].avgDwellSeconds}s por sessão).`;
    }

    return narrative;
  }, [counts, metrics]);

  const [clearing, setClearing] = useState(false);

  const handleCleanup = async () => {
    setClearing(true);
    try {
      const { data, error } = await supabase.rpc("cleanup_old_telemetry_events", {
        _page_view_retention_days: 15,
        _security_event_retention_days: 90,
      });

      if (error) throw error;
      const res = data as unknown as { deleted_page_views?: number; deleted_security_events?: number }[];
      const deletedPv = res?.[0]?.deleted_page_views ?? 0;

      toast({
        title: "Manutenção Concluída",
        description: `Foram removidos ${deletedPv} registros de navegação com mais de 15 dias. Banco otimizado.`,
      });
      void loadTelemetry();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro na manutenção de logs";
      toast({ title: "Erro na manutenção", description: message, variant: "destructive" });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" /> Telemetria & Estatísticas da Clínica
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Painel exclusivo Backoffice para monitoramento de acessos, dwell time e auditoria anti-print em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleCleanup()}
            disabled={clearing || loading}
            className="h-9 px-3 text-xs text-neutral-500 hover:text-amber-700 dark:hover:text-amber-400"
            title="Remove registros de navegação com mais de 15 dias para manter o banco leve no plano gratuito"
          >
            {clearing ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : "🧹 Cleansing (+15d)"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadTelemetry()}
            disabled={loading}
            className="h-9 px-3"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar Dados
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-neutral-200/70 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Atendimentos</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">{counts?.sessions ?? 0}</p>
              <p className="text-xs text-neutral-500">{counts?.patients ?? 0} pacientes totais</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200/70 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prints Interceptados</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{metrics.printsDetected}</p>
              <p className="text-xs text-neutral-500">Alerta e desfoque acionados</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-red-50 dark:bg-red-950 text-red-600 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200/70 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Impressões & PDFs</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{metrics.docsPrinted + metrics.pdfExported}</p>
              <p className="text-xs text-neutral-500">{metrics.docsPrinted} impressão | {metrics.pdfExported} PDF</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200/70 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Páginas Visualizadas</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">{metrics.totalPageViews}</p>
              <p className="text-xs text-neutral-500">Com tempo de permanência</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Intelligent Narrative Report */}
      <Card className="border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-amber-900 dark:text-amber-300">
            <Sparkles className="w-4 h-4 text-amber-600" /> Relatório Narrativo Inteligente da Clínica
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-950 dark:text-amber-200 leading-relaxed font-medium">
            {narrativeReport}
          </p>
        </CardContent>
      </Card>

      {/* Analytics Breakdown: Ranking & Most Visited Pages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Most Visited Pages */}
        <Card className="shadow-sm border-neutral-200/80">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Páginas Mais Acessadas & Permanência
            </CardTitle>
            <CardDescription>Top 5 rotas com maior número de acessos e tempo médio navegados.</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.topPages.length === 0 ? (
              <div className="p-6 text-center text-sm text-neutral-500 border border-dashed rounded-lg">
                Nenhum dado de navegação registrado ainda.
              </div>
            ) : (
              <div className="space-y-3">
                {metrics.topPages.map((page, idx) => (
                  <div key={page.path} className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-mono text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                        {idx + 1}. {page.path}
                      </p>
                      <p className="text-xs text-muted-foreground">{page.views} visualização(ões)</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 font-mono text-xs">
                      ~{page.avgDwellSeconds}s por sessão
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Activity Ranking */}
        <Card className="shadow-sm border-neutral-200/80">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-primary" /> Atividade Por Profissional / Colaborador
            </CardTitle>
            <CardDescription>Visualizações de telas e capturas de tela tentadas por conta.</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.topUsers.length === 0 ? (
              <div className="p-6 text-center text-sm text-neutral-500 border border-dashed rounded-lg">
                Nenhum usuário registrado com telemetria ativa.
              </div>
            ) : (
              <div className="space-y-3">
                {metrics.topUsers.map((u) => (
                  <div key={u.name} className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
                    <div className="space-y-0.5">
                      <p className="font-medium text-sm text-neutral-900 dark:text-neutral-100">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.views} páginas acessadas</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {u.prints > 0 && (
                        <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 font-mono text-xs">
                          📷 {u.prints} print(s)
                        </Badge>
                      )}
                      <Badge variant="outline" className="font-mono text-xs">
                        ~{u.avgDwellMinutes} min/pág
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Real-time Audit & Telemetry Log Table */}
      <Card className="shadow-sm border-neutral-200/80">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Log de Auditoria & Telemetria em Tempo Real
            </CardTitle>
            <CardDescription>
              Registro sequencial detalhado com selo de data/hora de milissegundos (DD/MM/YYYY HH:mm:ss.SSS).
            </CardDescription>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filtrar por nome ou rota..."
                className="h-9 pl-8 text-xs bg-neutral-50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
              <SelectTrigger className="h-9 w-full sm:w-[160px] text-xs bg-neutral-50">
                <SelectValue placeholder="Tipo de evento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os eventos</SelectItem>
                <SelectItem value="print_screen">📷 Captura de Tela</SelectItem>
                <SelectItem value="document_print">🖨️ Impressão</SelectItem>
                <SelectItem value="export_pdf">📁 Exportação PDF</SelectItem>
                <SelectItem value="page_view">📄 Navegação</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm animate-pulse">
              Carregando eventos de telemetria...
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-500 border border-dashed rounded-xl">
              Nenhum evento registrado com os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-800/40 text-neutral-500 dark:text-neutral-400 font-semibold">
                    <th className="py-3 px-4">Selo Data / Hora (Preciso)</th>
                    <th className="py-3 px-4">Tipo de Ação</th>
                    <th className="py-3 px-4">Usuário / Profissional</th>
                    <th className="py-3 px-4">Página (Rota)</th>
                    <th className="py-3 px-4">Metadados & Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                  {filteredEvents.map((ev) => (
                    <tr key={ev.id} className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                        {formatPrecisionTimestamp(ev.created_at)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getEventBadge(ev.event_type)}
                      </td>
                      <td className="py-3 px-4 font-medium text-neutral-900 dark:text-neutral-100">
                        {ev.user_name || "Desconhecido"}
                      </td>
                      <td className="py-3 px-4 font-mono text-neutral-600 dark:text-neutral-400">
                        {ev.pathname}
                      </td>
                      <td className="py-3 px-4 text-neutral-500 font-mono text-[11px] max-w-[280px] truncate" title={JSON.stringify(ev.metadata)}>
                        {JSON.stringify(ev.metadata)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};
