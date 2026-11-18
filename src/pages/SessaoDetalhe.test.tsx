import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SessaoDetalhe from "@/pages/SessaoDetalhe";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const cache: Record<string, React.ComponentType<any>> = {};
  const createMotionComponent = (tag: string) =>
    React.forwardRef(({ children, whileTap, initial, animate, exit, transition, ...props }: any, ref: any) =>
      React.createElement(tag, { ...props, ref }, children)
    );
  return {
    motion: new Proxy(
      {},
      {
        get: (_target, prop: string) => {
          if (!cache[prop]) cache[prop] = createMotionComponent(prop);
          return cache[prop];
        },
      }
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  };
});

const fastWaitFor = <T,>(cb: () => T) => waitFor(cb, { interval: 5 });

const getHeaderBar = async () => {
  const nameEl = await screen.findByText("Carlos Eduardo Silva", {}, { interval: 5 });
  return nameEl.closest(".space-y-4") as HTMLElement;
};

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
      patient_code: "PAC-123",
      name: "Carlos Eduardo Silva",
      clinic_id: "clinic-1",
      allergies: "Dipirona; Penicilina",
      blood_type: "O+",
      status: "ativo",
      registration_complete: true,
      clinical_profile: {
        risk_flags: ["fall_risk", "allergy", "diabetes"],
        clinical_alerts: "Alergia severa a dipirona",
      },
    },
    error: null,
  }),
  getPatientPath: vi.fn((patient: any, subpath?: string) => {
    const key = typeof patient === "string" ? patient : patient?.patient_code || patient?.id || "patient-123";
    const cleanSub = subpath ? (subpath.startsWith("/") ? subpath : `/${subpath}`) : "";
    return `/pacientes/${key}${cleanSub}`;
  }),
  getPatientSessionPath: vi.fn((patient: any, session: any, subpath?: string) => {
    const key = typeof patient === "string" ? patient : patient?.patient_code || patient?.id || "patient-123";
    const sessionKey = typeof session === "string" ? session : session?.id || "session-123";
    const cleanSub = subpath ? (subpath.startsWith("/") ? subpath : `/${subpath}`) : "";
    return `/pacientes/${key}/sessao/${sessionKey}${cleanSub}`;
  }),
  getClinicPatientPath: vi.fn(),
  getPatientRouteKey: (patient: any) => patient?.patient_code || patient?.id || "patient-123",
  isUuid: (val: string) => typeof val === "string" && !val.startsWith("ATD-") && val !== "novo",
  resolveSessionReference: vi.fn().mockImplementation(async (sessionRef: string) => ({
    data: sessionRef === "novo" ? null : {
      id: sessionRef.startsWith("ATD-") ? "real-session-uuid-456" : sessionRef,
      patient_id: "patient-123",
      user_id: "user-1",
      session_date: "2026-08-25T16:57:00.000Z",
      status: "rascunho",
      pain_score: 0,
      complexity_score: 0,
      notes: "",
      amount_charged_cents: 0,
      amount_paid_cents: 0,
      amount_original_cents: 0,
      payment_status: "nao_cobrado",
      created_at: "2026-08-25T16:57:00.000Z",
    },
    error: null,
    isNew: sessionRef === "novo",
    sessionIndex: 1,
    patient: {
      id: "patient-123",
      patient_code: "PAC-123",
      name: "Carlos Eduardo Silva",
      clinic_id: "clinic-1",
    },
    totalSessions: 1,
  })),
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
        neq: vi.fn(() => chain),
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

    const headerBar = await getHeaderBar();
    expect(within(headerBar).getByRole("button", { name: /Concluir Atendimento/i })).toBeInTheDocument();
    expect(within(headerBar).getByRole("button", { name: /Salvar como Rascunho/i })).toBeInTheDocument();
  });

  it("renders clean modular Anamnese form container without the fixed carelines picker", async () => {
    render(
      <MemoryRouter initialEntries={["/pacientes/patient-123/sessao/novo"]}>
        <Routes>
          <Route path="/pacientes/:id/sessao/:sessionId" element={<SessaoDetalhe />} />
        </Routes>
      </MemoryRouter>
    );

    await fastWaitFor(() => {
      // Verifies that the fixed care lines selector was removed
      expect(screen.queryByText(/1\. Primeiro Bloco da Anamnese/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Sintomas & Linhas de Cuidado/i)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Geral \/ Sintomas não definidos|Sintomas não definidos/i })).not.toBeInTheDocument();

      // Verifies that the modular form container is rendered with tutorial attribute and dynamic fields
      expect(document.querySelector("[data-tutorial='session-anamnesis-form']")).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Descreva a queixa principal/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Observações gerais sobre o atendimento/i)).toBeInTheDocument();
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

    await fastWaitFor(() => {
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

    const textarea = await screen.findByPlaceholderText(/Descreva a queixa principal/i, {}, { interval: 5 });
    fireEvent.change(textarea, { target: { value: "Paciente relata dor lombar intensa após esforço físico" } });

    const suggestionEl = await screen.findByText(/Sugestão inteligente/i, {}, { interval: 5 });
    const suggestionBox = suggestionEl.closest("div")!.parentElement!;
    expect(within(suggestionBox).getByRole("button", { name: /Aplicar/i })).toBeInTheDocument();
  });

  it("renders modular anamnesis runtime without static care line creation buttons and supports dynamic field inputs", async () => {
    render(
      <MemoryRouter initialEntries={["/pacientes/patient-123/sessao/novo"]}>
        <Routes>
          <Route path="/pacientes/:id/sessao/:sessionId" element={<SessaoDetalhe />} />
        </Routes>
      </MemoryRouter>
    );

    const queixaInput = await screen.findByPlaceholderText(/Descreva a queixa principal/i, {}, { interval: 5 });
    expect(screen.queryByRole("button", { name: /Criar Linha de Cuidado Personalizada/i })).not.toBeInTheDocument();

    fireEvent.change(queixaInput, { target: { value: "Avaliação inicial de mobilidade" } });

    expect((queixaInput as HTMLTextAreaElement).value).toBe("Avaliação inicial de mobilidade");
  });

  it("prompts confirmation modal with 3 choices when attempting to leave with unsaved changes", async () => {
    render(
      <MemoryRouter initialEntries={["/pacientes/patient-123/sessao/novo"]}>
        <Routes>
          <Route path="/pacientes/:id/sessao/:sessionId" element={<SessaoDetalhe />} />
        </Routes>
      </MemoryRouter>
    );

    const textarea = await screen.findByPlaceholderText(/Descreva a queixa principal/i, {}, { interval: 5 });
    const headerBar = await getHeaderBar();

    // Make an edit
    fireEvent.change(textarea, { target: { value: "Alteração não salva" } });

    // Click back button in header
    const backBtn = within(headerBar).getByRole("button", { name: /Voltar para paciente/i });
    fireEvent.click(backBtn);

    const modalTitle = await screen.findByText("Atendimento em andamento", {}, { interval: 5 });
    const dialogEl = modalTitle.closest('[role="dialog"], [role="alertdialog"]') as HTMLElement;
    expect(within(dialogEl).getByText(/Você possui alterações que ainda não foram salvas no prontuário/i)).toBeInTheDocument();
    expect(within(dialogEl).getByRole("button", { name: /Sair e salvar como rascunho/i })).toBeInTheDocument();
    expect(within(dialogEl).getByRole("button", { name: /Sair sem salvar/i })).toBeInTheDocument();
    expect(within(dialogEl).getByRole("button", { name: /Continuar atendimento/i })).toBeInTheDocument();
  });

  it("opens 'Evoluir Atendimento' modal with 3 action choices when clicking evolve button", async () => {
    render(
      <MemoryRouter initialEntries={["/pacientes/patient-123/sessao/session-123"]}>
        <Routes>
          <Route path="/pacientes/:id/sessao/:sessionId" element={<SessaoDetalhe />} />
        </Routes>
      </MemoryRouter>
    );

    const headerBar = await getHeaderBar();
    const evolveBtn = within(headerBar).getByRole("button", { name: /Evoluir Atendimento/i });
    fireEvent.click(evolveBtn);

    const modalDesc = await screen.findByText("Escolha como deseja iniciar a evolução deste caso no histórico do paciente:", {}, { interval: 5 });
    const dialogEl = modalDesc.closest('[role="dialog"]') as HTMLElement;
    expect(within(dialogEl).getByText("Iniciar atendimento a partir deste")).toBeInTheDocument();
    expect(within(dialogEl).getByText("Iniciar atendimento em branco")).toBeInTheDocument();
    expect(within(dialogEl).getByRole("button", { name: /Cancelar/i })).toBeInTheDocument();
  });

  it("renders patient risk tags and opens clinical summary modal from header", async () => {
    render(
      <MemoryRouter initialEntries={["/pacientes/patient-123/sessao/session-123"]}>
        <Routes>
          <Route path="/pacientes/:id/sessao/:sessionId" element={<SessaoDetalhe />} />
        </Routes>
      </MemoryRouter>
    );

    const headerBar = await getHeaderBar();
    const summaryBtn = within(headerBar).getByRole("button", { name: /Resumo clínico/i });
    expect(summaryBtn).toBeInTheDocument();

    // Check risk tags are present
    expect(within(headerBar).getByRole("button", { name: /Alergias/i })).toBeInTheDocument();
    expect(within(headerBar).getByRole("button", { name: /Risco de queda/i })).toBeInTheDocument();
    expect(within(headerBar).getByRole("button", { name: /Riscos/i })).toBeInTheDocument();

    // Click Resumo clínico button
    fireEvent.click(summaryBtn);

    const summaryTitle = await screen.findByText("Resumo do paciente", {}, { interval: 5 });
    const dialogEl = summaryTitle.closest('[role="dialog"]') as HTMLElement;
    expect(within(dialogEl).getByRole("heading", { name: "Resumo do paciente" })).toBeInTheDocument();
    expect(within(dialogEl).getByText("Saúde base")).toBeInTheDocument();
    expect(within(dialogEl).getByText("Histórico rápido")).toBeInTheDocument();
    expect(within(dialogEl).getByText("Dipirona; Penicilina")).toBeInTheDocument();
    expect(within(dialogEl).getByText("Alergia severa a dipirona")).toBeInTheDocument();
  });

  it("navigates back to /espacopessoal when location.state has from: '/espacopessoal'", async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/pacientes/patient-123/sessao/session-123", state: { from: "/espacopessoal" } }]}>
        <Routes>
          <Route path="/pacientes/:id/sessao/:sessionId" element={<SessaoDetalhe />} />
          <Route path="/espacopessoal" element={<div>Página Espaço Pessoal</div>} />
          <Route path="/pacientes/:id" element={<div>Página Paciente Detalhe</div>} />
        </Routes>
      </MemoryRouter>
    );

    const headerBar = await getHeaderBar();
    const backBtn = within(headerBar).getByRole("button", { name: /Voltar para paciente/i });
    fireEvent.click(backBtn);

    await fastWaitFor(() => {
      expect(screen.getByText("Página Espaço Pessoal")).toBeInTheDocument();
    });
  });

  it("navigates back to /pacientes/:patientId when location.state does not have from: '/espacopessoal'", async () => {
    render(
      <MemoryRouter initialEntries={["/pacientes/patient-123/sessao/session-123"]}>
        <Routes>
          <Route path="/pacientes/:id/sessao/:sessionId" element={<SessaoDetalhe />} />
          <Route path="/espacopessoal" element={<div>Página Espaço Pessoal</div>} />
          <Route path="/pacientes/:id" element={<div>Página Paciente Detalhe</div>} />
        </Routes>
      </MemoryRouter>
    );

    const headerBar = await getHeaderBar();
    const backBtn = within(headerBar).getByRole("button", { name: /Voltar para paciente/i });
    fireEvent.click(backBtn);

    await fastWaitFor(() => {
      expect(screen.getByText("Página Paciente Detalhe")).toBeInTheDocument();
    });
  });

  it("salva atendimento usando o UUID real no update do supabase quando a rota é acessada via código amigável ATD-8", async () => {
    let capturedUpdatedId: string | null = null;
    const sessionUpdateMock = vi.fn().mockImplementation(() => {
      const chain: any = {
        eq: vi.fn((col: string, val: string) => {
          if (col === "id") capturedUpdatedId = val;
          return chain;
        }),
        then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve),
      };
      return chain;
    });

    const createQueryChain = (resolvedData: any = []) => {
      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        neq: vi.fn(() => chain),
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
      if (table === "patients") return createQueryChain(mockPatient);
      if (table === "patient_groups") return createQueryChain(mockGroups);
      if (table === "anamnesis_form_templates") return createQueryChain(mockTemplates);
      if (table === "clinics") return createQueryChain({ name: "Clínica Saúde", anamnesis_base_schema: DEFAULT_ANAMNESIS_TEMPLATE_SCHEMA });
      if (table === "profiles") return createQueryChain([]);
      if (table === "sessions") {
        const chain = createQueryChain([]);
        chain.update = sessionUpdateMock;
        return chain;
      }
      return createQueryChain([]);
    });

    render(
      <MemoryRouter initialEntries={["/pacientes/patient-123/sessao/ATD-8?edit=true"]}>
        <Routes>
          <Route path="/pacientes/:id/sessao/:sessionId" element={<SessaoDetalhe />} />
        </Routes>
      </MemoryRouter>
    );

    const headerBar = await getHeaderBar();
    fireEvent.click(within(headerBar).getByRole("button", { name: /Concluir Atendimento/i }));

    await fastWaitFor(() => {
      expect(sessionUpdateMock).toHaveBeenCalled();
      expect(capturedUpdatedId).toBe("real-session-uuid-456");
      expect(capturedUpdatedId).not.toBe("ATD-8");
    });
  });
});
