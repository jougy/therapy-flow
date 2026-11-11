import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  Clock,
  TrendingUp,
  FileCheck,
  FileDown,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatMoneyCents } from "@/lib/session-operations";
import {
  type AsaasSplitStatus,
  type AffiliateFinancialStatsBlockProps,
  DEFAULT_STATS,
} from "./types";

export * from "./types";

export function AffiliateFinancialStatsBlock({
  data,
  clinicId: _clinicId,
  onDownloadReport,
  onNavigateFullStats,
  className = "",
}: AffiliateFinancialStatsBlockProps) {
  const { toast } = useToast();
  const [selectedYear, setSelectedYear] = useState(2026);
  const [isDownloading, setIsDownloading] = useState(false);

  const availableBalance = data?.availableBalanceCents ?? DEFAULT_STATS.availableBalanceCents;
  const retainedBalance = data?.retainedBalanceCents ?? DEFAULT_STATS.retainedBalanceCents;
  const mrr = data?.mrrCents ?? DEFAULT_STATS.mrrCents;
  const taxStatus = data?.taxStatus ?? DEFAULT_STATS.taxStatus;
  const splits = data?.splits ?? DEFAULT_STATS.splits;

  const handleDownload = (format: "pdf" | "csv") => {
    setIsDownloading(true);
    try {
      if (onDownloadReport) {
        onDownloadReport(format, selectedYear);
      } else {
        const header = "Data,Clinica Indicada,Plano/Ciclo,Valor Liquido (R$),% Split,Status Asaas\n";
        const rows = splits
          .map(
            (s) =>
              `"${s.date}","${s.clinicName}","${s.planCycle}","${(s.netAmountCents / 100).toFixed(2)}","${s.splitPercent}%","${s.asaasStatus}"`
          )
          .join("\n");
        const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `informe-rendimentos-afiliados-${selectedYear}.${format}`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      toast({
        title: "Informe baixado com sucesso",
        description: `O arquivo consolidado de rendimentos (${format.toUpperCase()}) de ${selectedYear} foi gerado.`,
      });
    } catch {
      toast({
        title: "Erro ao gerar informe",
        description: "Não foi possível gerar o arquivo. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const renderStatusBadge = (status: AsaasSplitStatus) => {
    switch (status) {
      case "received":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
            Recebido
          </Badge>
        );
      case "retained":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20">
            Em Retenção
          </Badge>
        );
      case "refunded":
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/20">
            Estornado
          </Badge>
        );
      default:
        return <Badge variant="outline">Pendente</Badge>;
    }
  };

  return (
    <div className={`w-full max-w-full min-w-0 space-y-4 ${className}`}>
      {/* 1. Cards de Topo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 💵 Saldo Disponível no Asaas */}
        <Card className="p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
              <span>Saldo Disponível Asaas</span>
              <Wallet className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
              {formatMoneyCents(availableBalance)}
            </p>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Liberado para saque/PIX</span>
            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
              Imediato
            </Badge>
          </div>
        </Card>

        {/* ⏳ Saldo em Garantia (Quarentena 40 dias) */}
        <Card className="p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
              <span>Saldo em Garantia</span>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {formatMoneyCents(retainedBalance)}
            </p>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Quarentena de 40 dias</span>
            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/20">
              D+40 Anti-Chargeback
            </Badge>
          </div>
        </Card>

        {/* 📈 MRR Gerado */}
        <Card className="p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
              <span>MRR de Afiliados</span>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
              {formatMoneyCents(mrr)}
              <span className="text-xs font-normal text-muted-foreground">/mês</span>
            </p>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Receita recorrente dos indicados ativos</p>
        </Card>

        {/* 📄 Status Fiscal */}
        <Card className="p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
              <span>Status Fiscal</span>
              {taxStatus === "up_to_date" ? (
                <FileCheck className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              )}
            </div>
            <div className="mt-1">
              {taxStatus === "up_to_date" ? (
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 font-medium text-xs">
                  Em dia (MEI / NFS-e)
                </Badge>
              ) : (
                <Badge className="bg-amber-600 text-white hover:bg-amber-700 font-medium text-xs">
                  Pendente de Nota
                </Badge>
              )}
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {taxStatus === "up_to_date"
              ? "NFS-e de corretagem regularizada"
              : "Envie a NFS-e do mês para liberar o split"}
          </p>
        </Card>
      </div>

      {/* 2. Tabela / Extrato Resumido de Comissões e Splits */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Extrato Resumido de Comissões e Splits
              </CardTitle>
              <CardDescription className="text-xs">
                Repasses processados na subconta Asaas com retenção e liquidação em tempo real
              </CardDescription>
            </div>
            {onNavigateFullStats && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onNavigateFullStats}
                className="text-xs text-primary min-h-[44px] touch-manipulation sm:min-h-[36px] w-fit"
              >
                Ver histórico completo
                <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-1">
          <div className="w-full max-w-full overflow-x-auto touch-pan-x rounded-lg border">
            <table className="w-full min-w-[550px] text-xs sm:text-sm text-left">
              <thead className="bg-muted/60 text-muted-foreground text-[11px] uppercase tracking-wider border-b">
                <tr>
                  <th className="py-2.5 px-3">Data</th>
                  <th className="py-2.5 px-3">Clínica Indicada</th>
                  <th className="py-2.5 px-3">Plano/Ciclo</th>
                  <th className="py-2.5 px-3">Valor Líquido</th>
                  <th className="py-2.5 px-3">% Split</th>
                  <th className="py-2.5 px-3 text-right">Status Asaas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {splits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground text-xs">
                      Nenhuma comissão ou split registrado neste período.
                    </td>
                  </tr>
                ) : (
                  splits.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[11px] sm:text-xs text-muted-foreground">
                        {s.date}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-foreground">{s.clinicName}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{s.planCycle}</td>
                      <td className="py-2.5 px-3 font-semibold text-foreground">
                        {formatMoneyCents(s.netAmountCents)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-muted-foreground">{s.splitPercent}%</td>
                      <td className="py-2.5 px-3 text-right">{renderStatusBadge(s.asaasStatus)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 3. Módulo Fiscal & Informe de Rendimentos */}
      <Card className="bg-muted/20 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <FileDown className="h-4 w-4 text-primary" />
            Módulo Fiscal & Informe de Rendimentos
          </CardTitle>
          <CardDescription className="text-xs">
            Comprovante anual consolidado de rendimentos e retenções tributárias para DIRF, Carnê-Leão e IRPF/IRPJ.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-1">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-lg bg-card border">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-foreground">Informe Anual de Rendimentos Tributáveis</span>
              <p className="text-[11px] text-muted-foreground">
                Ano-calendário de referência para apuração fiscal de corretagem e splits.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                aria-label="Ano de referência fiscal"
                className="h-11 px-3 rounded-md border bg-background text-xs font-medium min-h-[44px] touch-manipulation"
              >
                <option value={2026}>Ano 2026</option>
                <option value={2025}>Ano 2025</option>
                <option value={2024}>Ano 2024</option>
              </select>
              <Button
                type="button"
                variant="outline"
                disabled={isDownloading}
                onClick={() => handleDownload("pdf")}
                className="min-h-[44px] touch-manipulation gap-1.5 text-xs font-medium"
              >
                <FileDown className="h-4 w-4 text-primary" />
                Baixar Informe Anual (PDF/CSV)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
