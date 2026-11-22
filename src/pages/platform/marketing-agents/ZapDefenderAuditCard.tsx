import React from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { MarketingWhatsAppInstance } from "./types";
import type { ZapDefenderMetricItem, ZapDefenderReport } from "./suiteTypes";
import { computeZapDefenderReport } from "./zapSuiteEngine";

interface ZapDefenderAuditCardProps {
  instance: MarketingWhatsAppInstance;
  report?: ZapDefenderReport | null;
  auditing?: boolean;
  onRunAudit: (instance: MarketingWhatsAppInstance) => Promise<ZapDefenderReport | void> | void;
}

const RISK_META: Record<
  ZapDefenderReport["riskLevel"],
  { label: string; badgeClass: string; strokeClass: string }
> = {
  safe: {
    label: "Seguro",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    strokeClass: "text-emerald-500",
  },
  warning: {
    label: "Atenção",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    strokeClass: "text-amber-500",
  },
  high_risk: {
    label: "Risco Alto",
    badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    strokeClass: "text-rose-500",
  },
};

function renderMetricIcon(status: ZapDefenderMetricItem["status"]) {
  if (status === "ok") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
  if (status === "warn") return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
  return <ShieldAlert className="h-3.5 w-3.5 text-rose-500 shrink-0" />;
}

export const ZapDefenderAuditCard: React.FC<ZapDefenderAuditCardProps> = ({
  instance,
  report,
  auditing = false,
  onRunAudit,
}) => {
  const effectiveReport =
    report ??
    computeZapDefenderReport({
      instanceId: instance.id,
      warmupDay: instance.warmup_day,
      sent7d: Math.max(instance.daily_sent_count, 0),
      replied7d: Math.round(instance.daily_sent_count * 0.25),
      failed7d: 0,
      optOut7d: 0,
      disconnects7d: instance.status === "disconnected" ? 1 : 0,
      dailySentCount: instance.daily_sent_count,
      dailyLimit: instance.daily_limit,
      status: instance.status,
    });

  const riskMeta = RISK_META[effectiveReport.riskLevel];
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (effectiveReport.overallScore / 100) * circumference;

  return (
    <Card className="border-primary/20 bg-muted/20 w-full max-w-full min-w-0">
      <CardHeader className="pb-2.5 px-3.5 pt-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-xs sm:text-sm flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            <span>ZapDefender — Auditoria Pré-Disparo</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-[11px] ${riskMeta.badgeClass}`}>
              {riskMeta.label}
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={auditing}
              onClick={() => void onRunAudit(instance)}
              className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${auditing ? "animate-spin" : ""}`} />
              <span>{auditing ? "Auditando..." : "Rodar Check-up ZapDefender"}</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-3.5 pb-3.5 space-y-3 text-xs">
        <div className="flex items-center gap-3 rounded-lg border bg-background p-2.5">
          <div className="relative h-16 w-16 shrink-0 flex items-center justify-center">
            <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
              <circle
                cx="32"
                cy="32"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-muted/40"
              />
              <circle
                cx="32"
                cy="32"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className={riskMeta.strokeClass}
              />
            </svg>
            <span className="absolute text-sm font-bold">{effectiveReport.overallScore}</span>
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold">Score de Saúde Anti-Ban</span>
              <span className="font-mono text-muted-foreground">{effectiveReport.overallScore}/100</span>
            </div>
            <Progress value={effectiveReport.overallScore} className="h-2" />
            <p className="text-[11px] text-muted-foreground">
              {report ? "Última auditoria ao vivo concluída." : "Prévia local calculada — clique em Rodar Check-up para auditar últimos 7 dias."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {effectiveReport.metrics.map((metric) => (
            <div
              key={metric.key}
              className="rounded-lg border bg-background px-2.5 py-2 flex items-start justify-between gap-2"
            >
              <div className="flex items-start gap-2 min-w-0">
                <div className="mt-0.5">{renderMetricIcon(metric.status)}</div>
                <div className="min-w-0">
                  <p className="font-medium text-[11px] truncate">{metric.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{metric.detail}</p>
                </div>
              </div>
              <span className="font-mono text-[11px] font-semibold shrink-0">
                {metric.score}/{metric.maxScore}
              </span>
            </div>
          ))}
        </div>

        {effectiveReport.recommendations.length > 0 && (
          <div className="rounded-lg border bg-background p-2.5 space-y-1">
            <p className="text-[11px] font-semibold">Checklist de Recomendações</p>
            <ul className="space-y-1">
              {effectiveReport.recommendations.map((rec) => (
                <li key={rec} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                  <span className="text-primary font-bold">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
