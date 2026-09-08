import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformPersonDetailPage } from "./PlatformPersonDetailPage";
import { callPlatformAccountAdmin, callRpc } from "@/components/platform/platform-api";

window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/components/platform/platform-api", () => ({
  callPlatformAccountAdmin: vi.fn(),
  callRpc: vi.fn(),
  getErrorMessage: vi.fn((err: unknown) => String(err)),
  itemLabels: {
    account: "Conta",
    patient: "Paciente",
  },
  PLATFORM_CLINIC_DETAIL_ROUTE: "/platform/clinicas/detalhes",
  storePlatformClinicKey: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        order: vi.fn().mockResolvedValue({
          data: [
            { id: "clinic-3", name: "Clínica Gama", cnpj: "11.222.333/0001-44" },
          ],
        }),
      })),
    })),
    auth: {
      mfa: {
        listFactors: vi.fn().mockResolvedValue({ data: { totp: [] }, error: null }),
        challengeAndVerify: vi.fn().mockResolvedValue({ error: null }),
      },
    },
  },
}));

vi.mock("@/components/PlatformUserGovernancePanel", () => ({
  PlatformUserGovernancePanel: () => <div data-testid="governance-panel" />,
}));

vi.mock("@/components/PlatformUserStatistics", () => ({
  PlatformUserStatistics: () => <div data-testid="statistics-panel" />,
}));

vi.mock("@/components/platform/PlatformAccountOperations", () => ({
  PlatformAccountOperations: () => <div data-testid="account-operations" />,
}));

vi.mock("@/components/platform/PlatformInfoGrid", () => ({
  PlatformInfoGrid: () => <div data-testid="info-grid" />,
}));

describe("PlatformPersonDetailPage - Gestão de Relação Multi-Clínica", () => {
  const mockDetailData = {
    entity: {
      id: "user-123",
      email: "dr.joao@clinica.com",
      full_name: "Dr. João Silva",
      created_at: "2026-01-10T10:00:00Z",
    },
    memberships: [
      {
        membership_id: "mem-1",
        clinic_id: "clinic-1",
        clinic_name: "Clínica Alfa",
        clinic_route_key: "alfa-key",
        account_role: "member",
        operational_role: "professional",
        membership_status: "active",
      },
      {
        membership_id: "mem-2",
        clinic_id: "clinic-2",
        clinic_name: "Clínica Beta Owner",
        clinic_route_key: "beta-key",
        account_role: "account_owner",
        operational_role: "owner",
        membership_status: "active",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(callRpc).mockImplementation(async (method: string) => {
      if (method === "get_platform_person_detail") {
        return { data: mockDetailData, error: null };
      }
      if (method === "list_platform_clinics") {
        return {
          data: [
            { clinic_id: "clinic-1", clinic_name: "Clínica Alfa", clinic_cnpj: "123" },
            { clinic_id: "clinic-2", clinic_name: "Clínica Beta Owner", clinic_cnpj: "456" },
            { clinic_id: "clinic-3", clinic_name: "Clínica Gama Nova", clinic_cnpj: "789" },
          ],
          error: null,
        };
      }
      return { data: null, error: null };
    });
    vi.mocked(callPlatformAccountAdmin).mockResolvedValue({ success: true });
  });

  it("renderiza os cards de clínica com botões de editar e desvincular", async () => {
    render(<PlatformPersonDetailPage itemType="account" itemId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("Clínica Alfa")).toBeInTheDocument();
      expect(screen.getByText("Clínica Beta Owner")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle("Alterar relação com a clínica");
    expect(editButtons).toHaveLength(2);

    const deleteButtonAlfa = screen.getByTitle("Desvincular usuário desta clínica");
    expect(deleteButtonAlfa).toBeInTheDocument();

    const deleteButtonBeta = screen.getByTitle("Owner não pode ser desvinculado diretamente");
    expect(deleteButtonBeta).toBeInTheDocument();

    expect(screen.getByText("Adicionar a uma clínica")).toBeInTheDocument();
  });

  it("abre modal de edição ao clicar no lápis e permite salvar com justificativa auditável", async () => {
    render(<PlatformPersonDetailPage itemType="account" itemId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("Clínica Alfa")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle("Alterar relação com a clínica");
    fireEvent.click(editButtons[0]);

    expect(screen.getByText("Alterar Relação com a Clínica")).toBeInTheDocument();
    expect(screen.getByLabelText(/Papel Operacional/i)).toBeInTheDocument();

    const reasonInput = screen.getByPlaceholderText(/Promoção a administrador/i);
    fireEvent.change(reasonInput, { target: { value: "Ajuste de perfil para admin da unidade" } });

    const saveButton = screen.getByRole("button", { name: /Salvar alterações/i });
    expect(saveButton).not.toBeDisabled();
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(callPlatformAccountAdmin).toHaveBeenCalledWith(
        "update_membership_role",
        expect.objectContaining({
          clinicId: "clinic-1",
          identifier: "user-123",
        }),
        "Ajuste de perfil para admin da unidade"
      );
    });
  });

  it("mostra aviso de restrição ao tentar desvincular owner", async () => {
    render(<PlatformPersonDetailPage itemType="account" itemId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("Clínica Beta Owner")).toBeInTheDocument();
    });

    const deleteButtonBeta = screen.getByTitle("Owner não pode ser desvinculado diretamente");
    fireEvent.click(deleteButtonBeta);

    expect(screen.getByText("Desvincular Usuário da Clínica")).toBeInTheDocument();
    expect(
      screen.getByText(/Não é permitido desvincular o proprietário diretamente/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirmar desvinculação/i })).not.toBeInTheDocument();
  });

  it("abre modal ao clicar no botão '+' e carrega clínicas para novo vínculo", async () => {
    render(<PlatformPersonDetailPage itemType="account" itemId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("Adicionar a uma clínica")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Adicionar a uma clínica"));

    await waitFor(() => {
      expect(screen.getByText("Vincular a uma Clínica")).toBeInTheDocument();
      expect(screen.getByLabelText(/Clínica de Destino/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Hierarquia \/ Posição/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Status Inicial/i)).toBeInTheDocument();
    });
  });

  it("exibe a seção de modularização do papel com contadores por categoria e acessos-chave ao editar relação", async () => {
    render(<PlatformPersonDetailPage itemType="account" itemId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("Clínica Alfa")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle("Alterar relação com a clínica");
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Modularização do Papel:/i)).toBeInTheDocument();
      expect(screen.getByText(/Clínico:/i)).toBeInTheDocument();
      expect(screen.getByText(/Agenda:/i)).toBeInTheDocument();
      expect(screen.getByText(/Equipe:/i)).toBeInTheDocument();
      expect(screen.getByText(/Admin:/i)).toBeInTheDocument();
      expect(screen.getByText(/Financeiro:/i)).toBeInTheDocument();
      expect(screen.getByText(/Configurar na clínica/i)).toBeInTheDocument();
    });
  });
});
