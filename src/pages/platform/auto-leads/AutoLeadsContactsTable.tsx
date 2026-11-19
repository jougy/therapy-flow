import React from "react";
import {
  AlertTriangle,
  Bot,
  CalendarCheck2,
  CalendarPlus,
  ExternalLink,
  Instagram,
  Mail,
  MessageCircle,
  Phone,
  Sparkles,
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
  AUTO_LEAD_CHANNEL_LABELS,
  AUTO_LEAD_MEETING_STATUS_META,
  AUTO_LEAD_STAGE_META,
  WHATSAPP_BOT_PHONE,
  type AutoLeadAffiliateSummary,
  type AutoLeadStage,
  type PlatformAutoLead,
} from "./types";
import { buildLeadWhatsAppUrl } from "./usePlatformAutoLeads";
import {
  AutoLeadMobileCard,
  formatLeadScheduledLabel,
  getLeadScoreColor,
} from "./AutoLeadMobileCard";

interface AutoLeadsContactsTableProps {
  leads: PlatformAutoLead[];
  affiliates: AutoLeadAffiliateSummary[];
  selectedIds: string[];
  onToggleSelect: (leadId: string) => void;
  onToggleSelectAll: () => void;
  onStageChange: (leadId: string, stage: AutoLeadStage) => void;
  onAssignAffiliate: (leadId: string, affiliateId: string | null) => void;
  onOpenSchedule: (lead: PlatformAutoLead) => void;
  onOpenDetail: (lead: PlatformAutoLead) => void;
}

export const AutoLeadsContactsTable: React.FC<AutoLeadsContactsTableProps> = ({
  leads,
  affiliates,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onStageChange,
  onAssignAffiliate,
  onOpenSchedule,
  onOpenDetail,
}) => {
  const allSelected = leads.length > 0 && selectedIds.length === leads.length;

  const renderAgendaCell = (lead: PlatformAutoLead) => {
    const meta = AUTO_LEAD_MEETING_STATUS_META[lead.meeting_status] || AUTO_LEAD_MEETING_STATUS_META.none;
    const hasConfirmed = ["scheduled", "rescheduled", "completed"].includes(lead.meeting_status);
    const hasAttempt = ["attempted_bot", "handed_off_commercial"].includes(lead.meeting_status);

    if (hasConfirmed) {
      return (
        <div className="space-y-1 text-xs min-w-[200px]">
          <Badge variant="outline" className={cn("gap-1 font-semibold", meta.badgeClass)}>
            <CalendarCheck2 className="h-3 w-3 shrink-0" />
            <span>{formatLeadScheduledLabel(lead.meeting_scheduled_at)}</span>
          </Badge>
          {lead.meeting_booked_by && (
            <p className="text-[11px] font-medium text-foreground truncate" title={lead.meeting_booked_by}>
              Quem marcou: <span className="text-primary">{lead.meeting_booked_by}</span>
            </p>
          )}
          {lead.meeting_channel && (
            <p className="text-[11px] text-muted-foreground truncate">
              Canal: {AUTO_LEAD_CHANNEL_LABELS[lead.meeting_channel] || lead.meeting_channel}
            </p>
          )}
        </div>
      );
    }

    if (hasAttempt) {
      return (
        <div className="space-y-1 text-xs min-w-[200px]">
          <Badge variant="outline" className={cn("gap-1 font-semibold", meta.badgeClass)}>
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span>{meta.label}</span>
          </Badge>
          {lead.last_scheduling_attempt_at && (
            <p className="text-[11px] text-muted-foreground">
              Tentativa: {formatLeadScheduledLabel(lead.last_scheduling_attempt_at)}
            </p>
          )}
          {lead.scheduling_attempt_summary && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300 line-clamp-2">
              {lead.scheduling_attempt_summary}
            </p>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="quick-schedule-lead-btn"
            onClick={() => onOpenSchedule(lead)}
            className="h-7 px-2 text-[11px] gap-1 text-primary"
          >
            <CalendarPlus className="h-3 w-3" />
            <span>Confirmar Horário</span>
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-1 min-w-[160px]">
        <span className="text-[11px] text-muted-foreground block">Sem tentativa registrada</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="quick-schedule-lead-btn"
          onClick={() => onOpenSchedule(lead)}
          className="h-8 px-2.5 text-xs gap-1"
        >
          <CalendarPlus className="h-3.5 w-3.5" />
          <span>Agendar Reunião</span>
        </Button>
      </div>
    );
  };

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhum lead encontrado com os filtros atuais. Use <strong>+ Adicionar / Importar</strong> ou execute a skill <code>auto-lead-hunter</code> no Antigravity para alimentar a tabela.
      </div>
    );
  }

  return (
    <div data-testid="auto-leads-contacts-table" className="w-full max-w-full min-w-0 space-y-3">
      {/* Desktop Table with mandatory horizontal scroll shield */}
      <div className="hidden md:block rounded-xl border bg-card shadow-2xs">
        <div className="w-full overflow-x-auto touch-pan-x">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-semibold text-muted-foreground">
                <th className="p-3 w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={onToggleSelectAll}
                    aria-label="Selecionar todos os leads"
                  />
                </th>
                <th className="p-3 min-w-[220px]">Contato & Canais</th>
                <th className="p-3 min-w-[210px]">Origem (Grupo FB & Post)</th>
                <th className="p-3 min-w-[110px]">Score Lindy AI</th>
                <th className="p-3 min-w-[220px]">Agenda & Tentativas WhatsApp</th>
                <th className="p-3 min-w-[160px]">Estágio & Afiliado</th>
                <th className="p-3 text-right min-w-[150px]">Ações 1-Click</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {leads.map((lead) => {
                const isSelected = selectedIds.includes(lead.id);
                const waUrl = buildLeadWhatsAppUrl(lead);
                const stageMeta = AUTO_LEAD_STAGE_META[lead.stage] || AUTO_LEAD_STAGE_META.new;

                return (
                  <tr key={lead.id} className={cn("hover:bg-muted/20 transition-colors", isSelected && "bg-primary/5")}>
                    <td className="p-3 align-top">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelect(lead.id)}
                        aria-label={`Selecionar ${lead.full_name}`}
                      />
                    </td>
                    <td className="p-3 align-top space-y-1">
                      <button
                        type="button"
                        onClick={() => onOpenDetail(lead)}
                        className="font-semibold text-foreground hover:text-primary text-left block truncate max-w-[220px]"
                      >
                        {lead.full_name}
                      </button>
                      {(lead.clinic_name || lead.city) && (
                        <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                          {[lead.clinic_name, lead.city && lead.state ? `${lead.city}/${lead.state}` : lead.city]
                            .filter(Boolean)
                            .join(" • ")}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-0.5">
                        {lead.phone && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-medium">
                            <Phone className="h-3 w-3" />
                            {lead.phone}
                          </span>
                        )}
                        {lead.instagram_handle && (
                          <span className="inline-flex items-center gap-1">
                            <Instagram className="h-3 w-3 text-pink-600" />
                            {lead.instagram_handle}
                          </span>
                        )}
                        {lead.email && (
                          <span className="inline-flex items-center gap-1 truncate max-w-[170px]">
                            <Mail className="h-3 w-3" />
                            {lead.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 align-top space-y-1 max-w-[240px]">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[11px] truncate max-w-[200px]">
                          {lead.facebook_group_name || "Grupo Facebook"}
                        </Badge>
                      </div>
                      {lead.source_post_excerpt && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          "{lead.source_post_excerpt}"
                        </p>
                      )}
                      {lead.facebook_profile_url && (
                        <a
                          href={lead.facebook_profile_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                        >
                          <span>Perfil FB</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </td>
                    <td className="p-3 align-top">
                      <Badge variant="outline" className={cn("font-bold gap-1", getLeadScoreColor(lead.ai_score))}>
                        <Sparkles className="h-3 w-3" />
                        {lead.ai_score}/100
                      </Badge>
                    </td>
                    <td className="p-3 align-top">{renderAgendaCell(lead)}</td>
                    <td className="p-3 align-top space-y-1.5">
                      <Select
                        value={lead.stage}
                        onValueChange={(val) => onStageChange(lead.id, val as AutoLeadStage)}
                      >
                        <SelectTrigger className={cn("h-8 text-xs font-medium", stageMeta.badgeClass)}>
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
                      <Select
                        value={lead.assigned_affiliate_id || "unassigned"}
                        onValueChange={(val) => onAssignAffiliate(lead.id, val === "unassigned" ? null : val)}
                      >
                        <SelectTrigger className="h-7 text-[11px]">
                          <SelectValue placeholder="Sem afiliado" />
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
                    </td>
                    <td className="p-3 align-top text-right space-y-1.5">
                      <div className="flex flex-col items-end gap-1.5">
                        {lead.phone && (
                          <Button
                            asChild
                            size="sm"
                            className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <a href={waUrl} target="_blank" rel="noreferrer" data-testid={`wa-icebreaker-btn-${lead.id}`}>
                              <MessageCircle className="h-3.5 w-3.5" />
                              <span>WhatsApp 1-Click</span>
                            </a>
                          </Button>
                        )}
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenDetail(lead)}
                            className="h-7 px-2 text-[11px]"
                          >
                            Raio-X
                          </Button>
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11px]"
                            title="Abrir conversa direta com o Bot (+55 11 96047-4566)"
                          >
                            <a href={`https://wa.me/${WHATSAPP_BOT_PHONE}`} target="_blank" rel="noreferrer">
                              <Bot className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards (Zero Horizontal Overflow, 44px Touch Targets) */}
      <div className="md:hidden space-y-3">
        {leads.map((lead) => (
          <AutoLeadMobileCard
            key={lead.id}
            lead={lead}
            affiliates={affiliates}
            isSelected={selectedIds.includes(lead.id)}
            onToggleSelect={onToggleSelect}
            onStageChange={onStageChange}
            onOpenSchedule={onOpenSchedule}
            onOpenDetail={onOpenDetail}
          />
        ))}
      </div>
    </div>
  );
};
