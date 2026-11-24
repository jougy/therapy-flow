import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/hooks/use-toast";
import {
  DEFAULT_MARKETING_CHIP_DISPLAY, DEFAULT_MARKETING_INSTANCE_KEY, FALLBACK_DEFAULT_AGENTS, FALLBACK_PRIMARY_INSTANCE,
  type AgentSimulationTurn, type AntiBanConfig, type ConversationFunnelStage, type MarketingAiAgent,
  type MarketingOptOut, type MarketingWhatsAppInstance, type MarketingZapCampaign, type MarketingZapConversation,
} from "./types";
import { formatPhoneBr, normalizePhoneToE164 } from "./antiBanEngine";
import { checkLocalEvolutionStatus, fetchLocalEvolutionQr, isLocalhostRuntime } from "./localEvolutionFallback";
import {
  createPoolInstanceRecord, fetchMarketingAgentsState, invokeZapGateway, marketingDb,
  runAgentSimulationTurn, saveAgentRecord, updateInstanceAntiBanRecord,
  type AgentDraftInput, type CampaignDraftInput,
} from "./marketingAgentsService";

export type { AgentDraftInput, CampaignDraftInput };

export function useMarketingAgents() {
  const [instances, setInstances] = useState<MarketingWhatsAppInstance[]>([FALLBACK_PRIMARY_INSTANCE]);
  const [agents, setAgents] = useState<MarketingAiAgent[]>(FALLBACK_DEFAULT_AGENTS);
  const [campaigns, setCampaigns] = useState<MarketingZapCampaign[]>([]);
  const [conversations, setConversations] = useState<MarketingZapConversation[]>([]);
  const [optOuts, setOptOuts] = useState<MarketingOptOut[]>([]);
  const [eligibleLeadsCount, setEligibleLeadsCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [previewFallback, setPreviewFallback] = useState<boolean>(false);
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [evolutionSetupHint, setEvolutionSetupHint] = useState<string | null>(null);
  const [connectingInstanceKey, setConnectingInstanceKey] = useState<string | null>(null);
  const [simulationTurns, setSimulationTurns] = useState<AgentSimulationTurn[]>([]);
  const [simulating, setSimulating] = useState<boolean>(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const state = await fetchMarketingAgentsState();
      setPreviewFallback(state.previewFallback);
      setInstances(state.instances);
      setAgents(state.agents);
      setCampaigns(state.campaigns);
      setConversations(state.conversations);
      setOptOuts(state.optOuts);
      setEligibleLeadsCount(state.eligibleLeadsCount);
    } catch {
      setPreviewFallback(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const primaryInstance = useMemo(
    () =>
      instances.find((i) => i.instance_key === DEFAULT_MARKETING_INSTANCE_KEY) ||
      instances[0] ||
      FALLBACK_PRIMARY_INSTANCE,
    [instances],
  );

  const connectInstanceQr = useCallback(async (instanceKey: string) => {
    setConnectingInstanceKey(instanceKey);
    setEvolutionSetupHint(null);
    try {
      const { data, error } = await invokeZapGateway("connect_qr", { instance_key: instanceKey });
      if (error) throw error;
      const resp = (data || {}) as { configured?: boolean; qrBase64?: string | null; setupHint?: string };

      if (resp.configured === false) {
        setEvolutionSetupHint(
          resp.setupHint ||
            "Suba o container Evolution API em infra/marketing-node e configure EVOLUTION_API_URL e EVOLUTION_API_KEY no Pulumi ESC.",
        );
        toast({
          title: "Evolution API aguardando configuração",
          description: `Chip ${DEFAULT_MARKETING_CHIP_DISPLAY} pronto para parear assim que EVOLUTION_API_URL estiver ativa.`,
        });
        return;
      }

      if (resp.qrBase64) {
        setQrCodeBase64(resp.qrBase64);
        setInstances((prev) =>
          prev.map((item) => (item.instance_key === instanceKey ? { ...item, status: "qr_ready" } : item)),
        );
        toast({
          title: "QR Code gerado!",
          description: `Escaneie com o WhatsApp do chip ${DEFAULT_MARKETING_CHIP_DISPLAY}.`,
        });
      }
    } catch (err) {
      if (isLocalhostRuntime()) {
        try {
          const localQr = await fetchLocalEvolutionQr(instanceKey);
          if (localQr) {
            setQrCodeBase64(localQr);
            setInstances((prev) =>
              prev.map((item) => (item.instance_key === instanceKey ? { ...item, status: "qr_ready" } : item)),
            );
            toast({
              title: "QR Code gerado (Evolution Local)!",
              description: `Escaneie com o WhatsApp do chip ${DEFAULT_MARKETING_CHIP_DISPLAY}.`,
            });
            return;
          }
        } catch (localErr) {
          toast({
            title: "Falha ao solicitar QR Code local",
            description: localErr instanceof Error ? localErr.message : "Verifique a Evolution API em :8085.",
            variant: "destructive",
          });
          return;
        }
      }
      toast({
        title: "Falha ao solicitar QR Code",
        description: err instanceof Error ? err.message : "Verifique a Evolution API.",
        variant: "destructive",
      });
    } finally {
      setConnectingInstanceKey(null);
    }
  }, []);

  const checkInstanceStatus = useCallback(async (instanceKey: string) => {
    try {
      const { data, error } = await invokeZapGateway("check_connection", { instance_key: instanceKey });
      if (error) throw error;
      const status = (data as { status?: MarketingWhatsAppInstance["status"] })?.status;
      if (status) {
        setInstances((prev) =>
          prev.map((item) => (item.instance_key === instanceKey ? { ...item, status } : item)),
        );
        if (status === "connected") {
          setQrCodeBase64(null);
          toast({ title: "WhatsApp conectado!", description: `Instância ${instanceKey} online.` });
        }
      }
    } catch {
      toast({ title: "Status mantido", description: "Não foi possível consultar a Evolution API agora." });
    }
  }, []);

  const toggleCircuitBreaker = useCallback(
    async (instance: MarketingWhatsAppInstance, trip: boolean) => {
      const nextStatus: MarketingWhatsAppInstance["status"] = trip ? "circuit_broken" : "disconnected";
      setInstances((prev) => prev.map((item) => (item.id === instance.id ? { ...item, status: nextStatus } : item)));
      if (!previewFallback) {
        await invokeZapGateway("toggle_circuit_breaker", {
          instance_id: instance.id,
          trip,
          reason: trip ? "Pausa de segurança via painel Agentes" : "Reset manual",
        });
      }
      toast({
        title: trip ? "Circuit Breaker acionado" : "Circuit Breaker rearmado",
        description: trip
          ? `Disparos de ${formatPhoneBr(instance.phone_e164)} pausados.`
          : `Chip ${formatPhoneBr(instance.phone_e164)} liberado para reconexão.`,
      });
    },
    [previewFallback],
  );

  const addExtraInstance = useCallback(
    async (displayName: string, rawPhone: string) => {
      const e164 = normalizePhoneToE164(rawPhone);
      if (!e164 || e164.length < 12) {
        toast({ title: "Telefone inválido", description: "Informe DDD + número.", variant: "destructive" });
        return false;
      }
      const res = await createPoolInstanceRecord(displayName, e164, previewFallback);
      if (res.error || !res.instance) {
        toast({ title: "Erro ao adicionar chip", description: res.error, variant: "destructive" });
        return false;
      }
      setInstances((prev) => [...prev, res.instance!]);
      toast({ title: "Chip adicionado ao Pool", description: formatPhoneBr(e164) });
      return true;
    },
    [previewFallback],
  );

  const saveAgent = useCallback(
    async (draft: AgentDraftInput) => {
      const res = await saveAgentRecord(draft, previewFallback);
      if (res.error || !res.agent) {
        toast({ title: "Erro ao salvar agente", description: res.error, variant: "destructive" });
        return false;
      }
      setAgents((prev) =>
        res.isEdit ? prev.map((a) => (a.id === res.agent!.id ? res.agent! : a)) : [...prev, res.agent!],
      );
      toast({ title: res.isEdit ? "Agente atualizado!" : "Novo agente criado!", description: draft.name });
      return true;
    },
    [previewFallback],
  );

  const toggleAgentActive = useCallback(
    async (agent: MarketingAiAgent) => {
      const next = !agent.is_active;
      setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, is_active: next } : a)));
      if (!previewFallback) {
        await marketingDb.from("marketing_ai_agents").update({ is_active: next }).eq("id", agent.id);
      }
      toast({ title: next ? "Agente ativado" : "Agente pausado", description: agent.name });
    },
    [previewFallback],
  );

  const simulateAgentMessage = useCallback(
    async (
      agent: MarketingAiAgent,
      message: string,
      override?: { providerSlug: string; modelId: string } | null,
    ) => {
      const trimmed = message.trim();
      if (!trimmed) return;
      setSimulationTurns((prev) => [
        ...prev,
        { id: `turn-lead-${Date.now()}`, role: "lead", text: trimmed, createdAt: new Date().toISOString() },
      ]);
      setSimulating(true);
      try {
        const turn = await runAgentSimulationTurn(agent, trimmed, override);
        setSimulationTurns((prev) => [...prev, turn]);
      } finally {
        setSimulating(false);
      }
    },
    [],
  );

  const createAndEnqueueCampaign = useCallback(
    async (draft: CampaignDraftInput) => {
      const now = new Date().toISOString();
      const targetEstimate = draft.parsed_contacts?.length
        ? Math.min(draft.parsed_contacts.length, primaryInstance.daily_limit)
        : Math.min(eligibleLeadsCount || 15, primaryInstance.daily_limit);

      if (previewFallback) {
        setCampaigns((prev) => [
          {
            id: `camp-${Date.now()}`,
            tenant_scope: "platform",
            instance_id: draft.instance_id,
            agent_id: draft.agent_id,
            name: draft.name,
            status: "scheduled",
            audience_filter: { min_score: draft.min_score, only_with_phone: true },
            message_template: draft.message_template,
            enable_ai_spintax: draft.enable_ai_spintax,
            campaign_mode: draft.campaign_mode || "standard",
            instance_pool_ids: draft.instance_pool_ids || [],
            target_group_jids: draft.target_group_jids || [],
            media_payload: draft.media_payload || {},
            require_turbo_filter: draft.require_turbo_filter ?? true,
            budget_cap_cents: 0,
            total_targets: targetEstimate,
            sent_count: 0,
            replied_count: 0,
            failed_count: 0,
            created_at: now,
            updated_at: now,
          },
          ...prev,
        ]);
        toast({ title: "Campanha agendada!", description: draft.name });
        return true;
      }

      let audienceListId: string | null = null;
      if (draft.parsed_contacts && draft.parsed_contacts.length > 0) {
        const listRes = await marketingDb
          .from("marketing_audience_lists")
          .insert({
            tenant_scope: "platform",
            name: draft.audience_list_name || `${draft.name} (CSV)`,
            source_type: "csv_import",
            total_count: draft.parsed_contacts.length,
            valid_count: draft.parsed_contacts.length,
          })
          .select("id")
          .single();
        if (listRes.data?.id) {
          audienceListId = String(listRes.data.id);
          await marketingDb.from("marketing_audience_contacts").insert(
            draft.parsed_contacts.slice(0, 500).map((c) => ({
              list_id: audienceListId,
              phone_e164: c.phoneE164,
              contact_name: c.name || "Contato",
              custom_vars: c.customVars || {},
            })),
          );
        }
      }

      const coreCamp = {
        tenant_scope: "platform",
        instance_id: draft.instance_id,
        agent_id: draft.agent_id,
        name: draft.name,
        status: "draft",
        audience_filter: { min_score: draft.min_score, only_with_phone: true },
        message_template: draft.message_template,
        enable_ai_spintax: draft.enable_ai_spintax,
      };
      const extCamp = {
        ...coreCamp,
        ...(draft.campaign_mode ? { campaign_mode: draft.campaign_mode } : {}),
        ...(draft.instance_pool_ids?.length ? { instance_pool_ids: draft.instance_pool_ids } : {}),
        ...(draft.target_group_jids?.length ? { target_group_jids: draft.target_group_jids } : {}),
        ...(draft.media_payload ? { media_payload: draft.media_payload } : {}),
        ...(draft.require_turbo_filter !== undefined ? { require_turbo_filter: draft.require_turbo_filter } : {}),
        ...(audienceListId ? { audience_list_id: audienceListId } : {}),
      };

      let { data: created, error } = await marketingDb
        .from("marketing_zap_campaigns")
        .insert(extCamp)
        .select("*")
        .single();

      if (error && /42703|PGRST204|column .* does not exist/i.test(`${error.code || ""} ${error.message || ""}`)) {
        const retry = await marketingDb.from("marketing_zap_campaigns").insert(coreCamp).select("*").single();
        created = retry.data;
        error = retry.error;
      }

      if (error || !created) {
        toast({ title: "Erro ao criar campanha", description: error?.message, variant: "destructive" });
        return false;
      }

      const { data: enqData } = await invokeZapGateway("enqueue_campaign", { campaign_id: created.id });
      toast({
        title: "Disparo enfileirado com Jitter Gaussiano!",
        description: `${(enqData as { queued_count?: number })?.queued_count ?? targetEstimate} contatos agendados com respeito ao Opt-Out.`,
      });
      await loadAll();
      return true;
    },
    [eligibleLeadsCount, loadAll, previewFallback, primaryInstance.daily_limit],
  );

  const toggleCampaignStatus = useCallback(
    async (campaign: MarketingZapCampaign) => {
      const nextStatus = campaign.status === "paused" ? "running" : "paused";
      setCampaigns((prev) => prev.map((c) => (c.id === campaign.id ? { ...c, status: nextStatus } : c)));
      if (!previewFallback) {
        await marketingDb.from("marketing_zap_campaigns").update({ status: nextStatus }).eq("id", campaign.id);
      }
      toast({ title: nextStatus === "paused" ? "Campanha pausada" : "Campanha retomada" });
    },
    [previewFallback],
  );

  const updateAntiBanConfig = useCallback(
    async (instance: MarketingWhatsAppInstance, nextConfig: AntiBanConfig, warmupDay: number) => {
      const nextDailyLimit = await updateInstanceAntiBanRecord(
        instance,
        nextConfig,
        warmupDay,
        previewFallback,
      );
      setInstances((prev) =>
        prev.map((item) =>
          item.id === instance.id
            ? { ...item, anti_ban_config: nextConfig, warmup_day: warmupDay, daily_limit: nextDailyLimit }
            : item,
        ),
      );
      toast({ title: "Blindagem anti-ban atualizada!", description: `Teto diário: ${nextDailyLimit} envios/dia.` });
    },
    [previewFallback],
  );

  const addManualOptOut = useCallback(
    async (rawPhone: string, reason = "manual_backoffice_block") => {
      const phone = normalizePhoneToE164(rawPhone);
      if (!phone || phone.length < 12) {
        toast({ title: "Telefone inválido", variant: "destructive" });
        return false;
      }
      const newOpt: MarketingOptOut = {
        id: `opt-${Date.now()}`,
        phone_e164: phone,
        phone_hash: `manual-${phone}`,
        reason,
        source_channel: "backoffice_manual",
        created_at: new Date().toISOString(),
      };
      if (!previewFallback) {
        const { data, error } = await marketingDb
          .from("marketing_opt_outs")
          .insert({
            tenant_scope: "platform",
            phone_e164: phone,
            phone_hash: newOpt.phone_hash,
            reason,
            source_channel: "backoffice_manual",
          })
          .select("*")
          .single();
        if (error) {
          toast({ title: "Erro ao bloquear número", description: error.message, variant: "destructive" });
          return false;
        }
        setOptOuts((prev) => [data as MarketingOptOut, ...prev]);
      } else {
        setOptOuts((prev) => [newOpt, ...prev]);
      }
      toast({ title: "Opt-Out LGPD registrado", description: formatPhoneBr(phone) });
      return true;
    },
    [previewFallback],
  );

  const removeOptOut = useCallback(
    async (id: string) => {
      setOptOuts((prev) => prev.filter((o) => o.id !== id));
      if (!previewFallback) {
        await marketingDb.from("marketing_opt_outs").delete().eq("id", id);
      }
      toast({ title: "Número removido da lista de opt-out" });
    },
    [previewFallback],
  );

  const toggleConversationHumanMode = useCallback(
    async (conv: MarketingZapConversation) => {
      const nextMode: MarketingZapConversation["agent_mode"] = conv.agent_mode === "human" ? "ai" : "human";
      setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, agent_mode: nextMode } : c)));
      if (!previewFallback) {
        await marketingDb.from("marketing_zap_conversations").update({ agent_mode: nextMode }).eq("id", conv.id);
      }
      toast({
        title: nextMode === "human" ? "Atendimento humano ativado" : "IA SDR reativada",
        description:
          nextMode === "human"
            ? `Agente IA silenciado para ${conv.contact_name}.`
            : `Agente IA voltou a responder ${conv.contact_name}.`,
      });
    },
    [previewFallback],
  );

  const updateConversationStage = useCallback(
    async (convId: string, nextStage: ConversationFunnelStage) => {
      setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, funnel_stage: nextStage } : c)));
      if (!previewFallback) {
        await marketingDb.from("marketing_zap_conversations").update({ funnel_stage: nextStage }).eq("id", convId);
      }
    },
    [previewFallback],
  );

  return {
    instances, primaryInstance, agents, campaigns, conversations, optOuts, eligibleLeadsCount,
    loading, previewFallback, qrCodeBase64, evolutionSetupHint, connectingInstanceKey, simulationTurns, simulating,
    reload: loadAll, connectInstanceQr, checkInstanceStatus, toggleCircuitBreaker, addExtraInstance,
    saveAgent, toggleAgentActive, simulateAgentMessage, clearSimulation: () => setSimulationTurns([]),
    createAndEnqueueCampaign, toggleCampaignStatus, updateAntiBanConfig, addManualOptOut, removeOptOut,
    toggleConversationHumanMode, updateConversationStage,
  };
}
