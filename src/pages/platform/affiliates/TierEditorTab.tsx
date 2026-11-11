import React, { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  AFFILIATE_TIERS,
  type AffiliateTier,
  type AffiliateTierDefinition,
} from "@/lib/affiliate-tiers";
import {
  Award,
  Check,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";

export interface TierEditorTabProps {
  onTiersUpdated?: () => void;
}

export const TierEditorTab: React.FC<TierEditorTabProps> = ({ onTiersUpdated }) => {
  const { toast } = useToast();
  const [tiers, setTiers] = useState<AffiliateTierDefinition[]>(() =>
    AFFILIATE_TIERS.map((t) => ({ ...t, benefitsList: [...t.benefitsList] }))
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("governance_rules")
        .select("value")
        .eq("key", "affiliate_tiers_config")
        .maybeSingle();

      if (error) throw error;

      if (data?.value && typeof data.value === "object" && Array.isArray((data.value as any).tiers)) {
        const savedTiers = (data.value as any).tiers as AffiliateTierDefinition[];
        // Faz merge com os 8 tiers canônicos para garantir integridade estrutural
        const merged = AFFILIATE_TIERS.map((defaultTier) => {
          const matched = savedTiers.find((st) => st.tier === defaultTier.tier);
          if (matched) {
            return {
              ...defaultTier,
              ...matched,
              benefitsList: Array.isArray(matched.benefitsList)
                ? [...matched.benefitsList]
                : [...defaultTier.benefitsList],
            };
          }
          return { ...defaultTier, benefitsList: [...defaultTier.benefitsList] };
        });
        setTiers(merged);
      }
    } catch (err: unknown) {
      console.warn("[TierEditorTab] Falha ao carregar regras de governança:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleFieldChange = (
    tierKey: AffiliateTier,
    field: keyof AffiliateTierDefinition,
    value: unknown
  ) => {
    setTiers((prev) =>
      prev.map((item) => {
        if (item.tier !== tierKey) return item;
        return { ...item, [field]: value };
      })
    );
    setHasChanges(true);
  };

  const handleBenefitChange = (tierKey: AffiliateTier, index: number, text: string) => {
    setTiers((prev) =>
      prev.map((item) => {
        if (item.tier !== tierKey) return item;
        const nextList = [...item.benefitsList];
        nextList[index] = text;
        return { ...item, benefitsList: nextList };
      })
    );
    setHasChanges(true);
  };

  const handleAddBenefit = (tierKey: AffiliateTier) => {
    setTiers((prev) =>
      prev.map((item) => {
        if (item.tier !== tierKey) return item;
        return {
          ...item,
          benefitsList: [...item.benefitsList, "Novo benefício exclusivo"],
        };
      })
    );
    setHasChanges(true);
  };

  const handleRemoveBenefit = (tierKey: AffiliateTier, index: number) => {
    setTiers((prev) =>
      prev.map((item) => {
        if (item.tier !== tierKey) return item;
        const nextList = item.benefitsList.filter((_, i) => i !== index);
        return { ...item, benefitsList: nextList };
      })
    );
    setHasChanges(true);
  };

  const handleRestoreDefaults = () => {
    const defaultCopy = AFFILIATE_TIERS.map((t) => ({
      ...t,
      benefitsList: [...t.benefitsList],
    }));
    setTiers(defaultCopy);
    setHasChanges(true);
    toast({
      title: "Padrões Oficiais Restaurados",
      description: "Os 8 tiers foram revertidos para os valores de fábrica. Clique em 'Salvar Configurações' para consolidar.",
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("governance_rules").upsert({
        key: "affiliate_tiers_config",
        value: {
          tiers,
          updated_at: new Date().toISOString(),
        } as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      setHasChanges(false);
      toast({
        title: "Tiers Atualizados com Sucesso!",
        description: "As regras de comissionamento, isenção e benefícios foram propagadas globalmente.",
      });
      onTiersUpdated?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar tiers.";
      toast({
        title: "Falha ao salvar tiers",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando catálogo de tiers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      {/* Barra de ações superior */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border bg-card/60 backdrop-blur-sm">
        <div>
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500 shrink-0" />
            Configuração dos 8 Tiers Oficiais
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Ajuste alíquotas de 1º mês, comissões recorrentes, waivers de assinatura e benefícios.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRestoreDefaults}
            disabled={saving}
            className="h-9 gap-1.5 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar Padrões
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="h-9 gap-1.5 text-xs font-semibold"
            data-testid="save-tiers-btn"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Salvar Configurações
          </Button>
        </div>
      </div>

      {/* Grid de Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-full min-w-0">
        {tiers.map((t) => {
          const maxText = t.maxActiveReferrals === null ? "ou mais" : `a ${t.maxActiveReferrals}`;
          const referralRange = `${t.minActiveReferrals} ${maxText} indicados`;

          return (
            <Card
              key={t.tier}
              data-testid={`tier-card-${t.tier}`}
              className="border shadow-sm flex flex-col justify-between overflow-hidden"
            >
              <CardHeader className="p-4 sm:p-5 pb-3 border-b bg-muted/20">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                    <CardTitle className="text-base font-bold truncate">
                      Tier {t.label}
                    </CardTitle>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${t.badgeColorClass}`}>
                      {referralRange}
                    </span>
                  </div>
                  {t.isSubscriptionWaived && (
                    <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Waiver Ativo
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs truncate mt-1">
                  {t.tagline}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 sm:p-5 space-y-4 flex-1">
                {/* Alíquotas e Desconto */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">1º Mês (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={t.firstMonthCommissionPercent}
                      onChange={(e) =>
                        handleFieldChange(
                          t.tier,
                          "firstMonthCommissionPercent",
                          Math.max(0, Math.min(100, Number(e.target.value) || 0))
                        )
                      }
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Recorrente (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={t.recurringCommissionPercent}
                      onChange={(e) =>
                        handleFieldChange(
                          t.tier,
                          "recurringCommissionPercent",
                          Math.max(0, Math.min(100, Number(e.target.value) || 0))
                        )
                      }
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Desconto Plano (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={t.planDiscountPercent}
                      onChange={(e) =>
                        handleFieldChange(
                          t.tier,
                          "planDiscountPercent",
                          Math.max(0, Math.min(100, Number(e.target.value) || 0))
                        )
                      }
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                {/* Switch Isenção de Assinatura */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold cursor-pointer">
                      Isenção Total de Mensalidade (Waiver 100% OFF)
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Garante gratuidade na assinatura da plataforma Pluri para parceiros deste nível.
                    </p>
                  </div>
                  <Switch
                    checked={t.isSubscriptionWaived}
                    onCheckedChange={(checked) =>
                      handleFieldChange(t.tier, "isSubscriptionWaived", checked)
                    }
                  />
                </div>

                {/* Lista de Benefícios */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      Benefícios e Vantagens Oficiais ({t.benefitsList.length})
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAddBenefit(t.tier)}
                      className="h-7 text-[11px] gap-1 text-primary hover:text-primary"
                    >
                      <Plus className="h-3 w-3" />
                      Adicionar
                    </Button>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto overscroll-contain pr-1">
                    {t.benefitsList.map((benefit, bIndex) => (
                      <div key={bIndex} className="flex items-center gap-1.5">
                        <Input
                          value={benefit}
                          onChange={(e) =>
                            handleBenefitChange(t.tier, bIndex, e.target.value)
                          }
                          className="h-8 text-xs flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveBenefit(t.tier, bIndex)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                          title="Remover benefício"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
