import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PacienteResumo from "@/pages/PacienteResumo";
import { useAuth } from "@/hooks/useAuth";
import * as patientRouting from "@/lib/patient-routing";
import * as patientExport from "@/lib/patient-export";
import * as toastHook from "@/hooks/use-toast";

const navigateMock = vi.fn();
const trackEventMock = vi.fn();
const trackDocumentPrintMock = vi.fn();
const trackExportJsonMock = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    trackEvent: trackEventMock,
    trackDocumentPrint: trackDocumentPrintMock,
    trackExportPdf: vi.fn(),
    trackExportJson: trackExportJsonMock,
    triggerDomainSync: vi.fn(),
  }),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
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
    useParams: () => ({ id: "PAC-001", clinicKey: "guardian" }),
    useLocation: () => ({ search: "" }),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [] }),
          eq: vi.fn().mockResolvedValue({ data: [] }),
        };
      }
      if (table === "patient_clinical_snapshots") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [] }),
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
  clinical_profile: {
    risk_flags: ["fall_risk", "allergy"],
  },
  emergency_contact: {
    name: "Maria Silva",
    relationship: "Mãe",
    phone: "92999998888",
  },
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
  responsible_cpf: "999.888.777-66",
  uses_responsible_cpf: true,
  address_complement: null,
  origin_insurance_member_id: null,
  origin_insurance_plan: null,
  origin_insurance_provider: null,
  origin_referrer_name: null,
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("PacienteResumo - Modernized Clinical Summary", () => {
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

  it("renders the Imprimir / Exportar button and patient header", async () => {
    renderWithClient(<PacienteResumo />);

    await waitFor(() => {
      expect(screen.getByText("Resumo Clínico")).toBeInTheDocument();
    });

    expect(screen.getAllByText("Manuella Christina Nogueira da Silva").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /imprimir \/ exportar/i })).toBeInTheDocument();
  });

  it("renders risk flags and medical chart code in header", async () => {
    renderWithClient(<PacienteResumo />);

    await waitFor(() => {
      expect(screen.getByText(/Prontuário: PAC-001/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/2 Alertas de risco/i)).toBeInTheDocument();
  });

  it("does not render PatientRegistrationPrintView in the DOM until print modal is triggered", async () => {
    renderWithClient(<PacienteResumo />);

    await waitFor(() => {
      expect(screen.getByText("Resumo Clínico")).toBeInTheDocument();
    });

    // Before opening print modal, print view portal is NOT in document (no DOM leak)
    expect(document.getElementById("print-patient-registration-root")).toBeNull();

    const triggerBtn = screen.getByRole("button", { name: /imprimir \/ exportar/i });
    fireEvent.click(triggerBtn);

    const printItem = await screen.findByText(/imprimir cadastro \(pdf\)/i);
    fireEvent.click(printItem);

    // Modal de responsabilidade LGPD deve abrir e print view deve ser montada
    await waitFor(() => {
      expect(screen.getByText(/termo de responsabilidade para impressão/i)).toBeInTheDocument();
      expect(document.getElementById("print-patient-registration-root")).not.toBeNull();
    });
  });

  it("triggers JSON export download and audit telemetry when authorized", async () => {
    const downloadSpy = vi.spyOn(patientExport, "downloadPatientDataJson").mockImplementation(() => {});

    renderWithClient(<PacienteResumo />);

    await waitFor(() => {
      expect(screen.getByText("Resumo Clínico")).toBeInTheDocument();
    });

    const triggerBtn = screen.getByRole("button", { name: /imprimir \/ exportar/i });
    fireEvent.click(triggerBtn);

    const exportItem = await screen.findByText(/exportar dados \(json\)/i);
    fireEvent.click(exportItem);

    expect(downloadSpy).toHaveBeenCalled();
    expect(trackExportJsonMock).toHaveBeenCalledWith(
      "patient",
      mockPatient.id,
      expect.objectContaining({
        action: "lgpd_data_export",
        patient_code: "PAC-001",
      })
    );
  });

  it("blocks JSON export and logs unauthorized attempt when user lacks permission", async () => {
    vi.mocked(useAuth).mockReturnValue({
      clinic: { id: "clinic-1", name: "Ins. Guardian Of The Amazon", route_key: "guardian" } as any,
      clinicId: "clinic-1",
      profile: { full_name: "Assistente" } as any,
      user: { email: "assistente@exemplo.com" } as any,
      can: (cap: string) => cap !== "patients.read",
    } as any);

    const downloadSpy = vi.spyOn(patientExport, "downloadPatientDataJson").mockImplementation(() => {});

    renderWithClient(<PacienteResumo />);

    await waitFor(() => {
      expect(screen.getByText("Resumo Clínico")).toBeInTheDocument();
    });

    const triggerBtn = screen.getByRole("button", { name: /imprimir \/ exportar/i });
    fireEvent.click(triggerBtn);

    const exportItem = await screen.findByText(/exportar dados \(json\)/i);
    fireEvent.click(exportItem);

    expect(downloadSpy).not.toHaveBeenCalled();
    expect(trackEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "page_view",
        metadata: expect.objectContaining({
          action: "unauthorized_export_attempt",
        }),
      })
    );
  });

  it("navigates using scoped clinic route path getClinicPatientPath", async () => {
    renderWithClient(<PacienteResumo />);

    await waitFor(() => {
      expect(screen.getByText("Resumo Clínico")).toBeInTheDocument();
    });

    const backBtn = screen.getByRole("button", { name: /voltar ao paciente/i });
    fireEvent.click(backBtn);

    expect(navigateMock).toHaveBeenCalledWith("/clinica/guardian/pacientes/PAC-001");
  });
});
