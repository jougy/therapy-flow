import { describe, expect, it, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BibliotecaFormularios } from "./BibliotecaFormularios";

// Mock useAuth
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    clinic: { id: "clinic-123", name: "Clínica Teste", route_key: "clinica-teste" },
    clinicId: "clinic-123",
    user: { id: "user-123", email: "dr@teste.com" },
    profile: { full_name: "Dr. Roberto" },
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
      single: () => Promise.resolve({ data: null, error: null }),
      then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
    };
    return chain;
  };

  return {
    supabase: {
      from: () => createQueryChain(),
      rpc: () => Promise.resolve({ data: { liked: true, likes_count: 1 }, error: null }),
    },
  };
});

describe("BibliotecaFormularios Page", () => {
  it("renders page header and categories list", async () => {
    render(
      <MemoryRouter>
        <BibliotecaFormularios />
      </MemoryRouter>
    );

    expect(
      screen.getByText("Biblioteca de Modelos de Formulários")
    ).toBeDefined();

    expect(screen.getByText("Todas as Áreas")).toBeDefined();
    expect(screen.getByText("Psicologia")).toBeDefined();
    expect(screen.getByText("Fisioterapia")).toBeDefined();
    expect(screen.getByText("Publicar Modelo")).toBeDefined();
  });
});

