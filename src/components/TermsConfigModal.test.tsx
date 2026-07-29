import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TermsConfigModal } from "@/components/TermsConfigModal";

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

describe("TermsConfigModal", () => {
  it("renders the modal and shows the 4 document upload categories", () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();

    render(
      <TermsConfigModal
        isOpen={true}
        onClose={handleClose}
        onSave={handleSave}
      />
    );

    expect(screen.getByText("Configuração dos Termos de Uso e Consentimento")).toBeInTheDocument();
    expect(screen.getByText("Termos Owner (Brasil)")).toBeInTheDocument();
    expect(screen.getByText("Termos Usuários (Brasil)")).toBeInTheDocument();
    expect(screen.getByText("Termos Owner (Internacional)")).toBeInTheDocument();
    expect(screen.getByText("Termos Usuários (Internacional)")).toBeInTheDocument();
  });

  it("calls onSave when clicking Salvar Documentos", () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();

    render(
      <TermsConfigModal
        isOpen={true}
        onClose={handleClose}
        onSave={handleSave}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /salvar documentos/i }));
    expect(handleSave).toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalled();
  });
});
