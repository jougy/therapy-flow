import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { buildAgendaIndex, useUnifiedClinicAgenda } from "./clinicAgendaService";
import type { AgendaEventItem } from "@/lib/agenda-events";
import { AGENDA_EVENTS_CACHE_KEY } from "@/lib/agenda-cache";
import { clearLocalCache, setLocalCacheItem } from "@/lib/indexed-db-persister";
import { clearInFlightCoalescer } from "@/lib/local-first/inFlightCoalescer";

const mockEnqueueOfflineMutation = vi.hoisted(() => vi.fn(async () => ({ id: "outbox-1" })));
const mockAgendaSelectCount = vi.hoisted(() => ({ count: 0 }));

const mockRows = vi.hoisted(() => [
  {
    id: "ev-1",
    event_type: "atendimento",
    patient_id: "pat-1",
    scheduled_for: "2099-05-10T10:00:00.000Z",
    status: "confirmado",
    title: "Paciente Um",
    duration_minutes: 50,
  },
  {
    id: "ev-2",
    event_type: "atendimento",
    patient_id: "pat-2",
    scheduled_for: "2099-05-10T14:00:00.000Z",
    status: "aguardando_confirmacao",
    title: "Paciente Dois",
    duration_minutes: 60,
  },
]);

vi.mock("@/lib/local-first/offlineMutationQueue", () => ({
  enqueueOfflineMutation: mockEnqueueOfflineMutation,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => {
      const builder = {
        select: () => {
          mockAgendaSelectCount.count += 1;
          return builder;
        },
        eq: () => builder,
        order: () => Promise.resolve({ data: mockRows, error: null }),
      };
      return builder;
    }),
  },
}));

function createWrapper(client?: QueryClient) {
  const queryClient =
    client ??
    new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("clinicAgendaService", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockAgendaSelectCount.count = 0;
    clearInFlightCoalescer();
    await clearLocalCache();
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("buildAgendaIndex builds O(1) maps for byId, byPatientId, byDayKey and upcomingByPatientId", () => {
    const now = new Date(2026, 4, 10, 10, 0, 0).getTime();
    const events: AgendaEventItem[] = [
      {
        id: "past-1",
        eventType: "atendimento",
        patientId: "p1",
        scheduledFor: "2026-05-10T08:00:00.000Z",
        status: "concluido",
        title: "Passado",
        date: new Date(2026, 4, 10, 8, 0, 0),
        time: "08:00",
      },
      {
        id: "canceled-1",
        eventType: "atendimento",
        patientId: "p1",
        scheduledFor: "2026-05-10T11:00:00.000Z",
        status: "cancelado",
        title: "Cancelado",
        date: new Date(2026, 4, 10, 11, 0, 0),
        time: "11:00",
      },
      {
        id: "future-1",
        eventType: "atendimento",
        patientId: "p1",
        scheduledFor: "2026-05-10T13:00:00.000Z",
        status: "confirmado",
        title: "Próximo",
        date: new Date(2026, 4, 10, 13, 0, 0),
        time: "13:00",
      },
      {
        id: "only-canceled-p2",
        eventType: "atendimento",
        patientId: "p2",
        scheduledFor: "2026-05-11T09:00:00.000Z",
        status: "cancelado",
        title: "P2 Cancelado",
        date: new Date(2026, 4, 11, 9, 0, 0),
        time: "09:00",
      },
    ];

    const index = buildAgendaIndex(events, now);

    expect(index.byId.get("future-1")?.title).toBe("Próximo");
    expect(index.byPatientId.get("p1")?.map((e) => e.id)).toEqual(["past-1", "canceled-1", "future-1"]);
    expect(index.byDayKey.get("2026-05-10")?.length).toBe(3);
    expect(index.byDayKey.get("2026-05-11")?.length).toBe(1);
    expect(index.upcomingByPatientId.get("p1")?.id).toBe("future-1");
    expect(index.upcomingByPatientId.get("p2")).toBeNull();
  });

  it("coalesces concurrent fetches and hydrates instantly from L1 memory cache", async () => {
    await setLocalCacheItem(AGENDA_EVENTS_CACHE_KEY("clinic-1"), mockRows);

    const { result: r1 } = renderHook(() => useUnifiedClinicAgenda("clinic-1", true), {
      wrapper: createWrapper(),
    });
    const { result: r2 } = renderHook(() => useUnifiedClinicAgenda("clinic-1", true), {
      wrapper: createWrapper(),
    });

    // Instant 0ms L1 hydration without loading spinner
    expect(r1.current.isLoading).toBe(false);
    expect(r1.current.events).toHaveLength(2);
    expect(r2.current.events).toHaveLength(2);

    await waitFor(() => {
      expect(mockAgendaSelectCount.count).toBe(1);
    });
  });

  it("performs optimisticUpsertEvent and optimisticDeleteEvent offline via enqueueOfflineMutation", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useUnifiedClinicAgenda("clinic-1", true), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.events).toHaveLength(2);
    });

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });

    await act(async () => {
      await result.current.optimisticUpsertEvent(
        {
          id: "offline-ev-1",
          event_type: "atendimento",
          patient_id: "pat-1",
          scheduled_for: "2099-05-12T09:00:00.000Z",
          status: "aguardando_confirmacao",
          title: "Offline Novo",
        },
        {
          tempId: "offline-ev-1",
          offlineRecord: {
            clinic_id: "clinic-1",
            user_id: "user-1",
            event_type: "atendimento",
            patient_id: "pat-1",
            scheduled_for: "2099-05-12T09:00:00.000Z",
            status: "aguardando_confirmacao",
            title: "Offline Novo",
          },
        }
      );
    });

    await waitFor(() => {
      expect(result.current.index.byId.get("offline-ev-1")?.title).toBe("Offline Novo");
    });
    expect(mockEnqueueOfflineMutation).toHaveBeenCalledWith(
      "upsert_agenda_event",
      expect.objectContaining({ tempId: "offline-ev-1" })
    );

    await act(async () => {
      await result.current.optimisticDeleteEvent("offline-ev-1");
    });

    await waitFor(() => {
      expect(result.current.index.byId.get("offline-ev-1")).toBeUndefined();
    });
    expect(mockEnqueueOfflineMutation).toHaveBeenCalledWith("delete_agenda_event", {
      eventId: "offline-ev-1",
    });
  });
});
