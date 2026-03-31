import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FormularioEditor from "@/pages/FormularioEditor";
import { useAuth } from "@/hooks/useAuth";
import { buildAnamnesisTemplateExchangePayload } from "@/lib/anamnesis-forms";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
    })),
  },
}));

describe("FormularioEditor", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      accountRole: "account_owner",
      can: (capability) => capability === "forms.manage",
      capabilities: {} as never,
      clinic: {
        account_owner_user_id: "owner-1",
        id: "clinic-1",
        logo_url: null,
        name: "Clinica Aurora",
        subaccount_limit: 4,
        subscription_plan: "clinic",
      },
      clinicId: "clinic-1",
      isSuperAdmin: false,
      loading: false,
      membership: null,
      membershipStatus: "active",
      operationalRole: "owner",
      profile: null,
      refreshAuthState: vi.fn(async () => {}),
      session: null,
      signOut: vi.fn(async () => {}),
      subscriptionPlan: "clinic",
      user: {
        email: "owner@aurora.test",
        id: "owner-1",
      } as never,
    });
  });

  it("shows Data in the available blocks menu for a new form", async () => {
    render(
      <MemoryRouter initialEntries={["/configuracoes/formularios/novo"]}>
        <Routes>
          <Route path="/configuracoes/formularios/:templateId" element={<FormularioEditor />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Blocos disponíveis")).toBeInTheDocument());
    expect(screen.getAllByRole("button", { name: "Data" })).not.toHaveLength(0);
  });

  it("imports a template file directly into the current draft editor", async () => {
    const importedPayload = buildAnamnesisTemplateExchangePayload({
      description: "Triagem importada",
      exportedAt: "2026-03-31T21:00:00.000Z",
      kind: "template",
      name: "Ficha importada",
      schema: [
        { id: "section_imported", label: "Seção importada", type: "section" },
        { groupKey: "section_imported", id: "field_imported", label: "Campo importado", type: "short_text" },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/configuracoes/formularios/novo"]}>
        <Routes>
          <Route path="/configuracoes/formularios/:templateId" element={<FormularioEditor />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Nova ficha")).toBeInTheDocument());

    const file = new File([JSON.stringify(importedPayload)], "modelo.json", { type: "application/json" });
    Object.defineProperty(file, "text", {
      value: vi.fn(async () => JSON.stringify(importedPayload)),
    });
    const input = document.querySelector('input[type="file"][accept="application/json,.json"]') as HTMLInputElement | null;

    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByDisplayValue("Ficha importada")).toBeInTheDocument());
    expect(screen.getByDisplayValue("Triagem importada")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Campo importado")).toBeInTheDocument();
  });
});
