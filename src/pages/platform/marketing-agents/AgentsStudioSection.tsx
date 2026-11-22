import React, { useEffect, useState } from "react";
import { Bot, Cpu, Edit3, Image as ImageIcon, MessageSquare, Mic, Plus, Send, Settings2, Sparkles, Trash2, X, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DEFAULT_MARKETING_CHIP_DISPLAY,
  MODEL_TIER_LABELS,
  type AgentSimulationTurn,
  type MarketingAiAgent,
  type MarketingWhatsAppInstance,
} from "./types";
import {
  CURATED_LLM_CATALOG,
  DEFAULT_DEVICE_LLM_HARNESS,
  FALLBACK_LLM_PROVIDERS,
  type DeviceLlmHarnessConfig,
  type LlmModelCatalogItem,
  type LlmProviderRecord,
} from "./suiteTypes";
import { formatPhoneBr } from "./antiBanEngine";
import { resolveEffectiveAgentLlm } from "./llmHarnessStorage";
import { OpenCodeModelPickerDialog } from "./OpenCodeModelPickerDialog";
import { LlmHarnessDrawer } from "./LlmHarnessDrawer";

interface ModelOverrideRef {
  providerSlug: string;
  modelId: string;
}

interface AgentsStudioSectionProps {
  agents: MarketingAiAgent[];
  instances: MarketingWhatsAppInstance[];
  simulationTurns: AgentSimulationTurn[];
  simulating: boolean;
  onCreateNew: () => void;
  onEditAgent: (agent: MarketingAiAgent) => void;
  onToggleActive: (agent: MarketingAiAgent) => Promise<void>;
  onSimulateMessage: (agent: MarketingAiAgent, message: string) => Promise<void>;
  onClearSimulation: () => void;
  deviceHarness?: DeviceLlmHarnessConfig | null;
  providers?: LlmProviderRecord[];
  catalog?: LlmModelCatalogItem[];
  onOpenHarness?: () => void;
  playgroundModelOverride?: ModelOverrideRef | null;
  onChangePlaygroundModelOverride?: (override: ModelOverrideRef | null) => void;
  onSimulateWithModel?: (agent: MarketingAiAgent, message: string, override?: ModelOverrideRef | null) => Promise<void>;
}

const QUICK_PROMPTS = ["Quanto custa o Pluri Fisio?", "Quero falar com humano", "PARAR"];

export const AgentsStudioSection: React.FC<AgentsStudioSectionProps> = ({
  agents,
  instances,
  simulationTurns,
  simulating,
  onCreateNew,
  onEditAgent,
  onToggleActive,
  onSimulateMessage,
  onClearSimulation,
  deviceHarness,
  providers = FALLBACK_LLM_PROVIDERS,
  catalog = CURATED_LLM_CATALOG,
  onOpenHarness,
  playgroundModelOverride,
  onChangePlaygroundModelOverride,
  onSimulateWithModel,
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id || "");
  const [testInput, setTestInput] = useState("");
  const [localOverride, setLocalOverride] = useState<ModelOverrideRef | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [localHarnessOpen, setLocalHarnessOpen] = useState(false);

  useEffect(() => {
    if (!agents.some((a) => a.id === selectedAgentId) && agents[0]) setSelectedAgentId(agents[0].id);
  }, [agents, selectedAgentId]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0] || null;
  const activeOverride = playgroundModelOverride !== undefined ? playgroundModelOverride : localOverride;
  const effectiveHarness = deviceHarness || DEFAULT_DEVICE_LLM_HARNESS;
  const setOverride = (next: ModelOverrideRef | null) =>
    onChangePlaygroundModelOverride ? onChangePlaygroundModelOverride(next) : setLocalOverride(next);

  const resolveChipLabel = (instanceId?: string | null) => {
    const inst = instances.find((i) => i.id === instanceId);
    return inst ? formatPhoneBr(inst.phone_e164) : DEFAULT_MARKETING_CHIP_DISPLAY;
  };

  const runSimulation = async (agent: MarketingAiAgent, message: string) => {
    if (onSimulateWithModel) await onSimulateWithModel(agent, message, activeOverride);
    else await onSimulateMessage(agent, message);
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent || !testInput.trim() || simulating) return;
    const msg = testInput;
    setTestInput("");
    await runSimulation(selectedAgent, msg);
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 w-full max-w-full min-w-0">
        <div className="lg:col-span-7 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Agentes IA Configurados</h3>
              <p className="text-xs text-muted-foreground">Atendentes SDR multimodais ligados ao chip {DEFAULT_MARKETING_CHIP_DISPLAY}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => (onOpenHarness ? onOpenHarness() : setLocalHarnessOpen(true))} className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5">
                <Settings2 className="h-3.5 w-3.5 text-primary" /><span>Harness LLM Local-First</span>
              </Button>
              <Button type="button" size="sm" data-testid="agents-create-btn" onClick={onCreateNew} className="min-h-[44px] sm:min-h-[38px] gap-1.5">
                <Plus className="h-4 w-4" /><span>Novo Agente</span>
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {agents.map((agent) => {
              const tierMeta = MODEL_TIER_LABELS[agent.model_tier];
              const resolved = resolveEffectiveAgentLlm(agent, providers, effectiveHarness);
              const modelBadgeText = agent.llm_model_id || tierMeta?.label || resolved.modelId;
              const isZeroCost = resolved.costLabel.includes("R$ 0") || resolved.costLabel.includes("Grátis") || agent.model_tier === "gemma-4-local";

              return (
                <Card key={agent.id} data-testid={`agent-card-${agent.slug}`} className="border transition-colors hover:border-primary/40">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-sm text-foreground truncate">{agent.name}</span>
                          <Badge variant="outline" className="text-[11px] font-mono">{modelBadgeText}</Badge>
                          {isZeroCost && <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" variant="outline">R$ 0</Badge>}
                          {(agent.disable_thinking ?? true) && <Badge variant="secondary" className="text-[10px]">Sem Thinking</Badge>}
                          {(agent.auto_compact_context ?? true) && <Badge variant="secondary" className="text-[10px]">Auto-Compact</Badge>}
                          <Badge variant="secondary" className="text-[11px]">{resolveChipLabel(agent.instance_id)}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{agent.system_prompt}</p>
                      </div>
                      <Switch checked={agent.is_active} aria-label={`Ativar ou pausar ${agent.name}`} onCheckedChange={() => void onToggleActive(agent)} />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs">
                      <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Mic className="h-3.5 w-3.5 text-primary" />{agent.transcribe_audio ? "Áudio ON" : "Áudio OFF"}</span>
                        <span className="inline-flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5 text-primary" />{agent.analyze_images ? "Imagem ON" : "Imagem OFF"}</span>
                        <span className="inline-flex items-center gap-1"><Zap className="h-3.5 w-3.5 text-amber-500" />{agent.enable_semantic_cache ? "Cache <30ms" : "Sem cache"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="ghost" size="sm" className="min-h-[44px] sm:min-h-[36px] text-xs gap-1" onClick={() => setSelectedAgentId(agent.id)}>
                          <MessageSquare className="h-3.5 w-3.5" />Testar
                        </Button>
                        <Button type="button" variant="outline" size="sm" data-testid={`edit-agent-${agent.slug}`} className="min-h-[44px] sm:min-h-[36px] text-xs gap-1" onClick={() => onEditAgent(agent)}>
                          <Edit3 className="h-3.5 w-3.5" />Editar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 min-w-0">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Playground & Simulador IA</CardTitle>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)} className="min-h-[36px] px-2 text-[11px] gap-1 font-mono max-w-[165px]">
                    <Cpu className="h-3 w-3 text-primary shrink-0" />
                    <span className="truncate">{activeOverride ? activeOverride.modelId : "Modelo Padrão"}</span>
                  </Button>
                  {activeOverride && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => setOverride(null)} aria-label="Limpar modelo" className="h-8 w-8"><X className="h-3.5 w-3.5" /></Button>
                  )}
                  {simulationTurns.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" onClick={onClearSimulation} className="h-8 px-2 text-xs text-muted-foreground gap-1"><Trash2 className="h-3.5 w-3.5" />Limpar</Button>
                  )}
                </div>
              </div>
              <CardDescription className="text-xs">Teste Ollama, OpenCode Free ou Gemini, detecção de intenção e Opt-Out LGPD.</CardDescription>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="min-h-[44px] text-xs"><SelectValue placeholder="Escolha o agente" /></SelectTrigger>
                <SelectContent>{agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col gap-3">
              <div data-testid="agent-playground-messages" className="flex-1 min-h-[220px] max-h-[340px] overflow-y-auto overscroll-contain rounded-xl border bg-muted/25 p-3 space-y-2.5">
                {simulationTurns.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-6 space-y-2">
                    <Bot className="h-7 w-7 text-muted-foreground/60" />
                    <p className="text-xs text-muted-foreground max-w-xs">Envie uma mensagem simulando um fisioterapeuta ou clique em um atalho abaixo.</p>
                  </div>
                ) : (
                  simulationTurns.map((turn) => (
                    <div key={turn.id} className={`flex flex-col ${turn.role === "lead" ? "items-end" : "items-start"}`}>
                      <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs ${turn.role === "lead" ? "bg-primary text-primary-foreground" : "bg-card border text-foreground shadow-2xs"}`}>
                        <p className="whitespace-pre-wrap break-words">{turn.text}</p>
                      </div>
                      {turn.role === "agent" && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
                          {turn.modelUsed && <Badge variant="secondary" className="text-[10px] py-0 font-mono">{turn.modelUsed}</Badge>}
                          {turn.intent && <Badge variant="outline" className="text-[10px] py-0">{turn.intent}</Badge>}
                          {turn.typingMs && <span>digitando {(turn.typingMs / 1000).toFixed(1)}s</span>}
                          {turn.isOptOut && <Badge variant="destructive" className="text-[10px] py-0">Opt-Out LGPD</Badge>}
                          {turn.triggeredHandoff && <Badge className="text-[10px] py-0 bg-amber-500">Handoff Humano</Badge>}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((preset) => (
                  <Button key={preset} type="button" variant="outline" size="sm" disabled={!selectedAgent || simulating} onClick={() => selectedAgent && void runSimulation(selectedAgent, preset)} className="text-[11px] min-h-[36px] h-auto py-1 px-2.5">
                    {preset}
                  </Button>
                ))}
              </div>

              <form onSubmit={handleSendTest} className="flex items-center gap-2">
                <Input data-testid="agent-playground-input" value={testInput} onChange={(e) => setTestInput(e.target.value)} placeholder="Simular mensagem do lead..." className="min-h-[44px]" />
                <Button type="submit" data-testid="agent-playground-send" disabled={!selectedAgent || simulating || !testInput.trim()} className="min-h-[44px] min-w-[44px] shrink-0" aria-label="Enviar mensagem no simulador">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <OpenCodeModelPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedProviderSlug={activeOverride?.providerSlug}
        selectedModelId={activeOverride?.modelId}
        catalog={catalog}
        onSelectModel={(item) => setOverride({ providerSlug: item.providerSlug, modelId: item.id })}
      />

      {!onOpenHarness && <LlmHarnessDrawer open={localHarnessOpen} onOpenChange={setLocalHarnessOpen} config={deviceHarness} catalog={catalog} />}
    </>
  );
};
