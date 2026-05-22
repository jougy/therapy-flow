import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Index from "@/pages/Index";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/components/AgendaWidget", () => ({
  default: ({ headerAccessory }: { headerAccessory?: React.ReactNode }) => (
    <div>
      {headerAccessory}
      <div>Agenda mock</div>
    </div>
  ),
}));

vi.mock("@/components/PatientCard", () => ({
  default: ({ patient }: { patient: { name: string } }) => <div>{patient.name}</div>,
}));

vi.mock("@/integrations/supabase/client", () => {
  const createQueryBuilder = (table: string) => {
    const resolveData = () => {
      switch (table) {
        case "patients":
          return [
            {
              cpf: null,
              date_of_birth: null,
              gender: null,
              id: "patient-1",
              name: "Maria Silva",
              phone: null,
              pronoun: null,
              status: "ativo",
              updated_at: "2026-04-14T10:00:00.000Z",
            },
            {
              cpf: null,
              date_of_birth: null,
              gender: null,
              id: "patient-2",
              name: "João Souza",
              phone: null,
              pronoun: null,
              status: "inativo",
              updated_at: "2026-04-14T09:00:00.000Z",
            },
            {
              cpf: null,
              date_of_birth: null,
              gender: null,
              id: "patient-3",
              name: "Carla Lima",
              phone: null,
              pronoun: null,
              status: "inativo",
              updated_at: "2026-04-14T08:00:00.000Z",
            },
            {
              cpf: null,
              date_of_birth: null,
              gender: null,
              id: "patient-4",
              name: "Bruno Costa",
              phone: null,
              pronoun: null,
              status: "pausado",
              updated_at: "2026-04-14T07:00:00.000Z",
            },
            {
              cpf: null,
              date_of_birth: null,
              gender: null,
              id: "patient-5",
              name: "Daniela Rocha",
              phone: null,
              pronoun: null,
              status: "pagamento_pendente",
              updated_at: "2026-04-14T06:00:00.000Z",
            },
            {
              cpf: null,
              date_of_birth: null,
              gender: null,
              id: "patient-6",
              name: "Eduardo Alves",
              phone: null,
              pronoun: null,
              status: "alta",
              updated_at: "2026-04-14T05:00:00.000Z",
            },
          ];
        case "patient_groups":
          return [
            { color: "#9AA33A", name: "teste", patient_id: "patient-1", status: "em_andamento" },
            { color: "#7DD3FC", name: "pilates", patient_id: "patient-2", status: "em_andamento" },
          ];
        case "sessions":
          return [
            { amount_charged_cents: 10000, amount_paid_cents: 12000, id: "session-1", patient_id: "patient-1", payment_method: "pix", provider_id: "collab-1", session_date: "2026-04-14T10:00:00.000Z", status: "concluído", user_id: "collab-1" },
            { amount_charged_cents: 20000, amount_paid_cents: 5000, id: "session-2", patient_id: "patient-2", payment_method: "cartao_credito", provider_id: "collab-2", session_date: "2026-04-15T10:00:00.000Z", status: "concluído", user_id: "collab-2" },
            { amount_charged_cents: Infinity, amount_paid_cents: Number.NaN, id: "session-invalid-1", patient_id: "patient-3", payment_method: "dinheiro", provider_id: "collab-2", session_date: "not-a-date", status: "rascunho", user_id: "collab-2" },
            { amount_charged_cents: -5000, amount_paid_cents: 999_999_999_999, id: "session-invalid-2", patient_id: "patient-4", payment_method: "nao_informado", provider_id: "collab-1", session_date: "2026-04-16T10:00:00.000Z", status: "cancelado", user_id: "collab-1" },
          ];
        case "agenda_events":
          return [
            {
              event_type: "atendimento",
              id: "agenda-1",
              patient_id: "patient-1",
              scheduled_for: "2099-04-15T10:00:00.000Z",
              status: "confirmado",
              title: "Maria Silva",
            },
          ];
        case "clinic_memberships":
          return [
            { clinic_id: "clinic-1", is_active: true, membership_status: "active", operational_role: "professional", user_id: "collab-1" },
            { clinic_id: "clinic-1", is_active: true, membership_status: "active", operational_role: "assistant", user_id: "collab-2" },
          ];
        case "profiles":
          return [
            { email: "fuc@email.com", full_name: "fucredison", id: "collab-1", job_title: "Fisioterapeuta" },
            { email: "maria@email.com", full_name: "Maria Apoio", id: "collab-2", job_title: "Assistente" },
          ];
        default:
          return [];
      }
    };

    const builder = {
      eq: () => builder,
      gte: () => builder,
      neq: () => builder,
      order: () => builder,
      select: () => builder,
      then: (
        resolve: (value: { data: unknown; error: null }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve({ data: resolveData(), error: null }).then(resolve, reject),
    };

    return builder;
  };

  return {
    supabase: {
      from: vi.fn((table: string) => createQueryBuilder(table)),
    },
  };
});

describe("Index", () => {
  beforeEach(() => {
    vi.clearAllMocks();

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
  });

  it("removes a recently deleted patient from the homepage list", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/",
            state: {
              deletedPatientId: "patient-1",
              refreshPatientsAt: 1713110400000,
            },
          },
        ]}
      >
        <Routes>
          <Route path="/" element={<Index />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText("Maria Silva")).not.toBeInTheDocument();
    });

    expect(screen.getByText("João Souza")).toBeInTheDocument();
  });

  it("shows all recent patients instead of limiting the dashboard list to five", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Index />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("João Souza")).toBeInTheDocument();
    expect(screen.getByText("Carla Lima")).toBeInTheDocument();
    expect(screen.getByText("Bruno Costa")).toBeInTheDocument();
    expect(screen.getByText("Daniela Rocha")).toBeInTheDocument();
    expect(screen.getByText("Eduardo Alves")).toBeInTheDocument();
  });

  it("shows the patient list when a status filter is applied", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Index />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole("button", { name: /filtro/i });

    fireEvent.click(screen.getByRole("button", { name: /filtro/i }));
    fireEvent.click(screen.getByLabelText("Ativo"));

    expect(await screen.findByText("1 paciente encontrado")).toBeInTheDocument();
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.queryByText("João Souza")).not.toBeInTheDocument();
  });

  it("shows the patient list when filtering by group, color and collaborator", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Index />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole("button", { name: /filtro/i });

    fireEvent.click(screen.getByRole("button", { name: /filtro/i }));
    fireEvent.click(screen.getByLabelText("teste"));
    fireEvent.click(screen.getByLabelText("Cor #9AA33A"));
    fireEvent.click(screen.getByPlaceholderText("Buscar por nome, email, função ou cargo"));
    fireEvent.change(screen.getByPlaceholderText("Buscar por nome, email, função ou cargo"), { target: { value: "fucredison" } });
    fireEvent.click(screen.getByLabelText("Selecionar fucredison"));

    expect(await screen.findByText("1 paciente encontrado")).toBeInTheDocument();
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.queryByText("João Souza")).not.toBeInTheDocument();
  });

  it("shows collaborator job title instead of platform hierarchy in the collaborator filter", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Index />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole("button", { name: /filtro/i });

    fireEvent.click(screen.getByRole("button", { name: /filtro/i }));

    expect(await screen.findByText("Fisioterapeuta")).toBeInTheDocument();
    expect(screen.getByText("Assistente")).toBeInTheDocument();
    expect(screen.queryByText("Profissional")).not.toBeInTheDocument();
  });

  it("keeps the clinic agenda available in a popup after returning filters and sorting to the default state", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Index />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /abrir agenda/i }).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText("Agenda mock")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /filtro/i }));
    fireEvent.click(screen.getByLabelText("Ativo"));

    expect(await screen.findByText("1 paciente encontrado")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^limpar$/i }));

    await waitFor(() => {
      expect(screen.queryByText("1 paciente encontrado")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Filtros" })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /abrir agenda/i })[0]);

    expect(await screen.findByText("Agenda mock")).toBeVisible();
  });

  it("opens the clinic agenda from the toolbar", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Index />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /abrir agenda/i }).length).toBeGreaterThan(0);
    });

    expect(screen.queryByText("Agenda mock")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /abrir agenda/i })[0]);

    expect(await screen.findByRole("dialog")).toHaveTextContent("Agenda");
    expect(screen.getByText("Agenda mock")).toBeVisible();
  });

  it("renders the dashboard without unsafe values from malformed financial records", async () => {
    vi.mocked(useAuth).mockReturnValue({
      accountRole: "account_owner",
      can: (capability) => capability === "treasury.manage",
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

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Index />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /abrir dashboard/i }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: /abrir dashboard/i })[0]);

    expect(await screen.findByRole("dialog", { name: "Resumo geral" })).toBeInTheDocument();
    expect(screen.getByText("Receita registrada")).toBeInTheDocument();
    expect(screen.getByText("Método de pagamento")).toBeInTheDocument();
    expect(screen.queryByText("Total de pacientes")).not.toBeInTheDocument();
    expect(screen.getByText(/Pago: R\$/)).toBeInTheDocument();
    expect(screen.getByText(/Crédito: R\$/)).toBeInTheDocument();
    expect(screen.getByText(/Em aberto: R\$/)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/NaN|Infinity|∞/);
  });
});
