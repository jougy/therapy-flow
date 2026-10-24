import React from "react";
import { Clock, Globe, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getRelativeTimezoneComparison } from "@/lib/geo-timezone";
import type { AgendaPatientOption } from "@/lib/agenda-events";
import {
  type AgendaEventItem,
  agendaStatusLabels,
  eventTypeColors,
  eventTypeLabels,
  statusBadgeStyles,
} from "./types";

interface AgendaMonthSideEventCardProps {
  event: AgendaEventItem;
  patient: AgendaPatientOption | null;
  onOpenEditModal: (event: AgendaEventItem) => void;
  compact?: boolean;
}

/**
 * Card de evento no painel lateral contextual do dia selecionado.
 */
export const AgendaMonthSideEventCard = React.memo<AgendaMonthSideEventCardProps>(({
  event,
  patient,
  onOpenEditModal,
  compact = false,
}) => {
  const typeStyle = eventTypeColors[event.eventType];
  const tzComparison = getRelativeTimezoneComparison(event.scheduledFor, event.originTimezone);

  return (
    <div
      onClick={() => onOpenEditModal(event)}
      className={cn(
        "group relative flex flex-col rounded-xl border bg-muted/20 hover:bg-muted/50 hover:border-primary/40 cursor-pointer transition-all duration-150",
        compact ? "p-2 gap-1.5" : "p-3 gap-2"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="flex items-center gap-1 font-bold text-xs text-foreground bg-background px-2 py-0.5 rounded-lg border shadow-2xs shrink-0">
            <Clock className="h-3 w-3 text-muted-foreground" />
            {event.time}
          </span>
          {tzComparison.hasDifference && (
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 border-amber-300 dark:border-amber-700 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium inline-flex items-center gap-1 shrink-0"
              title={tzComparison.tooltip ?? undefined}
            >
              <Globe className="h-2.5 w-2.5" />
              {tzComparison.originTime} ({tzComparison.originTimezoneName})
            </Badge>
          )}
          <Badge
            variant="outline"
            className={cn("text-[9px] px-1.5 py-0 capitalize", statusBadgeStyles[event.status])}
          >
            {agendaStatusLabels[event.status]}
          </Badge>
        </div>

        <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium">
          Editar
        </span>
      </div>

      <div>
        <h4 className="font-semibold text-xs text-foreground truncate">{event.title}</h4>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className={cn("h-1.5 w-1.5 rounded-full", typeStyle.dot)} />
            {eventTypeLabels[event.eventType]}
          </span>
          {patient && (
            <span className="inline-flex items-center gap-1 truncate">
              <User className="h-3 w-3" />
              {patient.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

AgendaMonthSideEventCard.displayName = "AgendaMonthSideEventCard";
