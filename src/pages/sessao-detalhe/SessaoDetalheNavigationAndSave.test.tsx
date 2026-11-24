import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SessaoDetalhe from "@/pages/SessaoDetalhe";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { enqueueOfflineMutation } from "@/lib/local-first/offlineMutationQueue";
import { clearLocalCache } from "@/lib/indexed-db-persister";
import {
  renderWithProviders,
  fastWaitFor,
  getHeaderBar,
  mockPatient,
  mockGroups,
  mockTemplates,
  createQueryChain,
  createDefaultSupabaseFromHandler,
} from "./__tests__/sessaoDetalheTestHelpers";
import { DEFAULT_ANAMNESIS_TEMPLATE_SCHEMA } from "@/lib/anamnesis-forms";

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

vi.mock("@/lib/local-first/offlineMutationQueue", () => ({
  enqueueOfflineMutation: vi.fn().mockResolvedValue({ id: "outbox-1" }),
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
  getClinicPatientPath: vi.fn((clinicRouteKey: string | null | undefined, patient: any, subpath?: string) => {
    const key = typeof patient === "string" ? patient : patient?.patient_code || patient?.id || "patient-123";
    const cleanSub = subpath ? (subpath.startsWith("/") ? subpath : `/${subpath}`) : "";
    return clinicRouteKey ? `/clinica/${clinicRouteKey}/pacientes/${key}${cleanSub}` : `/pacientes/${key}${cleanSub}`;
  }),
  getClinicPatientSessionPath: vi.fn((clinicRouteKey: string | null | undefined, patient: any, session: any, subpath?: string) => {
    const key = typeof patient === "string" ? patient : patient?.patient_code || patient?.id || "patient-123";
    const sessionKey = typeof session === "string" ? session : session?.id || "session-123";
    const cleanSub = subpath ? (subpath.startsWith("/") ? subpath : `/${subpath}`) : "";
    return clinicRouteKey
      ? `/clinica/${clinicRouteKey}/pacientes/${key}/sessao/${sessionKey}${cleanSub}`
      : `/pacientes/${key}/sessao/${sessionKey}${cleanSub}`;
  }),
  getPatientRouteKey: (patient: any) => patient?.patient_code || patient?.id || "patient-123",
  isUuid: (val: string) => typeof val === "string" && !val.startsWith("ATD-") && val !== "novo",
  parseSessionRef: (ref: string | undefined | null) => {
    if (!ref || !ref.trim()) return { raw: "", isNew: false, isUuid: false, sessionIndex: null, isValid: false };
    const clean = ref.trim();
    if (clean.toLowerCase() === "novo") return { raw: clean, isNew: true, isUuid: false, sessionIndex: null, isValid: true };
    const match = clean.match(/^(?:ATD[-_ #]*|#)?(\d+)$/i);
    if (match) return { raw: clean, isNew: false, isUuid: false, sessionIndex: parseInt(match[1], 10), isValid: true };
    return { raw: clean, isNew: false, isUuid: true, sessionIndex: null, isValid: true };
  },
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

describe("SessaoDetalhe - Navegação, Preload e Salvamento", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearLocalCache();
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });

    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1", email: "dr@pluri.health" } as any,
      clinic: { id: "clinic-1", name: "Clínica Saúde", route_key: "saude" } as any,
      clinicId: "clinic-1",
      platformAccess: null,
      profile: { id: "user-1", full_name: "Dr. Roberto" } as any,
      can: () => true,
    } as any);

    vi.mocked(supabase.rpc).mockResolvedValue({ data: "clinic-1", error: null } as any);
    vi.mocked(supabase.from).mockImplementation(createDefaultSupabaseFromHandler());
  });

  it("navigates back to /espacopessoal when location.state has from: '/espacopessoal'", async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={[{ pathname: "/clinica/saude/pacientes/PAC-123/sessao/ATD-1", state: { from: "/espacopessoal" } }]}>
        <Routes>
          <Route path="/pacientes/:id/sessao/:sessionId" element={<SessaoDetalhe />} />
          <Route path="/clinica/:clinicKey/pacientes/:id/sessao/:sessionId" element={<SessaoDetalhe />} />
          <Route path="/espacopessoal" element={<div>Página Espaço Pessoal</div>} />
          <Route path="/pacientes/:id" element={<div>Página Paciente Detalhe</div>} />
          <Route path="/clinica/:clinicKey/pacientes/:id" element={<div>Página Paciente Detalhe</div>} />
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

  it("navigates back to scoped clinic patient route when location.state does not have from: '/espacopessoal'", async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/clinica/saude/pacientes/PAC-123/sessao/ATD-1"]}>
        <Routes>
          <Route path="/pacientes/:id/sessao/:sessionId" element={<SessaoDetalhe />} />
          <Route path="/clinica/:clinicKey/pacientes/:id/sessao/:sessionId" element={<SessaoDetalhe />} />
          <Route path="/espacopessoal" element={<div>Página Espaço Pessoal</div>} />
          <Route path="/pacientes/:id" element={<div>Página Paciente Detalhe</div>} />
          <Route path="/clinica/:clinicKey/pacientes/:id" element={<div>Página Paciente Detalhe</div>} />
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
    const updatedRow = {
      id: "real-session-uuid-456",
      patient_id: "patient-123",
      user_id: "user-1",
      session_date: "2026-08-25T16:57:00.000Z",
      status: "concluído",
      pain_score: 0,
      complexity_score: 0,
      notes: "",
      amount_charged_cents: 0,
      amount_paid_cents: 0,
      amount_original_cents: 0,
      payment_status: "nao_cobrado",
      created_at: "2026-08-25T16:57:00.000Z",
      updated_at: "2026-08-25T16:57:00.000Z",
    };
    const sessionUpdateMock = vi.fn().mockImplementation(() => {
      const chain: any = {
        eq: vi.fn((col: string, val: string) => {
          if (col === "id") capturedUpdatedId = val;
          return chain;
        }),
        select: vi.fn(() => chain),
        single: vi.fn().mockResolvedValue({ data: updatedRow, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: updatedRow, error: null }),
        then: (resolve: any) => Promise.resolve({ data: updatedRow, error: null }).then(resolve),
      };
      return chain;
    });

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

    renderWithProviders(
      <MemoryRouter initialEntries={["/clinica/saude/pacientes/PAC-123/sessao/ATD-8?edit=true"]}>
        <Routes>
          <Route path="/pacientes/:id/sessao/:sessionId" element={<SessaoDetalhe />} />
          <Route path="/clinica/:clinicKey/pacientes/:id/sessao/:sessionId" element={<SessaoDetalhe />} />
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
    expect(screen.queryByLabelText("Carregando atendimento")).not.toBeInTheDocument();
  });

  it("resolves session in 0ms from location.state.preloadedSession without showing skeleton", async () => {
    const { resolveSessionReference } = await import("@/lib/patient-routing");
    const preloadedSession = {
      id: "preloaded-uuid-1",
      patient_id: "patient-123",
      user_id: "user-1",
      session_date: "2026-08-25T16:57:00.000Z",
      status: "concluído",
      pain_score: 3,
      complexity_score: 2,
      notes: "Conduta precarregada",
      amount_charged_cents: 15000,
      amount_paid_cents: 15000,
      amount_original_cents: 15000,
      payment_status: "pago",
      created_at: "2026-08-25T16:57:00.000Z",
      updated_at: "2026-08-25T16:57:00.000Z",
      deleted_at: null,
    };

    renderWithProviders(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/clinica/saude/pacientes/PAC-123/sessao/ATD-1",
            state: { preloadedSession },
          },
        ]}
      >
        <Routes>
          <Route path="/clinica/:clinicKey/pacientes/:id/sessao/:sessionId" element={<SessaoDetalhe />} />
        </Routes>
      </MemoryRouter>
    );

    await fastWaitFor(() => {
      expect(screen.getByText("Conduta precarregada")).toBeInTheDocument();
    });
    expect(resolveSessionReference).not.toHaveBeenCalled();
  });

  it("saves new session offline via optimistic cache and enqueueOfflineMutation without error", async () => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });

    renderWithProviders(
      <MemoryRouter initialEntries={["/clinica/saude/pacientes/PAC-123/sessao/novo"]}>
        <Routes>
          <Route path="/clinica/:clinicKey/pacientes/:id/sessao/:sessionId" element={<SessaoDetalhe />} />
        </Routes>
      </MemoryRouter>
    );

    const headerBar = await getHeaderBar();
    fireEvent.click(within(headerBar).getByRole("button", { name: /Concluir Atendimento/i }));

    await fastWaitFor(() => {
      expect(enqueueOfflineMutation).toHaveBeenCalledWith(
        "upsert_session",
        expect.objectContaining({
          tempId: expect.stringContaining("offline-session-"),
          record: expect.objectContaining({ status: "concluído" }),
        })
      );
    });
  });
});
