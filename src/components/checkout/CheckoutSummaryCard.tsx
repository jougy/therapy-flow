import { QrCode, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CheckoutSummaryCardProps {
  cycleTitle: string;
  rawTotal: number;
  pixDiscountTotal: number;
  monthlyEquivalent: number;
  periodLabel: string;
  invoiceUrl?: string | null;
}

export function CheckoutSummaryCard({
  cycleTitle,
  rawTotal,
  pixDiscountTotal,
  monthlyEquivalent,
  periodLabel,
  invoiceUrl,
}: CheckoutSummaryCardProps) {
  return (
    <Card className="bg-card border-border backdrop-blur-md rounded-3xl overflow-hidden shadow-lg">
      <CardContent className="p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total da Assinatura ({cycleTitle})
            </span>
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10 text-[10px]">
              Garantia Oficial Asaas
            </Badge>
          </div>

          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              R$ {rawTotal.toFixed(2)}
            </span>
            <span className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <QrCode className="w-3.5 h-3.5" /> No PIX: R$ {pixDiscountTotal.toFixed(2)} (-5% OFF)
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            Equivalente a <strong className="text-foreground font-semibold">R$ {monthlyEquivalent.toFixed(2)}/mês</strong> por {periodLabel}.
          </p>
        </div>

        {invoiceUrl && (
          <a
            href={invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 h-11 px-4 text-xs font-semibold text-foreground bg-secondary hover:bg-secondary/80 border border-border rounded-2xl transition-all shadow-sm shrink-0"
          >
            <ExternalLink className="w-4 h-4 text-primary" />
            <span>Abrir Fatura Oficial Asaas</span>
          </a>
        )}
      </CardContent>
    </Card>
  );
}
