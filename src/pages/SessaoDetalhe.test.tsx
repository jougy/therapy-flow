import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SessaoDetalhe from "@/pages/SessaoDetalhe";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({
    isFeatureEnabled: () => true,
  }),
}));

vi.mock("@/lib/patient-routing", () => ({
  fetchPatientByRef: vi.fn().mockResolvedValue({
    data: {
      id: "patient-123",
      name: "Carlos Eduardo Silva",
      clinic_id: "clinic-1",
    },
    error: null,
  }),
  getPatientPath: vi.fn(),
  isUuid: () => true,
}));

vi.mock("@/lib/session-sharing", () => ({
  fetchClinicShareCollaborators: vi.fn().mockResolvedValue([]),
  fetchSessionShareRecipients: vi.fn().mockResolvedValue([]),
  getShareRecipientLabel: vi.fn(),
}));

import { DEFAULT_ANAMNESIS_TEMPLATE_SCHEMA } from "@/lib/anamnesis-forms";

const mockPatient = {
  id: "patient-123",
  name: "Carlos Eduardo Silva",
  clinic_id: "clinic-1",
};

const mockGroups = [
  { id: "group-1", name: "Coluna Lombar", color: "blue", patient_id: "patient-123" },
];

const mockTemplates = [
  { id: "tmpl-1", name: "Anamnese Geral da Clínica", description: "Avaliação completa inicial", schema: [] },
];

describe("SessaoDetalhe Component - Redesenho de Fluxo de Atendimento", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1", email: "dr@pluri.health" } as any,
      clinic: { id: "clinic-1", name: "Clínica Saúde", route_key: "saude" } as any,
      clinicId: "clinic-1",
      platformAccess: null,
      profile: { id: "user-1", full_name: "Dr. Roberto" } as any,
      can: () => true,
    } as any);

    vi.mocked(supabase.rpc).mockResolvedValue({ data: "clinic-1", error: null } as any);

    const createQueryChain = (resolvedData: any = []) => {
      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        not: vi.fn(() => chain),
        in: vi.fn(() => chain),
        order: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        single: vi.fn().mockResolvedValue({ data: Array.isArray(resolvedData) ? resolvedData[0] ?? null : resolvedData, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: Array.isArray(resolvedData) ? resolvedData[0] ?? null : resolvedData, error: null }),
        then: (resolve: any) => Promise.resolve({ data: resolvedData, error: null }).then(resolve),
      };
      return chain;
    };

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "patients") {
        return createQueryChain(mockPatient);
      }
      if (table === "patient_groups") {
        const chain = createQueryChain(mockGroups);
        chain.insert = vi.fn().mockReturnValue(createQueryChain({ id: "group-new", name: "Reabilitação Ortopédica", color: "blue", patient_id: "patient-123" }));
        return chain;
      }
      if (table === "anamnesis_form_templates") {
        return createQueryChain(mockTemplates);
      }
      if (table === "clinics") {
        return createQueryChain({ name: "Clínica Saúde", anamnesis_base_schema: DEFAULT_ANAMNESIS_TEMPLATE_SCHEMA });
      }
      if (table === "profiles") {
        return createQueryChain([]);
      }
      if (table === "sessions") {
        const chain = createQueryChain([]);
        chain.insert = vi.fn().mockReturnValue(createQueryChain({ id: "new-session-1" }));
        chain.update = vi.fn().mockReturnValue(createQueryChain(null));
        return chain;
      }
      return createQueryChain([]);
    });
  });

  it("renders explicit 'Concluir Atendimento' and 'Salvar como Rascunho' buttons on new session", async () => {
    render(
      <MemoryRouter initialEntries={["/pacientes/patient-123/sessao/novo"]}>
        <Routes>
          <Route path="/pacientes/:id/sessao/:sessionId" element={<SessaoDetalhe />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Concluir Atendimento/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Salvar como Rascunho/i })).toBeInTheDocument();
    });
  });

  it("displays care lines (Linhas de Cuidado) chips and helper card in Anamnese tab", async () => {
    render(
      <MemoryRouter initialEntries={["/pacientes/patient-123/sessao/novo"]}>
        <Routes>
          <Route path="/pacientes/:id/sessao/:sessionId" element={<SessaoDetalhe />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Sintomas & Linhas de Cuidado|Linha de Cuidado/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByRole("button", { name: /Geral \/ Sintomas não definidos|Sintomas não definidos/i }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByRole("button", { name: /Coluna Lombar/i }).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("displays ultra-visual complementary evaluation forms block inside Anamnese tab", async () => {
    render(
      <MemoryRouter initialEntries={["/pacientes/patient-123/sessao/novo"]}>
        <Routes>
          <Route path="/pacientes/:id/sessao/:sessionId" element={<SessaoDetalhe />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Ficha Complementar de Avaliação/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Anamnese Geral da Clínica/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("triggers smart keyword suggestion pill when typing a known symptom/complaint", async () => {
    render(
      <MemoryRouter initialEntries={["/pacientes/patient-123/sessao/novo"]}>
        <Routes>
          <Route path="/pacientes/:id/sessao/:sessionId" element={<SessaoDetalhe />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Descreva a queixa principal/i)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Descreva a queixa principal/i);
    fireEvent.change(textarea, { target: { value: "Paciente relata dor lombar intensa após esforço físico" } });

    await waitFor(() => {
      expect(screen.getByText(/Sugestão inteligente/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Aplicar/i })).toBeInTheDocument();
    });
  });

  it("opens 'Nova Linha de Cuidado' modal when clicking 'Criar Linha de Cuidado Personalizada'", async () => {
    render(
      <MemoryRouter initialEntries={["/pacientes/patient-123/sessao/novo"]}>
        <Routes>
          <Route path="/pacientes/:id/sessao/:sessionId" element={<SessaoDetalhe />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Criar Linha de Cuidado Personalizada/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Criar Linha de Cuidado Personalizada/i }));

    await waitFor(() => {
      expect(screen.getByText("Nova Linha de Cuidado")).toBeInTheDocument();
      expect(screen.getByText("Nome da Linha de Cuidado / Motivo")).toBeInTheDocument();
      expect(screen.getByText("Status da linha de cuidado")).toBeInTheDocument();
      expect(screen.getByText("Cor")).toBeInTheDocument();
    });
  });
});
