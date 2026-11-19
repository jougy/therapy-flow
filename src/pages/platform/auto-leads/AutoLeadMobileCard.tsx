import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarPlus,
  Facebook,
  Globe,
  Instagram,
  Mail,
  MessageCircle,
  Phone,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  AUTO_LEAD_STAGE_META,
  type AutoLeadAffiliateSummary,
  type AutoLeadChannel,
  type AutoLeadStage,
  type PlatformAutoLead,
} from "./types";
import { buildLeadWhatsAppUrl } from "./usePlatformAutoLeads";

interface AutoLeadMobileCardProps {
  lead: PlatformAutoLead;
  affiliates: AutoLeadAffiliateSummary[];
  isSelected: boolean;
  onToggleSelect: (leadId: string) => void;
  onStageChange: (leadId: string, stage: AutoLeadStage) => void;
  onOpenSchedule: (lead: PlatformAutoLead) => void;
  onOpenDetail: (lead: PlatformAutoLead) => void;
}

const ICP_SHORT_LABELS: Record<string, string> = {
  clinic_owner: "Clínica",
  solo_physio: "Solo",
  studio_pilates: "Pilates",
  student: "Estudante",
  other: "Outro",
};

const CHANNEL_SHORT_LABELS: Record<AutoLeadChannel, string> = {
  whatsapp_bot_5511960474566: "Bot",
  whatsapp_commercial_5511980113936: "Comercial",
  backoffice_agenda: "Backoffice",
};

export function formatLeadScheduledLabel(iso?: string | null): string {
  if (!iso) return "";
  try {
    return format(new Date(iso), "dd/MM 'às' HH:mm", { locale: ptBR });
  } catch {
    return iso;
  }
}

export function getLeadScoreColor(score: number): string {
  if (score >= 80) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/50";
  if (score >= 60) return "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-400/50";
  return "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-300/60";
}

function normalizeSafeExternalUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function buildInstagramUrl(handle?: string | null): string | null {
  if (!handle) return null;
  const trimmed = handle.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    return normalizeSafeExternalUrl(trimmed);
  }
  const cleanHandle = trimmed.replace(/^@/, "");
  return cleanHandle ? `https://instagram.com/${encodeURIComponent(cleanHandle)}` : null;
}

export const AutoLeadMobileCard: React.FC<AutoLeadMobileCardProps> = ({
  lead,
  affiliates,
  isSelected,
  onToggleSelect,
  onStageChange,
  onOpenSchedule,
  onOpenDetail,
}) => {
  const stageMeta = AUTO_LEAD_STAGE_META[lead.stage] || AUTO_LEAD_STAGE_META.new;
  const waUrl = buildLeadWhatsAppUrl(lead);
  const igUrl = buildInstagramUrl(lead.instagram_handle);
  const fbUrl = normalizeSafeExternalUrl(lead.facebook_profile_url);
  const siteUrl = normalizeSafeExternalUrl(lead.website_url || lead.linkedin_url);

  const assignedAffiliate = lead.assigned_affiliate_id
    ? affiliates.find((aff) => aff.id === lead.assigned_affiliate_id)
    : undefined;

  const locationLabel =
    lead.city && lead.state ? `${lead.city}/${lead.state}` : lead.city || null;
  const subtitleText =
    [lead.clinic_name, locationLabel, lead.facebook_group_name]
      .filter(Boolean)
      .join(" • ") || "Grupo Facebook";

  const hasConfirmedAgenda = ["scheduled", "rescheduled", "completed"].includes(
    lead.meeting_status
  );
  const hasAgendaAttempt = ["attempted_bot", "handed_off_commercial"].includes(
    lead.meeting_status
  );
  const agendaChannelShort = lead.meeting_channel
    ? CHANNEL_SHORT_LABELS[lead.meeting_channel]
    : null;

  return (
    <article
      data-testid={`mobile-lead-card-${lead.id}`}
      className={cn(
        "w-full max-w-full min-w-0 overflow-x-hidden rounded-xl border bg-card p-3 space-y-2.5 shadow-2xs transition-colors",
        isSelected && "border-primary bg-primary/5"
      )}
    >
      {/* Faixa 1: Identidade, Local/Origem, Perfil ICP & Score */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(lead.id)}
            className="mt-0.5 shrink-0"
            aria-label={`Selecionar ${lead.full_name}`}
          />
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onOpenDetail(lead)}
              className="font-semibold text-sm text-foreground hover:text-primary text-left truncate block w-full"
            >
              {lead.full_name}
            </button>
            <p className="text-xs text-muted-foreground truncate" title={subtitleText}>
              {subtitleText}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 font-medium">
            {ICP_SHORT_LABELS[lead.icp_tier] || "Outro"}
          </Badge>
          <Badge
            variant="outline"
            className={cn("font-bold text-xs px-1.5 py-0.5 gap-0.5", getLeadScoreColor(lead.ai_score))}
          >
            <Sparkles className="h-2.5 w-2.5 shrink-0" />
            <span>{lead.ai_score}</span>
          </Badge>
        </div>
      </div>

      {/* Faixa 2: Status Interativo, Afiliado/Agenda Compacta & Ícones de Canais */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
          <Select
            value={lead.stage}
            onValueChange={(val) => onStageChange(lead.id, val as AutoLeadStage)}
          >
            <SelectTrigger
              data-testid={`mobile-stage-select-${lead.id}`}
              aria-label={`Estágio de ${lead.full_name}`}
              className={cn(
                "h-7 text-[11px] font-semibold px-2.5 rounded-full w-auto max-w-[155px] border gap-1",
                stageMeta.badgeClass
              )}
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

          {assignedAffiliate && (
            <button
              type="button"
              onClick={() => onOpenDetail(lead)}
              title={`Afiliado: ${assignedAffiliate.full_name}`}
              className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground max-w-[125px] truncate hover:bg-muted"
            >
              <UserCheck className="h-3 w-3 shrink-0 text-primary" />
              <span className="truncate">
                {assignedAffiliate.coupon_code || assignedAffiliate.full_name}
              </span>
            </button>
          )}

          {hasConfirmedAgenda ? (
            <Badge
              variant="outline"
              className="gap-1 text-[10px] font-semibold px-2 py-0.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/50 max-w-full"
            >
              <CalendarCheck2 className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {formatLeadScheduledLabel(lead.meeting_scheduled_at)}
                {agendaChannelShort ? ` • ${agendaChannelShort}` : ""}
              </span>
            </Badge>
          ) : hasAgendaAttempt ? (
            <Badge
              variant="outline"
              className="gap-1 text-[10px] font-semibold px-2 py-0.5 bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-400/50"
            >
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>{lead.meeting_status === "attempted_bot" ? "Tentou Bot" : "Tentou Com."}</span>
            </Badge>
          ) : (
            <span className="text-[11px] text-muted-foreground">Sem agenda</span>
          )}
        </div>

        {/* Matriz compacta de canais disponíveis */}
        <div className="flex items-center gap-1 shrink-0" aria-label="Canais disponíveis">
          {lead.phone && (
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              title={`WhatsApp: ${lead.phone}`}
              aria-label={`Abrir WhatsApp de ${lead.full_name}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            >
              <Phone className="h-3.5 w-3.5" />
            </a>
          )}
          {igUrl && (
            <a
              href={igUrl}
              target="_blank"
              rel="noreferrer"
              title={`Instagram: ${lead.instagram_handle}`}
              aria-label={`Abrir Instagram de ${lead.full_name}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-pink-500/30 bg-pink-500/10 text-pink-600 dark:text-pink-400"
            >
              <Instagram className="h-3.5 w-3.5" />
            </a>
          )}
          {fbUrl && (
            <a
              href={fbUrl}
              target="_blank"
              rel="noreferrer"
              title="Perfil Facebook"
              aria-label={`Abrir Facebook de ${lead.full_name}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
            >
              <Facebook className="h-3.5 w-3.5" />
            </a>
          )}
          {lead.email && (
            <a
              href={`mailto:${lead.email.trim()}`}
              title={`E-mail: ${lead.email}`}
              aria-label={`Enviar e-mail para ${lead.full_name}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400"
            >
              <Mail className="h-3.5 w-3.5" />
            </a>
          )}
          {siteUrl && (
            <a
              href={siteUrl}
              target="_blank"
              rel="noreferrer"
              title="Site ou LinkedIn"
              aria-label={`Abrir site ou LinkedIn de ${lead.full_name}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border bg-muted text-foreground"
            >
              <Globe className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Faixa 3: Ações Touch-Friendly (>= 44px) */}
      <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t min-w-0">
        {lead.phone && (
          <Button
            asChild
            size="sm"
            className="flex-1 min-h-[44px] min-w-[110px] bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          >
            <a href={waUrl} target="_blank" rel="noreferrer" data-testid={`mobile-wa-btn-${lead.id}`}>
              <MessageCircle className="h-4 w-4 shrink-0" />
              <span>WhatsApp</span>
            </a>
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="quick-schedule-lead-btn"
          onClick={() => onOpenSchedule(lead)}
          className="min-h-[44px] min-w-[44px] px-3 gap-1.5 text-xs shrink-0"
        >
          <CalendarPlus className="h-4 w-4 shrink-0" />
          <span>{hasConfirmedAgenda ? "Agenda" : "Agendar"}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid={`mobile-detail-btn-${lead.id}`}
          onClick={() => onOpenDetail(lead)}
          className={cn("min-h-[44px] px-3 gap-1.5 text-xs", lead.phone ? "shrink-0" : "flex-1")}
        >
          <UserCheck className="h-4 w-4 shrink-0" />
          <span>Detalhes</span>
        </Button>
      </div>
    </article>
  );
};
