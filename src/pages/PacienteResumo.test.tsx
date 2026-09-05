import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PacienteResumo from "@/pages/PacienteResumo";
import { useAuth } from "@/hooks/useAuth";
import * as patientRouting from "@/lib/patient-routing";
import * as patientExport from "@/lib/patient-export";

const navigateMock = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button role="menuitem" onClick={disabled ? undefined : onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({
    flags: { print_general: true },
    loading: false,
    isFeatureEnabled: (key: string) => key === "print_general",
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ id: "PAC-001" }),
    useLocation: () => ({ search: "" }),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [] }),
        };
      }
      if (table === "patient_clinical_snapshots") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [] }),
        };
      }
      if (table === "feature_flags") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              value: {
                print_terms: {
                  content: "Termos de teste de impressão e responsabilidade LGPD.",
                },
              },
            },
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [] }),
      };
    }),
  },
}));

const mockPatient = {
  id: "patient-uuid-1",
  name: "Manuella Christina Nogueira da Silva",
  age: 17,
  date_of_birth: "2008-08-01",
  cpf: "111.222.333-44",
  rg: "1234567",
  gender: "feminino",
  pronoun: "ela/dela",
  profession: "Estudante",
  phone: "92988163117",
  email: "manu@exemplo.com",
  status: "ativo",
  registration_complete: true,
  origin_type: "outros",
  origin_other_name: "Não informado",
  origin_other_description: "Por favor, adicione uma opção de origem para este paciente",
  patient_code: "PAC-001",
  blood_type: "O+",
  chronic_conditions: null,
  allergies: null,
  surgeries: null,
  continuous_medications: null,
  clinical_notes: null,
  clinical_profile: null,
  emergency_contact: null,
  street: "Rua Teste",
  address_number: "100",
  neighborhood: "Centro",
  city: "Manaus",
  state: "AM",
  cep: "69000-000",
  country: "Brasil",
  created_at: "2026-01-01T10:00:00Z",
  updated_at: "2026-02-01T10:00:00Z",
  clinic_id: "clinic-1",
  user_id: "user-1",
  is_recurring: false,
  recurring_time: "08:00",
  recurring_weekdays: [],
  responsible_cpf: null,
  uses_responsible_cpf: false,
  address_complement: null,
  origin_insurance_member_id: null,
  origin_insurance_plan: null,
  origin_insurance_provider: null,
  origin_referrer_name: null,
};

describe("PacienteResumo - Print and LGPD Export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      clinic: { id: "clinic-1", name: "Ins. Guardian Of The Amazon", route_key: "guardian" } as any,
      clinicId: "clinic-1",
      profile: { full_name: "Terapeuta Responsável" } as any,
      user: { email: "terapeuta@exemplo.com" } as any,
      can: () => true,
    } as any);

    vi.spyOn(patientRouting, "fetchPatientByRef").mockResolvedValue({
      data: mockPatient as any,
      error: null,
    });
  });

  it("renders the Imprimir / Exportar button in header", async () => {
    render(
      <MemoryRouter>
        <PacienteResumo />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Resumo Clínico")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /imprimir \/ exportar/i })).toBeInTheDocument();
  });

  it("opens PrintResponsibilityModal when Imprimir cadastro completo (PDF) is selected", async () => {
    render(
      <MemoryRouter>
        <PacienteResumo />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Resumo Clínico")).toBeInTheDocument();
    });

    const triggerBtn = screen.getByRole("button", { name: /imprimir \/ exportar/i });
    fireEvent.click(triggerBtn);

    const printItem = await screen.findByText(/imprimir cadastro \(pdf\)/i);
    fireEvent.click(printItem);

    // Modal de responsabilidade LGPD deve abrir
    await waitFor(() => {
      expect(screen.getByText(/termo de responsabilidade para impressão/i)).toBeInTheDocument();
      expect(screen.getByText(/LGPD & Proteção de Dados Sensíveis/i)).toBeInTheDocument();
    });
  });

  it("triggers JSON export download when Exportar dados em JSON is selected", async () => {
    const downloadSpy = vi.spyOn(patientExport, "downloadPatientDataJson").mockImplementation(() => {});

    render(
      <MemoryRouter>
        <PacienteResumo />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Resumo Clínico")).toBeInTheDocument();
    });

    const triggerBtn = screen.getByRole("button", { name: /imprimir \/ exportar/i });
    fireEvent.click(triggerBtn);

    const exportItem = await screen.findByText(/exportar dados \(json\)/i);
    fireEvent.click(exportItem);

    expect(downloadSpy).toHaveBeenCalled();
  });
});
