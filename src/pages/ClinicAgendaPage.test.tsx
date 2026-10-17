import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ClinicAgendaPage from "./ClinicAgendaPage";

if (typeof window !== "undefined" && !window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
}

const mockUser = { id: "user-test" };
const mockClinic = { route_key: "testesteseqsadqwdas", name: "Clínica Teste" };

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mockUser,
    clinic: mockClinic,
    clinicId: "clinic-test-id",
    loading: false,
    can: () => true,
  }),
}));

const mockEvents = [
  {
    id: "ev-1",
    event_type: "atendimento",
    patient_id: "patient-1",
    scheduled_for: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    status: "confirmado",
    title: "Atendimento João",
  },
  {
    id: "ev-2",
    event_type: "reuniao",
    patient_id: null,
    scheduled_for: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    status: "aguardando_confirmacao",
    title: "Reunião Clínica",
  },
];

const mockPatients = [
  { id: "patient-1", name: "João da Silva" },
  { id: "patient-2", name: "Maria Santos" },
];

const mockInsert = vi.fn().mockReturnValue({
  select: vi.fn().mockResolvedValue({
    data: [
      {
        id: "ev-pasted-1",
        event_type: "atendimento",
        patient_id: "patient-1",
        scheduled_for: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        status: "aguardando_confirmacao",
        title: "Atendimento João",
        duration_minutes: 60,
      },
    ],
    error: null,
  }),
});

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        insert: mockInsert,
        order: vi.fn().mockImplementation(() => {
          if (table === "agenda_events") {
            return Promise.resolve({ data: mockEvents, error: null });
          }
          if (table === "patients") {
            return Promise.resolve({ data: mockPatients, error: null });
          }
          return Promise.resolve({ data: [], error: null });
        }),
      })),
    },
  };
});

describe("ClinicAgendaPage", () => {
  it("renders page header and actions", async () => {
    render(
      <MemoryRouter initialEntries={["/designlab/clinica/testesteseqsadqwdas/agenda"]}>
        <Routes>
          <Route path="/designlab/clinica/:clinicKey/agenda" element={<ClinicAgendaPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Agenda da Clínica/i)).toBeInTheDocument();
  });

  it("renders page header and actions in production clinic route", async () => {
    render(
      <MemoryRouter initialEntries={["/clinica/testesteseqsadqwdas/agenda"]}>
        <Routes>
          <Route path="/clinica/:clinicKey/agenda" element={<ClinicAgendaPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Agenda da Clínica/i)).toBeInTheDocument();
  });

  it("renders day view with 3 shifts (Manhã, Tarde, Noite) by default", async () => {
    render(
      <MemoryRouter initialEntries={["/clinica/testesteseqsadqwdas/agenda"]}>
        <Routes>
          <Route path="/clinica/:clinicKey/agenda" element={<ClinicAgendaPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Manhã")).toBeInTheDocument();
    expect(screen.getByText("Tarde")).toBeInTheDocument();
    expect(screen.getByText("Noite")).toBeInTheDocument();
  });

  it("switches to month view when clicking 'Mês'", async () => {
    render(
      <MemoryRouter initialEntries={["/clinica/testesteseqsadqwdas/agenda"]}>
        <Routes>
          <Route path="/clinica/:clinicKey/agenda" element={<ClinicAgendaPage />} />
        </Routes>
      </MemoryRouter>
    );

    const monthButton = await screen.findByRole("button", { name: /^mês$/i });
    fireEvent.click(monthButton);

    // Month view displays contextual panel with "Dia Selecionado" and "Agendar horário"
    expect(await screen.findByText(/Dia Selecionado/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /agendar horário/i })).toBeInTheDocument();
  });

  it("switches to week view when clicking 'Semana'", async () => {
    render(
      <MemoryRouter initialEntries={["/clinica/testesteseqsadqwdas/agenda"]}>
        <Routes>
          <Route path="/clinica/:clinicKey/agenda" element={<ClinicAgendaPage />} />
        </Routes>
      </MemoryRouter>
    );

    const weekButton = await screen.findByRole("button", { name: /^semana$/i });
    fireEvent.click(weekButton);

    // Week view renders 7 columns with "Adicionar" buttons
    const addButtons = await screen.findAllByRole("button", { name: /adicionar/i });
    expect(addButtons.length).toBe(7);
  });

  it("switches to year view when clicking 'Ano'", async () => {
    render(
      <MemoryRouter initialEntries={["/clinica/testesteseqsadqwdas/agenda"]}>
        <Routes>
          <Route path="/clinica/:clinicKey/agenda" element={<ClinicAgendaPage />} />
        </Routes>
      </MemoryRouter>
    );

    const yearButton = await screen.findByRole("button", { name: /^ano$/i });
    fireEvent.click(yearButton);

    // Year view renders months like "Janeiro", "Dezembro"
    expect(await screen.findByText(/janeiro/i)).toBeInTheDocument();
    expect(screen.getByText(/dezembro/i)).toBeInTheDocument();
  });

  it("opens the unified event modal when clicking 'Novo Agendamento'", async () => {
    render(
      <MemoryRouter initialEntries={["/clinica/testesteseqsadqwdas/agenda"]}>
        <Routes>
          <Route path="/clinica/:clinicKey/agenda" element={<ClinicAgendaPage />} />
        </Routes>
      </MemoryRouter>
    );

    const newAppointmentButton = await screen.findByRole("button", { name: /novo agendamento/i });
    fireEvent.click(newAppointmentButton);

    expect(await screen.findByRole("heading", { name: /novo agendamento/i })).toBeInTheDocument();
    expect(screen.getByText(/duração da sessão/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /50 min/i })).toBeInTheDocument();
  });

  it("supports copying current period (day, week, month), displaying Paste and Cancel buttons", async () => {
    render(
      <MemoryRouter initialEntries={["/clinica/testesteseqsadqwdas/agenda"]}>
        <Routes>
          <Route path="/clinica/:clinicKey/agenda" element={<ClinicAgendaPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Na visão inicial (dia)
    const copyDayButton = await screen.findByRole("button", { name: /copiar dia/i });
    expect(copyDayButton).toBeInTheDocument();

    // Mudar para visão semana
    const weekButton = await screen.findByRole("button", { name: /^semana$/i });
    fireEvent.click(weekButton);

    const copyWeekButton = await screen.findByRole("button", { name: /copiar semana/i });
    expect(copyWeekButton).toBeInTheDocument();

    // Clicar em Copiar Semana
    fireEvent.click(copyWeekButton);

    // Agora os botões Colar e Cancelar devem aparecer
    const pasteButton = await screen.findByRole("button", { name: /colar/i });
    const cancelButton = await screen.findByRole("button", { name: /cancelar/i });
    expect(pasteButton).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();

    // Cancelar a cópia limpa o clipboard e retorna o botão de copiar
    fireEvent.click(cancelButton);
    expect(await screen.findByRole("button", { name: /copiar semana/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /colar/i })).not.toBeInTheDocument();
  }, 30000);

  it("executes pastePeriod and triggers insert when clicking 'Colar'", async () => {
    render(
      <MemoryRouter initialEntries={["/clinica/testesteseqsadqwdas/agenda"]}>
        <Routes>
          <Route path="/clinica/:clinicKey/agenda" element={<ClinicAgendaPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Mudar para semana onde há eventos mockados
    const weekButton = await screen.findByRole("button", { name: /^semana$/i });
    fireEvent.click(weekButton);

    const copyWeekButton = await screen.findByRole("button", { name: /copiar semana/i });
    fireEvent.click(copyWeekButton);

    const pasteButton = await screen.findByRole("button", { name: /colar/i });
    expect(pasteButton).toBeInTheDocument();

    fireEvent.click(pasteButton);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  it("renders immediately from cache on remount without getting stuck in loading", async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/clinica/testesteseqsadqwdas/agenda"]}>
        <Routes>
          <Route path="/clinica/:clinicKey/agenda" element={<ClinicAgendaPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Agenda da Clínica/i)).toBeInTheDocument();
    unmount();

    // Segundo mount: deve utilizar o cache em memória sincronizado
    render(
      <MemoryRouter initialEntries={["/clinica/testesteseqsadqwdas/agenda"]}>
        <Routes>
          <Route path="/clinica/:clinicKey/agenda" element={<ClinicAgendaPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Header e elementos da tela disponíveis sem bloqueio
    expect(screen.getByText(/Agenda da Clínica/i)).toBeInTheDocument();
  });

  it("handles Expand and Contract fallback when notified_colleague_ids or schema cache error occurs", async () => {
    let callCount = 0;
    mockInsert.mockImplementation((payload: any) => ({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) {
            return {
              data: null,
              error: {
                code: "PGRST204",
                message: "Could not find the 'notified_colleague_ids' column of 'agenda_events' in the schema cache",
              },
            };
          }
          return {
            data: {
              id: "ev-fallback-1",
              event_type: payload.event_type || "atendimento",
              patient_id: payload.patient_id,
              scheduled_for: payload.scheduled_for,
              status: "aguardando_confirmacao",
              title: payload.title,
            },
            error: null,
          };
        }),
      }),
    }));

    render(
      <MemoryRouter initialEntries={["/clinica/testesteseqsadqwdas/agenda"]}>
        <Routes>
          <Route path="/clinica/:clinicKey/agenda" element={<ClinicAgendaPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Aguardar carregamento da página e dos pacientes
    expect(await screen.findByText(/Agenda da Clínica/i)).toBeInTheDocument();

    const newAppointmentButton = await screen.findByRole("button", { name: /novo agendamento/i });
    fireEvent.click(newAppointmentButton);

    // Aguardar o modal abrir
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: /novo agendamento/i })).toBeInTheDocument();

    // Selecionar paciente João da Silva no combobox
    const patientComboboxButton = within(dialog).getByText(/selecionar paciente/i);
    fireEvent.click(patientComboboxButton);

    const patientOption = await screen.findByText("João da Silva");
    fireEvent.click(patientOption);

    const submitButton = within(dialog).getByRole("button", { name: /^agendar$/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      // Primeira tentativa falhou com erro de schema cache e segunda funcionou com fallback Expand & Contract
      expect(callCount).toBe(2);
    });
  });
});
