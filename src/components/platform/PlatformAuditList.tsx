import React from "react";
import type { PlatformAuditEvent } from "./types";
import { eventLabel, formatDateTime } from "./platform-api";

export const PlatformAuditList = ({ events }: { events: PlatformAuditEvent[] }) => (
  <div className="space-y-2">
    {events.length === 0 ? (
      <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        Nenhum evento encontrado.
      </p>
    ) : (
      events.map((event) => (
        <div key={event.id} className="rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-foreground">{eventLabel[event.event_type] ?? event.event_type}</p>
            <span className="text-xs text-muted-foreground">{formatDateTime(event.created_at)}</span>
          </div>
          <p className="mt-1 text-muted-foreground">
            {event.clinic_name ? `${event.clinic_name} • ` : ""}
            {event.actor_name ?? event.actor_email ?? "Sistema"}
          </p>
          {event.reason && <p className="mt-1 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{event.reason}</p>}
        </div>
      ))
    )}
  </div>
);
