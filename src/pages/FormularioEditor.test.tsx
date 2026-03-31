import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FormularioEditor from "@/pages/FormularioEditor";
import { useAuth } from "@/hooks/useAuth";

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
});
