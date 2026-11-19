import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarCheck2,
  Copy,
  ExternalLink,
  MessageCircle,
  Save,
  Sparkles,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  AUTO_LEAD_CHANNEL_LABELS,
  AUTO_LEAD_MEETING_STATUS_META,
  type PlatformAutoLead,
} from "./types";
import { buildLeadWhatsAppUrl } from "./usePlatformAutoLeads";

interface AutoLeadDetailSheetProps {
  lead: PlatformAutoLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveDetails: (
    leadId: string,
    patch: Partial<Pick<PlatformAutoLead, "ai_icebreaker_message" | "notes" | "phone" | "email" | "instagram_handle">>
  ) => Promise<boolean>;
  onOpenSchedule: (lead: PlatformAutoLead) => void;
}

export const AutoLeadDetailSheet: React.FC<AutoLeadDetailSheetProps> = ({
  lead,
  open,
  onOpenChange,
  onSaveDetails,
  onOpenSchedule,
}) => {
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [icebreaker, setIcebreaker] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!lead) return;
    setPhone(lead.phone || "");
    setEmail(lead.email || "");
    setInstagram(lead.instagram_handle || "");
    setIcebreaker(lead.ai_icebreaker_message || "");
    setNotes(lead.notes || "");
  }, [lead]);

  if (!lead) return null;

  const meetingMeta = AUTO_LEAD_MEETING_STATUS_META[lead.meeting_status] || AUTO_LEAD_MEETING_STATUS_META.none;
  const waUrl = buildLeadWhatsAppUrl({ ...lead, phone, ai_icebreaker_message: icebreaker });

  const handleCopyIcebreaker = async () => {
    try {
      await navigator.clipboard.writeText(icebreaker);
      toast({ title: "Icebreaker copiado!", description: "Cole no Messenger, Instagram DM ou WhatsApp." });
    } catch {
      toast({ title: "Não foi possível copiar automaticamente", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveDetails(lead.id, {
        phone: phone.trim() || null,
        email: email.trim() || null,
        instagram_handle: instagram.trim() || null,
        ai_icebreaker_message: icebreaker.trim() || null,
        notes: notes.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col h-[100dvh] p-0">
        <SheetHeader className="p-5 border-b">
          <div className="flex items-center justify-between gap-2 pr-6">
            <SheetTitle className="text-lg truncate">{lead.full_name}</SheetTitle>
            <Badge variant="outline" className="gap-1 font-bold">
              <Sparkles className="h-3 w-3 text-amber-500" />
              Score {lead.ai_score}/100
            </Badge>
          </div>
          <SheetDescription className="text-xs">
            {lead.facebook_group_name || "Grupo de Facebook"} • {lead.specialty || "Fisioterapia"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-5">
          {/* Integração Tripla de Agendas */}
          <div className="rounded-xl border bg-muted/30 p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CalendarCheck2 className="h-4 w-4 text-primary" />
                Status nas 3 Agendas (Bot / Comercial / Backoffice)
              </h4>
              <Badge variant="outline" className={meetingMeta.badgeClass}>
                {meetingMeta.label}
              </Badge>
            </div>
            {lead.meeting_scheduled_at && (
              <p className="text-xs font-medium text-foreground">
                Data/Hora: {format(new Date(lead.meeting_scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
            {lead.meeting_booked_by && (
              <p className="text-xs text-foreground">
                Marcado por: <strong>{lead.meeting_booked_by}</strong>
              </p>
            )}
            {lead.meeting_channel && (
              <p className="text-xs text-muted-foreground">
                Canal: {AUTO_LEAD_CHANNEL_LABELS[lead.meeting_channel] || lead.meeting_channel}
              </p>
            )}
            {lead.scheduling_attempt_summary && (
              <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 rounded p-2">
                {lead.scheduling_attempt_summary}
              </p>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onOpenSchedule(lead)}
              className="w-full sm:w-auto text-xs mt-1"
            >
              Agendar / Atualizar Reunião nas Agendas
            </Button>
          </div>

          {/* Post Capturado pelo Apify */}
          <div className="rounded-xl border p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Post / Contexto Capturado no Grupo
              </h4>
              {lead.source_post_url && (
                <a
                  href={lead.source_post_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
                >
                  <span>Abrir Post</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <p className="text-xs text-foreground whitespace-pre-wrap">
              {lead.source_post_excerpt || "Sem trecho de publicação registrado."}
            </p>
            {lead.ai_qualification_summary && (
              <p className="text-xs text-muted-foreground border-t pt-2">
                <strong>Análise Lindy AI:</strong> {lead.ai_qualification_summary}
              </p>
            )}
          </div>

          {/* Dados Enriquecidos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="detail-phone" className="text-xs">WhatsApp (E.164)</Label>
              <Input id="detail-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5511999999999" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="detail-ig" className="text-xs">Instagram</Label>
              <Input id="detail-ig" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@clinica" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="detail-email" className="text-xs">E-mail</Label>
              <Input id="detail-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@clinica.com.br" />
            </div>
          </div>

          {/* Icebreaker Lindy AI */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="detail-icebreaker" className="text-xs font-semibold">
                Icebreaker Gerado (Lindy AI)
              </Label>
              <Button type="button" variant="ghost" size="sm" onClick={handleCopyIcebreaker} className="h-7 text-xs gap-1">
                <Copy className="h-3 w-3" />
                <span>Copiar</span>
              </Button>
            </div>
            <Textarea
              id="detail-icebreaker"
              value={icebreaker}
              onChange={(e) => setIcebreaker(e.target.value)}
              className="min-h-[90px] text-xs"
            />
          </div>

          {/* Notas Internas */}
          <div className="space-y-1.5">
            <Label htmlFor="detail-notes" className="text-xs font-semibold">Anotações Internas</Label>
            <Textarea
              id="detail-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Registrar retorno do contato, objeções ou interesse..."
              className="min-h-[80px] text-xs"
            />
          </div>
        </div>

        <div className="border-t p-4 flex flex-col sm:flex-row gap-2 bg-card">
          {phone && (
            <Button asChild className="flex-1 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
              <a href={waUrl} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" />
                <span>Enviar no WhatsApp</span>
              </a>
            </Button>
          )}
          <Button type="button" onClick={handleSave} disabled={saving} className="flex-1 min-h-[44px] gap-1.5">
            <Save className="h-4 w-4" />
            <span>{saving ? "Salvando..." : "Salvar Alterações"}</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
