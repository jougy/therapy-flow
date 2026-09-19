import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PersonalPortfolioSessionView } from "@/pages/personal/PersonalPortfolioSessionView";
import * as clinicalPortfolioService from "@/services/clinicalPortfolioService";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/services/clinicalPortfolioService", () => ({
  fetchPersonalPortfolioSessionDetail: vi.fn(),
}));

describe("PersonalPortfolioSessionView Component", () => {
  const mockUser = {
    id: "user-test-123",
    email: "dr.teste@clinica.com",
    user_metadata: { full_name: "Dr. Teste Fisioterapeuta" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({
      user: mockUser,
      profile: { id: "user-test-123", full_name: "Dr. Teste Fisioterapeuta" },
    });
  });

  it("renders session technical details in read-only mode with patient and clinic info", async () => {
    (clinicalPortfolioService.fetchPersonalPortfolioSessionDetail as any).mockResolvedValue({
      sessionId: "session-abc-123",
      sessionDate: "2026-09-15T14:30:00Z",
      sessionStatus: "concluído",
      clinicId: "clinic-1",
      clinicName: "Clínica Alfa Fisioterapia",
      clinicRouteKey: "clinica-alfa",
      clinicLogoUrl: null,
      patientId: "patient-1",
      patientRef: "PAC-009",
      patientName: "Mariana Souza Santos",
      patientPseudonym: "Paciente M. S. S.",
      patientDemographics: "32 anos • Feminino",
      notesSanitized: "Paciente relata redução significativa da dor na região lombar.",
      treatmentSanitized: "Cinesioterapia motora e liberação miofascial realizada com sucesso.",
      painScore: 2,
      complexityScore: 1,
      createdAt: "2026-09-15T14:00:00Z",
      anamnesisFormResponse: {
        "Grau de Mobilidade": "Excelente",
        "Região de Foco": "Coluna Lombar",
      },
      careLines: [
        { id: "line-1", name: "Coluna Vertebral", color: "#0ea5e9" },
      ],
      anamnesisBaseSchema: [],
    });

    render(
      <MemoryRouter initialEntries={["/espacopessoal/portfolio/session-abc-123"]}>
        <Routes>
          <Route path="/espacopessoal/portfolio/:sessionId" element={<PersonalPortfolioSessionView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/Carregando acervo técnico/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Acervo Técnico do Atendimento")).toBeInTheDocument();
      expect(screen.getByText("Mariana Souza Santos")).toBeInTheDocument();
      expect(screen.getByText("PAC-009")).toBeInTheDocument();
      expect(screen.getByText("32 anos • Feminino")).toBeInTheDocument();
      expect(screen.getByText("Clínica Alfa Fisioterapia")).toBeInTheDocument();
      expect(screen.getByText("concluído")).toBeInTheDocument();
      expect(screen.getByText("Coluna Vertebral")).toBeInTheDocument();
      expect(screen.getByText(/Paciente relata redução significativa da dor na região lombar/i)).toBeInTheDocument();
      expect(screen.getByText(/Respostas da Avaliação \/ Ficha Complementar/i)).toBeInTheDocument();
      expect(screen.getByText("Excelente")).toBeInTheDocument();
    });

    // Zero botões de mutação da clínica ou exclusão
    expect(screen.queryByRole("button", { name: /Mover para lixeira/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Excluir atendimento/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Salvar rascunho/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Concluir atendimento/i })).not.toBeInTheDocument();
  });

  it("navigates back to /espacopessoal when clicking the back button", async () => {
    (clinicalPortfolioService.fetchPersonalPortfolioSessionDetail as any).mockResolvedValue({
      sessionId: "session-abc-123",
      sessionDate: "2026-09-15T14:30:00Z",
      sessionStatus: "concluído",
      clinicId: "clinic-1",
      clinicName: "Clínica Alfa",
      patientId: "patient-1",
      patientName: "Mariana Souza Santos",
      patientPseudonym: "Paciente M. S. S.",
      careLines: [],
      createdAt: "2026-09-15T14:00:00Z",
    });

    render(
      <MemoryRouter initialEntries={["/espacopessoal/portfolio/session-abc-123"]}>
        <Routes>
          <Route path="/espacopessoal/portfolio/:sessionId" element={<PersonalPortfolioSessionView />} />
          <Route path="/espacopessoal" element={<div>Página Meu Espaço Pessoal</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Voltar para o Meu Portfólio/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Voltar para o Meu Portfólio/i }));

    await waitFor(() => {
      expect(screen.getByText("Página Meu Espaço Pessoal")).toBeInTheDocument();
    });
  });

  it("redirects to /espacopessoal with error toast if session is not found or does not belong to the user", async () => {
    (clinicalPortfolioService.fetchPersonalPortfolioSessionDetail as any).mockResolvedValue(null);

    render(
      <MemoryRouter initialEntries={["/espacopessoal/portfolio/non-existent-session"]}>
        <Routes>
          <Route path="/espacopessoal/portfolio/:sessionId" element={<PersonalPortfolioSessionView />} />
          <Route path="/espacopessoal" element={<div>Página Meu Espaço Pessoal</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Atendimento não encontrado",
          variant: "destructive",
        })
      );
      expect(screen.getByText("Página Meu Espaço Pessoal")).toBeInTheDocument();
    });
  });
});
