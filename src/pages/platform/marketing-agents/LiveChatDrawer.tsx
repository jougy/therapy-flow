import React, { useState } from "react";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Layers,
  Loader2,
  Send,
  Sparkles,
  User,
  UserCheck,
  Workflow,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  FUNNEL_STAGE_META,
  type MarketingZapConversation,
} from "./types";
import type { ZapMessageRecord } from "./suiteTypes";
import { formatPhoneBr, normalizePhoneToE164 } from "./antiBanEngine";
import { estimateMessagesTokens } from "./zapSuiteEngine";

export type LiveChatSenderRole = "lead" | "ai" | "human" | "flow";

export interface LiveChatMessageItem extends ZapMessageRecord {
  senderRole?: LiveChatSenderRole | "system";
}

export interface LiveChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: MarketingZapConversation | null;
  messages: LiveChatMessageItem[];
  loadingMessages?: boolean;
  onToggleHumanMode: (conv: MarketingZapConversation) => Promise<void>;
  onSendHumanReply?: (conv: MarketingZapConversation, text: string) => Promise<void>;
  onCompactMemory?: (conv: MarketingZapConversation) => Promise<void>;
}

function resolveSenderRole(msg: LiveChatMessageItem): LiveChatSenderRole {
  if (msg.senderRole && msg.senderRole !== "system") return msg.senderRole;
  if (msg.direction === "inbound") return "lead";
  const label = (msg.senderLabel || "").toLowerCase();
  if (label.includes("human")) return "human";
  if (label.includes("flow") || label.includes("fluxo")) return "flow";
  return "ai";
}

function getSenderMeta(role: LiveChatSenderRole) {
  switch (role) {
    case "lead":
      return {
        label: "Lead",
        alignClass: "mr-auto bg-muted/60 text-foreground border",
        icon: User,
      };
    case "human":
      return {
        label: "Humano",
        alignClass: "ml-auto bg-emerald-600 text-white border-emerald-700",
        icon: UserCheck,
      };
    case "flow":
      return {
        label: "Fluxo",
        alignClass: "ml-auto bg-violet-600 text-white border-violet-700",
        icon: Workflow,
      };
    case "ai":
    default:
      return {
        label: "IA SDR",
        alignClass: "ml-auto bg-primary text-primary-foreground",
        icon: Bot,
      };
  }
}

export const LiveChatDrawer: React.FC<LiveChatDrawerProps> = ({
  open,
  onOpenChange,
  conversation,
  messages,
  loadingMessages = false,
  onToggleHumanMode,
  onSendHumanReply,
  onCompactMemory,
}) => {
  const [memoryOpen, setMemoryOpen] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [compacting, setCompacting] = useState(false);

  if (!conversation) return null;

  const stageMeta = FUNNEL_STAGE_META[conversation.funnel_stage];
  const isHuman = conversation.agent_mode === "human";
  const waUrl = `https://wa.me/${normalizePhoneToE164(conversation.phone_e164)}`;
  const factsEntries = Object.entries(conversation.structured_facts || {});
  const estimatedTokens =
    conversation.context_tokens_est ??
    estimateMessagesTokens(messages.map((m) => ({ text: m.body })));
  const compactionCount = conversation.compaction_count ?? 0;

  const handleSend = async () => {
    const trimmed = replyText.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSendHumanReply?.(conversation, trimmed);
      setReplyText("");
    } finally {
      setSending(false);
    }
  };

  const handleCompact = async () => {
    if (compacting || !onCompactMemory) return;
    setCompacting(true);
    try {
      await onCompactMemory(conversation);
    } finally {
      setCompacting(false);
    }
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-testid="live-chat-drawer"
        className="w-full sm:max-w-lg max-h-[100dvh] h-[100dvh] flex flex-col p-0 gap-0 overflow-hidden"
      >
        {/* Header */}
        <SheetHeader className="p-4 pr-11 border-b bg-card/80 shrink-0 text-left space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <SheetTitle className="text-base truncate">
                {conversation.contact_name}
              </SheetTitle>
              <SheetDescription className="text-xs font-mono truncate">
                {formatPhoneBr(conversation.phone_e164)}
                {conversation.clinic_or_origin ? ` • ${conversation.clinic_or_origin}` : ""}
              </SheetDescription>
            </div>
            <Badge className={`text-[10px] shrink-0 ${stageMeta.badgeClass}`}>
              {stageMeta.label}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant={isHuman ? "outline" : "default"}
              onClick={() => void onToggleHumanMode(conversation)}
              className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5"
            >
              {isHuman ? <Bot className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
              <span>{isHuman ? "Devolver p/ IA" : "Assumir Humano"}</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              asChild
              className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5"
            >
              <a href={waUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Abrir wa.me</span>
              </a>
            </Button>
          </div>
        </SheetHeader>

        {/* Memória Compactada da IA (Collapsible) */}
        <div className="border-b bg-muted/25 px-4 py-2.5 shrink-0">
          <button
            type="button"
            aria-expanded={memoryOpen}
            onClick={() => setMemoryOpen((prev) => !prev)}
            className="w-full min-h-[44px] sm:min-h-[38px] flex items-center justify-between gap-2 text-left"
          >
            <span className="text-xs font-semibold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-violet-500 shrink-0" />
              Memória Compactada da IA
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-mono">
                {compactionCount}x • ~{estimatedTokens} tok
              </Badge>
              {memoryOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </button>

          {memoryOpen && (
            <div className="mt-2 space-y-2.5 pb-1">
              <div className="rounded-lg border bg-background p-2.5 text-xs text-muted-foreground leading-relaxed">
                {conversation.rolling_summary?.trim()
                  ? conversation.rolling_summary
                  : "Resumo rolante ainda não compactado. Clique abaixo para extrair fatos e comprimir o histórico."}
              </div>

              {factsEntries.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {factsEntries.map(([key, value]) => (
                    <Badge key={key} variant="secondary" className="text-[10px] gap-1">
                      <span className="font-semibold">{key}:</span>
                      <span className="truncate max-w-[160px]">{value}</span>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={compacting || !onCompactMemory}
                  onClick={() => void handleCompact()}
                  className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5"
                >
                  {compacting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Layers className="h-3.5 w-3.5 text-violet-500" />
                  )}
                  <span>Compactar Contexto Agora</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Message Timeline */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3 bg-muted/10">
          {loadingMessages ? (
            <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Carregando histórico de mensagens...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="rounded-xl border border-dashed p-5 text-center space-y-1.5">
              <p className="text-xs font-medium">Nenhuma mensagem detalhada carregada</p>
              {conversation.last_message_preview && (
                <p className="text-xs text-muted-foreground italic">
                  Última prévia: &ldquo;{conversation.last_message_preview}&rdquo;
                </p>
              )}
            </div>
          ) : (
            messages.map((msg) => {
              const role = resolveSenderRole(msg);
              const meta = getSenderMeta(role);
              const Icon = meta.icon;
              return (
                <div key={msg.id} className="flex flex-col gap-1">
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-2xs space-y-1 ${meta.alignClass}`}
                  >
                    <div className="flex items-center justify-between gap-2 opacity-85 text-[10px]">
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <Icon className="h-3 w-3" />
                        {msg.senderLabel || meta.label}
                      </span>
                      <span>
                        {new Date(msg.createdAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words leading-relaxed">
                      {msg.body}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sticky Bottom Composer */}
        <div className="sticky bottom-0 z-10 border-t bg-background p-3 space-y-2 shrink-0">
          <div className="flex items-end gap-2">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Responder manualmente via chip WhatsApp (Enter envia)..."
              rows={2}
              className="min-h-[48px] max-h-28 resize-none text-xs"
            />
            <Button
              type="button"
              size="sm"
              disabled={!replyText.trim() || sending}
              onClick={() => void handleSend()}
              aria-label="Enviar resposta manual"
              className="min-h-[44px] sm:min-h-[38px] px-3 shrink-0 gap-1.5"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Enviar</span>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
