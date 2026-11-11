import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Award, ShieldCheck, RefreshCw } from "lucide-react";
import { getAffiliateTierDefinition } from "@/lib/affiliate-tiers";
import {
  getConsolidatedAffiliateTelemetry,
  type AffiliateTelemetryData,
} from "@/lib/telemetry/affiliate-telemetry";
import { PerformanceTab } from "./PerformanceTab";
import { HookTab } from "./HookTab";
import { RegistryTab } from "./RegistryTab";
import { AffiliateSeasonalCampaignCard } from "@/components/marketing/campaigns";
import type { AffiliatePortalTab, AffiliatePortalViewProps } from "./types";

export * from "./types";

export function AffiliatePortalView({
  partner,
  initialTelemetry,
  defaultTab = "performance",
  onRequestBankChange,
}: AffiliatePortalViewProps) {
  const [activeTab, setActiveTab] = useState<AffiliatePortalTab>(defaultTab);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState(false);
  const [telemetry, setTelemetry] = useState<AffiliateTelemetryData>({
    slug: partner.slug,
    clicksCount: initialTelemetry?.clicksCount ?? 0,
    trialLeadsCount: initialTelemetry?.trialLeadsCount ?? 0,
    activeSubscribersCount: initialTelemetry?.activeSubscribersCount ?? 0,
    churnCount: initialTelemetry?.churnCount ?? 0,
    lifetimeCommissionCents: partner.lifetimeCommissionCents,
    availableBalanceCents: partner.availableBalanceCents,
    retainedBalanceCents: partner.retainedBalanceCents,
    overdueGraceDaysRemaining: partner.overdueGraceDaysRemaining ?? 40,
    conversionRatePercent: initialTelemetry?.conversionRatePercent ?? 0,
    churnRatePercent: initialTelemetry?.churnRatePercent ?? 0,
  });

  const loadTelemetry = async () => {
    setIsLoadingTelemetry(true);
    try {
      const data = await getConsolidatedAffiliateTelemetry(partner.slug, {
        lifetimeCommissionCents: partner.lifetimeCommissionCents,
        availableBalanceCents: partner.availableBalanceCents,
        retainedBalanceCents: partner.retainedBalanceCents,
        overdueGraceDaysRemaining: partner.overdueGraceDaysRemaining ?? 40,
        initialClicks: initialTelemetry?.clicksCount,
        initialTrials: initialTelemetry?.trialLeadsCount,
        initialActives: initialTelemetry?.activeSubscribersCount,
        initialChurn: initialTelemetry?.churnCount,
      });
      setTelemetry(data);
    } finally {
      setIsLoadingTelemetry(false);
    }
  };

  useEffect(() => {
    loadTelemetry();
  }, [partner.slug]);

  const currentTierDef = getAffiliateTierDefinition(partner.tier);

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden flex flex-col flex-1 gap-4 p-3 sm:p-5">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Portal do Parceiro Afiliado</h1>
            <Badge className={currentTierDef.badgeColorClass}>{currentTierDef.label}</Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {partner.name} • Cupom: <span className="font-semibold text-foreground">{partner.couponCode}</span>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadTelemetry}
          disabled={isLoadingTelemetry}
          className="min-h-[44px] min-w-[44px] self-start sm:self-auto touch-manipulation"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingTelemetry ? "animate-spin" : ""}`} />
          Atualizar Telemetria
        </Button>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as AffiliatePortalTab)}
        className="w-full max-w-full min-w-0"
      >
        <TabsList className="w-full grid grid-cols-3 min-h-[44px] p-1 bg-muted/60">
          <TabsTrigger value="performance" className="min-h-[38px] text-xs sm:text-sm">
            <TrendingUp className="h-4 w-4 mr-1.5 hidden sm:inline" /> Desempenho
          </TabsTrigger>
          <TabsTrigger value="hook" className="min-h-[38px] text-xs sm:text-sm">
            <Award className="h-4 w-4 mr-1.5 hidden sm:inline" /> Hook & Tier
          </TabsTrigger>
          <TabsTrigger value="registry" className="min-h-[38px] text-xs sm:text-sm">
            <ShieldCheck className="h-4 w-4 mr-1.5 hidden sm:inline" /> Registro
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4 pt-1">
          <AffiliateSeasonalCampaignCard
            currentCount={telemetry.activeSubscribersCount}
            couponCode={partner.couponCode}
            referralSlug={partner.slug}
            canEdit={false}
          />
          <PerformanceTab partner={partner} telemetry={telemetry} />
        </TabsContent>

        <TabsContent value="hook">
          <HookTab partner={partner} telemetry={telemetry} />
        </TabsContent>

        <TabsContent value="registry">
          <RegistryTab partner={partner} onRequestBankChange={onRequestBankChange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
