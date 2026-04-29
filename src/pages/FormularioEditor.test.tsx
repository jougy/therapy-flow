import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FormularioEditor from "@/pages/FormularioEditor";
import { useAuth } from "@/hooks/useAuth";
import { buildAnamnesisTemplateExchangePayload } from "@/lib/anamnesis-forms";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select value={value} onChange={(event) => onValueChange?.(event.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: ({ placeholder }: any) => <>{placeholder}</>,
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
    HTMLElement.prototype.scrollIntoView = vi.fn();
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

  it("toggles checklist and multiple choice without resetting options", async () => {
    const updateSpy = vi.fn().mockReturnThis();
    const selectSpy = vi.fn().mockReturnThis();
    const eqSpy = vi.fn().mockReturnThis();
    const singleSpy = vi.fn().mockResolvedValue({
      data: {
        clinic_id: "clinic-1",
        description: "Modelo inicial",
        id: "template-1",
        is_active: true,
        is_system_default: false,
        name: "Ficha teste",
        schema: [
          {
            id: "field_1",
            label: "Sintomas",
            type: "checklist",
            options: [
              { id: "option_1", label: "Dor" },
              { id: "option_2", label: "Rigidez" },
            ],
          },
        ],
        user_id: "owner-1",
      },
      error: null,
    });

    vi.mocked(supabase.from).mockReturnValue({
      eq: eqSpy,
      insert: vi.fn().mockReturnThis(),
      select: selectSpy,
      single: singleSpy,
      update: updateSpy,
    } as never);

    render(
      <MemoryRouter initialEntries={["/configuracoes/formularios/template-1"]}>
        <Routes>
          <Route path="/configuracoes/formularios/:templateId" element={<FormularioEditor />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByDisplayValue("Ficha teste")).toBeInTheDocument());
    expect(screen.getByDisplayValue("Dor")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Rigidez")).toBeInTheDocument();

    fireEvent.change(screen.getAllByRole("combobox")[0]!, { target: { value: "multiple_choice" } });

    fireEvent.click(screen.getByRole("button", { name: /salvar ficha/i }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: [
          expect.objectContaining({
            id: "field_1",
            label: "Sintomas",
            type: "multiple_choice",
            options: [
              { id: "option_1", label: "Dor" },
              { id: "option_2", label: "Rigidez" },
            ],
          }),
        ],
      })
    );
  });
});
