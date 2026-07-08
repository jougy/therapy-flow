import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NovoPaciente from "@/pages/NovoPaciente";
import { useAuth } from "@/hooks/useAuth";

const navigateMock = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@/integrations/supabase/client", () => {
  const patients = [
    {
      clinic_id: "clinic-1",
      cpf: "52998224725",
      date_of_birth: "1999-02-10",
      id: "patient-1",
      name: "Joao Paulo Taddeo do Val",
      status: "ativo",
    },
  ];

  const createPatientQuery = () => {
    const filters: Record<string, string> = {};
    const query = {
      eq: (column: string, value: string) => {
        filters[column] = value;
        return query;
      },
      limit: () => query,
      select: () => query,
      then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
        const data = patients.filter((patient) =>
          Object.entries(filters).every(([column, value]) => patient[column as keyof typeof patient] === value),
        );

        return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
      },
    };

    return query;
  };

  return {
    supabase: {
      from: () => createPatientQuery(),
      rpc: vi.fn(),
    },
  };
});

describe("NovoPaciente", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      clinic: { route_key: "clinica-teste" },
      clinicId: "clinic-1",
      user: { id: "user-1" },
    } as ReturnType<typeof useAuth>);
    navigateMock.mockClear();
  });

  it("blocks duplicate patient registration and shows a redirect action", async () => {
    render(<NovoPaciente />);

    fireEvent.change(screen.getByLabelText("Nome completo *"), {
      target: { value: "Joao Paulo Taddeo do Val" },
    });
    fireEvent.change(screen.getByLabelText("Data de nascimento *"), {
      target: { value: "1999-02-10" },
    });
    fireEvent.change(screen.getByLabelText("CPF do paciente *"), {
      target: { value: "529.982.247-25" },
    });

    expect(await screen.findByText("Paciente já cadastrado")).toBeInTheDocument();
    expect(screen.getByText(/Encontramos um cadastro ativo/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cadastrar Paciente" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Abrir cadastro existente" }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/pacientes/patient-1"));
  });
});
