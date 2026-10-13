import { describe, expect, it, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BibliotecaFormularios } from "./BibliotecaFormularios";

let mockAuthContext = {
  clinic: { id: "clinic-123", name: "Clínica Teste", route_key: "clinica-teste", subscription_plan: "clinic" },
  clinicId: "clinic-123",
  user: { id: "user-123", email: "dr@teste.com" },
  profile: { full_name: "Dr. Roberto", profession: "fisioterapeuta" },
  can: () => true,
  isPlatformOwner: false,
};

// Mock useAuth
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockAuthContext,
}));

// Mock Supabase
vi.mock("@/integrations/supabase/client", () => {
  const createQueryChain = () => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      single: () => Promise.resolve({ data: null, error: null }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
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
  it("restricts categories to Fisioterapia and Geral for monodisciplinary physiotherapists", async () => {
    mockAuthContext = {
      clinic: { id: "clinic-123", name: "Clínica Teste", route_key: "clinica-teste", subscription_plan: "clinic" },
      clinicId: "clinic-123",
      user: { id: "user-123", email: "dr@teste.com" },
      profile: { full_name: "Dr. Roberto", profession: "fisioterapeuta" },
      can: () => true,
      isPlatformOwner: false,
    };

    render(
      <MemoryRouter>
        <BibliotecaFormularios />
      </MemoryRouter>
    );

    expect(
      screen.getByText("Biblioteca de Modelos de Formulários")
    ).toBeDefined();

    // Na clínica monodisciplinar de Fisioterapeuta:
    expect(screen.getByRole("button", { name: "Fisioterapia" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Geral" })).toBeDefined();
    // Outras áreas NÃO devem aparecer
    expect(screen.queryByRole("button", { name: "Psicologia" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Fonoaudiologia" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Todas as Áreas" })).toBeNull();
    expect(screen.getByText(/Visualizando modelos exclusivos para/)).toBeDefined();
  });

  it("allows all categories for Enterprise clinics (multidisciplinary)", async () => {
    mockAuthContext = {
      clinic: { id: "clinic-enterprise", name: "Clínica Enterprise", route_key: "clinica-ent", subscription_plan: "enterprise" },
      clinicId: "clinic-enterprise",
      user: { id: "user-ent", email: "admin@enterprise.com" },
      profile: { full_name: "Dra. Gestora", profession: "fisioterapeuta" },
      can: () => true,
      isPlatformOwner: false,
    };

    render(
      <MemoryRouter>
        <BibliotecaFormularios />
      </MemoryRouter>
    );

    // Em clínica Enterprise, visão multidisciplinar é liberada:
    expect(screen.getByText("Todas as Áreas")).toBeDefined();
    expect(screen.getByText("Fisioterapia")).toBeDefined();
    expect(screen.getByText("Psicologia")).toBeDefined();
    expect(screen.getByText("Fonoaudiologia")).toBeDefined();
  });
});

