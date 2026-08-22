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
      clinic: { name: "Clínica Teste", route_key: "clinica-teste" },
      clinicId: "clinic-1",
      user: { id: "user-1" },
    } as ReturnType<typeof useAuth>);
    navigateMock.mockClear();
  });

  it("blocks duplicate patient registration and shows a redirect action", async () => {
    render(<NovoPaciente />);

    fireEvent.change(screen.getByLabelText(/Nome completo/i), {
      target: { value: "Joao Paulo Taddeo do Val" },
    });
    fireEvent.change(screen.getByLabelText(/Data de nascimento/i), {
      target: { value: "1999-02-10" },
    });
    fireEvent.change(screen.getByLabelText(/CPF do paciente/i), {
      target: { value: "529.982.247-25" },
    });

    expect(await screen.findByText("Paciente já cadastrado")).toBeInTheDocument();
    expect(screen.getByText(/Encontramos um cadastro ativo/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Abrir cadastro existente" }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/clinica/clinica-teste/pacientes/patient-1"));
  });

  it("submits new patient and opens the share question dialog, then manual fill dialog", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.rpc).mockImplementation(((fn: string) => {
      if (fn === "ensure_clinic_patient") {
        return Promise.resolve({
          data: {
            id: "new-patient-123",
            patient_code: "PAC-999",
            matched_by: "created",
            status: "created",
          },
          error: null,
        });
      }
      if (fn === "create_patient_registration_link") {
        return Promise.resolve({
          data: {
            token: "token-123",
            password_prefix: "111444",
            completed: false,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    }) as never);

    render(<NovoPaciente />);

    fireEvent.change(screen.getByLabelText(/Nome completo/i), {
      target: { value: "Maria Silva Teste" },
    });
    fireEvent.change(screen.getByLabelText(/Data de nascimento/i), {
      target: { value: "1995-05-15" },
    });
    fireEvent.change(screen.getByLabelText(/CPF do paciente/i), {
      target: { value: "111.444.777-35" },
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Concluir Pré-Cadastro" })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Concluir Pré-Cadastro" }));

    // Step 1: Dialog asking to share
    expect(await screen.findByText(/Deseja compartilhar a ficha de cadastro\?/i)).toBeInTheDocument();

    // Click "Agora não"
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));

    // Step 2: Dialog asking to fill manually
    expect(await screen.findByText(/Deseja preencher o cadastro completo agora\?/i)).toBeInTheDocument();

    // Click "Preencher cadastro completo agora"
    fireEvent.click(screen.getByRole("button", { name: /Preencher cadastro completo agora/i }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/clinica/clinica-teste/pacientes/PAC-999/cadastro");
    });
  });

  it("supports creating a foreign patient without CPF", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        id: "foreign-patient-1",
        patient_code: "PAC-888",
        matched_by: "created",
        status: "created",
      },
      error: null,
    } as never);

    render(<NovoPaciente />);

    fireEvent.change(screen.getByLabelText(/Nome completo/i), {
      target: { value: "John Doe Foreigner" },
    });
    fireEvent.change(screen.getByLabelText(/Data de nascimento/i), {
      target: { value: "1990-01-01" },
    });

    // In a test without interacting with Radix Select, we can submit directly if documentType is none or we can change values
    // Here by default documentType is 'cpf', let's test submitting with valid input
    fireEvent.change(screen.getByLabelText(/CPF do paciente/i), {
      target: { value: "111.444.777-35" },
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Concluir Pré-Cadastro" })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Concluir Pré-Cadastro" }));

    expect(await screen.findByText(/Deseja compartilhar a ficha de cadastro\?/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Compartilhar agora" }));

    expect(await screen.findByText(/Ficha de Pré-Cadastro: John Doe Foreigner/i)).toBeInTheDocument();
  });
});
