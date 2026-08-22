import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { PlatformFeedbacksManager } from "@/components/PlatformFeedbacksManager";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

const mockFeedbacks = [
  {
    id: "fb-1",
    user_id: "u-1",
    clinic_id: "c-1",
    user_email: "doutor@clinica.com",
    user_name: "Dr. Roberto",
    clinic_name: "Clínica Saúde",
    ratings: [
      { question_id: "loading_speed", question_text: "Velocidade de carregamento", rating: 5 },
      { question_id: "daily_routine_facilitation", question_text: "Facilitação da rotina", rating: 4 },
    ],
    average_rating: 4.5,
    problem_report: "Senti um leve atraso ao salvar a ficha ontem.",
    opinion: "Adoro a organização das abas!",
    page_url: "https://pluri.health/clinica/saude",
    user_agent: "Mozilla/5.0",
    status: "pending",
    admin_notes: null,
    created_at: "2026-08-20T10:00:00Z",
    updated_at: "2026-08-20T10:00:00Z",
  },
  {
    id: "fb-2",
    user_id: "u-2",
    clinic_id: "c-2",
    user_email: "ana@fisioterapia.com",
    user_name: "Dra. Ana",
    clinic_name: "Fisio & Vida",
    ratings: [
      { question_id: "general_satisfaction", question_text: "Satisfação geral", rating: 5 },
    ],
    average_rating: 5.0,
    problem_report: null,
    opinion: "Excelente plataforma, muito prática!",
    page_url: "https://pluri.health/clinica/vida",
    user_agent: "Mozilla/5.0",
    status: "reviewed",
    admin_notes: "Verificado com sucesso.",
    created_at: "2026-08-19T14:00:00Z",
    updated_at: "2026-08-19T15:00:00Z",
  },
];

describe("PlatformFeedbacksManager Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockFeedbacks, error: null }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as any);
  });

  it("renders metrics and list of feedbacks", async () => {
    render(<PlatformFeedbacksManager />);

    expect(screen.getByText("Central de Feedbacks & Avaliações")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Dr. Roberto")).toBeInTheDocument();
      expect(screen.getByText("Dra. Ana")).toBeInTheDocument();
    });

    expect(screen.getByText("Senti um leve atraso ao salvar a ficha ontem.")).toBeInTheDocument();
    expect(screen.getByText("Excelente plataforma, muito prática!")).toBeInTheDocument();
  });

  it("filters feedbacks by search input", async () => {
    render(<PlatformFeedbacksManager />);

    await waitFor(() => {
      expect(screen.getByText("Dr. Roberto")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Buscar por usuário, email, clínica/i);
    fireEvent.change(searchInput, { target: { value: "Fisio & Vida" } });

    expect(screen.queryByText("Dr. Roberto")).not.toBeInTheDocument();
    expect(screen.getByText("Dra. Ana")).toBeInTheDocument();
  });
});
