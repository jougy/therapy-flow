import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getAffiliateTierDefinition } from "@/lib/affiliate-tiers";
import { AffiliateSeasonalCampaignCard } from "@/components/marketing/campaigns";
import type { AffiliateRecord } from "@/components/platform/affiliate-management/types";
import {
  Award,
  ChevronRight,
  DollarSign,
  Loader2,
  Plus,
  Receipt,
  Search,
  Shield,
  UserPlus,
  Users,
} from "lucide-react";

export interface AffiliatesOverviewTabProps {
  onOpenManagement: (affiliateId?: string | null) => void;
  onOpenInvite: () => void;
}

export const AffiliatesOverviewTab: React.FC<AffiliatesOverviewTabProps> = ({
  onOpenManagement,
  onOpenInvite,
}) => {
  const [affiliates, setAffiliates] = useState<AffiliateRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const loadAffiliates = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("affiliates")
        .select(`
          *,
          profile:profiles!user_id (id, full_name, email, cpf)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAffiliates(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      console.warn("[AffiliatesOverviewTab] Falha ao carregar afiliados:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAffiliates();
  }, [loadAffiliates]);

  const metrics = useMemo(() => {
    const total = affiliates.length;
    const activeCount = affiliates.filter((a) => a.status === "active").length;
    const totalReferrals = affiliates.reduce(
      (acc, a) => acc + (a.active_referrals_count || 0),
      0
    );
    const totalSales = affiliates.reduce(
      (acc, a) => acc + (a.total_sales_count || 0),
      0
    );
    const totalCommissionCents = affiliates.reduce(
      (acc, a) => acc + (Number(a.lifetime_commission_cents) || 0),
      0
    );
    const totalCommissionBrl = (totalCommissionCents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    return {
      total,
      activeCount,
      totalReferrals,
      totalSales,
      totalCommissionBrl,
    };
  }, [affiliates]);

  const filteredAffiliates = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return affiliates;
    return affiliates.filter((a) => {
      const matchCoupon = a.coupon_code?.toLowerCase().includes(q);
      const matchSlug = a.referral_slug?.toLowerCase().includes(q);
      const matchName = a.profile?.full_name?.toLowerCase().includes(q);
      const matchEmail = a.profile?.email?.toLowerCase().includes(q);
      return matchCoupon || matchSlug || matchName || matchEmail;
    });
  }, [affiliates, searchTerm]);

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      {/* Campanha Sazonal & Desafio Ativo da Rede */}
      <AffiliateSeasonalCampaignCard
        currentCount={metrics.totalReferrals}
        canEdit={true}
      />

      {/* 1. Cards de Métricas Gerais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full max-w-full min-w-0">
        <Card className="p-4 bg-card/60 border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase text-muted-foreground truncate">
                Total de Parceiros
              </p>
              <p className="text-xl font-bold truncate">
                {metrics.total}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({metrics.activeCount} ativos)
                </span>
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card/60 border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 shrink-0">
              <Award className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase text-muted-foreground truncate">
                Assinantes Indicados
              </p>
              <p className="text-xl font-bold truncate">{metrics.totalReferrals}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card/60 border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 shrink-0">
              <Receipt className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase text-muted-foreground truncate">
                Mensalidades Pagas
              </p>
              <p className="text-xl font-bold truncate">{metrics.totalSales}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card/60 border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 shrink-0">
              <DollarSign className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase text-muted-foreground truncate">
                Comissões Geradas
              </p>
              <p className="text-xl font-bold truncate text-emerald-600 dark:text-emerald-400">
                {metrics.totalCommissionBrl}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* 2. Atalhos Rápidos & Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border bg-muted/20">
        <div>
          <h3 className="text-base font-bold">Ações Rápidas de Governança</h3>
          <p className="text-xs text-muted-foreground">
            Gerencie alíquotas individuais, aprove convites ou audite subcontas Asaas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 gap-1.5 text-xs border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950"
            onClick={() => onOpenManagement(null)}
            data-testid="open-general-management-btn"
          >
            <Shield className="h-3.5 w-3.5 text-amber-500" />
            Gestão Master de Afiliados
          </Button>
          <Button
            type="button"
            className="h-9 gap-1.5 text-xs font-semibold"
            onClick={onOpenInvite}
            data-testid="open-invite-affiliate-btn"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Convidar Novo Parceiro
          </Button>
        </div>
      </div>

      {/* 3. Tabela & Diretório de Parceiros */}
      <Card>
        <CardHeader className="p-4 sm:p-5 pb-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold">Diretório de Afiliados</CardTitle>
            <CardDescription className="text-xs">
              Listagem cadastral de promotores com acompanhamento de volume e comissões.
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Buscar por cupom ou nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 text-xs h-9"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Carregando afiliados...</p>
            </div>
          ) : filteredAffiliates.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground space-y-3">
              <p>
                {searchTerm
                  ? "Nenhum parceiro encontrado para a busca."
                  : "Nenhum parceiro cadastrado no momento."}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenInvite}
                className="h-8 text-xs gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Convidar Primeiro Parceiro
              </Button>
            </div>
          ) : (
            <div className="w-full overflow-x-auto touch-pan-x">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-muted/30 text-muted-foreground font-semibold">
                    <th className="p-3">Parceiro</th>
                    <th className="p-3">Cupom & Link</th>
                    <th className="p-3">Tier Atual</th>
                    <th className="p-3">Indicados</th>
                    <th className="p-3">Alíquotas</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredAffiliates.map((item) => {
                    const tierDef = getAffiliateTierDefinition(item.tier || "bronze");
                    const fullName = item.profile?.full_name || "Sem nome";
                    const email = item.profile?.email;

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-muted/30 transition-colors"
                        data-testid={`affiliate-row-${item.id}`}
                      >
                        <td className="p-3">
                          <p className="font-semibold text-foreground truncate max-w-[180px]">
                            {fullName}
                          </p>
                          {email && (
                            <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                              {email}
                            </p>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {item.coupon_code}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            /{item.referral_slug}
                          </p>
                        </td>
                        <td className="p-3">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded border inline-block ${tierDef.badgeColorClass}`}
                          >
                            {tierDef.label}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="font-semibold">{item.active_referrals_count ?? 0}</span>{" "}
                          <span className="text-[11px] text-muted-foreground">ativos</span>
                        </td>
                        <td className="p-3">
                          <span className="font-medium">
                            {item.first_month_commission_percent ?? 30}% /{" "}
                            {item.recurring_commission_percent ?? 10}%
                          </span>
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={item.status === "active" ? "secondary" : "destructive"}
                            className="text-[10px] uppercase font-semibold"
                          >
                            {item.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1 hover:bg-muted"
                            onClick={() => onOpenManagement(item.id)}
                            data-testid={`manage-btn-${item.id}`}
                          >
                            Gerenciar
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </td>
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
