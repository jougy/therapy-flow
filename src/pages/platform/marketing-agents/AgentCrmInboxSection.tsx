import React, { useMemo, useState } from "react";
import {
  Bot,
  Columns3,
  Download,
  ExternalLink,
  LayoutGrid,
  MessageCircle,
  MessageSquareText,
  UserCheck,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { FUNNEL_STAGE_META, type ConversationFunnelStage, type MarketingZapConversation } from "./types";
import type { KeywordTriggerRecord } from "./suiteTypes";
import { formatPhoneBr, normalizePhoneToE164 } from "./antiBanEngine";
import { buildLocalExtractiveCompaction } from "./zapSuiteEngine";
import { invokeZapGateway, marketingDb } from "./marketingAgentsService";
import { LiveChatDrawer, type LiveChatMessageItem } from "./LiveChatDrawer";
import { KeywordTriggersPanel } from "./KeywordTriggersPanel";

export interface AgentCrmInboxSectionProps {
  conversations: MarketingZapConversation[];
  onToggleHumanMode: (conv: MarketingZapConversation) => Promise<void>;
  onUpdateStage: (convId: string, stage: ConversationFunnelStage) => Promise<void>;
  triggers?: KeywordTriggerRecord[];
  onCreateTrigger?: (draft: Omit<KeywordTriggerRecord, "id" | "hitCount">) => Promise<void>;
  onToggleTrigger?: (trigger: KeywordTriggerRecord) => Promise<void>;
  onDeleteTrigger?: (id: string) => Promise<void>;
  onSyncWhatsappContacts?: () => Promise<void>;
  onLoadMessages?: (conv: MarketingZapConversation) => Promise<LiveChatMessageItem[]>;
  onSendHumanReply?: (conv: MarketingZapConversation, text: string) => Promise<void>;
  onCompactMemory?: (conv: MarketingZapConversation) => Promise<void>;
}

const STAGE_FILTERS: Array<{ id: "all" | ConversationFunnelStage; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "lead", label: "Novo Lead" },
  { id: "contacted", label: "Abordado" },
  { id: "qualified", label: "Qualificado IA" },
  { id: "proposal", label: "Proposta" },
  { id: "scheduled", label: "Demo Agendada" },
  { id: "won", label: "Convertido" },
  { id: "opt_out", label: "Opt-Out" },
];

const KANBAN_STAGES = STAGE_FILTERS.filter(
  (s): s is { id: ConversationFunnelStage; label: string } => s.id !== "all",
);

export const AgentCrmInboxSection: React.FC<AgentCrmInboxSectionProps> = ({
  conversations,
  onToggleHumanMode,
  onUpdateStage,
  triggers,
  onCreateTrigger,
  onToggleTrigger,
  onDeleteTrigger,
  onSyncWhatsappContacts,
  onLoadMessages,
  onSendHumanReply,
  onCompactMemory,
}) => {
  const [stageFilter, setStageFilter] = useState<"all" | ConversationFunnelStage>("all");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [mobileKanbanStage, setMobileKanbanStage] = useState<ConversationFunnelStage>("lead");
  const [showTriggers, setShowTriggers] = useState(false);
  const [syncingContacts, setSyncingContacts] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeConv, setActiveConv] = useState<MarketingZapConversation | null>(null);
  const [chatMessages, setChatMessages] = useState<LiveChatMessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const filtered = useMemo(
    () => (stageFilter === "all" ? conversations : conversations.filter((c) => c.funnel_stage === stageFilter)),
    [conversations, stageFilter],
  );

  const groupedByStage = useMemo(() => {
    const map: Record<ConversationFunnelStage, MarketingZapConversation[]> = {
      lead: [], contacted: [], qualified: [], proposal: [], scheduled: [], won: [], opt_out: [],
    };
    for (const c of conversations) {
      if (map[c.funnel_stage]) map[c.funnel_stage].push(c);
    }
    return map;
  }, [conversations]);

  const handleExtractContacts = async () => {
    setSyncingContacts(true);
    try {
      if (onSyncWhatsappContacts) {
        await onSyncWhatsappContacts();
      } else {
        const { error } = await invokeZapGateway("sync_whatsapp_contacts", {});
        toast({
          title: error ? "Sincronização em modo preview" : "Contatos do chip extraídos com sucesso!",
          description: error
            ? "Conecte a Evolution API para importar os chats ativos do aparelho."
            : "Conversas do WhatsApp sincronizadas no OmegaChat CRM.",
        });
      }
    } finally {
      setSyncingContacts(false);
    }
  };

  const openChatDrawer = async (conv: MarketingZapConversation) => {
    setActiveConv(conv);
    setDrawerOpen(true);
    setLoadingMessages(true);
    try {
      if (onLoadMessages) {
        setChatMessages(await onLoadMessages(conv));
        return;
      }
      const { data } = await marketingDb
        .from("marketing_zap_messages")
        .select("*")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true })
        .limit(40);
      if (Array.isArray(data) && data.length > 0) {
        setChatMessages(
          data.map((row: Record<string, unknown>) => ({
            id: String(row.id),
            conversationId: String(row.conversation_id || conv.id),
            direction: row.direction === "outbound" ? "outbound" : "inbound",
            messageType: "text",
            body: String(row.body_text || row.body || ""),
            status: "delivered",
            senderRole: (row.sender_role as LiveChatMessageItem["senderRole"]) || undefined,
            senderLabel: row.model_used ? String(row.model_used) : undefined,
            createdAt: String(row.created_at || new Date().toISOString()),
          })),
        );
      } else if (conv.last_message_preview) {
        setChatMessages([
          {
            id: `preview-${conv.id}`,
            conversationId: conv.id,
            direction: conv.last_message_direction,
            messageType: "text",
            body: conv.last_message_preview,
            status: "delivered",
            senderRole: conv.last_message_direction === "inbound" ? "lead" : "ai",
            createdAt: conv.updated_at,
          },
        ]);
      } else {
        setChatMessages([]);
      }
    } catch {
      setChatMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendManualReply = async (conv: MarketingZapConversation, text: string) => {
    if (onSendHumanReply) {
      await onSendHumanReply(conv, text);
    } else {
      await invokeZapGateway("send_human_reply", {
        conversation_id: conv.id,
        phone_e164: conv.phone_e164,
        message_text: text,
      }).catch(() => undefined);
    }
    setChatMessages((prev) => [
      ...prev,
      {
        id: `human-${Date.now()}`,
        conversationId: conv.id,
        direction: "outbound",
        messageType: "text",
        body: text,
        status: "sent",
        senderRole: "human",
        senderLabel: "Humano",
        createdAt: new Date().toISOString(),
      },
    ]);
    toast({ title: "Mensagem enviada pelo atendente" });
  };

  const handleCompactContext = async (conv: MarketingZapConversation) => {
    if (onCompactMemory) {
      await onCompactMemory(conv);
      return;
    }
    const turns = chatMessages.map((m) => ({
      role: m.direction === "inbound" ? "lead" : "ai",
      text: m.body,
    }));
    const result = buildLocalExtractiveCompaction(conv.rolling_summary, conv.structured_facts, turns, 4);
    setActiveConv((prev) =>
      prev && prev.id === conv.id
        ? {
            ...prev,
            rolling_summary: result.rollingSummary || prev.rolling_summary,
            structured_facts: result.structuredFacts,
            compaction_count: (prev.compaction_count ?? 0) + 1,
          }
        : prev,
    );
    toast({
      title: "Memória compactada!",
      description: `${Object.keys(result.structuredFacts).length} fatos estruturados preservados.`,
    });
  };

  const renderCard = (conv: MarketingZapConversation, compact = false) => {
    const stageMeta = FUNNEL_STAGE_META[conv.funnel_stage];
    const isHuman = conv.agent_mode === "human";
    const waUrl = `https://wa.me/${normalizePhoneToE164(conv.phone_e164)}`;

    return (
      <Card key={conv.id} data-testid={`crm-conversation-card-${conv.id}`} className="border transition-colors hover:border-primary/40">
        <CardContent className={compact ? "p-3 space-y-2.5" : "p-4 space-y-3"}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="font-semibold text-sm truncate">{conv.contact_name}</p>
                {!compact && <Badge className={`text-[10px] ${stageMeta.badgeClass}`}>{stageMeta.label}</Badge>}
              </div>
              <p className="text-xs font-mono text-muted-foreground truncate">
                {formatPhoneBr(conv.phone_e164)}
                {conv.clinic_or_origin ? ` • ${conv.clinic_or_origin}` : ""}
              </p>
            </div>
            <Badge variant={isHuman ? "secondary" : "default"} className="text-[10px] shrink-0 gap-1">
              {isHuman ? <><UserCheck className="h-3 w-3" /> Humano</> : <><Bot className="h-3 w-3" /> IA Ativa</>}
            </Badge>
          </div>

          {conv.last_message_preview && (
            <p className="text-xs text-muted-foreground bg-muted/35 rounded-lg p-2.5 line-clamp-2">
              {conv.last_message_preview}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Select value={conv.funnel_stage} onValueChange={(v) => void onUpdateStage(conv.id, v as ConversationFunnelStage)}>
              <SelectTrigger className={compact ? "w-full min-h-[44px] sm:min-h-[38px] text-xs" : "w-full sm:w-44 min-h-[44px] sm:min-h-[38px] text-xs"}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FUNNEL_STAGE_META).map(([key, meta]) => (
                  <SelectItem key={key} value={key}>{meta.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => void openChatDrawer(conv)} className="min-h-[44px] sm:min-h-[38px] text-xs gap-1">
                <MessageSquareText className="h-3.5 w-3.5 text-primary" />
                <span>Abrir Chat &amp; Memória</span>
              </Button>
              <Button type="button" variant="outline" size="sm" asChild className="min-h-[44px] sm:min-h-[38px] text-xs gap-1">
                <a href={waUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  WhatsApp
                </a>
              </Button>
              <Button
                type="button"
                size="sm"
                data-testid={`toggle-human-btn-${conv.id}`}
                variant={isHuman ? "outline" : "default"}
                onClick={() => void onToggleHumanMode(conv)}
                className="min-h-[44px] sm:min-h-[38px] text-xs gap-1"
              >
                <UserCheck className="h-3.5 w-3.5" />
                {isHuman ? "Devolver p/ IA" : "Assumir Humano"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4 w-full max-w-full min-w-0 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card/70 p-3">
        <div className="flex items-center gap-1.5">
          <Button type="button" size="sm" variant={viewMode === "list" ? "default" : "outline"} onClick={() => setViewMode("list")} className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5" /><span>Lista / Grid</span>
          </Button>
          <Button type="button" size="sm" variant={viewMode === "kanban" ? "default" : "outline"} onClick={() => setViewMode("kanban")} className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5">
            <Columns3 className="h-3.5 w-3.5" /><span>Kanban Colunas</span>
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={syncingContacts} onClick={() => void handleExtractContacts()} className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5">
            <Download className="h-3.5 w-3.5 text-emerald-500" />
            <span>{syncingContacts ? "Extraindo..." : "Extrair Contatos do Chip"}</span>
          </Button>
          <Button type="button" size="sm" variant={showTriggers ? "default" : "outline"} onClick={() => setShowTriggers((prev) => !prev)} className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-500" /><span>Gatilhos Palavra-Chave</span>
          </Button>
        </div>
      </div>

      {showTriggers && (
        <KeywordTriggersPanel triggers={triggers} onCreateTrigger={onCreateTrigger} onToggleTrigger={onToggleTrigger} onDeleteTrigger={onDeleteTrigger} />
      )}

      {viewMode === "list" ? (
        <>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 touch-pan-x">
            {STAGE_FILTERS.map((f) => (
              <Button key={f.id} type="button" size="sm" variant={stageFilter === f.id ? "default" : "outline"} onClick={() => setStageFilter(f.id)} className="min-h-[44px] sm:min-h-[38px] shrink-0 text-xs rounded-full">
                {f.label}
              </Button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center space-y-2">
                <MessageCircle className="h-7 w-7 mx-auto text-muted-foreground/60" />
                <p className="text-sm font-medium">Nenhuma conversa nesta etapa do funil</p>
                <p className="text-xs text-muted-foreground">
                  Assim que o chip (11) 96512-0431 receber mensagens ou iniciar disparos, as conversas aparecerão aqui em tempo real.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{filtered.map((conv) => renderCard(conv))}</div>
          )}
        </>
      ) : (
        <>
          <div className="md:hidden space-y-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 touch-pan-x">
              {KANBAN_STAGES.map((stage) => (
                <Button key={stage.id} type="button" size="sm" variant={mobileKanbanStage === stage.id ? "default" : "outline"} onClick={() => setMobileKanbanStage(stage.id)} className="min-h-[44px] shrink-0 text-xs rounded-full gap-1.5">
                  <span>{stage.label}</span>
                  <Badge variant="secondary" className="text-[10px]">{groupedByStage[stage.id].length}</Badge>
                </Button>
              ))}
            </div>
            <div className="space-y-3">
              {groupedByStage[mobileKanbanStage].length === 0 ? (
                <Card><CardContent className="p-6 text-center text-xs text-muted-foreground">Nenhum lead nesta coluna.</CardContent></Card>
              ) : (
                groupedByStage[mobileKanbanStage].map((conv) => renderCard(conv, true))
              )}
            </div>
          </div>

          <div className="hidden md:flex gap-3 overflow-x-auto touch-pan-x pb-2">
            {KANBAN_STAGES.map((stage) => {
              const items = groupedByStage[stage.id];
              const stageMeta = FUNNEL_STAGE_META[stage.id];
              return (
                <div key={stage.id} className="w-72 shrink-0 rounded-xl border bg-muted/20 p-2.5 space-y-2.5 flex flex-col">
                  <div className="flex items-center justify-between gap-2 px-1">
                    <Badge className={`text-[11px] ${stageMeta.badgeClass}`}>{stage.label}</Badge>
                    <span className="text-xs font-mono text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="space-y-2.5 flex-1">
                    {items.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-center text-[11px] text-muted-foreground">Sem leads</div>
                    ) : (
                      items.map((conv) => renderCard(conv, true))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <LiveChatDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        conversation={activeConv}
        messages={chatMessages}
        loadingMessages={loadingMessages}
        onToggleHumanMode={onToggleHumanMode}
        onSendHumanReply={handleSendManualReply}
        onCompactMemory={handleCompactContext}
      />
    </div>
  );
};
