import React, { useState } from "react";
import { Bot, CopyPlus, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import type { TypebotBindingRecord } from "../marketing-agents/suiteTypes";
import { invokeZapGateway, marketingDb } from "../marketing-agents/marketingAgentsService";

export interface TypeZapExtendedBinding extends TypebotBindingRecord {
  triggerType: "all" | "keyword";
  delayMessageMs: number;
  simulateTyping: boolean;
  simulateRecording: boolean;
  debounceSeconds: number;
  keywordFinish: string;
  cloneSourceUrl?: string;
}

export interface TypeZapBridgeSectionProps {
  bindings?: TypeZapExtendedBinding[];
  onSaveBinding?: (binding: TypeZapExtendedBinding) => Promise<void>;
  onDeleteBinding?: (id: string) => Promise<void>;
}

const DEFAULT_BINDINGS: TypeZapExtendedBinding[] = [
  {
    id: "tz-qualificacao-clinica",
    name: "Typebot Qualificação Pluri Fisio",
    instanceId: "inst-primary-5511965120431",
    typebotBaseUrl: "https://typebot.plurihealth.com.br",
    typebotPublicId: "pluri-fisio-triagem-v1",
    triggerType: "keyword",
    triggerKeyword: "quero testar",
    expireMinutes: 60,
    delayMessageMs: 1200,
    simulateTyping: true,
    simulateRecording: true,
    debounceSeconds: 8,
    keywordFinish: "#sair",
    isActive: true,
    createdAt: "2026-11-22T00:00:00.000Z",
  },
];

function parseTypebotCloneSource(rawInput: string): { name?: string; baseUrl?: string; publicId?: string } | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { name?: string; publicId?: string; id?: string };
      return {
        name: parsed.name || "Fluxo Typebot Importado",
        publicId: parsed.publicId || parsed.id || `cloned-${Date.now().toString(36)}`,
      };
    } catch {
      return null;
    }
  }
  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split("/").filter(Boolean);
    const publicId = segments[segments.length - 1] || `bot-${Date.now().toString(36)}`;
    return { baseUrl: `${url.protocol}//${url.host}`, publicId, name: `Clone: ${publicId}` };
  } catch {
    return null;
  }
}

export const TypeZapBridgeSection: React.FC<TypeZapBridgeSectionProps> = ({
  bindings,
  onSaveBinding,
  onDeleteBinding,
}) => {
  const [localBindings, setLocalBindings] = useState<TypeZapExtendedBinding[]>(DEFAULT_BINDINGS);
  const items = bindings ?? localBindings;

  const [name, setName] = useState("");
  const [typebotBaseUrl, setTypebotBaseUrl] = useState("https://typebot.plurihealth.com.br");
  const [typebotPublicId, setTypebotPublicId] = useState("");
  const [triggerType, setTriggerType] = useState<"all" | "keyword">("keyword");
  const [triggerKeyword, setTriggerKeyword] = useState("comecar");
  const [delayMessageMs, setDelayMessageMs] = useState(1200);
  const [debounceSeconds, setDebounceSeconds] = useState(8);
  const [keywordFinish, setKeywordFinish] = useState("#sair");
  const [simulateTyping, setSimulateTyping] = useState(true);
  const [simulateRecording, setSimulateRecording] = useState(true);
  const [cloneSource, setCloneSource] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCloneParse = () => {
    const parsed = parseTypebotCloneSource(cloneSource);
    if (!parsed) {
      toast({
        title: "URL ou JSON Typebot inválido",
        description: "Cole uma URL pública do Typebot ou o JSON exportado.",
        variant: "destructive",
      });
      return;
    }
    if (parsed.baseUrl) setTypebotBaseUrl(parsed.baseUrl);
    if (parsed.publicId) setTypebotPublicId(parsed.publicId);
    if (parsed.name && !name.trim()) setName(parsed.name);
    toast({ title: "Estrutura Typebot clonada para o formulário!", description: `Public ID: ${parsed.publicId || typebotPublicId}` });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typebotBaseUrl.trim() || !typebotPublicId.trim()) {
      toast({ title: "Informe a URL base e o Public ID do Typebot", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const nextBinding: TypeZapExtendedBinding = {
        id: `tz-${Date.now()}`,
        name: name.trim() || `TypeZap — ${typebotPublicId.trim()}`,
        instanceId: "inst-primary-5511965120431",
        typebotBaseUrl: typebotBaseUrl.trim().replace(/\/+$/, ""),
        typebotPublicId: typebotPublicId.trim(),
        triggerType,
        triggerKeyword: triggerType === "keyword" ? triggerKeyword.trim() : null,
        expireMinutes: 60,
        delayMessageMs,
        simulateTyping,
        simulateRecording,
        debounceSeconds,
        keywordFinish: keywordFinish.trim() || "#sair",
        cloneSourceUrl: cloneSource.trim().startsWith("http") ? cloneSource.trim() : undefined,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      if (onSaveBinding) {
        await onSaveBinding(nextBinding);
      } else {
        await marketingDb
          .from("marketing_typebot_bindings")
          .insert({
            tenant_scope: "platform",
            name: nextBinding.name,
            typebot_base_url: nextBinding.typebotBaseUrl,
            typebot_public_id: nextBinding.typebotPublicId,
            trigger_type: nextBinding.triggerType,
            trigger_value: nextBinding.triggerKeyword || "",
            delay_message_ms: nextBinding.delayMessageMs,
            simulate_typing: nextBinding.simulateTyping,
            simulate_recording: nextBinding.simulateRecording,
            debounce_seconds: nextBinding.debounceSeconds,
            keyword_finish: nextBinding.keywordFinish,
            clone_source_url: nextBinding.cloneSourceUrl ?? null,
            is_active: nextBinding.isActive,
          })
          .then(() => undefined, () => undefined);
      }
      setLocalBindings((prev) => [nextBinding, ...prev]);
      setName("");
      setTypebotPublicId("");
      setCloneSource("");
      toast({ title: "Vínculo TypeZap salvo!", description: nextBinding.name });
    } finally {
      setSaving(false);
    }
  };

  const handleSyncEvolution = async (binding: TypeZapExtendedBinding) => {
    setSyncingId(binding.id);
    try {
      const { error } = await invokeZapGateway("sync_typebot_binding", {
        binding_id: binding.id,
        typebot_base_url: binding.typebotBaseUrl,
        typebot_public_id: binding.typebotPublicId,
        trigger_type: binding.triggerType,
        trigger_keyword: binding.triggerKeyword,
        delay_message_ms: binding.delayMessageMs,
        simulate_typing: binding.simulateTyping,
        simulate_recording: binding.simulateRecording,
        debounce_seconds: binding.debounceSeconds,
        keyword_finish: binding.keywordFinish,
      }).catch(() => ({ error: new Error("preview") }));

      toast({
        title: error ? "Sincronização pronta (Preview Local)" : "Typebot sincronizado com Evolution API!",
        description: `${binding.typebotPublicId} (${binding.simulateTyping ? "digitando..." : "direto"})`,
      });
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (onDeleteBinding) await onDeleteBinding(id);
    setLocalBindings((prev) => prev.filter((item) => item.id !== id));
    toast({ title: "Vínculo TypeZap removido" });
  };

  return (
    <div data-testid="typezap-bridge-section" className="space-y-4 w-full max-w-full min-w-0">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary shrink-0" />
                TypeZap Bridge — Typebot OSS + Evolution API
              </CardTitle>
              <CardDescription className="text-xs">
                Conecte fluxos Typebot self-hosted ou externos com simulação realista de digitação, áudio gravando e palavra de saída.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-[11px]">
              {items.filter((i) => i.isActive).length} ativo(s)
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-xl border bg-muted/25 p-3 space-y-2">
            <Label htmlFor="tz-clone-input" className="text-xs font-semibold flex items-center gap-1.5">
              <CopyPlus className="h-3.5 w-3.5 text-violet-500" />
              Clonar de URL Pública ou JSON do Typebot
            </Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Textarea
                id="tz-clone-input"
                rows={2}
                value={cloneSource}
                onChange={(e) => setCloneSource(e.target.value)}
                placeholder="https://viewer.typebot.io/meu-funil-clinica ou cole o JSON exportado..."
                className="text-xs font-mono flex-1 min-h-[44px]"
              />
              <Button type="button" variant="secondary" onClick={handleCloneParse} className="min-h-[44px] sm:min-h-[38px] shrink-0 text-xs gap-1.5">
                <CopyPlus className="h-3.5 w-3.5" /><span>Clonar para Form</span>
              </Button>
            </div>
          </div>

          <form onSubmit={handleCreate} className="rounded-xl border bg-card p-3.5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label htmlFor="tz-name" className="text-xs">Nome do Vínculo</Label>
                <Input id="tz-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Funil Pilates" className="min-h-[44px] sm:min-h-[38px] text-xs" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tz-base-url" className="text-xs">URL Base Typebot (OSS / Cloud)</Label>
                <Input id="tz-base-url" value={typebotBaseUrl} onChange={(e) => setTypebotBaseUrl(e.target.value)} className="min-h-[44px] sm:min-h-[38px] text-xs font-mono" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tz-public-id" className="text-xs">Public ID do Fluxo</Label>
                <Input id="tz-public-id" value={typebotPublicId} onChange={(e) => setTypebotPublicId(e.target.value)} placeholder="pluri-fisio-triagem-v1" className="min-h-[44px] sm:min-h-[38px] text-xs font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Modo de Disparo</Label>
                <Select value={triggerType} onValueChange={(v) => setTriggerType(v as "all" | "keyword")}>
                  <SelectTrigger className="min-h-[44px] sm:min-h-[38px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keyword">Palavra-chave específica</SelectItem>
                    <SelectItem value="all">Todas as novas conversas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="tz-keyword" className="text-xs">Palavra-chave Gatilho</Label>
                <Input id="tz-keyword" disabled={triggerType === "all"} value={triggerKeyword} onChange={(e) => setTriggerKeyword(e.target.value)} className="min-h-[44px] sm:min-h-[38px] text-xs" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tz-finish" className="text-xs">Palavra de Saída</Label>
                <Input id="tz-finish" value={keywordFinish} onChange={(e) => setKeywordFinish(e.target.value)} className="min-h-[44px] sm:min-h-[38px] text-xs font-mono" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tz-delay" className="text-xs">Delay Balões (ms)</Label>
                <Input id="tz-delay" type="number" min={200} max={10000} value={delayMessageMs} onChange={(e) => setDelayMessageMs(Number(e.target.value) || 1200)} className="min-h-[44px] sm:min-h-[38px] text-xs font-mono" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tz-debounce" className="text-xs">Debounce (s)</Label>
                <Input id="tz-debounce" type="number" min={1} max={60} value={debounceSeconds} onChange={(e) => setDebounceSeconds(Number(e.target.value) || 8)} className="min-h-[44px] sm:min-h-[38px] text-xs font-mono" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2.5">
                <span>Simular &ldquo;digitando...&rdquo; (composing)</span>
                <Switch checked={simulateTyping} onCheckedChange={setSimulateTyping} />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2.5">
                <span>Simular &ldquo;gravando áudio...&rdquo; (recording)</span>
                <Switch checked={simulateRecording} onCheckedChange={setSimulateRecording} />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving} className="min-h-[44px] sm:min-h-[38px] gap-1.5 text-xs">
                <Plus className="h-4 w-4" /><span>{saving ? "Salvando..." : "Salvar Vínculo TypeZap"}</span>
              </Button>
            </div>
          </form>

          <div className="space-y-2.5">
            {items.map((binding) => (
              <div key={binding.id} className="rounded-xl border bg-muted/20 p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold truncate">{binding.name}</span>
                    <Badge variant="outline" className="text-[10px] font-mono">{binding.typebotPublicId}</Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {binding.triggerType === "all" ? "Todas msgs" : `Keyword: ${binding.triggerKeyword || "-"}`}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono truncate">
                    {binding.typebotBaseUrl} • delay {binding.delayMessageMs}ms • debounce {binding.debounceSeconds}s • sair: {binding.keywordFinish}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                  <Button type="button" size="sm" variant="outline" disabled={syncingId === binding.id} onClick={() => void handleSyncEvolution(binding)} className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5">
                    {syncingId === binding.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 text-emerald-500" />}
                    <span>Sincronizar com Evolution API</span>
                  </Button>
                  <Switch
                    checked={binding.isActive}
                    aria-label={`Ativar TypeZap ${binding.name}`}
                    onCheckedChange={() =>
                      setLocalBindings((prev) => prev.map((b) => (b.id === binding.id ? { ...b, isActive: !b.isActive } : b)))
                    }
                  />
                  <Button type="button" size="sm" variant="ghost" aria-label={`Remover vínculo ${binding.name}`} onClick={() => void handleDelete(binding.id)} className="min-h-[44px] sm:min-h-[38px] text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
