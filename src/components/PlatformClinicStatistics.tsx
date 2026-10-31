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
  TrendingUp,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { queryUpstashClinicTelemetry, type UpstashClinicTelemetry } from "@/lib/telemetry/upstash-client";
import { queryAxiomLogs } from "@/lib/telemetry/axiom-client";
import {
  type TelemetryRecord,
  type PlatformClinicStatisticsProps,
  formatPrecisionTimestamp,
  getEventBadge,
} from "./platform/clinic-statistics/types";
import { ClinicTelemetryAuditTable } from "./platform/clinic-statistics/ClinicTelemetryAuditTable";

export type { TelemetryRecord, PlatformClinicStatisticsProps };
export { formatPrecisionTimestamp, getEventBadge };

export const PlatformClinicStatistics: React.FC<PlatformClinicStatisticsProps> = ({
  clinicId,
  counts,
}) => {
  const [telemetryEvents, setTelemetryEvents] = useState<TelemetryRecord[]>([]);
  const [upstashClinicMetrics, setUpstashClinicMetrics] = useState<UpstashClinicTelemetry | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");

  const loadTelemetry = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const [upstashData, axiomLogs] = await Promise.all([
        queryUpstashClinicTelemetry(clinicId),
        queryAxiomLogs({ clinicId, limit: 150 }),
      ]);

      if (upstashData) {
        setUpstashClinicMetrics(upstashData);
      }

      if (axiomLogs && axiomLogs.length > 0) {
        const mappedAxiom: TelemetryRecord[] = axiomLogs.map((log) => ({
          id: log.id,
          clinic_id: log.clinic_id || clinicId,
          user_id: log.user_id || null,
          user_name: (log.context?.userName as string) || "Profissional",
          event_type: log.event_type || "page_view",
          pathname: log.route || "/",
          resource_type: log.scope || null,
          resource_id: null,
          metadata: log.context || null,
          created_at: log._time,
        }));
        setTelemetryEvents(mappedAxiom);
      } else {
        const { data, error } = await supabase.rpc("list_platform_telemetry_events", {
          _clinic_id: clinicId,
          _limit: 250,
        });

        if (!error && data) {
          setTelemetryEvents((data || []) as TelemetryRecord[]);
        }
      }
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

    if (upstashClinicMetrics && upstashClinicMetrics.pageDwellMatrix) {
      Object.entries(upstashClinicMetrics.pageDwellMatrix).forEach(([route, dwellSec]) => {
        if (!pageStatsMap[route]) {
          pageStatsMap[route] = { views: 1, totalDwellSeconds: dwellSec };
          totalPageViews += 1;
        } else {
          pageStatsMap[route].totalDwellSeconds = Math.max(pageStatsMap[route].totalDwellSeconds, dwellSec);
        }
      });
    }

    const topPages = Object.entries(pageStatsMap)
      .map(([path, data]) => ({
        path,
        views: data.views,
        avgDwellSeconds: Math.round(data.totalDwellSeconds / Math.max(1, data.views)),
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    const topUsers = Object.entries(userStatsMap)
      .map(([name, data]) => ({
        name,
        views: data.views,
        prints: data.prints,
        avgDwellMinutes: Math.round((data.dwelledSeconds / 60) / Math.max(1, data.views)),
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    return {
      printsCount,
      printsDetected,
      docsPrinted,
      pdfExported,
      totalPageViews,
      topPages,
      topUsers,
    };
  }, [telemetryEvents, upstashClinicMetrics]);

  const filteredEvents = useMemo(() => {
    return telemetryEvents.filter((ev) => {
      if (eventTypeFilter !== "all" && ev.event_type !== eventTypeFilter) {
        return false;
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchUser = (ev.user_name || "").toLowerCase().includes(q);
        const matchPath = (ev.pathname || "").toLowerCase().includes(q);
        const matchType = (ev.event_type || "").toLowerCase().includes(q);
        return matchUser || matchPath || matchType;
      }
      return true;
    });
  }, [telemetryEvents, eventTypeFilter, searchQuery]);

  const narrativeReport = useMemo(() => {
    if (telemetryEvents.length === 0 && !upstashClinicMetrics) {
      return "Clínica recém-registrada ou sem atividade de telemetria recente sincronizada.";
    }

    const parts: string[] = [];
    const totalSessions = counts?.sessions || 0;
    const totalPatients = counts?.patients || 0;
    const totalUsers = counts?.collaborators || 0;

    parts.push(`Esta clínica possui ${totalPatients} pacientes cadastrados e ${totalUsers} profissionais na equipe ativa.`);
    
    if (totalSessions > 0) {
      parts.push(`Já realizou um total de ${totalSessions} atendimentos clínicos concluídos na plataforma.`);
    }

    if (metrics.printsDetected > 0) {
      parts.push(`⚠️ ATENÇÃO: Detectamos ${metrics.printsDetected} tentativas de Captura de Tela (Print Screen) por profissionais.`);
    } else {
      parts.push("Nenhuma tentativa suspeita de print de tela foi interceptada.");
    }

    if (metrics.docsPrinted > 0 || metrics.pdfExported > 0) {
      parts.push(`Foram realizadas ${metrics.docsPrinted} impressões diretas de documentos e ${metrics.pdfExported} exportações em PDF.`);
    }

    if (metrics.topPages.length > 0) {
      const topPage = metrics.topPages[0].path;
      parts.push(`A tela com maior engajamento recente é "${topPage}".`);
    }

    return parts.join(" ");
  }, [telemetryEvents.length, upstashClinicMetrics, counts, metrics]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <span>Telemetria & Estatísticas da Clínica</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Métricas de engajamento, auditoria e uso em tempo real (Upstash Redis & Axiom).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadTelemetry()}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-neutral-200/70 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Atendimentos</p>
              <p className="text-2xl font-bold">{counts?.sessions ?? 0}</p>
              <p className="text-xs text-neutral-500">Sessões registradas</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200/70 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prints Interceptados</p>
              <p className={`text-2xl font-bold ${metrics.printsDetected > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                {metrics.printsDetected}
              </p>
              <p className="text-xs text-neutral-500">Bloqueio de tela</p>
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

        <Card className="border-neutral-200/70 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Páginas Visualizadas</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{metrics.totalPageViews}</p>
              <p className="text-xs text-neutral-500">Navegações monitoradas</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

      <ClinicTelemetryAuditTable
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
