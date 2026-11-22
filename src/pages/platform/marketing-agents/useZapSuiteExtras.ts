import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/hooks/use-toast";
import type { MarketingWhatsAppInstance, MarketingZapConversation } from "./types";
import {
  CURATED_LLM_CATALOG,
  DEFAULT_DEVICE_LLM_HARNESS,
  FALLBACK_LLM_PROVIDERS,
  type DeviceLlmHarnessConfig,
  type KeywordTriggerRecord,
  type LlmModelCatalogItem,
  type LlmProviderRecord,
  type WhatsAppGroupRecord,
  type ZapDefenderReport,
} from "./suiteTypes";
import {
  discoverLocalOllamaModels,
  fetchModelsDevCatalog,
  fetchOpenCodeLiveModels,
  loadDeviceLlmHarness,
  saveDeviceLlmHarness,
} from "./llmHarnessStorage";
import { formatPhoneBr, normalizePhoneToE164 } from "./antiBanEngine";
import { invokeZapGateway, marketingDb } from "./marketingAgentsService";
import type { WarmupPoolConfig } from "./WarmupPoolsPanel";
import {
  compactConversationAction,
  extractGroupMembersAction,
  fetchZapSuiteExtrasState,
  persistWarmupPoolAction,
  requestPairingCodeAction,
  runZapDefenderAuditAction,
  syncGroupsAction,
  testLlmProviderAction,
  validateNumbersBatchAction,
} from "./zapSuiteExtrasService";

interface UseZapSuiteExtrasParams {
  previewFallback: boolean;
  instances: MarketingWhatsAppInstance[];
  onReloadCore?: () => Promise<void>;
}

export function useZapSuiteExtras({
  previewFallback,
  instances,
  onReloadCore,
}: UseZapSuiteExtrasParams) {
  const [llmProviders, setLlmProviders] = useState<LlmProviderRecord[]>(FALLBACK_LLM_PROVIDERS);
  const [deviceHarness, setDeviceHarness] = useState<DeviceLlmHarnessConfig>(DEFAULT_DEVICE_LLM_HARNESS);
  const [liveCatalog, setLiveCatalog] = useState<LlmModelCatalogItem[]>(CURATED_LLM_CATALOG);
  const [syncingModels, setSyncingModels] = useState(false);

  const [defenderReports, setDefenderReports] = useState<Record<string, ZapDefenderReport>>({});
  const [auditingInstanceId, setAuditingInstanceId] = useState<string | null>(null);
  const [groups, setGroups] = useState<WhatsAppGroupRecord[]>([]);
  const [warmupPools, setWarmupPools] = useState<WarmupPoolConfig[]>([]);
  const [keywordTriggers, setKeywordTriggers] = useState<KeywordTriggerRecord[]>([]);

  const mergeCatalogItems = useCallback((incoming: LlmModelCatalogItem[]) => {
    setLiveCatalog((prev) => {
      const map = new Map<string, LlmModelCatalogItem>();
      for (const item of [...incoming, ...prev, ...CURATED_LLM_CATALOG]) {
        map.set(`${item.providerSlug}::${item.id}`, item);
      }
      return Array.from(map.values());
    });
  }, []);

  useEffect(() => {
    let active = true;
    void loadDeviceLlmHarness().then((cfg) => {
      if (active) setDeviceHarness(cfg);
    });
    void fetchModelsDevCatalog(false).then((items) => {
      if (active && items.length > 0) mergeCatalogItems(items);
    });
    return () => {
      active = false;
    };
  }, [mergeCatalogItems]);

  useEffect(() => {
    if (previewFallback) return;
    let active = true;
    void fetchZapSuiteExtrasState(instances)
      .then((res) => {
        if (!active) return;
        if (res.providers) setLlmProviders(res.providers);
        if (res.triggers) setKeywordTriggers(res.triggers);
        if (res.groups) setGroups(res.groups);
        if (res.pools) setWarmupPools(res.pools);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [instances, previewFallback]);

  const handleSaveDeviceHarness = useCallback(async (next: DeviceLlmHarnessConfig) => {
    const saved = await saveDeviceLlmHarness(next);
    setDeviceHarness(saved);
  }, []);

  const syncAllLlmModels = useCallback(async () => {
    setSyncingModels(true);
    try {
      const [openCodeItems, ollamaItems, modelsDevItems] = await Promise.all([
        fetchOpenCodeLiveModels(),
        discoverLocalOllamaModels(deviceHarness.ollamaBaseUrl),
        fetchModelsDevCatalog(true),
      ]);
      mergeCatalogItems([...ollamaItems, ...openCodeItems, ...modelsDevItems]);
      if (!previewFallback) {
        await invokeZapGateway("sync_llm_models", { slug: "opencode-free" }).catch(() => undefined);
      }
      toast({
        title: "Catálogo LLM sincronizado!",
        description: `${openCodeItems.length} OpenCode Free + ${ollamaItems.length} Ollama locais carregados.`,
      });
    } finally {
      setSyncingModels(false);
    }
  }, [deviceHarness.ollamaBaseUrl, mergeCatalogItems, previewFallback]);

  const runZapDefenderAudit = useCallback(async (inst: MarketingWhatsAppInstance) => {
    setAuditingInstanceId(inst.id);
    try {
      const report = await runZapDefenderAuditAction(inst);
      setDefenderReports((prev) => ({ ...prev, [inst.id]: report }));
      return report;
    } finally {
      setAuditingInstanceId(null);
    }
  }, []);

  const validateNumbersBatch = useCallback(
    async (instanceId: string, phones: string[]) => {
      const inst = instances.find((i) => i.id === instanceId) || instances[0];
      return validateNumbersBatchAction(inst, phones, previewFallback);
    },
    [instances, previewFallback],
  );

  const syncGroups = useCallback(
    async (instanceId: string) => {
      const inst = instances.find((i) => i.id === instanceId) || instances[0];
      const synced = await syncGroupsAction(inst, previewFallback);
      setGroups(synced);
      return synced;
    },
    [instances, previewFallback],
  );

  const extractGroupMembers = useCallback(
    async (group: WhatsAppGroupRecord) => {
      const inst = instances.find((i) => i.id === group.instanceId) || instances[0];
      return extractGroupMembersAction(inst, group.groupJid, previewFallback);
    },
    [instances, previewFallback],
  );

  const enqueueGroupJob = useCallback(
    async (payload: { instanceId: string; groupJids?: string[]; groupJid?: string; action?: "add" | "remove"; phones?: string[]; message?: string }) => {
      const targetJids = payload.groupJids?.length ? payload.groupJids : payload.groupJid ? [payload.groupJid] : [];
      if (targetJids.length === 0) return false;
      const jobType = payload.message ? "broadcast_group" : payload.action === "remove" ? "remove_participants" : "add_participants";
      if (!previewFallback) {
        await Promise.all(
          targetJids.map((jid) =>
            invokeZapGateway("enqueue_group_action", {
              instance_id: payload.instanceId,
              group_jid: jid,
              job_type: jobType,
              participants: payload.phones || [],
              message: payload.message || "",
            }),
          ),
        );
      }
      return true;
    },
    [previewFallback],
  );

  const sendPushAlert = useCallback(
    async ({ instanceId, phone, message }: { instanceId: string; phone: string; message: string }) => {
      const inst = instances.find((i) => i.id === instanceId) || instances[0];
      const e164 = normalizePhoneToE164(phone);
      if (!inst || !e164) return false;
      if (!previewFallback) {
        const { error } = await invokeZapGateway("send_push_alert", {
          instance_key: inst.instance_key,
          phone_e164: e164,
          message_text: message,
        });
        if (error) {
          toast({ title: "Erro no PushZap", description: error.message, variant: "destructive" });
          return false;
        }
      }
      toast({ title: "PushZap enviado!", description: `Alerta encaminhado para ${formatPhoneBr(e164)}.` });
      return true;
    },
    [instances, previewFallback],
  );

  const saveWarmupPool = useCallback(
    async (pool: WarmupPoolConfig) => {
      setWarmupPools((prev) => (prev.some((p) => p.id === pool.id) ? prev.map((p) => (p.id === pool.id ? pool : p)) : [pool, ...prev]));
      if (!previewFallback) await persistWarmupPoolAction(pool);
    },
    [previewFallback],
  );

  const createKeywordTrigger = useCallback(
    async (draft: Omit<KeywordTriggerRecord, "id" | "hitCount">) => {
      const optimistic: KeywordTriggerRecord = { ...draft, id: `trig-${Date.now()}`, hitCount: 0 };
      setKeywordTriggers((prev) => [optimistic, ...prev]);
      if (!previewFallback) {
        const { data } = await marketingDb
          .from("marketing_keyword_triggers")
          .insert({
            tenant_scope: "platform",
            instance_id: draft.instanceId || null,
            name: draft.name,
            match_type: draft.matchType,
            pattern: draft.pattern,
            action_type: draft.actionType,
            action_payload: draft.actionPayload,
            priority: draft.priority,
            is_active: draft.isActive,
          })
          .select("*")
          .single();
        if (data?.id) {
          setKeywordTriggers((prev) => prev.map((t) => (t.id === optimistic.id ? { ...optimistic, id: String(data.id) } : t)));
        }
      }
    },
    [previewFallback],
  );

  const toggleKeywordTrigger = useCallback(
    async (trigger: KeywordTriggerRecord) => {
      const next = !trigger.isActive;
      setKeywordTriggers((prev) => prev.map((t) => (t.id === trigger.id ? { ...t, isActive: next } : t)));
      if (!previewFallback) {
        await marketingDb.from("marketing_keyword_triggers").update({ is_active: next }).eq("id", trigger.id).catch(() => undefined);
      }
    },
    [previewFallback],
  );

  const deleteKeywordTrigger = useCallback(
    async (id: string) => {
      setKeywordTriggers((prev) => prev.filter((t) => t.id !== id));
      if (!previewFallback) {
        await marketingDb.from("marketing_keyword_triggers").update({ deleted_at: new Date().toISOString() }).eq("id", id).catch(() => undefined);
      }
    },
    [previewFallback],
  );

  const sendHumanReply = useCallback(
    async (conv: MarketingZapConversation, text: string) => {
      if (!previewFallback) {
        await invokeZapGateway("send_human_reply", { conversation_id: conv.id, message_text: text }).catch(() => undefined);
      }
    },
    [previewFallback],
  );

  const compactConversationMemory = useCallback(
    async (conv: MarketingZapConversation) => compactConversationAction(conv, previewFallback, onReloadCore),
    [onReloadCore, previewFallback],
  );

  return useMemo(
    () => ({
      llmProviders,
      deviceHarness,
      liveCatalog,
      syncingModels,
      defenderReports,
      auditingInstanceId,
      groups,
      warmupPools,
      keywordTriggers,
      saveDeviceHarness: handleSaveDeviceHarness,
      syncAllLlmModels,
      testLlmProvider: testLlmProviderAction,
      requestPairingCode: requestPairingCodeAction,
      runZapDefenderAudit,
      validateNumbersBatch,
      syncGroups,
      extractGroupMembers,
      enqueueGroupJob,
      sendPushAlert,
      saveWarmupPool,
      createKeywordTrigger,
      toggleKeywordTrigger,
      deleteKeywordTrigger,
      sendHumanReply,
      compactConversationMemory,
    }),
    [
      llmProviders, deviceHarness, liveCatalog, syncingModels, defenderReports, auditingInstanceId,
      groups, warmupPools, keywordTriggers, handleSaveDeviceHarness, syncAllLlmModels,
      runZapDefenderAudit, validateNumbersBatch, syncGroups, extractGroupMembers,
      enqueueGroupJob, sendPushAlert, saveWarmupPool, createKeywordTrigger, toggleKeywordTrigger,
      deleteKeywordTrigger, sendHumanReply, compactConversationMemory,
    ],
  );
}