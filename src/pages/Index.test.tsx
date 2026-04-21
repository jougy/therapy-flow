import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Index from "@/pages/Index";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/components/AgendaWidget", () => ({
  default: () => <div>Agenda mock</div>,
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
          ];
        case "patient_groups":
        case "sessions":
          return [];
        default:
          return [];
      }
    };

    const builder = {
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

  it("restores the dashboard cards after returning filters and sorting to the default state", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Index />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Pacientes Ativos");

    fireEvent.click(screen.getByRole("button", { name: /filtro/i }));
    fireEvent.click(screen.getByLabelText("Ativo"));

    expect(await screen.findByText("1 paciente encontrado")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /limpar filtros/i }));

    await waitFor(() => {
      expect(screen.queryByText("1 paciente encontrado")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Pacientes Ativos")).toBeVisible();
    expect(screen.getByText("Total de Pacientes")).toBeVisible();
    expect(screen.getByText("Total de Sessões")).toBeVisible();
    expect(screen.getByText("Agenda mock")).toBeVisible();
  });
});
