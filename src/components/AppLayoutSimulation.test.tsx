import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AppLayout from "./AppLayout";
import { FeatureFlagsProvider } from "@/contexts/FeatureFlagsContext";

const mockSetPlatformSupportRole = vi.fn();
const mockSetPlatformSimulatedPlan = vi.fn();
const mockEndPlatformClinicAccess = vi.fn().mockResolvedValue(undefined);

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    clinic: { id: "clinic-test-1", name: "Clínica Teste Simulation", route_key: "clinica-teste" },
    platformAccess: {
      clinic: { id: "clinic-test-1", name: "Clínica Teste Simulation", route_key: "clinica-teste" },
      reason: "Simulação de Experiência do Usuário (Backoffice)",
      simulatedRole: "owner",
      simulatedPlan: "clinic",
      isSimulation: true,
    },
    setPlatformSupportRole: mockSetPlatformSupportRole,
    setPlatformSimulatedPlan: mockSetPlatformSimulatedPlan,
    endPlatformClinicAccess: mockEndPlatformClinicAccess,
    can: () => true,
    capabilities: {},
    simulatedRoleCapabilityOverrides: {},
    profile: { full_name: "Admin User", email: "admin@test.com" },
    subscriptionPlan: "clinic",
  }),
}));

describe("AppLayout Simulation Mode TopBar", () => {
  it("renders simulation mode bar with role, plan, feature flags, and viewport controls", () => {
    render(
      <MemoryRouter>
        <FeatureFlagsProvider>
          <AppLayout>
            <div>Conteúdo da Clínica de Teste</div>
          </AppLayout>
        </FeatureFlagsProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/Modo Simulação Backoffice/i)).toBeInTheDocument();
    expect(screen.getByText("Conteúdo da Clínica de Teste")).toBeInTheDocument();

    // Check Role select trigger
    expect(screen.getByText("Owner")).toBeInTheDocument();

    // Check Feature Flags button
    const flagsButton = screen.getByRole("button", { name: /Flags/i });
    expect(flagsButton).toBeInTheDocument();

    // Check Viewport switcher buttons
    expect(screen.getByText("Vertical (Mobile)")).toBeInTheDocument();
  });

  it("toggles mobile viewport layout when clicking Vertical (Mobile)", () => {
    render(
      <MemoryRouter>
        <FeatureFlagsProvider>
          <AppLayout>
            <div>Conteúdo Mobile Teste</div>
          </AppLayout>
        </FeatureFlagsProvider>
      </MemoryRouter>
    );

    const mobileBtn = screen.getByText("Vertical (Mobile)");
    fireEvent.click(mobileBtn);

    // Smartphone clock indicator and touchscreen simulation banner should appear in mobile mode
    expect(screen.getByText("09:41")).toBeInTheDocument();
    expect(screen.getByText(/Simulação Touchscreen Mobile Ativa/i)).toBeInTheDocument();
  });

  it("opens Feature Flags Modal when clicking Flags button", () => {
    render(
      <MemoryRouter>
        <FeatureFlagsProvider>
          <AppLayout>
            <div>Conteúdo Modal Teste</div>
          </AppLayout>
        </FeatureFlagsProvider>
      </MemoryRouter>
    );

    const flagsButton = screen.getByRole("button", { name: /Flags/i });
    fireEvent.click(flagsButton);

    expect(screen.getByText("Feature Flags da Simulação")).toBeInTheDocument();
  });

  it("opens Role Permissions Modal when clicking Permissões button next to role selector", () => {
    render(
      <MemoryRouter>
        <FeatureFlagsProvider>
          <AppLayout>
            <div>Conteúdo Role Modal Teste</div>
          </AppLayout>
        </FeatureFlagsProvider>
      </MemoryRouter>
    );

    const permissionsButton = screen.getByRole("button", { name: /Permissões/i });
    fireEvent.click(permissionsButton);

    expect(screen.getByText(/Permissões do Papel: Owner/i)).toBeInTheDocument();
  });

  it("opens Simulation Test Patient Generator Dialog when clicking + Paciente Teste button", () => {
    render(
      <MemoryRouter>
        <FeatureFlagsProvider>
          <AppLayout>
            <div>Conteúdo Paciente Teste</div>
          </AppLayout>
        </FeatureFlagsProvider>
      </MemoryRouter>
    );

    const testPatientButton = screen.getByRole("button", { name: /\+ Paciente Teste/i });
    expect(testPatientButton).toBeInTheDocument();

    fireEvent.click(testPatientButton);

    expect(screen.getByText("Gerador de Paciente Teste")).toBeInTheDocument();
    expect(screen.getByText("Adulto Padrão")).toBeInTheDocument();
    expect(screen.getByText("Menor com Responsável")).toBeInTheDocument();
  });
});
