import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Copy, Check, QrCode } from "lucide-react";
import {
  AFFILIATE_TIERS,
  getAffiliateTierDefinition,
  getNextAffiliateTier,
  getTierProgressPercentage,
} from "@/lib/affiliate-tiers";
import type { AffiliateTelemetryData } from "@/lib/telemetry/affiliate-telemetry";
import type { AffiliatePortalPartner } from "./types";

interface HookTabProps {
  partner: AffiliatePortalPartner;
  telemetry: AffiliateTelemetryData;
}

const UTM_PRESETS = [
  { id: "default", label: "Padrão", params: "" },
  { id: "whatsapp", label: "WhatsApp", params: "&utm_source=whatsapp&utm_medium=chat&utm_campaign=afiliado" },
  { id: "instagram", label: "Instagram", params: "&utm_source=instagram&utm_medium=bio&utm_campaign=afiliado" },
  { id: "evento", label: "Evento", params: "&utm_source=event&utm_medium=qrcode&utm_campaign=afiliado" },
] as const;

export function HookTab({ partner, telemetry }: HookTabProps) {
  const [selectedUtm, setSelectedUtm] = useState<string>("default");
  const [copied, setCopied] = useState(false);

  const activeLink = useMemo(() => {
    const base = `https://pluri.health/?cupom=${encodeURIComponent(partner.couponCode)}&ref=${encodeURIComponent(partner.slug)}`;
    const utm = UTM_PRESETS.find((u) => u.id === selectedUtm)?.params || "";
    return `${base}${utm}`;
  }, [partner.couponCode, partner.slug, selectedUtm]);

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(activeLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQrCode = () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="240" height="240"><rect width="100%" height="100%" fill="white"/><path fill="#0f172a" d="M10 10h30v30h-30z M15 15h20v20h-20z M20 20h10v10h-10z M60 10h30v30h-30z M65 15h20v20h-20z M70 20h10v10h-10z M10 60h30v30h-30z M15 65h20v20h-20z M20 70h10v10h-10z M45 20h10v10h-10z M45 45h10v10h-10z M20 45h10v10h-10z M70 45h10v10h-10z M45 70h10v10h-10z M60 60h10v10h-10z M80 60h10v10h-10z M60 80h10v10h-10z M80 80h10v10h-10z"/></svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `qrcode-${partner.slug}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const currentTierDef = getAffiliateTierDefinition(partner.tier);
  const nextTierDef = getNextAffiliateTier(partner.tier);
  const tierProgress = getTierProgressPercentage(telemetry.activeSubscribersCount, partner.tier);

  return (
    <div className="space-y-4 pt-3 w-full max-w-full min-w-0">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Link Parametrizado & Construtor de UTMs</CardTitle>
          <CardDescription className="text-xs">Seu link oficial carrega cookie vitalício e o cupom de 30% OFF</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {UTM_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                variant={selectedUtm === preset.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedUtm(preset.id)}
                className="min-h-[44px] touch-manipulation text-xs"
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="p-3 bg-muted/60 rounded-md border font-mono text-xs break-all select-all">
            {activeLink}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleCopyLink} className="min-h-[44px] flex-1 sm:flex-none touch-manipulation">
              {copied ? <Check className="h-4 w-4 mr-2 text-emerald-400" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? "Link Copiado!" : "Copiar Link"}
            </Button>
            <Button variant="outline" onClick={handleDownloadQrCode} className="min-h-[44px] flex-1 sm:flex-none touch-manipulation">
              <QrCode className="h-4 w-4 mr-2" /> Baixar QR Code SVG
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Esteira dos 8 Tiers de Gamificação</CardTitle>
              <CardDescription className="text-xs">Nível Atual: {currentTierDef.label} ({telemetry.activeSubscribersCount} ativos)</CardDescription>
            </div>
            <Badge className={currentTierDef.badgeColorClass}>{currentTierDef.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="w-full overflow-x-auto touch-pan-x pb-2">
            <div className="flex items-center gap-2 min-w-max">
              {AFFILIATE_TIERS.map((tier) => {
                const isCurrent = tier.tier === partner.tier;
                return (
                  <div
                    key={tier.tier}
                    className={`p-2.5 rounded-lg border text-xs flex flex-col items-center gap-1 min-w-[100px] ${
                      isCurrent ? "border-primary bg-primary/10 font-bold" : "border-border/60 bg-card text-muted-foreground"
                    }`}
                  >
                    <span style={{ color: tier.color }} className="font-semibold">{tier.label}</span>
                    <span className="text-[10px]">{tier.minActiveReferrals}+ ativos</span>
                    <span className="text-[10px] text-muted-foreground">{tier.recurringCommissionPercent}% rec.</span>
                  </div>
                );
              })}
            </div>
          </div>

          {nextTierDef && (
            <div className="space-y-2 pt-1">
              <div className="flex justify-between text-xs">
                <span>Progresso para <strong>{nextTierDef.label}</strong> ({nextTierDef.minActiveReferrals} ativos)</span>
                <span className="font-semibold">{tierProgress}%</span>
              </div>
              <Progress value={tierProgress} className="h-2.5" />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t text-xs">
            <div className="p-2.5 rounded bg-muted/40">
              <span className="text-muted-foreground block text-[11px]">1ª Mensalidade</span>
              <span className="font-bold text-foreground text-sm">{currentTierDef.firstMonthCommissionPercent}%</span>
            </div>
            <div className="p-2.5 rounded bg-muted/40">
              <span className="text-muted-foreground block text-[11px]">Recorrente Vitalícia</span>
              <span className="font-bold text-foreground text-sm">{currentTierDef.recurringCommissionPercent}%</span>
            </div>
            <div className="p-2.5 rounded bg-muted/40">
              <span className="text-muted-foreground block text-[11px]">Desconto na Assinatura</span>
              <span className="font-bold text-foreground text-sm">
                {currentTierDef.isSubscriptionWaived ? "100% (Isenção Total)" : `${currentTierDef.planDiscountPercent}%`}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
