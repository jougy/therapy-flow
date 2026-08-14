import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ClinicDashboard from "@/pages/ClinicDashboard";

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => {
  const sampleSessions = [
    {
      id: "s1",
      patient_id: "p1",
      professional_id: "prof1",
      session_date: new Date().toISOString(),
      payment_status: "pago",
      payment_method: "pix",
      total_cents: 15000,
    },
    {
      id: "s2",
      patient_id: "p1",
      professional_id: "prof1",
      session_date: new Date().toISOString(),
      payment_status: "em_aberto",
      payment_method: "cartao_credito",
      total_cents: 12000,
    },
  ];

  const samplePatients = [
    { id: "p1", name: "Paciente Teste", status: "ativo", updated_at: new Date().toISOString() },
  ];

  const sampleGroups = [
    {
      id: "g1",
      name: "Terapia Cognitiva",
      patient_id: "p1",
      status: "ativo",
      color: "blue",
      clinic_group_color_slots: { color_hex: "#0ea5e9" },
    },
  ];

  const sampleAgendaEvents = [
    {
      id: "a1",
      patient_id: "p1",
      title: "Sessão Semanal",
      event_type: "session",
      status: "confirmed",
      scheduled_for: new Date().toISOString(),
    },
  ];

  const sampleProfiles = [
    {
      id: "prof1",
      full_name: "Dra. Especialista",
      email: "especialista@clinica.com",
      job_title: "Psicóloga",
    },
  ];

  return {
    supabase: {
      from: (table: string) => ({
        select: () => {
          if (table === "patients") {
            return { order: () => Promise.resolve({ data: samplePatients, error: null }) };
          }
          if (table === "patient_groups") {
            return Promise.resolve({ data: sampleGroups, error: null });
          }
          if (table === "sessions") {
            return Promise.resolve({ data: sampleSessions, error: null });
          }
          if (table === "agenda_events") {
            return { order: () => Promise.resolve({ data: sampleAgendaEvents, error: null }) };
          }
          if (table === "clinic_memberships") {
            return { eq: () => Promise.resolve({ data: [{ user_id: "prof1" }], error: null }) };
          }
          if (table === "profiles") {
            return {
              eq: () => Promise.resolve({ data: sampleProfiles, error: null }),
              in: () => Promise.resolve({ data: sampleProfiles, error: null }),
            };
          }
          return Promise.resolve({ data: [], error: null });
        },
      }),
    },
  };
});

// Mock useAuth
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "admin@clinica.com" },
    profile: { full_name: "Admin Clínico", email: "admin@clinica.com" },
    clinic: { id: "clinic-1", name: "Minha Clínica Particular" },
    clinicId: "clinic-1",
    can: () => true,
  }),
}));

// Mock FeatureFlags
vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({
    isFeatureEnabled: () => true,
  }),
}));

describe("ClinicDashboard - Print Stats SVG Rendering Verification", () => {
  it("renders #print-clinic-stats-root with non-zero width and height SVG elements for all Recharts charts", async () => {
    render(
      <MemoryRouter>
        <ClinicDashboard />
      </MemoryRouter>
    );

    // Wait for the dashboard to finish loading data
    await waitFor(() => {
      expect(screen.queryByText("Minha Clínica Particular")).toBeInTheDocument();
    });

    // 1. Check that #print-clinic-stats-root is present in document.body
    const printRoot = document.body.querySelector("#print-clinic-stats-root");
    expect(printRoot).not.toBeNull();
    expect(printRoot).toHaveClass("print:block");

    // 2. Verify header information in print root
    expect(printRoot?.textContent).toContain("Minha Clínica Particular");
    expect(printRoot?.textContent).toContain("Relatório de Estatísticas Completas");
    expect(printRoot?.textContent).toContain("Impresso por: Admin Clínico (admin@clinica.com)");

    // 3. Verify all 5 Recharts chart cards are present in print root
    expect(printRoot?.textContent).toContain("Receita e atendimentos no ano");
    expect(printRoot?.textContent).toContain("Atendimentos nos últimos 30 dias");
    expect(printRoot?.textContent).toContain("Distribuição por dia da semana");
    expect(printRoot?.textContent).toContain("Produtividade por colaborador");
    expect(printRoot?.textContent).toContain("Status financeiro");

    // 4. Locate all SVGs rendered by Recharts inside #print-clinic-stats-root
    const chartSvgs = printRoot?.querySelectorAll("svg.recharts-surface");
    expect(chartSvgs).toBeDefined();
    expect(chartSvgs!.length).toBe(5);

    // 5. Verify each SVG chart has explicit non-zero width and height attributes (> 0)
    chartSvgs!.forEach((svg) => {
      const width = svg.getAttribute("width");
      const height = svg.getAttribute("height");
      const viewBox = svg.getAttribute("viewBox");

      expect(width).toBeTruthy();
      expect(height).toBeTruthy();

      const numWidth = Number(width);
      const numHeight = Number(height);

      expect(numWidth).toBeGreaterThan(0);
      expect(numHeight).toBeGreaterThan(0);

      // Verify viewBox matches SVG dimensions
      expect(viewBox).toBe(`0 0 ${numWidth} ${numHeight}`);
    });

    // 6. Verify AreaChart contains path elements for pago and emAberto areas
    const areaPaths = printRoot?.querySelectorAll(".recharts-area-area");
    expect(areaPaths?.length).toBeGreaterThan(0);

    // 7. Verify LineChart contains line path elements
    const lineCurves = printRoot?.querySelectorAll(".recharts-line-curve");
    expect(lineCurves?.length).toBeGreaterThan(0);

    // 8. Verify BarCharts contain bar rectangles
    const barRectangles = printRoot?.querySelectorAll(".recharts-bar-rectangle");
    expect(barRectangles?.length).toBeGreaterThan(0);

    // 9. Verify PieChart contains pie sectors
    const pieSectors = printRoot?.querySelectorAll(".recharts-pie-sector");
    expect(pieSectors?.length).toBeGreaterThan(0);
  });
});
