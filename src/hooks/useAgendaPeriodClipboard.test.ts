import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAgendaPeriodClipboard } from "./useAgendaPeriodClipboard";
import type { AgendaEventItem } from "@/components/agenda";

const supabaseMocks = vi.hoisted(() => ({
  insert: vi.fn(),
  from: vi.fn(),
}));

const toastMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: supabaseMocks.from,
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: any[]) => toastMock(...args),
}));

describe("useAgendaPeriodClipboard", () => {
  const mockUser = { id: "usr_12345" };
  const mockClinicId = "clinic_abcde";
  const refDate = new Date(2026, 9, 15, 10, 0, 0); // 15 de Outubro de 2026

  const sampleEvent1: AgendaEventItem = {
    id: "ev-1",
    eventType: "atendimento",
    patientId: "pat_99",
    scheduledFor: new Date(2026, 9, 15, 14, 0, 0).toISOString(),
    status: "confirmado",
    title: "Atendimento Especial <script>alert(1)</script>",
    date: new Date(2026, 9, 15, 14, 0, 0),
    time: "14:00",
    durationMinutes: 50,
  };

  const sampleEvent2: AgendaEventItem = {
    id: "ev-2",
    eventType: "reuniao",
    patientId: null,
    scheduledFor: new Date(2026, 9, 16, 9, 30, 0).toISOString(),
    status: "aguardando_confirmacao",
    title: "Reunião de Equipe",
    date: new Date(2026, 9, 16, 9, 30, 0),
    time: "09:30",
    durationMinutes: 60,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.from.mockReturnValue({
      insert: supabaseMocks.insert,
    });
  });

  it("copies events matching current day and notifies user", () => {
    const setEvents = vi.fn();
    const { result } = renderHook(() =>
      useAgendaPeriodClipboard({
        user: mockUser,
        effectiveClinicId: mockClinicId,
        viewMode: "day",
        selectedDate: refDate,
        events: [sampleEvent1, sampleEvent2],
        setEvents,
        can: () => true,
      })
    );

    act(() => {
      result.current.copyCurrentPeriod();
    });

    expect(result.current.copiedPeriod).not.toBeNull();
    expect(result.current.copiedPeriod?.events).toHaveLength(1);
    expect(result.current.copiedPeriod?.events[0].id).toBe("ev-1");
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("Dia copiado"),
      })
    );
  });

  it("clears clipboard when cancelCopy is called", () => {
    const setEvents = vi.fn();
    const { result } = renderHook(() =>
      useAgendaPeriodClipboard({
        user: mockUser,
        effectiveClinicId: mockClinicId,
        viewMode: "day",
        selectedDate: refDate,
        events: [sampleEvent1],
        setEvents,
        can: () => true,
      })
    );

    act(() => {
      result.current.copyCurrentPeriod();
    });
    expect(result.current.copiedPeriod).not.toBeNull();

    act(() => {
      result.current.cancelCopy();
    });
    expect(result.current.copiedPeriod).toBeNull();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Cópia cancelada",
      })
    );
  });

  it("blocks paste when user lacks schedule.write permission (RBAC)", async () => {
    const setEvents = vi.fn();
    const { result } = renderHook(() =>
      useAgendaPeriodClipboard({
        user: mockUser,
        effectiveClinicId: mockClinicId,
        viewMode: "day",
        selectedDate: refDate,
        events: [sampleEvent1],
        setEvents,
        can: (cap: string) => cap !== "schedule.write",
      })
    );

    act(() => {
      result.current.copyCurrentPeriod();
    });

    await act(async () => {
      await result.current.pastePeriod();
    });

    expect(supabaseMocks.insert).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Permissão negada",
        variant: "destructive",
      })
    );
  });

  it("sanitizes payloads and inserts copied events into new period", async () => {
    const nextWeekDate = new Date(2026, 9, 22, 10, 0, 0); // 1 semana depois
    const setEvents = vi.fn();

    supabaseMocks.insert.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [
          {
            id: "ev-created-1",
            event_type: "atendimento",
            patient_id: "pat_99",
            scheduled_for: new Date(2026, 9, 22, 14, 0, 0).toISOString(),
            status: "aguardando_confirmacao",
            title: "Atendimento Especial alert(1)",
            duration_minutes: 50,
          },
        ],
        error: null,
      }),
    });

    const { result, rerender } = renderHook(
      ({ selectedDate }) =>
        useAgendaPeriodClipboard({
          user: mockUser,
          effectiveClinicId: mockClinicId,
          viewMode: "day",
          selectedDate,
          events: [sampleEvent1],
          setEvents,
          can: () => true,
        }),
      { initialProps: { selectedDate: refDate } }
    );

    // 1. Copiar no dia de origem (refDate)
    act(() => {
      result.current.copyCurrentPeriod();
    });
    expect(result.current.copiedPeriod).not.toBeNull();

    // 2. Navegar para a próxima semana
    rerender({ selectedDate: nextWeekDate });

    // 3. Colar no novo período
    await act(async () => {
      await result.current.pastePeriod();
    });

    expect(supabaseMocks.insert).toHaveBeenCalledTimes(1);
    const insertedPayload = supabaseMocks.insert.mock.calls[0][0];
    expect(insertedPayload).toHaveLength(1);
    expect(insertedPayload[0].status).toBe("aguardando_confirmacao");
    expect(insertedPayload[0].clinic_id).toBe("clinic_abcde");
    expect(insertedPayload[0].user_id).toBe("usr_12345");
    expect(insertedPayload[0].duration_minutes).toBe(50);
    expect(setEvents).toHaveBeenCalled();
  });

  it("resets isPasting state safely when insert throws an error", async () => {
    const setEvents = vi.fn();

    supabaseMocks.insert.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database connection failed", code: "500" },
      }),
    });

    const { result } = renderHook(() =>
      useAgendaPeriodClipboard({
        user: mockUser,
        effectiveClinicId: mockClinicId,
        viewMode: "day",
        selectedDate: refDate,
        events: [sampleEvent1],
        setEvents,
        can: () => true,
      })
    );

    act(() => {
      result.current.copyCurrentPeriod();
    });

    await act(async () => {
      await result.current.pastePeriod();
    });

    expect(result.current.isPasting).toBe(false);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Erro ao colar agendamentos",
        variant: "destructive",
      })
    );
  });
});
