import { describe, expect, it, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PlatformFormLibraryManager } from "./PlatformFormLibraryManager";

// Mock useAuth
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "admin-123", email: "admin@platform.com" },
    isPlatformOwner: true,
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
      rpc: () => Promise.resolve({ data: null, error: null }),
    },
  };
});

describe("PlatformFormLibraryManager Component", () => {
  it("renders backoffice KPIs and actions", async () => {
    render(
      <MemoryRouter>
        <PlatformFormLibraryManager />
      </MemoryRouter>
    );

    expect(screen.getByText("Total de Modelos")).toBeDefined();
    expect(screen.getByText("Importações Totais")).toBeDefined();
    expect(screen.getByText("Curtidas Comunitárias")).toBeDefined();
    expect(screen.getByText("Destaques Editoriais")).toBeDefined();
    expect(screen.getByText("Criar Modelo Oficial")).toBeDefined();
  });
});
