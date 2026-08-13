import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Activity,
  Printer,
  Camera,
  Eye,
  Clock,
  Sparkles,
  RefreshCw,
  Search,
  ShieldCheck,
  Download,
  AlertOctagon,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface UserTelemetryRecord {
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

export interface UserSummaryRecord {
  id: string;
  user_id: string;
  clinic_id: string;
  summary_date: string;
  user_name: string;
  page_views_count: number;
  prints_detected_count: number;
  docs_printed_count: number;
  pdf_exported_count: number;
  dwell_time_seconds: number;
  top_routes: Record<string, number>;
  is_spam_flagged: boolean;
  spam_reason: string | null;
  updated_at: string;
}

export interface PlatformUserStatisticsProps {
  userId: string;
  userName?: string;
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

export const PlatformUserStatistics: React.FC<PlatformUserStatisticsProps> = ({
  userId,
  userName,
}) => {
  const [telemetryEvents, setTelemetryEvents] = useState<UserTelemetryRecord[]>([]);
  const [userSummaries, setUserSummaries] = useState<UserSummaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");

  const loadTelemetry = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [eventsRes, summariesRes] = await Promise.all([
        supabase.rpc("list_platform_user_telemetry_events", {
          _user_id: userId,
          _limit: 250,
        }),
        supabase.from("user_telemetry_summaries").select("*").eq("user_id", userId).order("summary_date", { ascending: false }),
      ]);

      if (eventsRes.error) throw eventsRes.error;
      if (summariesRes.error) throw summariesRes.error;

      setTelemetryEvents((eventsRes.data || []) as UserTelemetryRecord[]);
      setUserSummaries((summariesRes.data || []) as UserSummaryRecord[]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao carregar estatísticas do usuário";
      toast({
        title: "Erro na telemetria do usuário",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadTelemetry();
  }, [loadTelemetry]);

  // Anti-Spam Check
  const spamAlert = useMemo(() => {
    const flagged = userSummaries.find((s) => s.is_spam_flagged);
    if (!flagged) return null;
    return {
      reason: flagged.spam_reason || "Rate limit de requisições excedido pelo cliente (suspeita de spam).",
      date: flagged.summary_date,
    };
  }, [userSummaries]);

  // Derived Analytics Metrics (Aggregated from Summaries & Events)
  const metrics = useMemo(() => {
    let printsDetected = 0;
    let docsPrinted = 0;
    let pdfExported = 0;
    let totalPageViews = 0;
    let totalDwellSeconds = 0;
    const pageStatsMap: Record<string, number> = {};

    if (userSummaries.length > 0) {
      userSummaries.forEach((sum) => {
        printsDetected += sum.prints_detected_count || 0;
        docsPrinted += sum.docs_printed_count || 0;
        pdfExported += sum.pdf_exported_count || 0;
        totalPageViews += sum.page_views_count || 0;
        totalDwellSeconds += sum.dwell_time_seconds || 0;

        if (sum.top_routes && typeof sum.top_routes === "object") {
          Object.entries(sum.top_routes).forEach(([route, count]) => {
            pageStatsMap[route] = (pageStatsMap[route] || 0) + Number(count);
          });
        }
      });
    } else {
      telemetryEvents.forEach((ev) => {
        if (ev.event_type === "print_screen") printsDetected += 1;
        else if (ev.event_type === "document_print") docsPrinted += 1;
        else if (ev.event_type === "export_pdf") pdfExported += 1;
        else if (ev.event_type === "page_view") {
          totalPageViews += 1;
          const dwell = Number(ev.metadata?.dwell_time_seconds || 0);
          if (dwell > 0) totalDwellSeconds += dwell;
          const path = ev.pathname || "/";
          pageStatsMap[path] = (pageStatsMap[path] || 0) + 1;
        }
      });
    }

    const avgDwellSeconds = Math.round(totalDwellSeconds / Math.max(1, totalPageViews));

    // Top Pages ranking for this user
    const topPages = Object.entries(pageStatsMap)
      .map(([path, views]) => ({
        path,
        views,
        avgDwellSeconds: Math.round(totalDwellSeconds / Math.max(1, totalPageViews)),
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    return {
      printsDetected,
      docsPrinted,
      pdfExported,
      totalPageViews,
      avgDwellSeconds,
      topPages,
    };
  }, [userSummaries, telemetryEvents]);

  // Filtered Telemetry Logs
  const filteredEvents = useMemo(() => {
    return telemetryEvents.filter((ev) => {
      if (eventTypeFilter !== "all" && ev.event_type !== eventTypeFilter) {
        return false;
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchPath = (ev.pathname || "").toLowerCase().includes(q);
        const matchType = (ev.event_type || "").toLowerCase().includes(q);
        return matchPath || matchType;
      }
      return true;
    });
  }, [telemetryEvents, eventTypeFilter, searchQuery]);

  // Intelligent Narrative Report
  const narrativeReport = useMemo(() => {
    const name = userName || "Este usuário";
    let narrative = `${name} acumulou um resumo acumulado de ${metrics.totalPageViews} visualizações de páginas navegadas na plataforma (100% otimizado via cliente). `;

    if (metrics.printsDetected > 0) {
      narrative += `⚠️ ATENÇÃO DE SEGURANÇA: Esta conta possui ${metrics.printsDetected} registro(s) de tentativa de captura de tela (print screen) interceptados localmente no cliente. `;
    } else {
      narrative += `🔒 Nenhuma tentativa de captura de tela não autorizada foi registrada para este perfil. `;
    }

    if (metrics.docsPrinted > 0 || metrics.pdfExported > 0) {
      narrative += `Disparou ${metrics.docsPrinted} impressão(ões) de documentos e ${metrics.pdfExported} exportação(ões) em arquivo PDF. `;
    }

    if (metrics.topPages.length > 0) {
      narrative += `Sua página de maior frequência de trabalho é "${metrics.topPages[0].path}".`;
    }

    return narrative;
  }, [userName, metrics]);

  return (
    <div className="space-y-6">
      
      {/* Anti-Spam / Rate Limit Alert Banner */}
      {spamAlert && (
        <Card className="border-red-300 bg-red-500/10 dark:bg-red-950/40 dark:border-red-800 shadow-md animate-pulse">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-red-900 dark:text-red-200">
              <AlertOctagon className="w-5 h-5 text-red-600 dark:text-red-400" />
              🚨 Alerta Backoffice: Notificação de Anti-Spam / Bloqueio Temporário
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
              {spamAlert.reason}
            </p>
            <p className="text-xs text-red-700/80 dark:text-red-400 font-mono">
              Sincronização pausada automaticamente no cliente para proteger o servidor contra alta escrita/looping.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" /> Estatísticas Resumidas do Usuário (Cliente-first Idempotente)
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Resumo acumulado no cliente com sincronização a cada 5 minutos e proteção contra looping/spam.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadTelemetry()}
          disabled={loading}
          className="h-9 px-3 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar Dados
        </Button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-neutral-200/70 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Telas Navegadas</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">{metrics.totalPageViews}</p>
              <p className="text-xs text-neutral-500">Resumo no cliente</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200/70 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Permanência Média</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">~{metrics.avgDwellSeconds}s</p>
              <p className="text-xs text-neutral-500">Dwell time acumulado</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200/70 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prints Tentados</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{metrics.printsDetected}</p>
              <p className="text-xs text-neutral-500">Contado localmente</p>
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
              <p className="text-xs text-neutral-500">{metrics.docsPrinted} impr. | {metrics.pdfExported} PDF</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Intelligent Narrative Report */}
      <Card className="border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-amber-900 dark:text-amber-300">
            <Sparkles className="w-4 h-4 text-amber-600" /> Relatório Narrativo da Conta do Usuário
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-950 dark:text-amber-200 leading-relaxed font-medium">
            {narrativeReport}
          </p>
        </CardContent>
      </Card>

      {/* Most Visited Pages */}
      <Card className="shadow-sm border-neutral-200/80">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Páginas Mais Acessadas por Este Usuário
          </CardTitle>
          <CardDescription>Top 5 rotas com maior acúmulo de uso pelo colaborador.</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.topPages.length === 0 ? (
            <div className="p-6 text-center text-sm text-neutral-500 border border-dashed rounded-lg">
              Nenhum dado de navegação registrado para este usuário ainda.
            </div>
          ) : (
            <div className="space-y-3">
              {metrics.topPages.map((page, idx) => (
                <div key={page.path} className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-mono text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                      {idx + 1}. {page.path}
                    </p>
                    <p className="text-xs text-muted-foreground">{page.views} visualização(ões) acumuladas</p>
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

      {/* Real-time Telemetry & Audit Table for User */}
      <Card className="shadow-sm border-neutral-200/80">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Log de Telemetria e Auditoria Desta Conta
            </CardTitle>
            <CardDescription>
              Eventos instantâneos e resumos de auditoria do colaborador.
            </CardDescription>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filtrar por rota..."
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
              Carregando eventos do usuário...
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-500 border border-dashed rounded-xl">
              Nenhum evento individual instantâneo registrado. Os dados acumulados continuam visíveis no sumário acima.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-800/40 text-neutral-500 dark:text-neutral-400 font-semibold">
                    <th className="py-3 px-4">Selo Data / Hora (Preciso)</th>
                    <th className="py-3 px-4">Tipo de Ação</th>
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
                      <td className="py-3 px-4 font-mono text-neutral-600 dark:text-neutral-400">
                        {ev.pathname}
                      </td>
                      <td className="py-3 px-4 text-neutral-500 font-mono text-[11px] max-w-[320px] truncate" title={JSON.stringify(ev.metadata)}>
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
