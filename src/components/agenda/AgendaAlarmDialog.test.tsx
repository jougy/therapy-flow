import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgendaAlarmDialog, type AgendaAlarmEvent } from "./AgendaAlarmDialog";
import * as soundModule from "@/lib/notification-sounds";

const navigateMock = vi.fn();
const toastMock = vi.fn();
let canScheduleWrite = true;

const supabaseUpdateMock = vi.fn();
const supabaseEqMock = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    can: (cap: string) => (cap === "schedule.write" ? canScheduleWrite : true),
    clinic: {
      id: "clinic-1",
      name: "Clínica PluriHealth",
      brand_name: "PluriHealth Matriz",
      route_key: "pluri-matriz",
    },
    user: { id: "user-1" },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      update: supabaseUpdateMock.mockReturnValue({
        eq: supabaseEqMock.mockResolvedValue({ error: null }),
      }),
    })),
  },
}));

vi.mock("@/lib/agenda-events", () => ({
  formatSupabaseErrorMessage: vi.fn((_err, fallback) => fallback),
  notifyAgendaEventsUpdated: vi.fn(),
}));

describe("AgendaAlarmDialog", () => {
  let startAlarmLoopSpy: ReturnType<typeof vi.spyOn>;
  let stopAlarmLoopSpy: ReturnType<typeof vi.spyOn>;

  const defaultEvent: AgendaAlarmEvent = {
    id: "event-101",
    title: "Sessão Fisioterapia Coluna",
    scheduledFor: "2026-10-17T14:30:00.000Z",
    eventType: "atendimento",
    patientId: "pac-202",
    patientName: "Carlos Drummond",
    clinicName: "PluriHealth Matriz",
    durationMinutes: 60,
    time: "14:30",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    canScheduleWrite = true;
    startAlarmLoopSpy = vi.spyOn(soundModule, "startAlarmLoop").mockReturnValue(
      Object.assign(vi.fn(), { stop: vi.fn() }),
    );
    stopAlarmLoopSpy = vi.spyOn(soundModule, "stopAlarmLoop").mockImplementation(() => {});
  });

  it("renders appointment details and starts alarm loop when open", () => {
    render(
      <AgendaAlarmDialog
        open={true}
        event={defaultEvent}
        soundKey="urgent_alarm"
      />,
    );

    expect(screen.getByTestId("alarm-title")).toHaveTextContent("Sessão Fisioterapia Coluna");
    expect(screen.getByTestId("alarm-time")).toHaveTextContent("14:30");
    expect(screen.getByTestId("alarm-patient")).toHaveTextContent("Carlos Drummond");
    expect(screen.getByTestId("alarm-clinic")).toHaveTextContent("PluriHealth Matriz");

    expect(startAlarmLoopSpy).toHaveBeenCalledWith({
      soundKey: "urgent_alarm",
      maxLoops: 4,
    });
  });

  it("stops alarm loop on unmount or close", () => {
    const { unmount } = render(
      <AgendaAlarmDialog
        open={true}
        event={defaultEvent}
      />,
    );

    unmount();
    expect(stopAlarmLoopSpy).toHaveBeenCalled();
  });

  it("handles [Confirmar presença e iniciar atendimento] action", async () => {
    const onOpenChange = vi.fn();
    render(
      <AgendaAlarmDialog
        open={true}
        event={defaultEvent}
        onOpenChange={onOpenChange}
      />,
    );

    const confirmButton = screen.getByRole("button", {
      name: /confirmar presença e iniciar atendimento/i,
    });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(stopAlarmLoopSpy).toHaveBeenCalled();
      expect(supabaseUpdateMock).toHaveBeenCalledWith({ status: "confirmado" });
      expect(supabaseEqMock).toHaveBeenCalledWith("id", "event-101");
      expect(navigateMock).toHaveBeenCalledWith("/sessao/nova?pacienteId=pac-202");
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("handles [Ver paciente] action and navigates to /pacientes/:id", () => {
    const onOpenChange = vi.fn();
    render(
      <AgendaAlarmDialog
        open={true}
        event={defaultEvent}
        onOpenChange={onOpenChange}
      />,
    );

    const viewPatientButton = screen.getByRole("button", {
      name: /ver paciente/i,
    });
    fireEvent.click(viewPatientButton);

    expect(stopAlarmLoopSpy).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith("/pacientes/pac-202");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("handles [Cancelar atendimento] action with internal confirmation dialog", async () => {
    const onOpenChange = vi.fn();
    render(
      <AgendaAlarmDialog
        open={true}
        event={defaultEvent}
        onOpenChange={onOpenChange}
      />,
    );

    const cancelTrigger = screen.getByRole("button", {
      name: /cancelar atendimento/i,
    });
    fireEvent.click(cancelTrigger);

    // Diálogo interno de confirmação deve aparecer
    expect(
      screen.getByText("Tem certeza que deseja cancelar o atendimento?"),
    ).toBeInTheDocument();

    const confirmCancelButton = screen.getByRole("button", {
      name: /confirmar cancelamento/i,
    });
    fireEvent.click(confirmCancelButton);

    await waitFor(() => {
      expect(stopAlarmLoopSpy).toHaveBeenCalled();
      expect(supabaseUpdateMock).toHaveBeenCalledWith({ status: "cancelado" });
      expect(supabaseEqMock).toHaveBeenCalledWith("id", "event-101");
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("handles [Fechar Alerta] centered button", () => {
    const onOpenChange = vi.fn();
    const onDismiss = vi.fn();
    render(
      <AgendaAlarmDialog
        open={true}
        event={defaultEvent}
        onOpenChange={onOpenChange}
        onDismiss={onDismiss}
      />,
    );

    const closeButton = screen.getByRole("button", {
      name: /fechar alerta/i,
    });
    fireEvent.click(closeButton);

    expect(stopAlarmLoopSpy).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDismiss).toHaveBeenCalled();
  });

  it("does not show attendance actions for non-atendimento event type", () => {
    const nonAttendanceEvent: AgendaAlarmEvent = {
      id: "event-303",
      title: "Reunião de Alinhamento Semanal",
      scheduledFor: "2026-10-17T16:00:00.000Z",
      eventType: "reuniao",
      clinicName: "PluriHealth Matriz",
    };

    render(
      <AgendaAlarmDialog
        open={true}
        event={nonAttendanceEvent}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /confirmar presença e iniciar atendimento/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /ver paciente/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /cancelar atendimento/i }),
    ).not.toBeInTheDocument();

    // O botão Fechar Alerta continua presente
    expect(screen.getByRole("button", { name: /fechar alerta/i })).toBeInTheDocument();
  });

  it("blocks confirmation when user lacks schedule.write capability", async () => {
    canScheduleWrite = false;

    render(
      <AgendaAlarmDialog
        open={true}
        event={defaultEvent}
      />,
    );

    const confirmButton = screen.getByRole("button", {
      name: /confirmar presença e iniciar atendimento/i,
    });
    fireEvent.click(confirmButton);

    expect(supabaseUpdateMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Permissão insuficiente",
        variant: "destructive",
      }),
    );
  });
});
