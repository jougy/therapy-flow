import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformRolesManagementModal } from "./PlatformRolesManagementModal";
import { supabase } from "@/integrations/supabase/client";

window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

vi.mock("@/components/platform/platform-api", () => ({
  callRpc: vi.fn().mockResolvedValue({
    data: {
      roles: [
        {
          id: "r-1",
          clinic_id: "clinic-1",
          role_key: "admin",
          label: "Administrador(a)",
          description: "Acompanha a equipe",
          base_operational_role: "admin",
          sort_order: 10,
          is_system: true,
        },
        {
          id: "r-2",
          clinic_id: "clinic-1",
          role_key: "professional",
          label: "Profissional",
          description: "Fluxo clínico",
          base_operational_role: "professional",
          sort_order: 20,
          is_system: true,
        },
      ],
      capabilities: [
        {
          id: "c-1",
          clinic_id: "clinic-1",
          operational_role: "admin",
          capability: "patients.read",
          enabled: true,
        },
      ],
      usage_counts: {
        admin: 2,
        professional: 5,
      },
    },
    error: null,
  }),
  getErrorMessage: vi.fn((err) => String(err)),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

const mockUpsert = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
      upsert: (...args: unknown[]) => mockUpsert(...args),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
    })),
  },
}));

describe("PlatformRolesManagementModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza o modal com o título Gerenciar papéis operacionais e categorias", async () => {
    render(
      <PlatformRolesManagementModal
        clinicId="clinic-1"
        clinicName="Clínica Teste"
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Gerenciar papéis operacionais")).toBeInTheDocument();
      expect(screen.getByText("Hierarquias")).toBeInTheDocument();
      expect(screen.getByText("Novo papel")).toBeInTheDocument();
    });

    expect(screen.getByText("Clínico")).toBeInTheDocument();
    expect(screen.getByText("Agenda")).toBeInTheDocument();
    expect(screen.getByText("Equipe")).toBeInTheDocument();
    expect(screen.getByText("Administração")).toBeInTheDocument();
    expect(screen.getByText("Financeiro")).toBeInTheDocument();
  });

  it("permite filtrar por categoria ao clicar no botão Agenda", async () => {
    render(
      <PlatformRolesManagementModal
        clinicId="clinic-1"
        clinicName="Clínica Teste"
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Agenda")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Agenda"));

    await waitFor(() => {
      expect(screen.getByText("Agenda própria")).toBeInTheDocument();
      expect(screen.getByText("Agenda da equipe")).toBeInTheDocument();
    });
  });
});
