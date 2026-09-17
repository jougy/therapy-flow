import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TermsConfigModal } from "@/components/TermsConfigModal";

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

describe("TermsConfigModal", () => {
  it("renders the modal and shows all 6 document upload categories including Minor Consent LGPD", () => {
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
    expect(screen.getByText("Termo de Responsabilidade para Impressão")).toBeInTheDocument();
    expect(screen.getByText("Termo de Consentimento para Menor de Idade (LGPD)")).toBeInTheDocument();

    // Check badges
    expect(screen.getByText("PT-BR | Menor de Idade LGPD")).toBeInTheDocument();
    expect(screen.getByText("PT-BR | Impressão LGPD")).toBeInTheDocument();
  });

  it("indicates default embedded fallback is active when no custom minor terms is present", () => {
    render(
      <TermsConfigModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    // minor_terms has default embedded fallback
    expect(screen.getByText("minor-terms-of-responsibility.md (Padrão)")).toBeInTheDocument();
  });

  it("renders custom document info and allows removal", () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();

    const initialData = {
      minor_terms: {
        filename: "meu-termo-menor-customizado.md",
        content: "# Termo Customizado para Menores",
        updatedAt: "2026-09-12T12:00:00Z",
      },
    };

    render(
      <TermsConfigModal
        isOpen={true}
        onClose={handleClose}
        onSave={handleSave}
        initialData={initialData}
      />
    );

    expect(screen.getByText("meu-termo-menor-customizado.md")).toBeInTheDocument();
    expect(screen.getByText("Customizado")).toBeInTheDocument();

    // Click remove button
    const removeBtn = screen.getByRole("button", { name: /remover/i });
    fireEvent.click(removeBtn);

    // After removing, it falls back to default
    expect(screen.getByText("minor-terms-of-responsibility.md (Padrão)")).toBeInTheDocument();
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
