import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PlatformLayout } from "./PlatformLayout";
import PlatformAdmin from "@/pages/PlatformAdmin";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/components/PersonalNotificationsButton", () => ({
  default: () => <div data-testid="notifications-btn" />,
}));

vi.mock("@/components/SimulationDebugPanel", () => ({
  SimulationDebugPanel: () => <div data-testid="simulation-debug-panel" />,
}));

vi.mock("@/pages/platform/PlatformDirectoryPage", () => ({
  PlatformDirectoryPage: () => <div>Mock Directory Page</div>,
}));

vi.mock("@/pages/platform/PlatformMarketingPage", () => ({
  PlatformMarketingPage: () => <div data-testid="mock-marketing-page">Mock Marketing Page</div>,
}));

vi.mock("@/pages/platform/PlatformAgendaMaster", () => ({
  PlatformAgendaMaster: () => <div data-testid="mock-agenda-page">Mock Agenda Page</div>,
}));

vi.mock("@/components/PlatformGovernanceSettings", () => ({
  PlatformGovernanceSettings: () => <div data-testid="mock-governance-page">Mock Governance Page</div>,
}));

describe("platform_marketing RBAC & UI isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exibe apenas Marketing, Agenda de Reuniões, badge platform_marketing, Simulação (Preview) e Espaço pessoal no PlatformLayout", () => {
    vi.mocked(useAuth).mockReturnValue({
      isPlatformOwner: false,
      isPlatformMarketing: true,
      platformRole: "platform_marketing",
      startPlatformClinicSimulation: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/platform/marketing"]}>
        <PlatformLayout title="Marketing & Auto-Lead">
          <div>Conteúdo Marketing</div>
        </PlatformLayout>
      </MemoryRouter>
    );

    expect(screen.getByText("platform_marketing")).toBeInTheDocument();
    expect(screen.queryByText("platform_owner")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Simulação \(Preview\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Espaço pessoal/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Painel mestre/i })).not.toBeInTheDocument();

    expect(screen.getAllByText("Marketing").length).toBeGreaterThan(0);
    expect(screen.getByText("Agenda de Reuniões")).toBeInTheDocument();

    expect(screen.queryByText("Diretório Mestre")).not.toBeInTheDocument();
    expect(screen.queryByText("Biblioteca de Formulários")).not.toBeInTheDocument();
    expect(screen.queryByText("Feedbacks & Avaliações")).not.toBeInTheDocument();
    expect(screen.queryByText("Notas de Novidades")).not.toBeInTheDocument();
    expect(screen.queryByText("Gestão de Tags")).not.toBeInTheDocument();
    expect(screen.queryByText("Governança & Segurança")).not.toBeInTheDocument();
    expect(screen.queryByText("Faturamento & Webhooks")).not.toBeInTheDocument();
    expect(screen.queryByText("Erros & Logs")).not.toBeInTheDocument();
  });

  it("redireciona rotas restritas de /platform/* para /platform/marketing quando usuário é platform_marketing", () => {
    vi.mocked(useAuth).mockReturnValue({
      isPlatformOwner: false,
      isPlatformMarketing: true,
      platformRole: "platform_marketing",
      startPlatformClinicSimulation: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/platform/governanca"]}>
        <Routes>
          <Route path="/platform/*" element={<PlatformAdmin />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId("mock-marketing-page")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-governance-page")).not.toBeInTheDocument();
  });

  it("permite acessar /platform/agenda quando usuário é platform_marketing", () => {
    vi.mocked(useAuth).mockReturnValue({
      isPlatformOwner: false,
      isPlatformMarketing: true,
      platformRole: "platform_marketing",
      startPlatformClinicSimulation: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/platform/agenda"]}>
        <Routes>
          <Route path="/platform/*" element={<PlatformAdmin />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId("mock-agenda-page")).toBeInTheDocument();
  });

  it("mantém todas as abas e Painel mestre visíveis para platform_owner", () => {
    vi.mocked(useAuth).mockReturnValue({
      isPlatformOwner: true,
      isPlatformMarketing: false,
      platformRole: "platform_owner",
      startPlatformClinicSimulation: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/platform/diretorio"]}>
        <PlatformLayout>
          <div>Conteúdo Diretório</div>
        </PlatformLayout>
      </MemoryRouter>
    );

    expect(screen.getByText("platform_owner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Painel mestre/i })).toBeInTheDocument();
    expect(screen.getByText("Diretório Mestre")).toBeInTheDocument();
    expect(screen.getByText("Governança & Segurança")).toBeInTheDocument();
  });
});
