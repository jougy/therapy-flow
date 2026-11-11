import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MousePointerClick, Users, UserCheck, UserX, Wallet } from "lucide-react";
import type { AffiliateTelemetryData } from "@/lib/telemetry/affiliate-telemetry";
import { formatCents, type AffiliatePortalPartner } from "./types";

interface PerformanceTabProps {
  partner: AffiliatePortalPartner;
  telemetry: AffiliateTelemetryData;
}

export function PerformanceTab({ partner, telemetry }: PerformanceTabProps) {
  const graceDays = telemetry.overdueGraceDaysRemaining ?? 40;
  const graceProgress = Math.min(100, Math.max(0, (graceDays / 40) * 100));

  return (
    <div className="space-y-4 pt-3 w-full max-w-full min-w-0">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="p-3">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
            <span>Cliques</span>
            <MousePointerClick className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <p className="text-lg sm:text-2xl font-bold tracking-tight">{telemetry.clicksCount}</p>
          <span className="text-[10px] text-muted-foreground">Upstash Real-Time</span>
        </Card>
        <Card className="p-3">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
            <span>Leads Trial</span>
            <Users className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <p className="text-lg sm:text-2xl font-bold tracking-tight">{telemetry.trialLeadsCount}</p>
          <span className="text-[10px] text-muted-foreground">Axiom Analytics</span>
        </Card>
        <Card className="p-3">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
            <span>Assinantes</span>
            <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="text-lg sm:text-2xl font-bold tracking-tight">{telemetry.activeSubscribersCount}</p>
          <span className="text-[10px] text-emerald-600 font-medium">{telemetry.conversionRatePercent}% conv.</span>
        </Card>
        <Card className="p-3">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
            <span>Churn</span>
            <UserX className="h-3.5 w-3.5 text-rose-500" />
          </div>
          <p className="text-lg sm:text-2xl font-bold tracking-tight">{telemetry.churnCount}</p>
          <span className="text-[10px] text-muted-foreground">{telemetry.churnRatePercent}% taxa</span>
        </Card>
        <Card className="p-3 col-span-2 lg:col-span-1 bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
            <span>Comissões Total</span>
            <Wallet className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-lg sm:text-2xl font-bold tracking-tight text-primary">
            {formatCents(partner.lifetimeCommissionCents)}
          </p>
          <span className="text-[10px] text-muted-foreground">Lifetime em R$</span>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Saldo Líquido Asaas</span>
              <Badge variant="outline" className="text-[11px]">D+30 Split</Badge>
            </CardTitle>
            <CardDescription className="text-xs">Valores já processados na sua subconta Asaas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-1">
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div>
                <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Liberado para Saque</span>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{formatCents(partner.availableBalanceCents)}</p>
              </div>
              <Badge className="bg-emerald-600">Disponível</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/60 border">
              <div>
                <span className="text-xs font-medium text-muted-foreground">Retido na Carência</span>
                <p className="text-base font-semibold">{formatCents(partner.retainedBalanceCents)}</p>
              </div>
              <span className="text-xs text-muted-foreground">Liquidação futura</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Termômetro da Janela de Inadimplência</CardTitle>
            <CardDescription className="text-xs">Garantia de retenção e comissão em cobranças atrasadas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Janela de 40 dias</span>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                {graceDays} dias restantes
              </span>
            </div>
            <Progress value={graceProgress} className="h-3" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              A Pluri preserva a atribuição do lead por até 40 dias caso o assinante atrase a mensalidade antes de churn definitivo.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
