import { describe, expect, it, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FormTemplateDetailPage } from "./FormTemplateDetailPage";

// Mock useAuth
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    clinic: { id: "clinic-123", name: "Clínica Teste", route_key: "clinica-teste" },
    clinicId: "clinic-123",
    user: { id: "user-123", email: "dr@teste.com", user_metadata: { full_name: "Dr. Roberto" } },
    can: () => true,
    isPlatformOwner: false,
  }),
}));

// Mock Supabase
vi.mock("@/integrations/supabase/client", () => {
  const createQueryChain = () => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      single: () =>
        Promise.resolve({
          data: {
            id: "test-form-1",
            title: "Anamnese de Teste",
            description: "Descrição do modelo de teste",
            category: "Psicologia",
            tags: ["adulto", "teste"],
            schema: [
              { id: "sec_1", label: "Seção 1", type: "section" },
              { id: "f_1", label: "Queixa Principal", type: "short_text", required: true },
            ],
            kind: "template",
            author_name: "Dr. Roberto",
            clinic_name: "Clínica Teste",
            imports_count: 10,
            likes_count: 5,
            is_featured: true,
            is_published: true,
            created_at: "2026-08-01T12:00:00Z",
            updated_at: "2026-08-01T12:00:00Z",
          },
          error: null,
        }),
      then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
    };
    return chain;
  };

  return {
    supabase: {
      from: () => createQueryChain(),
      rpc: () => Promise.resolve({ data: { liked: true, likes_count: 6 }, error: null }),
    },
  };
});

describe("FormTemplateDetailPage Component", () => {
  it("renders product header, tabs, and interactive live preview", async () => {
    render(
      <MemoryRouter initialEntries={["/clinica/clinica-teste/configuracoes/formularios/biblioteca/test-form-1"]}>
        <Routes>
          <Route
            path="/clinica/:clinicKey/configuracoes/formularios/biblioteca/:templateId"
            element={<FormTemplateDetailPage />}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Anamnese de Teste")).toBeDefined();
    expect(screen.getByText("Live Preview Interativo")).toBeDefined();
    expect(screen.getByText("Estrutura & Metadados")).toBeDefined();
    expect(screen.getByText("Comentários & Dicas da Comunidade")).toBeDefined();
    expect(screen.getByText("Simulador de Preenchimento Real (Live Sandbox)")).toBeDefined();
  });
});
