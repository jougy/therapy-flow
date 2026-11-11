import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useB2bAffiliateCrm } from "@/modules/marketing/adapters/useB2bAffiliateCrm";
import { MarketingCrmEngine } from "@/modules/marketing/components/MarketingCrmEngine";
import type { MarketingCrmAdapter, CrmStageDefinition } from "@/modules/marketing/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Filter,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface AffiliateOption {
  id: string;
  coupon_code?: string | null;
  referral_slug?: string | null;
  tier?: string | null;
  status?: string | null;
  profile?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
}

export interface AffiliatesCrmTabProps {
  className?: string;
  initialAffiliateId?: string;
}

const B2B_AFFILIATE_STAGES: CrmStageDefinition[] = [
  {
    key: "new",
    label: "Lead Capturado / Trial",
    colorClass: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  },
  {
    key: "active",
    label: "Assinante Pago",
    colorClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  },
  {
    key: "stalled",
    label: "Lead Pausado",
    colorClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  {
    key: "grace_period",
    label: "Risco de Churn",
    colorClass: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  },
  {
    key: "churn",
    label: "Cancelado",
    colorClass: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  },
];

export const AffiliatesCrmTab: React.FC<AffiliatesCrmTabProps> = ({
  className,
  initialAffiliateId = "all",
}) => {
  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string>(initialAffiliateId);
  const [affiliates, setAffiliates] = useState<AffiliateOption[]>([]);
  const [loadingAffiliates, setLoadingAffiliates] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Carrega a lista de promotores cadastrados para o dropdown superior
  const fetchAffiliates = useCallback(async () => {
    setLoadingAffiliates(true);
    try {
      const { data, error } = await (supabase as any)
        .from("affiliates")
        .select(`
          id, coupon_code, referral_slug, tier, status,
          profile:profiles!user_id ( full_name, email )
        `)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAffiliates(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      console.warn("[AffiliatesCrmTab] Falha ao carregar lista de promotores:", err);
    } finally {
      setLoadingAffiliates(false);
    }
  }, []);

  useEffect(() => {
    void fetchAffiliates();
  }, [fetchAffiliates]);

  // Hook unificado de CRM B2B
  const rawAdapter = useB2bAffiliateCrm({
    affiliateId: selectedAffiliateId === "all" ? "all" : selectedAffiliateId,
    enabled: true,
  });

  const selectedAffiliate = useMemo(() => {
    return affiliates.find((a) => a.id === selectedAffiliateId);
  }, [affiliates, selectedAffiliateId]);

  // Adapter enriquecido com nomenclaturas canônicas de B2B
  const adapter: MarketingCrmAdapter = useMemo(() => {
    const promoterLabel = selectedAffiliate
      ? `${selectedAffiliate.profile?.full_name || selectedAffiliate.referral_slug || "Afiliado"} (${selectedAffiliate.coupon_code || "Sem cupom"})`
      : "Todos os Afiliados (Consolidado)";

    return {
      ...rawAdapter,
      title: `CRM B2B — ${promoterLabel}`,
      subtitle:
        selectedAffiliateId === "all"
          ? "Visão global de todos os leads, trials e assinantes convertidos pela rede"
          : `Acompanhamento dos clientes indicados via cupom ${selectedAffiliate?.coupon_code || "do parceiro"}`,
      stages: B2B_AFFILIATE_STAGES,
    };
  }, [rawAdapter, selectedAffiliate, selectedAffiliateId]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([rawAdapter.refetch(), fetchAffiliates()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Contadores de status do filtro ativo
  const stageStats = useMemo(() => {
    const total = rawAdapter.contacts.length;
    const active = rawAdapter.contacts.filter((c) => c.stage === "active").length;
    const trials = rawAdapter.contacts.filter((c) => c.stage === "new").length;
    const atRisk = rawAdapter.contacts.filter(
      (c) => c.stage === "grace_period" || c.stage === "stalled"
    ).length;

    return { total, active, trials, atRisk };
  }, [rawAdapter.contacts]);

  return (
    <div
      data-testid="affiliates-crm-tab"
      className={cn("w-full max-w-full min-w-0 overflow-x-hidden space-y-4", className)}
    >
      {/* Barra de Seleção Superior e Filtros */}
      <Card className="border bg-card/60 backdrop-blur-sm shadow-sm">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary shrink-0" />
                <h3 className="text-sm sm:text-base font-semibold text-foreground">
                  Filtrar por Promotor / Afiliado
                </h3>
                {selectedAffiliate?.tier && (
                  <Badge variant="outline" className="text-xs uppercase font-mono">
                    Tier {selectedAffiliate.tier}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Selecione uma carteira individual ou acompanhe a esteira consolidada de parceiros.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="w-full sm:w-80">
                <Select
                  value={selectedAffiliateId}
                  onValueChange={setSelectedAffiliateId}
                  disabled={loadingAffiliates}
                >
                  <SelectTrigger
                    data-testid="affiliate-crm-selector"
                    className="w-full h-11 min-h-[44px] text-xs sm:text-sm bg-background border-input"
                  >
                    <SelectValue placeholder="Selecione um promotor..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="all" className="text-xs sm:text-sm font-medium">
                      Todos os Afiliados (Consolidado)
                    </SelectItem>
                    {affiliates.map((aff) => {
                      const name =
                        aff.profile?.full_name || aff.referral_slug || "Parceiro sem nome";
                      const coupon = aff.coupon_code ? ` • Cupom: ${aff.coupon_code}` : "";
                      return (
                        <SelectItem key={aff.id} value={aff.id} className="text-xs sm:text-sm">
                          {name}
                          {coupon}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={isRefreshing || rawAdapter.isLoading}
                className="h-11 min-h-[44px] px-3 gap-2 shrink-0 text-xs font-medium"
                title="Atualizar dados do CRM"
              >
                <RefreshCw
                  className={cn(
                    "h-4 w-4",
                    (isRefreshing || rawAdapter.isLoading) && "animate-spin"
                  )}
                />
                <span className="hidden sm:inline">Atualizar</span>
              </Button>
            </div>
          </div>

          {/* Mini Dashboard de Métricas Rápidas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t">
            <div className="bg-muted/40 rounded-lg p-2.5 flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-muted-foreground truncate">Total de Leads</div>
                <div className="text-base sm:text-lg font-bold text-foreground">
                  {stageStats.total}
                </div>
              </div>
            </div>

            <div className="bg-muted/40 rounded-lg p-2.5 flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-muted-foreground truncate">Assinantes Pagos</div>
                <div className="text-base sm:text-lg font-bold text-emerald-600">
                  {stageStats.active}
                </div>
              </div>
            </div>

            <div className="bg-muted/40 rounded-lg p-2.5 flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-muted-foreground truncate">Trials / Novos</div>
                <div className="text-base sm:text-lg font-bold text-blue-600">
                  {stageStats.trials}
                </div>
              </div>
            </div>

            <div className="bg-muted/40 rounded-lg p-2.5 flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4 w-4 text-purple-600" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-muted-foreground truncate">Risco / Churn</div>
                <div className="text-base sm:text-lg font-bold text-purple-600">
                  {stageStats.atRisk}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Motor Polimórfico de CRM com Pipeline Kanban */}
      <MarketingCrmEngine adapter={adapter} />
    </div>
  );
};

export default AffiliatesCrmTab;
