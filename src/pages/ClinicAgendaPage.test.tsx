import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ClinicAgendaPage from "./ClinicAgendaPage";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-test" },
    clinic: { route_key: "testesteseqsadqwdas", name: "Clínica Teste" },
    clinicId: "clinic-test-id",
    loading: false,
    can: () => true,
  }),
}));

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    },
  };
});

describe("ClinicAgendaPage", () => {
  it("renders page header and actions", async () => {
    render(
      <MemoryRouter initialEntries={["/designlab/clinica/testesteseqsadqwdas/agenda"]}>
        <Routes>
          <Route path="/designlab/clinica/:clinicKey/agenda" element={<ClinicAgendaPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Agenda da Clínica/i)).toBeInTheDocument();
  });
});
