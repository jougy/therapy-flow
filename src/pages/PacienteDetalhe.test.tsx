import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Children, isValidElement, type ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PacienteDetalhe from "@/pages/PacienteDetalhe";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const navigateMock = vi.fn();

const supabaseMocks = vi.hoisted(() => ({
  agendaEvents: [] as Array<Record<string, unknown>>,
  deleteCalls: [] as Array<{ table: string; filters: Array<{ column: string; value: unknown }> }>,
  from: vi.fn(),
  insertCalls: [] as Array<{
    payload: Record<string, unknown>;
    table: string;
  }>,
  rpc: vi.fn(),
  updateCalls: [] as Array<{
    payload: Record<string, unknown>;
    table: string;
    filters: Array<{ column: string; value: unknown }>;
  }>,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/components/ui/select", () => {
  const extractText = (node: ReactNode): string => {
    if (typeof node === "string" || typeof node === "number") {
      return String(node);
    }

    if (!node) {
      return "";
    }

    return Children.toArray(node)
      .map((child) => {
        if (isValidElement<{ children?: ReactNode }>(child)) {
          return extractText(child.props.children);
        }

        return extractText(child);
      })
      .join("")
      .trim();
  };

  const collectItems = (node: ReactNode): Array<{ label: string; value: string }> => {
    return Children.toArray(node).flatMap((child) => {
      if (!isValidElement<{ children?: ReactNode; value?: string }>(child)) {
        return [];
      }

      const childType = child.type as { displayName?: string };

      if (childType.displayName === "MockSelectItem") {
        return [
          {
            label: extractText(child.props.children),
            value: child.props.value ?? "",
          },
        ];
      }

      return collectItems(child.props.children);
    });
  };

  const Select = ({
    children,
    disabled,
    onValueChange,
    value,
  }: {
    children: ReactNode;
    disabled?: boolean;
    onValueChange?: (value: string) => void;
    value?: string;
  }) => {
    const items = collectItems(children);

    return (
      <select
        disabled={disabled}
        onChange={(event) => onValueChange?.(event.target.value)}
        role="combobox"
        value={value ?? ""}
      >
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    );
  };

  const SelectTrigger = ({ children }: { children?: ReactNode }) => <>{children}</>;
  const SelectValue = ({ children, placeholder }: { children?: ReactNode; placeholder?: string }) => <>{children ?? placeholder}</>;
  const SelectContent = ({ children }: { children?: ReactNode }) => <>{children}</>;
  const SelectItem = ({ children }: { children?: ReactNode }) => <>{children}</>;

  SelectItem.displayName = "MockSelectItem";

  return {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  };
});

vi.mock("@/integrations/supabase/client", () => {
  const patient = {
    age: 32,
    cpf: "12345678901",
    created_at: "2026-04-01T12:00:00.000Z",
    date_of_birth: "1994-04-01",
    email: "paciente@example.com",
    gender: "feminino",
    id: "patient-1",
    name: "Maria Silva",
    phone: "11999999999",
    pronoun: "ela/dela",
    rg: "1234567",
    status: "ativo",
  };

  const createQueryBuilder = (table: string) => {
    let mode: "delete" | "insert" | "select" | "update" = "select";
    let payload: Record<string, unknown> = {};
    const filters: Array<{ column: string; value: unknown }> = [];

    const resolveData = () => {
      switch (table) {
        case "patients":
          return patient;
        case "patient_groups":
          return [
            {
              clinic_color_slot_id: null,
              color: "lavender",
              created_at: "2026-04-01T12:00:00.000Z",
              group_kind: "custom",
              id: "group-1",
              is_default: false,
              name: "Lombalgia",
              status: "em_andamento",
            },
            {
              clinic_color_slot_id: null,
              color: "gray",
              created_at: "2026-04-01T12:00:00.000Z",
              group_kind: "default",
              id: "group-default",
              is_default: true,
              name: "Grupo sem definição",
              status: null,
            },
            {
              clinic_color_slot_id: null,
              color: "rose",
              created_at: "2026-04-01T12:00:00.000Z",
              group_kind: "cancelados",
              id: "group-cancelados",
              is_default: false,
              name: "Cancelados",
              status: "cancelado",
            },
          ];
        case "sessions":
          return [
            {
              anamnesis: { queixa: "Dor lombar" },
              anamnesis_form_response: {},
              complexity_score: 3,
              created_at: "2026-04-02T12:00:00.000Z",
              group_id: "group-1",
              id: "session-1",
              notes: "",
              pain_score: 5,
              provider_id: "owner-1",
              session_date: "2026-04-02T12:00:00.000Z",
              status: "concluído",
              treatment: null,
              user_id: "owner-1",
            },
          ];
        case "clinics":
          return { anamnesis_base_schema: [] };
        case "profiles":
          return [];
        case "agenda_events":
          return supabaseMocks.agendaEvents;
        default:
          return [];
      }
    };

    const execute = () => {
      if (mode === "delete") {
        supabaseMocks.deleteCalls.push({ filters: [...filters], table });
        return { data: null, error: null };
      }

      if (mode === "update") {
        supabaseMocks.updateCalls.push({ filters: [...filters], payload, table });
        if (table === "agenda_events") {
          const targetId = filters.find((filter) => filter.column === "id")?.value;
          const existingEvent = supabaseMocks.agendaEvents.find((event) => event.id === targetId) ?? {};
          const updatedEvent = { ...existingEvent, ...payload };
          supabaseMocks.agendaEvents = supabaseMocks.agendaEvents.map((event) => (event.id === targetId ? updatedEvent : event));
          return { data: updatedEvent, error: null };
        }
        return { data: null, error: null };
      }

      if (mode === "insert") {
        supabaseMocks.insertCalls.push({ payload, table });
        if (table === "sessions") {
          return {
            data: {
              created_at: "2026-05-14T12:00:00.000Z",
              id: "session-canceled-1",
              updated_at: "2026-05-14T12:00:00.000Z",
              ...payload,
            },
            error: null,
          };
        }

        return {
          data: {
            clinic_id: payload.clinic_id,
            created_at: "2026-05-14T12:00:00.000Z",
            event_type: payload.event_type,
            id: "agenda-1",
            patient_id: payload.patient_id,
            scheduled_for: payload.scheduled_for,
            status: payload.status,
            title: payload.title,
            updated_at: "2026-05-14T12:00:00.000Z",
            user_id: payload.user_id,
          },
          error: null,
        };
      }

      return { data: resolveData(), error: null };
    };

    const builder = {
      delete: () => {
        mode = "delete";
        return builder;
      },
      eq: (column: string, value: unknown) => {
        filters.push({ column, value });
        return builder;
      },
      in: (column: string, values: unknown) => {
        filters.push({ column, value: values });
        return builder;
      },
      insert: (nextPayload: Record<string, unknown>) => {
        mode = "insert";
        payload = nextPayload;
        return builder;
      },
      limit: () => builder,
      maybeSingle: () => Promise.resolve({ data: resolveData(), error: null }),
      not: () => builder,
      order: () => builder,
      select: () => {
        if (mode !== "insert" && mode !== "update") {
          mode = "select";
        }
        return builder;
      },
      single: () => Promise.resolve(execute()),
      then: (
        resolve: (value: { data: unknown; error: null }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve(execute()).then(resolve, reject),
      update: (nextPayload: Record<string, unknown>) => {
        mode = "update";
        payload = nextPayload;
        return builder;
      },
    };

    return builder;
  };

  return {
    supabase: {
      from: vi.fn((table: string) => createQueryBuilder(table)),
      rpc: supabaseMocks.rpc,
    },
  };
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/pacientes/patient-1"]}>
      <Routes>
        <Route path="/pacientes/:id" element={<PacienteDetalhe />} />
      </Routes>
    </MemoryRouter>
  );

describe("PacienteDetalhe", () => {
  beforeEach(() => {
    if (!HTMLElement.prototype.hasPointerCapture) {
      HTMLElement.prototype.hasPointerCapture = () => false;
    }

    if (!HTMLElement.prototype.setPointerCapture) {
      HTMLElement.prototype.setPointerCapture = () => {};
    }

    if (!HTMLElement.prototype.releasePointerCapture) {
      HTMLElement.prototype.releasePointerCapture = () => {};
    }

    navigateMock.mockReset();
    supabaseMocks.agendaEvents = [];
    supabaseMocks.deleteCalls = [];
    supabaseMocks.insertCalls = [];
    supabaseMocks.updateCalls = [];
    vi.clearAllMocks();

    vi.mocked(useAuth).mockReturnValue({
      accountRole: "account_owner",
      can: (capability) => capability !== "treasury.manage",
      capabilities: {} as never,
      clinic: null,
      clinicId: "clinic-1",
      isSuperAdmin: false,
      loading: false,
      membership: null,
      membershipStatus: "active",
      operationalRole: "owner",
      profile: null,
      refreshAuthState: vi.fn(async () => {}),
      session: null,
      signOut: vi.fn(async () => {}),
      subscriptionPlan: "clinic",
      user: {
        id: "owner-1",
      } as never,
    });

    supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });
  });

  it("shows the delete option for owner/admin flows", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Maria Silva" });

    expect(screen.getByRole("option", { name: "Excluir" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /novo atendimento/i })).not.toBeInTheDocument();
  });

  it("renders grouped sessions without crashing", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Lombalgia" })).toBeInTheDocument();
    expect(screen.getByText("Dor lombar")).toBeInTheDocument();
  });

  it("navigates patient summary cards in a single compact block", async () => {
    renderPage();

    await screen.findByText("Resumo");
    expect(screen.getByText("atendimento no histórico")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /próximo resumo/i }));

    expect(screen.getByText("Concluídos")).toBeInTheDocument();
    expect(screen.getByText("atendimento")).toBeInTheDocument();
  });

  it("shows the patient agenda block and opens the scheduling dialog", async () => {
    renderPage();

    expect(await screen.findByText("Sem eventos")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /adicionar evento/i }));

    expect(await screen.findByRole("heading", { name: /novo evento/i })).toBeInTheDocument();
    expect(screen.getAllByText("Maria Silva").length).toBeGreaterThan(1);

    const confirmButton = screen.getByRole("button", { name: /confirmar/i });
    expect(confirmButton).not.toBeDisabled();
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(supabaseMocks.insertCalls).toEqual([
        {
          payload: expect.objectContaining({
            clinic_id: "clinic-1",
            event_type: "atendimento",
            patient_id: "patient-1",
            status: "aguardando_confirmacao",
            title: "Maria Silva",
            user_id: "owner-1",
          }),
          table: "agenda_events",
        },
      ]);
    });
  });

  it("opens scheduled event details and creates a canceled session when applying canceled status", async () => {
    supabaseMocks.agendaEvents = [
      {
        clinic_id: "clinic-1",
        created_at: "2026-05-14T12:00:00.000Z",
        event_type: "atendimento",
        id: "agenda-existing-1",
        patient_id: "patient-1",
        scheduled_for: "2099-05-14T12:00:00.000Z",
        status: "aguardando_confirmacao",
        title: "Maria Silva",
        updated_at: "2026-05-14T12:00:00.000Z",
        user_id: "owner-1",
      },
    ];

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /próximo dia com agendamentos/i }));

    const statusBadge = await screen.findByText("Aguardando");
    fireEvent.click(statusBadge.closest("div[role='button']")!);

    expect(await screen.findByText("Revise o horário, atualize o status ou inicie o atendimento a partir deste agendamento.")).toBeInTheDocument();

    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "cancelado" } });
    fireEvent.click(screen.getByRole("button", { name: /aplicar status/i }));

    await waitFor(() => {
      expect(supabaseMocks.updateCalls).toContainEqual({
        filters: [{ column: "id", value: "agenda-existing-1" }],
        payload: { status: "cancelado" },
        table: "agenda_events",
      });
      expect(supabaseMocks.insertCalls).toContainEqual({
        payload: expect.objectContaining({
          group_id: "group-cancelados",
          patient_id: "patient-1",
          status: "cancelado",
          user_id: "owner-1",
        }),
        table: "sessions",
      });
    });
  });

  it("keeps active agenda events from today visible in the patient agenda block", async () => {
    const today = new Date();
    today.setHours(9, 0, 0, 0);
    supabaseMocks.agendaEvents = [
      {
        clinic_id: "clinic-1",
        created_at: "2026-05-14T12:00:00.000Z",
        event_type: "atendimento",
        id: "agenda-overdue-1",
        patient_id: "patient-1",
        scheduled_for: today.toISOString(),
        status: "aguardando_confirmacao",
        title: "Maria Silva",
        updated_at: "2026-05-14T12:00:00.000Z",
        user_id: "owner-1",
      },
    ];

    renderPage();

    expect(await screen.findByText("Aguardando")).toBeInTheDocument();
    expect(screen.queryByText("Sem eventos")).not.toBeInTheDocument();
  });

  it("jumps to future patient agenda events with the same agenda controls", async () => {
    supabaseMocks.agendaEvents = [
      {
        clinic_id: "clinic-1",
        created_at: "2026-05-14T12:00:00.000Z",
        event_type: "atendimento",
        id: "agenda-future-1",
        patient_id: "patient-1",
        scheduled_for: "2099-05-14T09:00:00.000Z",
        status: "confirmado",
        title: "Maria Silva",
        updated_at: "2026-05-14T12:00:00.000Z",
        user_id: "owner-1",
      },
    ];

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /próximo dia com agendamentos/i }));

    expect(await screen.findByText("Confirmado")).toBeInTheDocument();
  });

  it("opens the patient summary popup from the compact header", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Maria Silva" });

    fireEvent.click(screen.getByRole("button", { name: /ver mais/i }));

    expect(await screen.findByRole("heading", { name: "Resumo do paciente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resumo clínico/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editar cadastro/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /compartilhar com o paciente/i })).toBeInTheDocument();
  });

  it("hides the delete option for non-admin flows", async () => {
    vi.mocked(useAuth).mockReturnValue({
      accountRole: null,
      can: () => false,
      capabilities: {} as never,
      clinic: null,
      clinicId: "clinic-1",
      isSuperAdmin: false,
      loading: false,
      membership: null,
      membershipStatus: "active",
      operationalRole: "professional",
      profile: null,
      refreshAuthState: vi.fn(async () => {}),
      session: null,
      signOut: vi.fn(async () => {}),
      subscriptionPlan: "clinic",
      user: {
        id: "professional-1",
      } as never,
    });

    renderPage();

    await screen.findByRole("heading", { name: "Maria Silva" });

    await waitFor(() => {
      expect(screen.queryByRole("option", { name: "Excluir" })).not.toBeInTheDocument();
    });
  });

  it("confirms deletion, deletes the patient, and redirects to the homepage", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Maria Silva" });

    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "delete" } });

    expect(await screen.findByRole("heading", { name: /excluir paciente/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^excluir$/i }));

    await waitFor(() => {
      expect(supabaseMocks.deleteCalls).toEqual([
        {
          filters: [{ column: "id", value: "patient-1" }],
          table: "patients",
        },
      ]);
    });

    expect(navigateMock).toHaveBeenCalledWith("/", {
      replace: true,
      state: {
        deletedPatientId: "patient-1",
        refreshPatientsAt: expect.any(Number),
      },
    });
    expect(toast).toHaveBeenCalledWith({ title: "Paciente excluído" });
  });
});
