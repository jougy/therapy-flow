import React from "react";
import { CheckCircle2 } from "lucide-react";

interface OnboardingStep4Props {
  couponCode: string;
}

export function OnboardingStep4({ couponCode }: OnboardingStep4Props) {
  const referralLink = `https://pluri.health/?cupom=${couponCode}`;

  return (
    <div className="space-y-4 text-center py-2" data-testid="step-4-container">
      <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
        <CheckCircle2 className="w-7 h-7" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base sm:text-lg font-bold text-foreground">
          Parabéns! Subconta e Cupom Ativados
        </h3>
        <p className="text-xs text-muted-foreground">
          Compartilhe seu cupom oficial de 30% OFF para novas clínicas e acompanhe as conversões
          em tempo real.
        </p>
      </div>

      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3 text-left">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">
            Seu Cupom Nominal Ativo
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold">
            30% de Desconto
          </span>
        </div>
        <div className="flex items-center justify-between bg-background border rounded-xl p-3">
          <span
            className="font-mono text-base font-extrabold text-primary"
            data-testid="display-coupon-code"
          >
            {couponCode}
          </span>
          <span className="text-xs text-muted-foreground">Validade Permanente</span>
        </div>
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground">
            Link Oficial de Compartilhamento
          </span>
          <div
            className="p-2.5 bg-background border rounded-xl text-xs font-mono break-all text-foreground/80 select-all"
            data-testid="display-referral-link"
          >
            {referralLink}
          </div>
        </div>
      </div>
    </div>
  );
}
