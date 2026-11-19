import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bot,
  CalendarCheck2,
  Copy,
  ExternalLink,
  MessageCircle,
  Save,
  Sparkles,
  UserCheck,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  AUTO_LEAD_CHANNEL_LABELS,
  AUTO_LEAD_MEETING_STATUS_META,
  AUTO_LEAD_STAGE_META,
  WHATSAPP_BOT_PHONE,
  type AutoLeadAffiliateSummary,
  type AutoLeadStage,
  type PlatformAutoLead,
} from "./types";
import { buildLeadWhatsAppUrl } from "./usePlatformAutoLeads";

interface AutoLeadDetailSheetProps {
  lead: PlatformAutoLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  affiliates?: AutoLeadAffiliateSummary[];
  onStageChange?: (leadId: string, stage: AutoLeadStage) => void;
  onAssignAffiliate?: (leadId: string, affiliateId: string | null) => void;
  onSaveDetails: (
    leadId: string,
    patch: Partial<Pick<PlatformAutoLead, "ai_icebreaker_message" | "notes" | "phone" | "email" | "instagram_handle">>
  ) => Promise<boolean>;
  onOpenSchedule: (lead: PlatformAutoLead) => void;
}

const ICP_TIER_LABELS: Record<string, string> = {
  clinic_owner: "Clínica / Consultório",
  solo_physio: "Fisio Solo / Autônomo",
  studio_pilates: "Estúdio de Pilates",
  student: "Estudante / Estágio",
  other: "Outro Perfil",
};

export const AutoLeadDetailSheet: React.FC<AutoLeadDetailSheetProps> = ({
  lead,
  open,
  onOpenChange,
  affiliates = [],
  onStageChange,
  onAssignAffiliate,
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
  const stageMeta = AUTO_LEAD_STAGE_META[lead.stage] || AUTO_LEAD_STAGE_META.new;
  const locationLabel = lead.city && lead.state ? `${lead.city}/${lead.state}` : lead.city || null;
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
      <SheetContent className="w-full max-w-full sm:max-w-xl flex flex-col h-[100dvh] p-0 overflow-x-hidden">
        <SheetHeader className="p-4 sm:p-5 border-b text-left space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 pr-6 min-w-0">
            <SheetTitle className="text-lg leading-tight break-words min-w-0">{lead.full_name}</SheetTitle>
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <Badge variant="outline" className={cn("text-[11px] font-semibold", stageMeta.badgeClass)}>
                {stageMeta.label}
              </Badge>
              <Badge variant="secondary" className="text-[11px] font-medium">
                {ICP_TIER_LABELS[lead.icp_tier] || lead.icp_tier}
              </Badge>
              <Badge variant="outline" className="gap-1 font-bold text-[11px]">
                <Sparkles className="h-3 w-3 text-amber-500" />
                Score {lead.ai_score}/100
              </Badge>
            </div>
          </div>
          <SheetDescription className="text-xs break-words">
            {[
              lead.clinic_name,
              locationLabel,
              lead.facebook_group_name || "Grupo de Facebook",
              lead.specialty || "Fisioterapia",
            ]
              .filter(Boolean)
              .join(" • ")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 sm:space-y-5">
          {/* Status do Lead & Atribuição (Pipeline) */}
          <div className="rounded-xl border bg-card p-3.5 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <UserCheck className="h-4 w-4 text-primary" />
              <span>Status do Lead &amp; Atribuição</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="detail-stage-select" className="text-xs">
                  Estágio do Funil
                </Label>
                <Select
                  value={lead.stage}
                  onValueChange={(val) => onStageChange?.(lead.id, val as AutoLeadStage)}
                  disabled={!onStageChange}
                >
                  <SelectTrigger
                    id="detail-stage-select"
                    data-testid="detail-sheet-stage-select"
                    className={cn("min-h-[44px] sm:min-h-[38px] text-xs font-medium", stageMeta.badgeClass)}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(AUTO_LEAD_STAGE_META).map(([key, meta]) => (
                      <SelectItem key={key} value={key} className="text-xs">
                        {meta.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="detail-affiliate-select" className="text-xs">
                  Afiliado Responsável
                </Label>
                <Select
                  value={lead.assigned_affiliate_id || "unassigned"}
                  onValueChange={(val) => onAssignAffiliate?.(lead.id, val === "unassigned" ? null : val)}
                  disabled={!onAssignAffiliate}
                >
                  <SelectTrigger
                    id="detail-affiliate-select"
                    data-testid="detail-sheet-affiliate-select"
                    className="min-h-[44px] sm:min-h-[38px] text-xs"
                  >
                    <SelectValue placeholder="Sem afiliado (Backoffice)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned" className="text-xs">
                      Sem afiliado (Backoffice)
                    </SelectItem>
                    {affiliates.map((aff) => (
                      <SelectItem key={aff.id} value={aff.id} className="text-xs">
                        {aff.full_name} {aff.coupon_code ? `(${aff.coupon_code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Integração Tripla de Agendas */}
          <div className="rounded-xl border bg-muted/30 p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 min-w-0">
                <CalendarCheck2 className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">Status nas 3 Agendas (Bot / Comercial / Backoffice)</span>
              </h4>
              <Badge variant="outline" className={cn("shrink-0", meetingMeta.badgeClass)}>
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
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onOpenSchedule(lead)}
                className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] text-xs"
              >
                Agendar / Atualizar Reunião nas Agendas
              </Button>
              <Button
                asChild
                type="button"
                size="sm"
                variant="ghost"
                className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] text-xs gap-1.5"
              >
                <a
                  href={`https://wa.me/${WHATSAPP_BOT_PHONE}`}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="detail-sheet-bot-link"
                >
                  <Bot className="h-3.5 w-3.5" />
                  <span>Abrir Bot WhatsApp</span>
                </a>
              </Button>
            </div>
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

          {/* Formas de Contato & Origem */}
          <div className="rounded-xl border p-3.5 space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Formas de Contato &amp; Origem
            </h4>
            <ul className="space-y-1.5 text-xs">
              {lead.facebook_group_name && (
                <li className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Grupo / Origem:</span>
                  {lead.facebook_group_url ? (
                    <a
                      href={lead.facebook_group_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1 truncate font-medium"
                    >
                      <span className="truncate">{lead.facebook_group_name}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-foreground font-medium truncate">{lead.facebook_group_name}</span>
                  )}
                </li>
              )}
              {lead.facebook_profile_url && (
                <li className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Facebook:</span>
                  <a
                    href={lead.facebook_profile_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1 truncate font-medium"
                  >
                    <span className="truncate">{lead.facebook_profile_url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </li>
              )}
              {(instagram || lead.instagram_handle) && (() => {
                const rawHandle = (instagram || lead.instagram_handle || "").trim();
                const cleanHandle = rawHandle.replace(/^@/, "");
                const igUrl = `https://instagram.com/${cleanHandle}`;
                return (
                  <li className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Instagram:</span>
                    <a
                      href={igUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1 truncate font-medium"
                    >
                      <span className="truncate">@{cleanHandle}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </li>
                );
              })()}
              {lead.linkedin_url && (
                <li className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">LinkedIn:</span>
                  <a
                    href={lead.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1 truncate font-medium"
                  >
                    <span className="truncate">{lead.linkedin_url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </li>
              )}
              {lead.website_url && (
                <li className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Site / Outra Rede:</span>
                  <a
                    href={lead.website_url.startsWith("http") ? lead.website_url : `https://${lead.website_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1 truncate font-medium"
                  >
                    <span className="truncate">{lead.website_url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </li>
              )}
              {waUrl && (
                <li className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">WhatsApp:</span>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 truncate font-medium"
                  >
                    <span>{phone}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </li>
              )}
              {(email || lead.email) && (
                <li className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">E-mail:</span>
                  <a
                    href={`mailto:${(email || lead.email || "").trim()}`}
                    className="text-primary hover:underline truncate font-medium"
                  >
                    {(email || lead.email || "").trim()}
                  </a>
                </li>
              )}
            </ul>
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

        <div className="sticky bottom-0 pb-safe z-10 border-t p-4 flex flex-col sm:flex-row gap-2 bg-card">
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
