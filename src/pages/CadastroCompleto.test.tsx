import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CadastroCompleto from "@/pages/CadastroCompleto";
import { useAuth } from "@/hooks/useAuth";

const navigateMock = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const mockPatient = {
  id: "patient-123",
  patient_code: "PAC-001",
  clinic_id: "clinic-1",
  name: "Carlos Teste Silva",
  date_of_birth: "1990-01-01",
  cpf: "12345678901",
  phone: "11999999999",
  email: "carlos@teste.com",
  gender: "masculino",
  rg: "1234567",
  blood_type: "O+",
  pronoun: "ele/dele",
  profession: "Engenheiro",
  status: "ativo",
  origin_type: "direto",
};

vi.mock("@/lib/patient-routing", async () => {
  const actual = await vi.importActual<typeof import("@/lib/patient-routing")>("@/lib/patient-routing");
  return {
    ...actual,
    fetchPatientByRef: vi.fn().mockImplementation((ref: string) => {
      if (ref === "patient-123" || ref === "PAC-001") {
        return Promise.resolve({ data: mockPatient, error: null });
      }
      return Promise.resolve({ data: null, error: new Error("Not found") });
    }),
  };
});

describe("CadastroCompleto", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      clinic: { route_key: "clinica-teste", id: "clinic-1" },
      clinicId: "clinic-1",
      session: { access_token: "mock-token" },
      user: { id: "user-1" },
    } as ReturnType<typeof useAuth>);
    navigateMock.mockClear();
  });

  it("loads and displays the patient data without infinite loading", async () => {
    render(
      <MemoryRouter initialEntries={["/clinica/clinica-teste/pacientes/patient-123/cadastro"]}>
        <Routes>
          <Route path="/clinica/:clinicKey/pacientes/:id/cadastro" element={<CadastroCompleto />} />
        </Routes>
      </MemoryRouter>
    );

    // Should load and display patient name in title / inputs
    expect(await screen.findByDisplayValue("Carlos Teste Silva")).toBeInTheDocument();
    expect(screen.getByText("Cadastro Completo")).toBeInTheDocument();
    expect(screen.getByDisplayValue("123.456.789-01")).toBeInTheDocument();
  });

  it("handles patient not found gracefully by redirecting and not hanging", async () => {
    render(
      <MemoryRouter initialEntries={["/clinica/clinica-teste/pacientes/non-existent/cadastro"]}>
        <Routes>
          <Route path="/clinica/:clinicKey/pacientes/:id/cadastro" element={<CadastroCompleto />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/clinica/clinica-teste");
    });
  });
});
