import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getAffiliateTierDefinition } from "@/lib/affiliate-tiers";
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { Award, Building2, Percent, RefreshCw, ShieldCheck, TrendingUp, Trophy } from "lucide-react";
import {
  type AffiliatesStatsData,
  type AffiliatesStatsTabProps,
  EMPTY_AFFILIATES_STATS,
  calculateAffiliatesStats,
  formatBrl,
} from "./affiliatesStatsData";

export * from "./affiliatesStatsData";

const RANK_BADGES = [
  "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40",
  "bg-slate-300/30 text-slate-700 dark:text-slate-300 border-slate-400/40",
  "bg-amber-700/20 text-amber-800 dark:text-amber-500 border-amber-700/40",
];

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "0.5rem", fontSize: "0.75rem",
};

export const AffiliatesStatsTab: React.FC<AffiliatesStatsTabProps> = ({ initialData }) => {
  const [data, setData] = useState<AffiliatesStatsData>(initialData || EMPTY_AFFILIATES_STATS);
  const [loading, setLoading] = useState(false);
  const [distributionView, setDistributionView] = useState<"plan" | "cycle">("plan");

  const loadStats = useCallback(async () => {
    if (initialData) return;
    setLoading(true);
    try {
      const [affsRes, commsRes, convsRes] = await Promise.all([
        (supabase as any).from("affiliates").select("id, user_id, tier, active_referrals_count, lifetime_commission_cents, coupon_code, profiles:user_id(full_name, email)").order("active_referrals_count", { ascending: false }),
        (supabase as any).from("affiliate_commissions").select("commission_amount_cents, payment_status, gross_amount_cents"),
        (supabase as any).from("affiliate_conversions").select("status, plan_type, billing_cycle, created_at"),
      ]);

      const affs = !affsRes?.error && Array.isArray(affsRes?.data) ? affsRes.data : [];
      const comms = !commsRes?.error && Array.isArray(commsRes?.data) ? commsRes.data : [];
      if (commsRes?.error) {
        console.warn("[AffiliatesStatsTab] Erro ao carregar comissões:", commsRes.error);
      }

      let convs = !convsRes?.error && Array.isArray(convsRes?.data) ? convsRes.data : [];
      if (convsRes?.error) {
        const fallbackConvs = await (supabase as any).from("affiliate_conversions").select("status, plan_type, created_at");
        if (!fallbackConvs?.error && Array.isArray(fallbackConvs?.data)) convs = fallbackConvs.data;
      }

      setData(calculateAffiliatesStats(affs, comms, convs));
    } catch (err) {
      console.warn("[AffiliatesStatsTab] Falha ao carregar dados do Supabase:", err);
    } finally {
      setLoading(false);
    }
  }, [initialData]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const hasNoConversions = data.totalActiveClinics === 0 && data.totalMrr === 0;
  const isPlanView = distributionView === "plan";

  return (
    <div data-testid="affiliates-stats-tab" className="w-full max-w-full min-w-0 overflow-x-hidden space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500 shrink-0" />
            Telemetria e Desempenho da Rede
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Métricas analíticas globais, conversões por plano e ranking dos principais parceiros.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadStats()}
          disabled={loading}
          className="self-start sm:self-auto min-h-[44px] sm:min-h-[36px] gap-2"
          data-testid="btn-refresh-stats"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar Dados
        </Button>
      </div>

      {/* 4 Cards Analíticos Superiores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="metric-conversion-rate" className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Taxa de Conversão Global</CardTitle>
            <Percent className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold tracking-tight">{data.avgConversionRate.toFixed(1)}%</div>
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
              {data.conversionRateChange > 0 ? `+${data.conversionRateChange}% vs mês anterior` : "Base real em tempo real"}
            </Badge>
            <p className="text-[11px] text-muted-foreground pt-1">Trial para planos faturados</p>
          </CardContent>
        </Card>

        <Card data-testid="metric-mrr" className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">MRR Gerado da Rede</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold tracking-tight">{formatBrl(data.totalMrr)}</div>
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
              {data.mrrGrowthPercent > 0 ? `+${data.mrrGrowthPercent}% MoM` : "Faturamento recorrente ativo"}
            </Badge>
            <p className="text-[11px] text-muted-foreground pt-1">Receita recorrente mensal ativa</p>
          </CardContent>
        </Card>

        <Card data-testid="metric-commissions-split" className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Comissões: Quarentena vs Liberadas</CardTitle>
            <ShieldCheck className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-muted-foreground">Liberadas:</span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatBrl(data.commissionsReleasedCents, true)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 border-t pt-1">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Quarentena:</span>
                <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-400 text-amber-700 dark:text-amber-400">Hold 40d</Badge>
              </div>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{formatBrl(data.commissionsQuarantineCents, true)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Hold de 40 dias anti-chargeback Asaas</p>
          </CardContent>
        </Card>

        <Card data-testid="metric-active-clinics" className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Clínicas Ativas Indicadas</CardTitle>
            <Building2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold tracking-tight">{data.totalActiveClinics}</div>
            <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px]">{data.retentionRatePercent}% retenção ativa</Badge>
            <p className="text-[11px] text-muted-foreground pt-1">Assinaturas adimplentes ativas</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Linha/Área: Evolução Temporal (Últimos 6 Meses) */}
      <Card className="border-border" data-testid="chart-evolution-container">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            Evolução de MRR e Novas Clínicas (Últimos 6 Meses)
          </CardTitle>
          <CardDescription className="text-xs">
            {hasNoConversions
              ? "Nenhuma conversão registrada ainda. O gráfico refletirá o crescimento assim que houver novas assinaturas."
              : "Crescimento consolidado da receita mensal e ritmo de aquisição de novas assinaturas."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full h-[260px] min-h-[260px]" data-testid="area-chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.evolutionHistory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="affMrrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} /><stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="affClinicsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
                <YAxis yAxisId="mrrAxis" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="clinicsAxis" orientation="right" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
                <Tooltip formatter={(val: any, name: string) => [name === "mrr" ? formatBrl(Number(val)) : `${val} clínicas`, name === "mrr" ? "MRR Gerado" : "Novas Clínicas"]} contentStyle={CHART_TOOLTIP_STYLE} />
                <Area yAxisId="mrrAxis" type="monotone" dataKey="mrr" name="mrr" stroke="#10b981" fillOpacity={1} fill="url(#affMrrGrad)" strokeWidth={2} />
                <Area yAxisId="clinicsAxis" type="monotone" dataKey="newClinics" name="newClinics" stroke="#3b82f6" fillOpacity={1} fill="url(#affClinicsGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos de Distribuição: Clínicas por Plano & Conversões por Tier */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Distribuição: Clínicas por Plano */}
        <Card className="border-border" data-testid="chart-plan-distribution">
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-500" />
                {isPlanView ? "Clínicas por Plano" : "Clínicas por Ciclo de Faturamento"}
              </CardTitle>
              <CardDescription className="text-xs">
                {hasNoConversions
                  ? "Nenhuma conversão registrada ainda."
                  : isPlanView
                  ? "Distribuição das clínicas ativas entre os 8 níveis de planos oficiais."
                  : "Distribuição entre Mensal, Trimestral e Anual (identificando LTV e receita antecipada de anuais)."}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 p-0.5 bg-muted rounded-lg self-start sm:self-auto shrink-0" data-testid="toggle-plan-cycle">
              <Button
                type="button"
                variant={isPlanView ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setDistributionView("plan")}
                data-testid="btn-view-plan"
                aria-label="Por Nível de Plano (8)"
              >
                Nível do Plano (8)
              </Button>
              <Button
                type="button"
                variant={!isPlanView ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setDistributionView("cycle")}
                data-testid="btn-view-cycle"
                aria-label="Por Ciclo de Faturamento (3)"
              >
                Ciclo de Faturamento (3)
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="w-full h-[220px] min-h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={isPlanView ? data.planDistribution : data.billingCycleDistribution}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
                  <YAxis
                    dataKey={isPlanView ? "plan" : "label"}
                    type="category"
                    tick={{ fontSize: 11 }}
                    width={isPlanView ? 115 : 75}
                    stroke="currentColor"
                    className="text-muted-foreground"
                  />
                  <Tooltip formatter={(val: any) => [`${val} clínicas`, "Assinaturas"]} contentStyle={CHART_TOOLTIP_STYLE} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {(isPlanView ? data.planDistribution : data.billingCycleDistribution).map((entry: any, idx: number) => (
                      <Cell key={`cell-dist-${idx}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {isPlanView ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t text-xs">
                {data.planDistribution.map((p) => (
                  <div key={p.plan} className="text-left sm:text-center truncate">
                    <span className="font-semibold">{p.plan}:</span>{" "}
                    <span className="text-muted-foreground">{p.count} ({p.percentage}%)</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-around gap-2 pt-2 border-t text-xs">
                {data.billingCycleDistribution.map((c) => (
                  <div key={c.cycle} className="text-center">
                    <span className="font-semibold">{c.label}:</span>{" "}
                    <span className="text-muted-foreground">{c.count} ({c.percentage}%)</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribuição: Conversões por Tier */}
        <Card className="border-border" data-testid="chart-tier-distribution">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
              <Award className="h-4 w-4 text-purple-500" />
              Conversões por Tier Oficial
            </CardTitle>
            <CardDescription className="text-xs">
              {hasNoConversions ? "Nenhuma conversão registrada ainda por nível de parceiro." : "Volume de clínicas convertidas por nível de progressão do parceiro."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="w-full h-[180px] min-h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.tierDistribution} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
                  <Tooltip formatter={(val: any) => [`${val} clínicas`, "Conversões"]} contentStyle={CHART_TOOLTIP_STYLE} />
                  <Bar dataKey="conversions" radius={[4, 4, 0, 0]}>
                    {data.tierDistribution.map((entry, idx) => (
                      <Cell key={`cell-tier-${idx}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t text-xs">
              {data.tierDistribution.map((t) => (
                <span key={t.tier} className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${t.badgeClass}`}>
                  {t.label}: {t.conversions}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard: Top 5 Parceiros */}
      <Card className="border-border" data-testid="card-leaderboard">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            Top 5 Parceiros Mais Eficientes
          </CardTitle>
          <CardDescription className="text-xs">
            Afiliados com maior volume de clínicas ativas e taxa de conversão superior.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.leaderboard.length === 0 ? (
            <div data-testid="leaderboard-empty" className="flex flex-col items-center justify-center py-8 px-4 text-center border rounded-lg border-dashed border-border/80 bg-muted/10">
              <Trophy className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Nenhum parceiro com indicações ativas no momento</p>
              <p className="text-[11px] text-muted-foreground/70 mt-1">Nenhuma conversão registrada ainda. O ranking é atualizado automaticamente conforme as clínicas indicadas são ativadas.</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto touch-pan-x">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-2 font-medium w-12 text-center">Pos</th><th className="pb-2 font-medium">Parceiro</th><th className="pb-2 font-medium">Tier Oficial</th>
                    <th className="pb-2 font-medium text-right">Clínicas Ativas</th><th className="pb-2 font-medium text-right">Taxa Conv.</th><th className="pb-2 font-medium text-right">MRR Gerado</th><th className="pb-2 font-medium text-right">Comissão Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {data.leaderboard.map((item, idx) => {
                    const tierDef = getAffiliateTierDefinition(item.tier);
                    return (
                      <tr key={item.id} className="hover:bg-muted/40 transition-colors" data-testid={`leaderboard-row-${idx}`}>
                        <td className="py-2.5 text-center font-bold">
                          {idx < 3 ? (
                            <Badge variant="outline" className={`h-5 w-5 p-0 justify-center text-[10px] ${RANK_BADGES[idx]}`}>{idx + 1}º</Badge>
                          ) : (
                            <span className="text-muted-foreground">{idx + 1}º</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          <div className="font-semibold text-foreground">{item.name}</div>
                          <div className="text-[11px] font-mono text-muted-foreground">{item.coupon}</div>
                        </td>
                        <td className="py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${tierDef.badgeColorClass}`}>{tierDef.label}</span>
                        </td>
                        <td className="py-2.5 text-right font-medium">{item.activeClinics}</td>
                        <td className="py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">{item.conversionRate.toFixed(1)}%</td>
                        <td className="py-2.5 text-right font-medium">{formatBrl(item.mrrGenerated)}</td>
                        <td className="py-2.5 text-right text-muted-foreground">{formatBrl(item.commissionEarnedCents, true)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
