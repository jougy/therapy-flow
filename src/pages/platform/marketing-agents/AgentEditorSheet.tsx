import React, { useEffect, useState } from "react";
import { Bot, Cpu, Layers, Plus, Save, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DEFAULT_HANDOFF_COMMERCIAL_PHONE,
  MODEL_TIER_LABELS,
  type AgentModelTier,
  type MarketingAiAgent,
  type MarketingWhatsAppInstance,
} from "./types";
import {
  CURATED_LLM_CATALOG,
  FALLBACK_LLM_PROVIDERS,
  type FallbackModelRef,
  type LlmModelCatalogItem,
  type LlmProviderRecord,
} from "./suiteTypes";
import type { AgentDraftInput } from "./useMarketingAgents";
import { formatPhoneBr } from "./antiBanEngine";
import { OpenCodeModelPickerDialog } from "./OpenCodeModelPickerDialog";

export type ExtendedAgentDraftInput = AgentDraftInput &
  Partial<
    Pick<
      MarketingAiAgent,
      | "llm_provider_id"
      | "llm_model_id"
      | "fallback_chain"
      | "disable_thinking"
      | "auto_compact_context"
      | "split_messages"
      | "simulate_typing"
      | "audio_reply_mode"
    >
  >;

interface AgentEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: MarketingAiAgent | null;
  instances: MarketingWhatsAppInstance[];
  onSave: (draft: ExtendedAgentDraftInput) => Promise<boolean>;
  catalog?: LlmModelCatalogItem[];
  providers?: LlmProviderRecord[];
}

export const AgentEditorSheet: React.FC<AgentEditorSheetProps> = ({
  open,
  onOpenChange,
  agent,
  instances,
  onSave,
  catalog = CURATED_LLM_CATALOG,
  providers = FALLBACK_LLM_PROVIDERS,
}) => {
  const [name, setName] = useState("");
  const [personaRole, setPersonaRole] = useState("sdr_qualifier");
  const [instanceId, setInstanceId] = useState("");
  const [modelTier, setModelTier] = useState<AgentModelTier>("gemini-4-hydrogen");
  const [llmProviderId, setLlmProviderId] = useState("gemini-pulumi");
  const [llmModelId, setLlmModelId] = useState("gemini-2.5-flash-lite");
  const [fallbackChain, setFallbackChain] = useState<FallbackModelRef[]>([]);
  const [disableThinking, setDisableThinking] = useState(true);
  const [autoCompactContext, setAutoCompactContext] = useState(true);
  const [splitMessages, setSplitMessages] = useState(true);
  const [simulateTyping, setSimulateTyping] = useState(true);
  const [audioReplyMode, setAudioReplyMode] = useState<"never" | "match_user" | "always_ptt">("match_user");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [knowledgeBase, setKnowledgeBase] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [handoffKeywordsText, setHandoffKeywordsText] = useState("falar com humano, atendente, suporte");
  const [handoffPhone, setHandoffPhone] = useState(DEFAULT_HANDOFF_COMMERCIAL_PHONE);
  const [maxChars, setMaxChars] = useState(450);
  const [debounceSec, setDebounceSec] = useState(6);
  const [transcribeAudio, setTranscribeAudio] = useState(true);
  const [analyzeImages, setAnalyzeImages] = useState(true);
  const [enableSemanticCache, setEnableSemanticCache] = useState(true);
  const [pickerMode, setPickerMode] = useState<"primary" | "fallback" | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(agent?.name || "");
    setPersonaRole(agent?.persona_role || "sdr_qualifier");
    setInstanceId(agent?.instance_id || instances[0]?.id || "");
    setModelTier(agent?.model_tier || "gemini-4-hydrogen");
    setLlmProviderId(agent?.llm_provider_id || (agent ? "gemini-pulumi" : "opencode-free"));
    setLlmModelId(agent?.llm_model_id || agent?.model_tier || "deepseek-v4.1-flash-free");
    setFallbackChain(agent?.fallback_chain || []);
    setDisableThinking(agent?.disable_thinking ?? true);
    setAutoCompactContext(agent?.auto_compact_context ?? true);
    setSplitMessages(agent?.split_messages ?? true);
    setSimulateTyping(agent?.simulate_typing ?? true);
    setAudioReplyMode(agent?.audio_reply_mode || "match_user");
    setSystemPrompt(
      agent?.system_prompt ||
        "Você é o consultor SDR oficial do Pluri Fisio no WhatsApp. Seja cordial, direto e conduza para demonstração de 10 minutos.",
    );
    setKnowledgeBase(agent?.knowledge_base || "Pluri Fisio: Prontuário SOAP, Escala EVA, Agenda Multi-Turno e Repasses.");
    setWelcomeMessage(
      agent?.welcome_message || "Olá {{primeiro_nome}}! Tudo bem? Vi seu contato e queria te mostrar o Pluri Fisio.",
    );
    setHandoffKeywordsText(agent?.handoff_keywords.join(", ") || "falar com humano, atendente, suporte, fechar plano");
    setHandoffPhone(agent?.handoff_phone || DEFAULT_HANDOFF_COMMERCIAL_PHONE);
    setMaxChars(agent?.max_chars_per_reply ?? 450);
    setDebounceSec(agent?.debounce_seconds ?? 6);
    setTranscribeAudio(agent?.transcribe_audio ?? true);
    setAnalyzeImages(agent?.analyze_images ?? true);
    setEnableSemanticCache(agent?.enable_semantic_cache ?? true);
  }, [agent, instances, open]);

  const handleModelSelected = (item: LlmModelCatalogItem) => {
    if (pickerMode === "fallback") {
      setFallbackChain((prev) =>
        prev.some((f) => f.providerSlug === item.providerSlug && f.modelId === item.id)
          ? prev
          : [...prev, { providerSlug: item.providerSlug, modelId: item.id, label: item.name }],
      );
      setPickerMode(null);
      return;
    }
    const matchedProv = providers.find((p) => p.slug === item.providerSlug);
    setLlmProviderId(matchedProv?.id || item.providerSlug);
    setLlmModelId(item.id);
    if (item.isLocal) setModelTier("gemma-4-local");
    else if (item.id in MODEL_TIER_LABELS) setModelTier(item.id as AgentModelTier);
    if (item.disableThinkingRecommended) setDisableThinking(true);
    setPickerMode(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !systemPrompt.trim()) return;
    setSaving(true);
    const ok = await onSave({
      id: agent?.id,
      name: name.trim(),
      persona_role: personaRole,
      instance_id: instanceId || null,
      model_tier: modelTier,
      llm_provider_id: llmProviderId || null,
      llm_model_id: llmModelId || null,
      fallback_chain: fallbackChain.map(({ providerSlug, modelId }) => ({ providerSlug, modelId })),
      disable_thinking: disableThinking,
      auto_compact_context: autoCompactContext,
      split_messages: splitMessages,
      simulate_typing: simulateTyping,
      audio_reply_mode: audioReplyMode,
      system_prompt: systemPrompt.trim(),
      knowledge_base: knowledgeBase.trim(),
      welcome_message: welcomeMessage.trim(),
      handoff_keywords: handoffKeywordsText.split(",").map((s) => s.trim()).filter(Boolean),
      handoff_phone: handoffPhone.trim() || DEFAULT_HANDOFF_COMMERCIAL_PHONE,
      max_chars_per_reply: Math.max(80, Math.min(2000, Number(maxChars) || 450)),
      debounce_seconds: Math.max(0, Math.min(30, Number(debounceSec) || 6)),
      transcribe_audio: transcribeAudio,
      analyze_images: analyzeImages,
      enable_semantic_cache: enableSemanticCache,
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  const toggleRows = [
    { label: "Modo Rápido sem Thinking", hint: "Desativa chain-of-thought para respostas em <2s no WhatsApp.", val: disableThinking, set: setDisableThinking },
    { label: "Compactação de Memória Contínua", hint: "Resume turnos antigos mantendo fatos estruturados.", val: autoCompactContext, set: setAutoCompactContext },
    { label: "Dividir em balões curtos", hint: "Quebra respostas longas em mensagens naturais.", val: splitMessages, set: setSplitMessages },
    { label: "Simular digitando (presence)", hint: "Envia status composing proporcional antes de responder.", val: simulateTyping, set: setSimulateTyping },
    { label: "Transcrever Áudios (Gemini Transcribe)", hint: "Entende notas de voz enviadas pelo lead.", val: transcribeAudio, set: setTranscribeAudio },
    { label: "Interpretar Imagens & Prints", hint: "Lê fotos de agenda/planilhas no chat.", val: analyzeImages, set: setAnalyzeImages },
    { label: "Semantic Cache (Upstash Redis)", hint: "Responde FAQs recorrentes em <30ms a custo R$ 0.", val: enableSemanticCache, set: setEnableSemanticCache },
  ];

  const activeModelLabel = llmModelId || MODEL_TIER_LABELS[modelTier]?.label || modelTier;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent data-testid="agent-editor-sheet" className="w-full sm:max-w-xl max-h-[100dvh] flex flex-col p-0">
          <SheetHeader className="px-4 sm:px-6 pt-5 pb-3 border-b text-left">
            <SheetTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Bot className="h-5 w-5 text-primary shrink-0" />
              {agent ? "Editar Agente WhatsApp IA" : "Novo Agente WhatsApp IA"}
            </SheetTitle>
            <SheetDescription className="text-xs">
              Configure modelo LLM (Ollama, OpenCode Free ou Gemini), fallback, humanização e transbordo.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="agent-name">Nome do Agente</Label>
                  <Input id="agent-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Agente SDR Clínicas" className="min-h-[44px]" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Modelo LLM Principal</Label>
                  <input type="hidden" value={modelTier} readOnly />
                  <Button type="button" variant="outline" onClick={() => setPickerMode("primary")} className="w-full min-h-[44px] justify-between gap-2 text-xs font-mono">
                    <span className="flex items-center gap-1.5 truncate"><Cpu className="h-3.5 w-3.5 text-primary shrink-0" /><span className="truncate">{activeModelLabel}</span></span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">Trocar</Badge>
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium flex items-center gap-1.5"><Layers className="h-3.5 w-3.5 text-primary" />Fallback Chain ({fallbackChain.length})</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPickerMode("fallback")} className="min-h-[36px] text-xs gap-1"><Plus className="h-3.5 w-3.5" />Adicionar</Button>
                </div>
                {fallbackChain.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">Usando cadeia padrão do Harness do dispositivo caso o modelo principal falhe.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {fallbackChain.map((step, idx) => (
                      <Badge key={`${step.providerSlug}-${step.modelId}`} variant="secondary" className="gap-1 text-[11px]">
                        <span className="font-mono">#{idx + 1} {step.modelId}</span>
                        <button type="button" onClick={() => setFallbackChain((p) => p.filter((_, i) => i !== idx))} aria-label={`Remover ${step.modelId}`} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="agent-instance">Chip / Instância Evolution</Label>
                  <Select value={instanceId} onValueChange={setInstanceId}>
                    <SelectTrigger id="agent-instance" className="min-h-[44px]"><SelectValue placeholder="Selecione o chip" /></SelectTrigger>
                    <SelectContent>
                      {instances.map((inst) => (
                        <SelectItem key={inst.id} value={inst.id}>{formatPhoneBr(inst.phone_e164)} ({inst.instance_key})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="agent-handoff-phone">WhatsApp de Transbordo Humano</Label>
                  <Input id="agent-handoff-phone" value={handoffPhone} onChange={(e) => setHandoffPhone(e.target.value)} className="min-h-[44px]" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="agent-prompt">Prompt & Personalidade do Agente</Label>
                <Textarea id="agent-prompt" rows={3} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agent-kb">Base de Conhecimento / FAQ</Label>
                <Textarea id="agent-kb" rows={2} value={knowledgeBase} onChange={(e) => setKnowledgeBase(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agent-welcome">Mensagem Inicial / Quebra-gelo</Label>
                <Textarea id="agent-welcome" rows={2} value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="agent-audio-reply">Resposta em Áudio PTT</Label>
                  <Select value={audioReplyMode} onValueChange={(v) => setAudioReplyMode(v as "never" | "match_user" | "always_ptt")}>
                    <SelectTrigger id="agent-audio-reply" className="min-h-[44px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Nunca (só texto)</SelectItem>
                      <SelectItem value="match_user">Espelhar lead (PTT)</SelectItem>
                      <SelectItem value="always_ptt">Sempre PTT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="agent-max-chars">Máx. chars/balão</Label>
                  <Input id="agent-max-chars" type="number" min={80} max={2000} value={maxChars} onChange={(e) => setMaxChars(Number(e.target.value))} className="min-h-[44px]" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="agent-debounce">Debounce rajada (s)</Label>
                  <Input id="agent-debounce" type="number" min={0} max={30} value={debounceSec} onChange={(e) => setDebounceSec(Number(e.target.value))} className="min-h-[44px]" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="agent-handoff-kw">Gatilhos de Transbordo Humano (separados por vírgula)</Label>
                <Input id="agent-handoff-kw" value={handoffKeywordsText} onChange={(e) => setHandoffKeywordsText(e.target.value)} className="min-h-[44px]" />
              </div>

              <div className="rounded-xl border bg-muted/30 p-3 space-y-2.5">
                {toggleRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium">{row.label}</p>
                      <p className="text-[11px] text-muted-foreground">{row.hint}</p>
                    </div>
                    <Switch checked={row.val} onCheckedChange={row.set} />
                  </div>
                ))}
              </div>
            </div>

            <div className="sticky bottom-0 z-10 border-t bg-background px-4 sm:px-6 py-3 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="min-h-[44px] gap-2"><Save className="h-4 w-4" />{saving ? "Salvando..." : "Salvar Agente"}</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <OpenCodeModelPickerDialog
        open={pickerMode !== null}
        onOpenChange={(isOpen) => !isOpen && setPickerMode(null)}
        selectedModelId={pickerMode === "primary" ? llmModelId : undefined}
        catalog={catalog}
        onSelectModel={handleModelSelected}
      />
    </>
  );
};
