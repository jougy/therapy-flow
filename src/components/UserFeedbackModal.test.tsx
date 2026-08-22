import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UserFeedbackModal } from "@/components/UserFeedbackModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

describe("UserFeedbackModal Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-123", email: "dr@clinica.com" } as any,
      clinic: { id: "clinic-456", name: "Clínica Teste" } as any,
    } as any);

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: "feedback-id-1",
      error: null,
    } as any);
  });

  it("renders 5 questions and textareas when open with default manual source", () => {
    render(<UserFeedbackModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Sua Opinião Importa")).toBeInTheDocument();
    expect(screen.getByText("Como está sendo sua experiência na plataforma?")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ao salvar a ficha de anamnese/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Adoro a organização visual/i)).toBeInTheDocument();
  });

  it("renders contextual headers when triggered after session completed", () => {
    render(
      <UserFeedbackModal
        open={true}
        onOpenChange={vi.fn()}
        triggerSource="session_completed"
      />
    );

    expect(screen.getByText("🎉 Atendimento Concluído")).toBeInTheDocument();
    expect(screen.getByText("Como foi sua experiência no atendimento?")).toBeInTheDocument();
  });

  it("renders contextual headers when triggered by time connected", () => {
    render(
      <UserFeedbackModal
        open={true}
        onOpenChange={vi.fn()}
        triggerSource="time_connected"
      />
    );

    expect(screen.getByText("⏱️ Sessão Ativa")).toBeInTheDocument();
    expect(screen.getByText("Como está sendo sua experiência hoje?")).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when clicking 'Agora não'", () => {
    const onOpenChange = vi.fn();
    render(<UserFeedbackModal open={true} onOpenChange={onOpenChange} />);

    const dismissBtn = screen.getByRole("button", { name: /Agora não/i });
    fireEvent.click(dismissBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("allows typing in problem report and opinion fields and submitting", async () => {
    const onOpenChange = vi.fn();
    render(<UserFeedbackModal open={true} onOpenChange={onOpenChange} triggerSource="session_completed" />);

    const problemInput = screen.getByPlaceholderText(/Ao salvar a ficha de anamnese/i);
    const opinionInput = screen.getByPlaceholderText(/Adoro a organização visual/i);

    fireEvent.change(problemInput, { target: { value: "Tive um problema na impressão." } });
    fireEvent.change(opinionInput, { target: { value: "Gostei muito da velocidade nova!" } });

    const submitBtn = screen.getByRole("button", { name: /Enviar Avaliação/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith(
        "submit_user_platform_feedback",
        expect.objectContaining({
          _clinic_id: "clinic-456",
          _problem_report: "Tive um problema na impressão.",
          _opinion: "Gostei muito da velocidade nova!",
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Muito obrigado pelo seu feedback!/i)).toBeInTheDocument();
    });
  });
});
