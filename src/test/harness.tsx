import React, { ReactElement, ReactNode } from "react";
import { render as rtlRender, RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, MemoryRouterProps } from "react-router-dom";
import { vi } from "vitest";

export interface HarnessRenderOptions extends Omit<RenderOptions, "wrapper"> {
  initialEntries?: MemoryRouterProps["initialEntries"];
  queryClient?: QueryClient;
  user?: {
    id?: string;
    email?: string;
    role?: string;
    operationalRole?: "owner" | "admin" | "professional" | "receptionist";
  };
}

/**
 * Cria uma instância isolada do QueryClient para testes
 * configurado com retries desligados e gcTime zero para velocidade máxima.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Wrapper de Teste Soberano que provê:
 * - QueryClientProvider isolado
 * - MemoryRouter configurado
 * - Supressão de vazamentos de estado entre testes
 */
export function renderWithApp(
  ui: ReactElement,
  options: HarnessRenderOptions = {}
) {
  const queryClient = options.queryClient || createTestQueryClient();
  const initialEntries = options.initialEntries || ["/"];

  function ProvidersWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  return {
    ...rtlRender(ui, { wrapper: ProvidersWrapper, ...options }),
    queryClient,
  };
}

/**
 * Mock utilitário padrão para PostgREST / Supabase Builder
 */
export function createMockSupabaseQueryBuilder<T = unknown>(resolvedData: T, error: unknown = null) {
  const queryMock: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: resolvedData, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data: resolvedData, error }),
    then: (resolve: (val: any) => any) => Promise.resolve({ data: resolvedData, error }).then(resolve),
  };
  return queryMock;
}
