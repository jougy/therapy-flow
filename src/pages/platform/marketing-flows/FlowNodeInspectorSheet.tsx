import React, { useEffect, useState } from "react";
import { Save, Settings2, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURATED_LLM_CATALOG } from "../marketing-agents/suiteTypes";
import { FUNNEL_STAGE_META } from "../marketing-agents/types";
import type { MarketingFlowNode } from "./types";

export interface FlowNodeInspectorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: MarketingFlowNode | null;
  onSaveNode: (updated: MarketingFlowNode) => void;
  onDeleteNode?: (nodeId: string) => void;
}

export const FlowNodeInspectorSheet: React.FC<FlowNodeInspectorSheetProps> = ({
  open,
  onOpenChange,
  node,
  onSaveNode,
  onDeleteNode,
}) => {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [config, setConfig] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!node) return;
    setTitle(node.title);
    setSubtitle(node.subtitle);
    setConfig({ ...(node.config || {}) });
  }, [node]);

  if (!node) return null;

  const setField = (key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const str = (key: string, fallback = ""): string =>
    typeof config[key] === "string" ? (config[key] as string) : fallback;

  const bool = (key: string, fallback = false): boolean =>
    typeof config[key] === "boolean" ? (config[key] as boolean) : fallback;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveNode({
      ...node,
      title: title.trim() || node.title,
      subtitle: subtitle.trim() || node.subtitle,
      config,
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-testid="flow-node-inspector-sheet"
        className="w-full sm:max-w-md max-h-[100dvh] h-[100dvh] flex flex-col p-0 gap-0 overflow-hidden"
      >
        <SheetHeader className="p-4 pr-11 border-b shrink-0 text-left">
          <SheetTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary shrink-0" />
            <span>Configurar Nó do Fluxo</span>
          </SheetTitle>
          <SheetDescription className="text-xs font-mono">
            Tipo: {node.type}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="node-title" className="text-xs">Título do Nó</Label>
              <Input
                id="node-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="min-h-[44px] sm:min-h-[38px] text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="node-subtitle" className="text-xs">Subtítulo / Resumo</Label>
              <Input
                id="node-subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="min-h-[44px] sm:min-h-[38px] text-xs"
              />
            </div>

            {node.type === "ai_agent_gemini" && (
              <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
                <p className="text-xs font-semibold">Roteador Multi-LLM (OpenCode / Gemini / Ollama)</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Modelo Curado</Label>
                  <Select
                    value={str("modelId", "gemini-2.5-flash-lite")}
                    onValueChange={(v) => {
                      const found = CURATED_LLM_CATALOG.find((m) => m.id === v);
                      setConfig((prev) => ({
                        ...prev,
                        modelId: v,
                        providerSlug: found?.providerSlug || prev.providerSlug || "gemini-pulumi",
                        disableThinking: found?.disableThinkingRecommended ?? bool("disableThinking", true),
                      }));
                    }}
                  >
                    <SelectTrigger className="min-h-[44px] sm:min-h-[38px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURATED_LLM_CATALOG.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} ({item.providerLabel})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="node-custom-model" className="text-xs">
                    Ou ID de Modelo Livre (opcional)
                  </Label>
                  <Input
                    id="node-custom-model"
                    value={str("customModelId")}
                    onChange={(e) => setField("customModelId", e.target.value)}
                    placeholder="Ex: qwen3:8b ou deepseek-chat"
                    className="min-h-[44px] sm:min-h-[38px] text-xs font-mono"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs">Desativar Thinking (resposta rápida WhatsApp)</span>
                  <Switch
                    checked={bool("disableThinking", true)}
                    onCheckedChange={(v) => setField("disableThinking", v)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="node-ai-prompt" className="text-xs">Instrução do Nó</Label>
                  <Textarea
                    id="node-ai-prompt"
                    rows={3}
                    value={str("promptInstruction")}
                    onChange={(e) => setField("promptInstruction", e.target.value)}
                    placeholder="Ex: Qualifique o porte da clínica e ofereça agendar demo."
                    className="text-xs"
                  />
                </div>
              </div>
            )}

            {(node.type === "http_request" || node.type === "trigger_webhook") && (
              <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Método HTTP</Label>
                  <Select
                    value={str("method", "POST")}
                    onValueChange={(v) => setField("method", v)}
                  >
                    <SelectTrigger className="min-h-[44px] sm:min-h-[38px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="PATCH">PATCH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="node-http-url" className="text-xs">URL do Endpoint</Label>
                  <Input
                    id="node-http-url"
                    value={str("url")}
                    onChange={(e) => setField("url", e.target.value)}
                    placeholder="https://api.sua-clinica.com/webhook"
                    className="min-h-[44px] sm:min-h-[38px] text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {node.type === "condition_if_else" && (
              <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cond-field" className="text-xs">Campo Avaliado</Label>
                  <Input
                    id="cond-field"
                    value={str("field", "intent")}
                    onChange={(e) => setField("field", e.target.value)}
                    placeholder="intent, message, score, funnel_stage"
                    className="min-h-[44px] sm:min-h-[38px] text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Operador</Label>
                  <Select
                    value={str("operator", "contains")}
                    onValueChange={(v) => setField("operator", v)}
                  >
                    <SelectTrigger className="min-h-[44px] sm:min-h-[38px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals">Igual a (equals)</SelectItem>
                      <SelectItem value="contains">Contém (contains)</SelectItem>
                      <SelectItem value="greater_than">Maior que (&gt;)</SelectItem>
                      <SelectItem value="regex">Regex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cond-value" className="text-xs">Valor Esperado</Label>
                  <Input
                    id="cond-value"
                    value={str("value")}
                    onChange={(e) => setField("value", e.target.value)}
                    placeholder="Ex: pricing ou demo"
                    className="min-h-[44px] sm:min-h-[38px] text-xs"
                  />
                </div>
              </div>
            )}

            {(node.type === "zap_enqueue_cadence" || node.type === "send_whatsapp_media") && (
              <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="wa-msg" className="text-xs">Mensagem / Spintax</Label>
                  <Textarea
                    id="wa-msg"
                    rows={3}
                    value={str("message")}
                    onChange={(e) => setField("message", e.target.value)}
                    placeholder="{Olá|Oi} {{primeiro_nome}}! Tudo bem?"
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wa-media-url" className="text-xs">URL da Mídia / Áudio (opcional)</Label>
                  <Input
                    id="wa-media-url"
                    value={str("mediaUrl")}
                    onChange={(e) => setField("mediaUrl", e.target.value)}
                    placeholder="https://.../audio-boas-vindas.ogg"
                    className="min-h-[44px] sm:min-h-[38px] text-xs font-mono"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs">Enviar áudio como gravado na hora (PTT)</span>
                  <Switch
                    checked={bool("simulatePtt", node.type === "send_whatsapp_media")}
                    onCheckedChange={(v) => setField("simulatePtt", v)}
                  />
                </div>
              </div>
            )}

            {node.type === "move_kanban_stage" && (
              <div className="space-y-1.5 rounded-xl border bg-muted/20 p-3">
                <Label className="text-xs">Etapa Destino no Kanban</Label>
                <Select
                  value={str("stage", "qualified")}
                  onValueChange={(v) => setField("stage", v)}
                >
                  <SelectTrigger className="min-h-[44px] sm:min-h-[38px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FUNNEL_STAGE_META).map(([key, meta]) => (
                      <SelectItem key={key} value={key}>
                        {meta.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {node.type === "group_action" && (
              <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
                <Label htmlFor="grp-jid" className="text-xs">JID ou Link do Grupo</Label>
                <Input
                  id="grp-jid"
                  value={str("groupJid")}
                  onChange={(e) => setField("groupJid", e.target.value)}
                  placeholder="120363...@g.us"
                  className="min-h-[44px] sm:min-h-[38px] text-xs font-mono"
                />
              </div>
            )}

            {node.type === "delay_wait" && (
              <div className="space-y-1.5 rounded-xl border bg-muted/20 p-3">
                <Label htmlFor="delay-min" className="text-xs">Aguardar (minutos)</Label>
                <Input
                  id="delay-min"
                  type="number"
                  min={1}
                  max={10080}
                  value={str("delayMinutes", "15")}
                  onChange={(e) => setField("delayMinutes", e.target.value)}
                  className="min-h-[44px] sm:min-h-[38px] text-xs font-mono"
                />
              </div>
            )}
          </div>

          <div className="sticky bottom-0 z-10 border-t bg-background p-3 flex items-center justify-between gap-2 shrink-0">
            {onDeleteNode ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  onDeleteNode(node.id);
                  onOpenChange(false);
                }}
                className="min-h-[44px] sm:min-h-[38px] text-destructive hover:text-destructive gap-1.5 text-xs"
              >
                <Trash2 className="h-4 w-4" />
                <span>Remover Nó</span>
              </Button>
            ) : (
              <span />
            )}

            <Button
              type="submit"
              size="sm"
              className="min-h-[44px] sm:min-h-[38px] gap-1.5 text-xs"
            >
              <Save className="h-4 w-4" />
              <span>Aplicar no Nó</span>
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};
