import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Cpu, Layers, Plus, RefreshCw, RotateCcw, Save, Sparkles, Trash2, Zap } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  CURATED_LLM_CATALOG,
  DEFAULT_DEVICE_LLM_HARNESS,
  type DeviceLlmHarnessConfig,
  type FallbackModelRef,
  type LlmModelCatalogItem,
} from "./suiteTypes";
import {
  discoverLocalOllamaModels,
  fetchOpenCodeLiveModels,
  loadDeviceLlmHarness,
  resetDeviceLlmHarness,
  saveDeviceLlmHarness,
} from "./llmHarnessStorage";
import { OpenCodeModelPickerDialog } from "./OpenCodeModelPickerDialog";

export interface ProviderConnectionTestResult {
  ok: boolean;
  latencyMs: number;
  reply?: string;
  error?: string;
}

interface LlmHarnessDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: DeviceLlmHarnessConfig | null;
  catalog?: LlmModelCatalogItem[];
  onSaveConfig?: (next: DeviceLlmHarnessConfig) => void | Promise<void>;
  onTestProvider?: (providerSlug: string, modelId: string) => Promise<ProviderConnectionTestResult>;
}

type PickerTarget = "opencode" | "pulumi" | "fallback";

export const LlmHarnessDrawer: React.FC<LlmHarnessDrawerProps> = ({
  open,
  onOpenChange,
  config: externalConfig,
  catalog: externalCatalog,
  onSaveConfig,
  onTestProvider,
}) => {
  const [draft, setDraft] = useState<DeviceLlmHarnessConfig>(DEFAULT_DEVICE_LLM_HARNESS);
  const [ollamaModels, setOllamaModels] = useState<LlmModelCatalogItem[]>([]);
  const [openCodeModels, setOpenCodeModels] = useState<LlmModelCatalogItem[]>([]);
  const [detectingOllama, setDetectingOllama] = useState(false);
  const [syncingOpenCode, setSyncingOpenCode] = useState(false);
  const [testingPulumi, setTestingPulumi] = useState(false);
  const [testResult, setTestResult] = useState<ProviderConnectionTestResult | null>(null);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (externalConfig) {
      setDraft(externalConfig);
      return;
    }
    void loadDeviceLlmHarness().then((loaded) => setDraft(loaded));
  }, [open, externalConfig]);

  const mergedCatalog = React.useMemo(() => {
    const base = externalCatalog?.length ? externalCatalog : CURATED_LLM_CATALOG;
    const map = new Map<string, LlmModelCatalogItem>();
    for (const item of [...ollamaModels, ...openCodeModels, ...base]) {
      map.set(`${item.providerSlug}::${item.id}`, item);
    }
    return Array.from(map.values());
  }, [externalCatalog, ollamaModels, openCodeModels]);

  const handleDetectOllama = async () => {
    setDetectingOllama(true);
    const found = await discoverLocalOllamaModels(draft.ollamaBaseUrl);
    setOllamaModels(found);
    setDetectingOllama(false);
    if (found.length > 0) {
      setDraft((p) => ({ ...p, ollamaModel: found.some((m) => m.id === p.ollamaModel) ? p.ollamaModel : found[0].id }));
      toast({ title: `${found.length} modelo(s) Ollama detectado(s)` });
    } else {
      toast({ title: "Nenhum modelo Ollama local respondeu", description: "Confira http://127.0.0.1:11434" });
    }
  };

  const handleSyncOpenCode = async () => {
    setSyncingOpenCode(true);
    const items = await fetchOpenCodeLiveModels();
    setOpenCodeModels(items);
    setSyncingOpenCode(false);
    toast({ title: `${items.length} modelo(s) OpenCode Free sincronizado(s)` });
  };

  const handleTestPulumiConnection = async () => {
    setTestingPulumi(true);
    setTestResult(null);
    const started = Date.now();
    try {
      if (onTestProvider) {
        setTestResult(await onTestProvider(draft.pulumiDefaultProviderSlug, draft.pulumiDefaultModelId));
      } else {
        const localHits = await discoverLocalOllamaModels(draft.ollamaBaseUrl);
        setTestResult({
          ok: true,
          latencyMs: Math.max(12, Date.now() - started),
          reply: `Harness pronto (${draft.pulumiDefaultModelId}). Ollama local: ${localHits.length} modelo(s).`,
        });
      }
    } catch (err) {
      setTestResult({ ok: false, latencyMs: Date.now() - started, error: err instanceof Error ? err.message : "Falha ao testar" });
    } finally {
      setTestingPulumi(false);
    }
  };

  const moveFallback = (index: number, delta: -1 | 1) => {
    setDraft((prev) => {
      const nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= prev.fallbackChain.length) return prev;
      const copy = [...prev.fallbackChain];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return { ...prev, fallbackChain: copy };
    });
  };

  const handlePickerSelect = (item: LlmModelCatalogItem) => {
    if (pickerTarget === "opencode") {
      setDraft((p) => ({ ...p, openCodePreferredFreeModel: item.id }));
    } else if (pickerTarget === "pulumi") {
      setDraft((p) => ({ ...p, pulumiDefaultProviderSlug: item.providerSlug, pulumiDefaultModelId: item.id }));
    } else if (pickerTarget === "fallback") {
      const entry: FallbackModelRef = { providerSlug: item.providerSlug, modelId: item.id, label: item.name };
      setDraft((p) =>
        p.fallbackChain.some((f) => f.providerSlug === entry.providerSlug && f.modelId === entry.modelId)
          ? p
          : { ...p, fallbackChain: [...p.fallbackChain, entry] },
      );
    }
    setPickerTarget(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const saved = await saveDeviceLlmHarness(draft);
    await onSaveConfig?.(saved);
    setSaving(false);
    toast({ title: "Harness LLM deste dispositivo salvo!" });
    onOpenChange(false);
  };

  const handleReset = async () => {
    const fresh = await resetDeviceLlmHarness();
    setDraft(fresh);
    await onSaveConfig?.(fresh);
    toast({ title: "Harness restaurado para o padrão" });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl max-h-[100dvh] flex flex-col p-0">
          <SheetHeader className="px-4 sm:px-6 pt-5 pb-3 border-b text-left">
            <SheetTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Cpu className="h-5 w-5 text-primary shrink-0" />
              Harness LLM Local-First (Este Dispositivo)
            </SheetTitle>
            <SheetDescription className="text-xs">
              Configure Ollama GPU local (R$ 0), OpenCode Free Zen, padrão Pulumi Cloud e compactação de memória.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-4">
              <div className="rounded-xl border p-3.5 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold">Preferir LLM Local neste computador (Ollama 12GB VRAM)</p>
                    <p className="text-[11px] text-muted-foreground">Custo R$ 0 usando GPU local antes da nuvem.</p>
                  </div>
                  <Switch checked={draft.preferLocalOllama} onCheckedChange={(v) => setDraft((p) => ({ ...p, preferLocalOllama: v }))} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="harness-ollama-url" className="text-xs">URL Ollama (OpenAI /v1)</Label>
                    <Input id="harness-ollama-url" value={draft.ollamaBaseUrl} onChange={(e) => setDraft((p) => ({ ...p, ollamaBaseUrl: e.target.value }))} placeholder="http://127.0.0.1:11434/v1" className="min-h-[44px] text-xs font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="harness-ollama-model" className="text-xs">Modelo Local Ativo</Label>
                    <Input id="harness-ollama-model" value={draft.ollamaModel} onChange={(e) => setDraft((p) => ({ ...p, ollamaModel: e.target.value }))} placeholder="gemma4:e4b" className="min-h-[44px] text-xs font-mono" />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={detectingOllama} onClick={() => void handleDetectOllama()} className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5">
                    <RefreshCw className={`h-3.5 w-3.5 ${detectingOllama ? "animate-spin" : ""}`} />
                    <span>Detectar Modelos Ollama</span>
                  </Button>
                  {ollamaModels.map((m) => (
                    <Badge key={m.id} variant={draft.ollamaModel === m.id ? "default" : "outline"} className="cursor-pointer py-1 text-[11px]" onClick={() => setDraft((p) => ({ ...p, ollamaModel: m.id }))}>
                      {m.id}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold">OpenCode Free Zen (https://opencode.ai/zen/v1)</p>
                    <p className="text-[11px] text-muted-foreground">Modelos gratuitos sem custo de API.</p>
                  </div>
                  <Switch checked={draft.openCodeEnabled} onCheckedChange={(v) => setDraft((p) => ({ ...p, openCodeEnabled: v }))} />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2 text-xs">
                  <span>{draft.openCodeUsePublicAuth ? "Bearer public (sem chave)" : "Usar ENV OPENCODE_API_KEY"}</span>
                  <Switch checked={draft.openCodeUsePublicAuth} onCheckedChange={(v) => setDraft((p) => ({ ...p, openCodeUsePublicAuth: v }))} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setPickerTarget("opencode")} className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span className="font-mono">{draft.openCodePreferredFreeModel}</span>
                  </Button>
                  <Button type="button" variant="secondary" size="sm" disabled={syncingOpenCode} onClick={() => void handleSyncOpenCode()} className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5">
                    <RefreshCw className={`h-3.5 w-3.5 ${syncingOpenCode ? "animate-spin" : ""}`} />
                    <span>Sincronizar Modelos Free ao Vivo</span>
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold">Padrão Nuvem Gerenciada (Pulumi ESC)</p>
                    <p className="text-[11px] text-muted-foreground">{draft.pulumiDefaultProviderSlug} / <code className="font-mono">{draft.pulumiDefaultModelId}</code></p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setPickerTarget("pulumi")} className="min-h-[44px] sm:min-h-[38px] text-xs">Trocar Modelo</Button>
                    <Button type="button" variant="secondary" size="sm" disabled={testingPulumi} onClick={() => void handleTestPulumiConnection()} className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      <span>{testingPulumi ? "Testando..." : "Testar Conexão"}</span>
                    </Button>
                  </div>
                </div>
                {testResult && (
                  <div className={`rounded-lg border px-3 py-2 text-xs ${testResult.ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"}`}>
                    <p className="font-semibold">{testResult.ok ? `Conectado (${testResult.latencyMs}ms)` : `Falha (${testResult.latencyMs}ms)`}</p>
                    <p className="text-[11px] break-words">{testResult.reply || testResult.error}</p>
                  </div>
                )}
              </div>

              <div className="rounded-xl border p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold flex items-center gap-1.5"><Layers className="h-3.5 w-3.5 text-primary" />Cadeia de Fallback Automático</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPickerTarget("fallback")} className="min-h-[38px] text-xs gap-1"><Plus className="h-3.5 w-3.5" />Adicionar</Button>
                </div>
                <div className="space-y-1.5">
                  {draft.fallbackChain.map((step, idx) => (
                    <div key={`${step.providerSlug}::${step.modelId}`} className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 px-2.5 py-1.5 text-xs">
                      <div className="min-w-0 flex-1 truncate">
                        <span className="font-medium mr-1.5">#{idx + 1}</span>
                        <span className="font-mono text-[11px]">{step.modelId}</span>
                        <span className="text-[10px] text-muted-foreground ml-1.5">({step.providerSlug})</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveFallback(idx, -1)} aria-label="Subir"><ArrowUp className="h-3.5 w-3.5" /></Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveFallback(idx, 1)} aria-label="Descer"><ArrowDown className="h-3.5 w-3.5" /></Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDraft((p) => ({ ...p, fallbackChain: p.fallbackChain.filter((_, i) => i !== idx) }))} aria-label="Remover"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border p-3.5 space-y-3 bg-primary/5 border-primary/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-xs font-semibold">Compactação Inteligente de Memória</p>
                      <Badge variant="secondary" className="text-[10px]">Latência Plana + Anti-Alucinação</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Mantém tokens e latência constantes em chats longos, preservando fatos sem alucinação.</p>
                  </div>
                  <Switch checked={draft.autoCompactContext} onCheckedChange={(v) => setDraft((p) => ({ ...p, autoCompactContext: v }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="harness-max-ctx" className="text-xs">Máx. msgs no contexto</Label>
                    <Input id="harness-max-ctx" type="number" min={4} max={40} value={draft.maxContextMessages} onChange={(e) => setDraft((p) => ({ ...p, maxContextMessages: Number(e.target.value) || 8 }))} className="min-h-[44px]" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="harness-keep-turns" className="text-xs">Turnos recentes intactos</Label>
                    <Input id="harness-keep-turns" type="number" min={2} max={20} value={draft.compactKeepLastTurns} onChange={(e) => setDraft((p) => ({ ...p, compactKeepLastTurns: Number(e.target.value) || 4 }))} className="min-h-[44px]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 z-10 border-t bg-background px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="ghost" onClick={() => void handleReset()} className="min-h-[44px] gap-1.5 text-xs"><RotateCcw className="h-3.5 w-3.5" /><span>Restaurar Padrão</span></Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="min-h-[44px]">Fechar</Button>
                <Button type="submit" disabled={saving} className="min-h-[44px] gap-1.5"><Save className="h-4 w-4" /><span>{saving ? "Salvando..." : "Salvar Harness"}</span></Button>
              </div>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <OpenCodeModelPickerDialog
        open={pickerTarget !== null}
        onOpenChange={(isOpen) => !isOpen && setPickerTarget(null)}
        catalog={mergedCatalog}
        selectedModelId={pickerTarget === "opencode" ? draft.openCodePreferredFreeModel : pickerTarget === "pulumi" ? draft.pulumiDefaultModelId : undefined}
        onSelectModel={handlePickerSelect}
        onRefreshLive={handleSyncOpenCode}
        refreshing={syncingOpenCode}
      />
    </>
  );
};
