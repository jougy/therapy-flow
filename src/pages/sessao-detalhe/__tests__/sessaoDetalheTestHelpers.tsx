import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import { DEFAULT_ANAMNESIS_TEMPLATE_SCHEMA } from "@/lib/anamnesis-forms";

export const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

export const fastWaitFor = <T,>(cb: () => T) => waitFor(cb, { interval: 5 });

export const getHeaderBar = async () => {
  const nameEl = await screen.findByText("Carlos Eduardo Silva", {}, { interval: 5 });
  return nameEl.closest(".space-y-4") as HTMLElement;
};

export const mockPatient = {
  id: "patient-123",
  name: "Carlos Eduardo Silva",
  clinic_id: "clinic-1",
};

export const mockGroups = [
  { id: "group-1", name: "Coluna Lombar", color: "blue", patient_id: "patient-123" },
];

export const mockTemplates = [
  { id: "tmpl-1", name: "Anamnese Geral da Clínica", description: "Avaliação completa inicial", schema: [] },
];

export const createQueryChain = (resolvedData: any = []) => {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    not: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn().mockResolvedValue({
      data: Array.isArray(resolvedData) ? resolvedData[0] ?? null : resolvedData,
      error: null,
    }),
    maybeSingle: vi.fn().mockResolvedValue({
      data: Array.isArray(resolvedData) ? resolvedData[0] ?? null : resolvedData,
      error: null,
    }),
    then: (resolve: any) => Promise.resolve({ data: resolvedData, error: null }).then(resolve),
  };
  return chain;
};

export const createDefaultSupabaseFromHandler = () => (table: string) => {
  if (table === "patients") return createQueryChain(mockPatient);
  if (table === "patient_groups") {
    const chain = createQueryChain(mockGroups);
    chain.insert = vi.fn().mockReturnValue(
      createQueryChain({
        id: "group-new",
        name: "Reabilitação Ortopédica",
        color: "blue",
        patient_id: "patient-123",
      })
    );
    return chain;
  }
  if (table === "anamnesis_form_templates") return createQueryChain(mockTemplates);
  if (table === "clinics") {
    return createQueryChain({
      name: "Clínica Saúde",
      anamnesis_base_schema: DEFAULT_ANAMNESIS_TEMPLATE_SCHEMA,
    });
  }
  if (table === "profiles") return createQueryChain([]);
  if (table === "sessions") {
    const chain = createQueryChain([]);
    chain.insert = vi.fn().mockReturnValue(
      createQueryChain({
        id: "new-session-1",
        patient_id: "patient-123",
        user_id: "user-1",
        session_date: "2026-08-25T16:57:00.000Z",
        status: "rascunho",
        created_at: "2026-08-25T16:57:00.000Z",
        updated_at: "2026-08-25T16:57:00.000Z",
      })
    );
    chain.update = vi.fn().mockReturnValue(createQueryChain(null));
    return chain;
  }
  return createQueryChain([]);
};
