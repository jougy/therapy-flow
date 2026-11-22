import React, { useState } from "react";
import { Plus, Trash2, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import type { KeywordTriggerRecord } from "./suiteTypes";
import { evaluateKeywordTriggers } from "./zapSuiteEngine";

export type SimpleTriggerActionType =
  | "reply_text"
  | "start_flow"
  | "handoff_human"
  | "move_stage";

export interface KeywordTriggersPanelProps {
  triggers?: KeywordTriggerRecord[];
  onCreateTrigger?: (draft: Omit<KeywordTriggerRecord, "id" | "hitCount">) => Promise<void>;
  onToggleTrigger?: (trigger: KeywordTriggerRecord) => Promise<void>;
  onDeleteTrigger?: (id: string) => Promise<void>;
}

const DEFAULT_PREVIEW_TRIGGERS: KeywordTriggerRecord[] = [
  {
    id: "trig-preco",
    name: "Tabela de Preços Instantânea",
    matchType: "contains",
    pattern: "preço",
    actionType: "reply_text",
    actionPayload: {
      replyText: "Nossos planos começam em R$ 97/mês sem fidelidade. Quer ver uma demo rápida?",
    },
    priority: 1,
    isActive: true,
    hitCount: 18,
  },
  {
    id: "trig-humano",
    name: "Escalar Comercial Humano",
    matchType: "regex",
    pattern: "\\b(atendente|humano|consultor|fechar)\\b",
    actionType: "handoff_human",
    actionPayload: { target: "comercial" },
    priority: 2,
    isActive: true,
    hitCount: 7,
  },
];

const MATCH_LABELS: Record<KeywordTriggerRecord["matchType"], string> = {
  exact: "Exato",
  contains: "Contém",
  starts_with: "Começa com",
  regex: "Regex",
};

const ACTION_LABELS: Record<KeywordTriggerRecord["actionType"], string> = {
  reply_text: "Responder Texto",
  reply_media: "Responder Mídia",
  start_flow: "Iniciar Fluxo",
  switch_agent: "Trocar Agente",
  handoff_human: "Assumir Humano",
  move_stage: "Mover Kanban",
};

export const KeywordTriggersPanel: React.FC<KeywordTriggersPanelProps> = ({
  triggers,
  onCreateTrigger,
  onToggleTrigger,
  onDeleteTrigger,
}) => {
  const [localTriggers, setLocalTriggers] = useState<KeywordTriggerRecord[]>(
    DEFAULT_PREVIEW_TRIGGERS,
  );
  const items = triggers ?? localTriggers;

  const [name, setName] = useState("");
  const [matchType, setMatchType] = useState<KeywordTriggerRecord["matchType"]>("contains");
  const [pattern, setPattern] = useState("");
  const [actionType, setActionType] = useState<SimpleTriggerActionType>("reply_text");
  const [replyTextOrTarget, setReplyTextOrTarget] = useState("");
  const [testMessage, setTestMessage] = useState("");

  const matchedPreview = testMessage.trim()
    ? evaluateKeywordTriggers(testMessage, items)
    : null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !pattern.trim()) {
      toast({
        title: "Preencha nome e padrão da regra",
        variant: "destructive",
      });
      return;
    }

    const actionPayload: Record<string, unknown> =
      actionType === "reply_text"
        ? { replyText: replyTextOrTarget.trim() }
        : actionType === "start_flow"
          ? { flowId: replyTextOrTarget.trim() || "flow-sdr-hunt" }
          : actionType === "move_stage"
            ? { stage: replyTextOrTarget.trim() || "qualified" }
            : { note: replyTextOrTarget.trim() || "Handoff imediato" };

    const draft: Omit<KeywordTriggerRecord, "id" | "hitCount"> = {
      name: name.trim(),
      matchType,
      pattern: pattern.trim(),
      actionType,
      actionPayload,
      priority: items.length + 1,
      isActive: true,
    };

    if (onCreateTrigger) {
      await onCreateTrigger(draft);
    } else {
      setLocalTriggers((prev) => [
        ...prev,
        { ...draft, id: `trig-${Date.now()}`, hitCount: 0 },
      ]);
      toast({ title: "Gatilho 0-token criado!", description: draft.name });
    }

    setName("");
    setPattern("");
    setReplyTextOrTarget("");
  };

  const handleToggle = async (trigger: KeywordTriggerRecord) => {
    if (onToggleTrigger) {
      await onToggleTrigger(trigger);
      return;
    }
    setLocalTriggers((prev) =>
      prev.map((item) =>
        item.id === trigger.id ? { ...item, isActive: !item.isActive } : item,
      ),
    );
  };

  const handleDelete = async (id: string) => {
    if (onDeleteTrigger) {
      await onDeleteTrigger(id);
      return;
    }
    setLocalTriggers((prev) => prev.filter((item) => item.id !== id));
    toast({ title: "Gatilho removido" });
  };

  return (
    <Card data-testid="keyword-triggers-panel" className="border-primary/25">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500 shrink-0" />
              Gatilhos por Palavra-Chave & Regex (OmegaChat)
            </CardTitle>
            <CardDescription className="text-xs">
              Intercepta mensagens instantaneamente com 0 tokens de LLM antes de acionar a IA.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-[11px] font-mono">
            0 Tokens LLM
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Lista de gatilhos */}
        <div className="space-y-2">
          {items.map((trig) => (
            <div
              key={trig.id}
              className="rounded-xl border bg-muted/20 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold truncate">{trig.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {MATCH_LABELS[trig.matchType]}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {ACTION_LABELS[trig.actionType]}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {trig.hitCount} hits
                  </Badge>
                </div>
                <p className="text-[11px] font-mono text-muted-foreground break-all">
                  Padrão: {trig.pattern}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 shrink-0">
                <Switch
                  checked={trig.isActive}
                  aria-label={`Ativar gatilho ${trig.name}`}
                  onCheckedChange={() => void handleToggle(trig)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Remover gatilho ${trig.name}`}
                  onClick={() => void handleDelete(trig.id)}
                  className="min-h-[44px] sm:min-h-[38px] text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Form compacto para criar regra */}
        <form onSubmit={handleCreate} className="rounded-xl border bg-card p-3 space-y-3">
          <p className="text-xs font-semibold">Nova Regra Instantânea</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="space-y-1">
              <Label htmlFor="trig-name" className="text-[11px]">Nome da regra</Label>
              <Input
                id="trig-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Enviar Link Demo"
                className="min-h-[44px] sm:min-h-[38px] text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px]">Tipo de Match</Label>
              <Select
                value={matchType}
                onValueChange={(v) => setMatchType(v as KeywordTriggerRecord["matchType"])}
              >
                <SelectTrigger className="min-h-[44px] sm:min-h-[38px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exact">Exato (exact)</SelectItem>
                  <SelectItem value="contains">Contém (contains)</SelectItem>
                  <SelectItem value="starts_with">Começa com (starts_with)</SelectItem>
                  <SelectItem value="regex">Regex</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="trig-pattern" className="text-[11px]">Palavra / Regex</Label>
              <Input
                id="trig-pattern"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="Ex: agendar|demo"
                className="min-h-[44px] sm:min-h-[38px] text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px]">Ação</Label>
              <Select
                value={actionType}
                onValueChange={(v) => setActionType(v as SimpleTriggerActionType)}
              >
                <SelectTrigger className="min-h-[44px] sm:min-h-[38px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reply_text">Responder Texto</SelectItem>
                  <SelectItem value="start_flow">Iniciar Fluxo Botzom</SelectItem>
                  <SelectItem value="handoff_human">Assumir Humano</SelectItem>
                  <SelectItem value="move_stage">Mover Etapa Kanban</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={replyTextOrTarget}
              onChange={(e) => setReplyTextOrTarget(e.target.value)}
              placeholder={
                actionType === "reply_text"
                  ? "Resposta imediata (suporta {{primeiro_nome}})..."
                  : actionType === "start_flow"
                    ? "ID do fluxo (ex: flow-sdr-hunt)"
                    : actionType === "move_stage"
                      ? "Etapa destino (ex: qualified, proposal, scheduled)"
                      : "Observação para o atendente humano..."
              }
              className="min-h-[44px] sm:min-h-[38px] text-xs flex-1"
            />
            <Button
              type="submit"
              size="sm"
              className="min-h-[44px] sm:min-h-[38px] gap-1.5 shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Criar Gatilho</span>
            </Button>
          </div>
        </form>

        {/* Simulador rápido 0-token */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg bg-muted/30 p-2.5">
          <Input
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="Testar frase de entrada nos gatilhos acima..."
            className="min-h-[44px] sm:min-h-[38px] text-xs flex-1"
          />
          <div className="text-xs shrink-0">
            {testMessage.trim() ? (
              matchedPreview ? (
                <Badge className="bg-emerald-600 text-white">
                  Disparou: {matchedPreview.name}
                </Badge>
              ) : (
                <Badge variant="outline">Sem match → segue p/ LLM</Badge>
              )
            ) : (
              <span className="text-[11px] text-muted-foreground">Teste determinístico</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
