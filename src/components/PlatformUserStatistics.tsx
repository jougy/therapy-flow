import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Activity,
  Printer,
  Camera,
  Eye,
  Clock,
  Sparkles,
  RefreshCw,
  AlertOctagon,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { queryUpstashUserTelemetry, type UpstashUserTelemetry } from "@/lib/telemetry/upstash-client";
import { queryAxiomLogs } from "@/lib/telemetry/axiom-client";
import {
  type UserTelemetryRecord,
  type UserSummaryRecord,
  formatPrecisionTimestamp,
  getEventBadge,
} from "./platform/user-statistics/types";
import { UserTelemetryAuditTable } from "./platform/user-statistics/UserTelemetryAuditTable";

export type { UserTelemetryRecord, UserSummaryRecord };
export { formatPrecisionTimestamp, getEventBadge };

export interface PlatformUserStatisticsProps {
  userId: string;
  userName?: string;
}

export const PlatformUserStatistics: React.FC<PlatformUserStatisticsProps> = ({
  userId,
  userName,
}) => {
  const [telemetryEvents, setTelemetryEvents] = useState<UserTelemetryRecord[]>([]);
  const [userSummaries, setUserSummaries] = useState<UserSummaryRecord[]>([]);
  const [upstashMetrics, setUpstashMetrics] = useState<UpstashUserTelemetry | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");

  const loadTelemetry = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [upstashData, axiomLogs] = await Promise.all([
        queryUpstashUserTelemetry(userId),
        queryAxiomLogs({ userId, limit: 150 }),
      ]);

      if (upstashData) {
        setUpstashMetrics(upstashData);
      }

      if (axiomLogs && axiomLogs.length > 0) {
        const mappedAxiom: UserTelemetryRecord[] = axiomLogs.map((log) => ({
          id: log.id,
          clinic_id: log.clinic_id || "",
          user_id: log.user_id || userId,
          user_name: userName || "Usuário",
          event_type: log.event_type || "page_view",
          pathname: log.route || "/",
          resource_type: log.scope || null,
          resource_id: null,
          metadata: log.context || null,
          created_at: log._time,
        }));
        setTelemetryEvents(mappedAxiom);
      } else {
        const eventsRes = await supabase.rpc("list_platform_user_telemetry_events", {
          _user_id: userId,
          _limit: 250,
        });
        if (!eventsRes.error && eventsRes.data) {
          setTelemetryEvents((eventsRes.data || []) as UserTelemetryRecord[]);
        }
      }

      const summariesRes = await supabase
        .from("user_telemetry_summaries")
        .select("*")
        .eq("user_id", userId)
        .order("summary_date", { ascending: false });

      if (summariesRes.data) {
        setUserSummaries((summariesRes.data || []) as UserSummaryRecord[]);
      }
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
  }, [userId, userName]);

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

    if (upstashMetrics) {
      printsDetected = upstashMetrics.printsDetected;
      docsPrinted = upstashMetrics.docsPrinted;
      pdfExported = upstashMetrics.pdfExported;
      totalPageViews = upstashMetrics.pageViews;
      totalDwellSeconds = upstashMetrics.dwellTimeSeconds;

      if (upstashMetrics.pageDwellMatrix) {
        Object.entries(upstashMetrics.pageDwellMatrix).forEach(([route, dwellSec]) => {
          pageStatsMap[route] = (pageStatsMap[route] || 0) + dwellSec;
        });
      }
    } else if (userSummaries.length > 0) {
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
  }, [upstashMetrics, userSummaries, telemetryEvents]);

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

  const narrativeReport = useMemo(() => {
    if (metrics.totalPageViews === 0 && metrics.printsDetected === 0 && metrics.docsPrinted === 0) {
      return "Usuário recém-vinculado ou ainda sem registros significativos de uso de tela ou navegação.";
    }

    const parts: string[] = [];
    parts.push(`O colaborador navegou por ${metrics.totalPageViews} telas.`);

    if (metrics.avgDwellSeconds > 0) {
      parts.push(`A permanência média registrada é de cerca de ~${metrics.avgDwellSeconds}s por fluxo de trabalho.`);
    }

    if (metrics.printsDetected > 0) {
      parts.push(`⚠️ ATENÇÃO: Foram interceptadas ${metrics.printsDetected} tentativas de Captura de Tela (Print Screen) neste dispositivo.`);
    } else {
      parts.push("Nenhuma tentativa suspeita de print screen detectada.");
    }

    if (metrics.docsPrinted > 0 || metrics.pdfExported > 0) {
      parts.push(`Foram realizadas ${metrics.docsPrinted} impressões físicas de documentos e ${metrics.pdfExported} exportações diretas para PDF.`);
    }

    if (metrics.topPages.length > 0) {
      const topName = metrics.topPages[0].path;
      parts.push(`A área de maior foco operacional foi "${topName}".`);
    }

    return parts.join(" ");
  }, [metrics]);

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      {/* Header and Refresh Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm w-full max-w-full min-w-0">
        <div className="min-w-0">
          <h3 className="text-lg font-bold flex items-center gap-2 truncate">
            <Activity className="w-5 h-5 text-primary shrink-0" />
            <span className="truncate">Telemetria & Comportamento: {userName || "Usuário"}</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitoramento comportamental com sincronização em lote (Upstash Redis & Axiom).
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadTelemetry()}
          disabled={loading}
          className="gap-2 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Anti-Spam Banner if flagged */}
      {spamAlert && (
        <Card className="w-full max-w-full min-w-0 border-red-500/50 bg-red-50/50 dark:bg-red-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-red-600 dark:text-red-400">
              <ShieldAlert className="w-5 h-5" />
              <span>Conta Sinalizada por Alta Frequência de Ações</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-neutral-700 dark:text-neutral-300">
              Esta conta disparou o mecanismo anti-spam local. Ações em excesso foram bloqueadas temporariamente para segurança da clínica.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="destructive" className="text-[10px]">
                <AlertOctagon className="w-3 h-3 mr-1" />
                {spamAlert.reason}
              </Badge>
              <span className="text-[11px] text-muted-foreground font-mono">
                Registrado em: {spamAlert.date}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-full min-w-0">
        <Card className="w-full max-w-full min-w-0 border-neutral-200/70 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Telas Navegadas</p>
              <p className="text-2xl font-bold">{metrics.totalPageViews}</p>
              <p className="text-xs text-neutral-500">Visualizações agregadas</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Eye className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="w-full max-w-full min-w-0 border-neutral-200/70 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Permanência Média</p>
              <p className="text-2xl font-bold">~{metrics.avgDwellSeconds}s</p>
              <p className="text-xs text-neutral-500">Tempo ativo por tela</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="w-full max-w-full min-w-0 border-neutral-200/70 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prints Tentados</p>
              <p className={`text-2xl font-bold ${metrics.printsDetected > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                {metrics.printsDetected}
              </p>
              <p className="text-xs text-neutral-500">Contado localmente</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-red-50 dark:bg-red-950 text-red-600 flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="w-full max-w-full min-w-0 border-neutral-200/70 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Impressões & PDFs</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{metrics.docsPrinted + metrics.pdfExported}</p>
              <p className="text-xs text-neutral-500">{metrics.docsPrinted} impr. | {metrics.pdfExported} PDF</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center shrink-0">
              <Printer className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Intelligent Narrative Report */}
      <Card className="w-full max-w-full min-w-0 border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-amber-900 dark:text-amber-300">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Relatório Narrativo da Conta do Usuário</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-950 dark:text-amber-200 leading-relaxed font-medium break-words">
            {narrativeReport}
          </p>
        </CardContent>
      </Card>

      {/* Most Visited Pages */}
      <Card className="w-full max-w-full min-w-0 shadow-sm border-neutral-200/80">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary shrink-0" />
            <span>Páginas Mais Acessadas por Este Usuário</span>
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
                <div key={page.path} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 gap-2">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate" title={page.path}>
                      {idx + 1}. {page.path}
                    </p>
                    <p className="text-xs text-muted-foreground">{page.views} visualização(ões) acumuladas</p>
                  </div>
                  <Badge variant="secondary" className="self-start sm:self-auto shrink-0 font-mono text-xs">
                    ~{page.avgDwellSeconds}s por sessão
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Real-time Telemetry & Audit Table for User */}
      <UserTelemetryAuditTable
        loading={loading}
        filteredEvents={filteredEvents}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        eventTypeFilter={eventTypeFilter}
        setEventTypeFilter={setEventTypeFilter}
      />
    </div>
  );
};
