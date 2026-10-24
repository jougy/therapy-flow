import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AgendaViewSelector } from "./AgendaViewSelector";
import { AgendaYearView } from "./AgendaYearView";
import { AgendaMonthView } from "./AgendaMonthView";
import { AgendaDayView } from "./AgendaDayView";
import { AgendaWeekView } from "./AgendaWeekView";
import { AgendaEventModal } from "./AgendaEventModal";
import { AgendaFiltersToolbar } from "./AgendaFiltersToolbar";
import type { AgendaEventItem } from "./types";

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuCheckboxItem: ({
    children,
    checked,
    onCheckedChange,
  }: {
    children: React.ReactNode;
    checked?: boolean;
    onCheckedChange?: (c: boolean) => void;
  }) => (
    <button
      role="checkbox"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      type="button"
    >
      {children}
    </button>
  ),
}));

const mockEvents: AgendaEventItem[] = [
  {
    id: "ev-1",
    eventType: "atendimento",
    patientId: "p-1",
    scheduledFor: "2026-09-26T09:00:00.000Z",
    status: "confirmado",
    title: "Atendimento Lucas",
    date: new Date(2026, 8, 26, 9, 0), // 26/09/2026 09:00
    time: "09:00",
    durationMinutes: 50,
  },
  {
    id: "ev-2",
    eventType: "reuniao",
    patientId: null,
    scheduledFor: "2026-09-26T14:30:00.000Z",
    status: "aguardando_confirmacao",
    title: "Reunião de Supervisão",
    date: new Date(2026, 8, 26, 14, 30), // 26/09/2026 14:30
    time: "14:30",
    durationMinutes: 60,
  },
  {
    id: "ev-3",
    eventType: "evento",
    patientId: null,
    scheduledFor: "2026-09-26T19:00:00.000Z",
    status: "lembrete",
    title: "Workshop Noturno",
    date: new Date(2026, 8, 26, 19, 0), // 26/09/2026 19:00
    time: "19:00",
    durationMinutes: 90,
  },
];

const mockPatients = [
  { id: "p-1", name: "Lucas Silva" },
  { id: "p-2", name: "Camila Rocha" },
];

describe("Agenda Modular Components", () => {
  describe("AgendaViewSelector", () => {
    it("renders all 4 modes (Ano, Mês, Semana, Dia)", () => {
      const onChange = vi.fn();
      render(<AgendaViewSelector value="day" onChange={onChange} />);

      expect(screen.getByRole("button", { name: /ano/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /mês/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /semana/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /dia/i })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /mês/i }));
      expect(onChange).toHaveBeenCalledWith("month");
    });
  });

  describe("AgendaYearView", () => {
    it("renders 12 months and navigates to month or day", () => {
      const onSelectDate = vi.fn();
      const onNavigateToView = vi.fn();

      render(
        <AgendaYearView
          currentDate={new Date(2026, 8, 26)}
          onSelectDate={onSelectDate}
          onNavigateToView={onNavigateToView}
          events={mockEvents}
        />
      );

      expect(screen.getByText("2026")).toBeInTheDocument();
      expect(screen.getByText("janeiro")).toBeInTheDocument();
      expect(screen.getByText("dezembro")).toBeInTheDocument();

      // Click on a month header
      fireEvent.click(screen.getByText("janeiro"));
      expect(onNavigateToView).toHaveBeenCalledWith("month", expect.any(Date));
    });
  });

  describe("AgendaMonthView", () => {
    it("renders calendar month and contextual side panel", () => {
      const onSelectDate = vi.fn();
      const onOpenAddModal = vi.fn();
      const onOpenEditModal = vi.fn();

      render(
        <AgendaMonthView
          currentDate={new Date(2026, 8, 26)}
          onSelectDate={onSelectDate}
          events={mockEvents}
          patients={mockPatients}
          onOpenAddModal={onOpenAddModal}
          onOpenEditModal={onOpenEditModal}
        />
      );

      expect(screen.getByText(/Dia Selecionado/i)).toBeInTheDocument();
      expect(screen.getByText(/Atendimento Lucas/i)).toBeInTheDocument();

      const addBtn = screen.getByRole("button", { name: /agendar horário/i });
      fireEvent.click(addBtn);
      expect(onOpenAddModal).toHaveBeenCalled();
    });
  });

  describe("AgendaDayView", () => {
    it("renders the 3 shifts: Manhã, Tarde, Noite with event cards and free slot buttons", () => {
      const onOpenAddModal = vi.fn();
      const onOpenEditModal = vi.fn();

      render(
        <AgendaDayView
          currentDate={new Date(2026, 8, 26)}
          events={mockEvents}
          patients={mockPatients}
          onOpenAddModal={onOpenAddModal}
          onOpenEditModal={onOpenEditModal}
        />
      );

      expect(screen.getByText("Manhã")).toBeInTheDocument();
      expect(screen.getByText("Tarde")).toBeInTheDocument();
      expect(screen.getByText("Noite")).toBeInTheDocument();

      // Check event items
      expect(screen.getByText("Atendimento Lucas")).toBeInTheDocument();
      expect(screen.getByText("Reunião de Supervisão")).toBeInTheDocument();
      expect(screen.getByText("Workshop Noturno")).toBeInTheDocument();

      // Click edit
      const editButtons = screen.getAllByRole("button", { name: /editar/i });
      fireEvent.click(editButtons[0]);
      expect(onOpenEditModal).toHaveBeenCalledWith(mockEvents[0]);
    });
  });

  describe("AgendaWeekView", () => {
    it("renders 7-day grid with shift indicators and events", () => {
      const onSelectDate = vi.fn();
      const onNavigateToDay = vi.fn();
      const onOpenAddModal = vi.fn();
      const onOpenEditModal = vi.fn();

      render(
        <AgendaWeekView
          currentDate={new Date(2026, 8, 26)}
          onSelectDate={onSelectDate}
          onNavigateToDay={onNavigateToDay}
          events={mockEvents}
          patients={mockPatients}
          onOpenAddModal={onOpenAddModal}
          onOpenEditModal={onOpenEditModal}
        />
      );

      // Check that 7 days are rendered with "Adicionar" buttons
      const addButtons = screen.getAllByRole("button", { name: /adicionar/i });
      expect(addButtons.length).toBe(7);

      // Check event rendered in the week (both mobile matrix and desktop grid render the event)
      expect(screen.getAllByText("Atendimento Lucas").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("AgendaEventModal", () => {
    it("renders duration chips and applies historical suggestion", () => {
      const onOpenChange = vi.fn();
      const onSaveCreate = vi.fn();
      const onSaveEdit = vi.fn();

      render(
        <AgendaEventModal
          open={true}
          onOpenChange={onOpenChange}
          mode="create"
          initialDate={new Date(2026, 8, 26)}
          initialTime="10:00"
          patients={mockPatients}
          onSaveCreate={onSaveCreate}
          onSaveEdit={onSaveEdit}
        />
      );

      expect(screen.getByRole("heading", { name: /novo agendamento/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^30 min$/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^50 min$/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /manual/i })).toBeInTheDocument();

      // Check both time inputs: start time and editable end time
      const startTimeInput = screen.getByLabelText(/horário de início/i);
      const endTimeInput = screen.getByLabelText(/horário de término/i);
      expect(startTimeInput).toHaveValue("10:00");
      expect(endTimeInput).toHaveValue("10:50");

      // Changing preset recalculates end time
      fireEvent.click(screen.getByRole("button", { name: /^30 min$/i }));
      expect(endTimeInput).toHaveValue("10:30");

      // Manually changing end time recalculates duration
      fireEvent.change(endTimeInput, { target: { value: "11:30" } });
      expect(screen.getAllByText(/90 min/i).length).toBeGreaterThan(0);

      // Click manual chip and see custom input
      fireEvent.click(screen.getByRole("button", { name: /manual/i }));
      expect(screen.getByPlaceholderText(/minutos/i)).toBeInTheDocument();
    });
  });

  describe("Agenda types & helpers", () => {
    it("getEventShift correctly classifies hours and safely handles malformed times", async () => {
      const { getEventShift } = await import("./types");
      expect(getEventShift("08:00")).toBe("morning");
      expect(getEventShift("11:59")).toBe("morning");
      expect(getEventShift("12:00")).toBe("afternoon");
      expect(getEventShift("17:45")).toBe("afternoon");
      expect(getEventShift("18:00")).toBe("evening");
      expect(getEventShift("23:30")).toBe("evening");

      // Defensive fallbacks
      expect(getEventShift("")).toBe("morning");
      expect(getEventShift("invalid")).toBe("morning");
      expect(getEventShift(undefined as unknown as string)).toBe("morning");
    });
  });

  describe("AgendaDayView free slot interactions", () => {
    it("triggers onOpenAddModal with slot start time when clicking on a condensed free slot", () => {
      const onOpenAddModal = vi.fn();
      const onOpenEditModal = vi.fn();

      render(
        <AgendaDayView
          currentDate={new Date(2026, 8, 26)}
          events={mockEvents}
          patients={mockPatients}
          onOpenAddModal={onOpenAddModal}
          onOpenEditModal={onOpenEditModal}
        />
      );

      // Find free slot agendar buttons
      const agendarButtons = screen.getAllByRole("button", { name: /agendar/i });
      expect(agendarButtons.length).toBeGreaterThan(0);

      // Click the first free slot Agendar button (morning free slot before 09:00, starts at 07:00)
      fireEvent.click(agendarButtons[0]);
      expect(onOpenAddModal).toHaveBeenCalledWith(expect.any(Date), "07:00");
    });
  });

  describe("AgendaFiltersToolbar (Drop Checklist de Períodos)", () => {
    it("renders and toggles shift filters correctly", async () => {
      const setSearchQuery = vi.fn();
      const setFilterType = vi.fn();
      const setFilterStatus = vi.fn();
      const setFilterShifts = vi.fn();

      const { rerender } = render(
        <AgendaFiltersToolbar
          searchQuery=""
          setSearchQuery={setSearchQuery}
          filterType="all"
          setFilterType={setFilterType}
          filterStatus="all"
          setFilterStatus={setFilterStatus}
          filterShifts={[]}
          setFilterShifts={setFilterShifts}
        />
      );

      // Botão do Drop Checklist com label padrão
      const triggerBtn = screen.getByRole("button", { name: /todos os períodos/i });
      expect(triggerBtn).toBeInTheDocument();

      // Abrir dropdown (Radix UI responde a pointerDown)
      fireEvent.pointerDown(triggerBtn, { button: 0 });

      // Opções com turnos
      expect(await screen.findByText("Madrugada")).toBeInTheDocument();
      expect(screen.getByText("Manhã")).toBeInTheDocument();
      expect(screen.getByText("Tarde")).toBeInTheDocument();
      expect(screen.getByText("Noite")).toBeInTheDocument();

      // Clicar em Manhã
      const morningOption = screen.getByText("Manhã");
      fireEvent.click(morningOption);
      expect(setFilterShifts).toHaveBeenCalled();

      // Rerender com 1 período selecionado
      rerender(
        <AgendaFiltersToolbar
          searchQuery=""
          setSearchQuery={setSearchQuery}
          filterType="all"
          setFilterType={setFilterType}
          filterStatus="all"
          setFilterStatus={setFilterStatus}
          filterShifts={["morning"]}
          setFilterShifts={setFilterShifts}
        />
      );

      expect(screen.getByRole("button", { name: /manhã/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /limpar filtros/i })).toBeInTheDocument();
    });
  });

  describe("AgendaWeekView Shift Filter Toggling", () => {
    it("allows clicking shift badges in day cards to filter events interactively", () => {
      const onSelectDate = vi.fn();
      const onNavigateToDay = vi.fn();
      const onOpenAddModal = vi.fn();
      const onOpenEditModal = vi.fn();

      render(
        <AgendaWeekView
          currentDate={new Date(2026, 8, 26)}
          onSelectDate={onSelectDate}
          onNavigateToDay={onNavigateToDay}
          events={mockEvents}
          patients={mockPatients}
          onOpenAddModal={onOpenAddModal}
          onOpenEditModal={onOpenEditModal}
        />
      );

      // Buscar os botões de turno com title explicativo
      const morningShiftBtns = screen.getAllByTitle(/manhã: 1 compromisso\(s\)/i);
      expect(morningShiftBtns.length).toBeGreaterThan(0);

      // Clicar no botão da manhã
      fireEvent.click(morningShiftBtns[0]);

      // Verificar que o botão "Todos" aparece no card para limpar o filtro
      const resetBtn = screen.queryByTitle(/limpar filtro de turnos/i);
      expect(resetBtn).toBeInTheDocument();
    });
  });

  describe("Compact mode & Patient inline agenda integration", () => {
    it("renders AgendaWeekView, AgendaMonthView and AgendaYearView in compact mode without errors", () => {
      const onSelectDate = vi.fn();
      const onNavigateToDay = vi.fn();
      const onNavigateToView = vi.fn();
      const onOpenAddModal = vi.fn();
      const onOpenEditModal = vi.fn();

      // Week View compact
      const { container: weekContainer } = render(
        <AgendaWeekView
          currentDate={new Date(2026, 8, 26)}
          onSelectDate={onSelectDate}
          onNavigateToDay={onNavigateToDay}
          events={mockEvents}
          patients={mockPatients}
          onOpenAddModal={onOpenAddModal}
          onOpenEditModal={onOpenEditModal}
          compact
        />
      );
      expect(weekContainer.querySelector(".min-h-\\[190px\\]")).toBeInTheDocument();

      // Month View compact
      const { container: monthContainer } = render(
        <AgendaMonthView
          currentDate={new Date(2026, 8, 26)}
          onSelectDate={onSelectDate}
          events={mockEvents}
          patients={mockPatients}
          onOpenAddModal={onOpenAddModal}
          onOpenEditModal={onOpenEditModal}
          onNavigateToDay={onNavigateToDay}
          compact
        />
      );
      expect(monthContainer.querySelector(".min-h-\\[36px\\]")).toBeInTheDocument();

      // Year View compact
      const { container: yearContainer } = render(
        <AgendaYearView
          currentDate={new Date(2026, 8, 26)}
          onSelectDate={onSelectDate}
          onNavigateToView={onNavigateToView}
          events={mockEvents}
          compact
        />
      );
      expect(yearContainer.querySelector(".gap-2\\.5")).toBeInTheDocument();
    });
  });
});

