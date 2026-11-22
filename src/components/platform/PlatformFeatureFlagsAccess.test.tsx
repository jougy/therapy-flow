import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PlatformLayout } from "./PlatformLayout";
import { PlatformMobileDock } from "@/components/PlatformMobileDock";
import { SimulationTopDock } from "@/components/SimulationTopDock";
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
  PlatformDirectoryPage: () => <div data-testid="mock-directory-page">Mock Directory Page</div>,
}));

vi.mock("@/pages/platform/PlatformMarketingPage", () => ({
  PlatformMarketingPage: () => <div data-testid="mock-marketing-page">Mock Marketing Page</div>,
}));

vi.mock("@/pages/platform/PlatformAgendaMaster", () => ({
  PlatformAgendaMaster: () => <div data-testid="mock-agenda-page">Mock Agenda Page</div>,
}));

vi.mock("@/components/PlatformBillingMaster", () => ({
  PlatformBillingMaster: () => <div data-testid="mock-billing-page">Mock Billing Page</div>,
}));

vi.mock("@/components/PlatformGovernanceSettings", () => ({
  PlatformGovernanceSettings: () => <div data-testid="mock-governance-page">Mock Governance Page</div>,
}));

describe("Dynamic Platform Feature Flags integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filtra abas do PlatformLayout, PlatformMobileDock e botões Simulação/Debug via hasPlatformFlag", () => {
    const flags: Record<string, boolean> = {
      billing: true,
      logs: true,
      simulation: false,
      debug: false,
    };

    vi.mocked(useAuth).mockReturnValue({
      isPlatformOwner: false,
      isPlatformMarketing: true,
      platformRole: "platform_marketing",
      platformFeatureFlags: flags,
      hasPlatformFlag: (flag: string) => Boolean(flags[flag]),
      startPlatformClinicSimulation: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/platform/faturamento"]}>
        <PlatformLayout title="Faturamento">
          <div>Conteúdo Faturamento</div>
        </PlatformLayout>
      </MemoryRouter>
    );

    expect(screen.getByText("Faturamento & Webhooks")).toBeInTheDocument();
    expect(screen.getByText("Erros & Logs")).toBeInTheDocument();
    expect(screen.queryByText("Marketing")).not.toBeInTheDocument();
    expect(screen.queryByText("Diretório Mestre")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Simulação \(Preview\)/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Debug$/i })).not.toBeInTheDocument();
  });

  it("redireciona rota não autorizada em PlatformAdmin para a primeira aba liberada pelas flags", () => {
    const flags: Record<string, boolean> = {
      billing: true,
      governance: false,
      marketing: false,
    };

    vi.mocked(useAuth).mockReturnValue({
      isPlatformOwner: false,
      isPlatformMarketing: true,
      platformRole: "platform_marketing",
      platformFeatureFlags: flags,
      hasPlatformFlag: (flag: string) => Boolean(flags[flag]),
      startPlatformClinicSimulation: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/platform/governanca"]}>
        <Routes>
          <Route path="/platform/*" element={<PlatformAdmin />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId("mock-billing-page")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-governance-page")).not.toBeInTheDocument();
  });

  it("filtra abas padrão do PlatformMobileDock via hasPlatformFlag quando tabs não é sobrescrito", () => {
    const flags: Record<string, boolean> = {
      forms: true,
      tags: true,
    };

    vi.mocked(useAuth).mockReturnValue({
      isPlatformOwner: false,
      isPlatformMarketing: true,
      platformRole: "platform_marketing",
      platformFeatureFlags: flags,
      hasPlatformFlag: (flag: string) => Boolean(flags[flag]),
    } as unknown as ReturnType<typeof useAuth>);

    render(<PlatformMobileDock activeTab="forms-library" onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Biblioteca de Formulários" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gestão de Tags" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Diretório Mestre" })).not.toBeInTheDocument();
  });

  it("oculta Debug e controles de simulação no SimulationTopDock conforme flags", () => {
    vi.mocked(useAuth).mockReturnValue({
      isPlatformOwner: false,
      isPlatformMarketing: true,
      platformRole: "platform_marketing",
      platformFeatureFlags: { simulation: false, debug: false },
      hasPlatformFlag: () => false,
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <SimulationTopDock
        clinicBrandName="Clínica Teste"
        isSimulationMode={true}
        simulatedRole="owner"
        onRoleChange={vi.fn()}
        subscriptionPlan="clinic"
        onPlanChange={vi.fn()}
        activeRoleOverridesCount={0}
        onOpenRoleModal={vi.fn()}
        activeOverrideCount={0}
        onOpenFlagsModal={vi.fn()}
        errorCount={0}
        onOpenDebugModal={vi.fn()}
        onOpenGeneratePatientModal={vi.fn()}
        viewMode="widescreen"
        onViewModeChange={vi.fn()}
        onExitSimulation={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: /Abrir Diagnóstico e Debug/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gerar Novo Paciente Teste/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sair da Simulação/i })).toBeInTheDocument();
  });
});
