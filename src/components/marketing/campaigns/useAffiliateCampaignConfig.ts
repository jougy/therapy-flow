import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import {
  AffiliateCampaignConfig,
  DEFAULT_CAMPAIGN_CONFIG,
} from "./campaignTypes";

export const AFFILIATE_CAMPAIGN_RULE_KEY = "affiliate_campaign_config";

export function parseAffiliateCampaignConfig(rawValue: unknown): AffiliateCampaignConfig {
  if (!rawValue || typeof rawValue !== "object") {
    return DEFAULT_CAMPAIGN_CONFIG;
  }

  const val = rawValue as Partial<AffiliateCampaignConfig>;

  return {
    isActive: typeof val.isActive === "boolean" ? val.isActive : DEFAULT_CAMPAIGN_CONFIG.isActive,
    title:
      typeof val.title === "string" && val.title.trim().length > 0
        ? val.title
        : DEFAULT_CAMPAIGN_CONFIG.title,
    description:
      typeof val.description === "string" ? val.description : DEFAULT_CAMPAIGN_CONFIG.description,
    targetCount:
      typeof val.targetCount === "number" && val.targetCount > 0
        ? Math.round(val.targetCount)
        : DEFAULT_CAMPAIGN_CONFIG.targetCount,
    bonusValueCents:
      typeof val.bonusValueCents === "number" && val.bonusValueCents >= 0
        ? Math.round(val.bonusValueCents)
        : DEFAULT_CAMPAIGN_CONFIG.bonusValueCents,
    endDate:
      typeof val.endDate === "string" && val.endDate.trim().length > 0
        ? val.endDate
        : DEFAULT_CAMPAIGN_CONFIG.endDate,
    rulesList:
      Array.isArray(val.rulesList) && val.rulesList.length > 0
        ? val.rulesList.map((r) => String(r).trim()).filter(Boolean)
        : DEFAULT_CAMPAIGN_CONFIG.rulesList,
    badgeLabel:
      typeof val.badgeLabel === "string" && val.badgeLabel.trim().length > 0
        ? val.badgeLabel
        : DEFAULT_CAMPAIGN_CONFIG.badgeLabel,
  };
}

export function useAffiliateCampaignConfig() {
  const [config, setConfig] = useState<AffiliateCampaignConfig>(DEFAULT_CAMPAIGN_CONFIG);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (typeof supabase?.from !== "function") {
        setConfig(DEFAULT_CAMPAIGN_CONFIG);
        setLoading(false);
        return;
      }

      const query = supabase
        .from("governance_rules")
        .select("value")
        .eq("key", AFFILIATE_CAMPAIGN_RULE_KEY);

      const response = await query?.maybeSingle?.();
      const data = response?.data;
      const fetchError = response?.error;

      if (fetchError) throw fetchError;

      if (data && data.value) {
        setConfig(parseAffiliateCampaignConfig(data.value));
      } else {
        setConfig(DEFAULT_CAMPAIGN_CONFIG);
      }
    } catch (err: unknown) {
      const parsedError = err instanceof Error ? err : new Error(String(err));
      console.warn("[useAffiliateCampaignConfig] Falha ao carregar configuração:", err);
      setError(parsedError);
      setConfig(DEFAULT_CAMPAIGN_CONFIG);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();

    if (typeof supabase?.channel !== "function") {
      return;
    }

    // Identificador único por instância do hook para evitar colisão no realtime client
    // caso múltiplos componentes ou modais montem o hook simultaneamente
    const channelId = `governance-affiliate-campaign-${Math.random().toString(36).substring(2, 9)}`;

    // Inscrição em tempo real para propagar alterações instantaneamente
    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "governance_rules",
          filter: `key=eq.${AFFILIATE_CAMPAIGN_RULE_KEY}`,
        },
        (payload: { new?: { value?: unknown } }) => {
          if (payload.new && payload.new.value) {
            setConfig(parseAffiliateCampaignConfig(payload.new.value));
          }
        }
      )
      .subscribe();

    return () => {
      if (typeof supabase?.removeChannel === "function") {
        void supabase.removeChannel(channel);
      }
    };
  }, [loadConfig]);

  const saveConfig = useCallback(
    async (newConfig: AffiliateCampaignConfig) => {
      try {
        const validatedConfig = parseAffiliateCampaignConfig(newConfig);

        const { error: upsertError } = await supabase.from("governance_rules").upsert({
          key: AFFILIATE_CAMPAIGN_RULE_KEY,
          value: validatedConfig as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        });

        if (upsertError) throw upsertError;

        setConfig(validatedConfig);

        toast({
          title: "Campanha Sazonal Atualizada",
          description: validatedConfig.isActive
            ? "O desafio foi salvo e suas metas estão ativas para toda a rede."
            : "A campanha sazonal foi desativada globalmente.",
        });

        return { success: true, config: validatedConfig };
      } catch (err: unknown) {
        console.error("[useAffiliateCampaignConfig] Erro ao salvar configuração:", err);
        toast({
          variant: "destructive",
          title: "Erro ao salvar campanha",
          description: "Não foi possível gravar as regras no banco de governança.",
        });
        return { success: false, error: err };
      }
    },
    [toast]
  );

  const resetToDefault = useCallback(async () => {
    return saveConfig(DEFAULT_CAMPAIGN_CONFIG);
  }, [saveConfig]);

  return {
    config,
    loading,
    error,
    saveConfig,
    resetToDefault,
    refresh: loadConfig,
  };
}
