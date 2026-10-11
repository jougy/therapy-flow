import React from "react";
import {
  Calendar,
  Clock,
  Building,
  Phone,
  Mail,
  Video,
  FileText,
  ExternalLink,
  MessageCircle,
  MoreVertical,
  CheckCircle2,
  CalendarClock,
  XCircle,
  UserX,
  Edit,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { OnboardingMeeting, MeetingStatus } from "./types";
import { MEETING_STATUS_CONFIG } from "./types";
import {
  formatMeetingDateTimeFull,
  formatMeetingRelative,
  formatPhoneDisplay,
  getGoogleCalendarUrl,
  getWhatsAppLink,
} from "./agenda-utils";

interface MeetingCardProps {
  meeting: OnboardingMeeting;
  onStatusChange: (meetingId: string, newStatus: MeetingStatus) => Promise<void>;
  onEditNotes: (meeting: OnboardingMeeting) => void;
  onReschedule: (meeting: OnboardingMeeting) => void;
}

export const MeetingCard: React.FC<MeetingCardProps> = ({
  meeting,
  onStatusChange,
  onEditNotes,
  onReschedule,
}) => {
  const statusCfg = MEETING_STATUS_CONFIG[meeting.status] || MEETING_STATUS_CONFIG.scheduled;
  const StatusIcon = statusCfg.icon;
  const formattedFullDate = formatMeetingDateTimeFull(meeting.scheduled_at);
  const relativeDate = formatMeetingRelative(meeting.scheduled_at);
  const waUrl = getWhatsAppLink(meeting.phone, meeting.lead_name);
  const gcalUrl = getGoogleCalendarUrl(meeting);

  return (
    <Card
      className={cn(
        "group relative overflow-hidden border-l-4 transition-all duration-200 hover:shadow-md bg-card",
        statusCfg.borderClass
      )}
    >
      <CardContent className="p-4 sm:p-5 space-y-3.5">
        {/* Top bar: Lead Info & Status Badge & Actions Menu */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-semibold text-foreground tracking-tight truncate">
                {meeting.lead_name}
              </h3>
              {relativeDate.isToday && (
                <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-300/50 text-[11px] font-bold animate-pulse">
                  Hoje
                </Badge>
              )}
            </div>

            {meeting.clinic_name && (
              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 truncate">
                <Building className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                <span className="font-medium text-foreground/80">{meeting.clinic_name}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Badge
              variant="outline"
              className={cn("px-2.5 py-0.5 text-xs font-medium gap-1.5 border shadow-2xs", statusCfg.badgeClass)}
            >
              <StatusIcon className="h-3.5 w-3.5" />
              <span>{statusCfg.label}</span>
            </Badge>

            {/* Dropdown Menu for Status & Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title="Mais ações da reunião"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => void onStatusChange(meeting.id, "completed")}
                  disabled={meeting.status === "completed"}
                  className="gap-2 text-emerald-600 focus:text-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Marcar como Concluída</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => onReschedule(meeting)}
                  className="gap-2 text-amber-600 focus:text-amber-700"
                >
                  <CalendarClock className="h-4 w-4" />
                  <span>Remarcar Horário</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => void onStatusChange(meeting.id, "no_show")}
                  disabled={meeting.status === "no_show"}
                  className="gap-2 text-purple-600 focus:text-purple-700"
                >
                  <UserX className="h-4 w-4" />
                  <span>Não Compareceu</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => void onStatusChange(meeting.id, "canceled")}
                  disabled={meeting.status === "canceled"}
                  className="gap-2 text-rose-600 focus:text-rose-700"
                >
                  <XCircle className="h-4 w-4" />
                  <span>Cancelar Reunião</span>
                </DropdownMenuItem>

                {meeting.status !== "scheduled" && (
                  <DropdownMenuItem
                    onClick={() => void onStatusChange(meeting.id, "scheduled")}
                    className="gap-2 text-sky-600 focus:text-sky-700"
                  >
                    <Clock className="h-4 w-4" />
                    <span>Reativar como Agendada</span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => onEditNotes(meeting)} className="gap-2">
                  <FileText className="h-4 w-4" />
                  <span>Editar Anotações</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Date, Time & Metadata details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground pt-1 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-foreground font-medium truncate">
            <Calendar className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">{formattedFullDate}</span>
            <span className="text-muted-foreground font-normal shrink-0">
              ({meeting.duration_minutes || 15} min)
            </span>
          </div>

          <div className="flex items-center gap-3 sm:justify-end">
            <div className="flex items-center gap-1.5 truncate">
              <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
              <span className="font-mono text-foreground/90">{formatPhoneDisplay(meeting.phone)}</span>
            </div>

            {meeting.email && (
              <div className="hidden sm:flex items-center gap-1.5 truncate" title={meeting.email}>
                <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                <span className="truncate max-w-[140px]">{meeting.email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Notes preview if exists */}
        {meeting.notes && (
          <div
            onClick={() => onEditNotes(meeting)}
            className="rounded-lg bg-muted/40 hover:bg-muted/70 cursor-pointer p-2.5 text-xs text-muted-foreground border border-border/40 transition-colors duration-150 flex items-start gap-2"
            title="Clique para editar as anotações"
          >
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="line-clamp-2 italic leading-relaxed text-foreground/80 flex-1">
              "{meeting.notes}"
            </p>
            <Edit className="h-3 w-3 text-muted-foreground/60 shrink-0 mt-0.5" />
          </div>
        )}

        {/* Actions row: WhatsApp, Google Calendar, Google Meet, Notes button */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* WhatsApp Direct */}
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 text-xs font-semibold gap-1.5 shadow-2xs"
          >
            <a href={waUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-3.5 w-3.5 text-emerald-600 fill-emerald-500/20 shrink-0" />
              <span>Chamar no WhatsApp</span>
            </a>
          </Button>

          {/* Google Calendar */}
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-sky-300 dark:border-sky-800/80 bg-sky-50/50 dark:bg-sky-950/20 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-950/40 text-xs font-semibold gap-1.5 shadow-2xs"
          >
            <a href={gcalUrl} target="_blank" rel="noopener noreferrer">
              <Calendar className="h-3.5 w-3.5 text-sky-600 shrink-0" />
              <span>Abrir no Google Calendar</span>
              <ExternalLink className="h-3 w-3 opacity-60 ml-0.5" />
            </a>
          </Button>

          {/* Google Meet Room if present */}
          {meeting.meet_url && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-indigo-300 dark:border-indigo-800/80 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 text-xs font-semibold gap-1.5 shadow-2xs"
            >
              <a href={meeting.meet_url} target="_blank" rel="noopener noreferrer">
                <Video className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                <span>Entrar no Meet</span>
                <ExternalLink className="h-3 w-3 opacity-60 ml-0.5" />
              </a>
            </Button>
          )}

          {/* Quick Add Notes button if no notes */}
          {!meeting.notes && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEditNotes(meeting)}
              className="text-xs text-muted-foreground hover:text-foreground gap-1 ml-auto"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Adicionar notas</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
