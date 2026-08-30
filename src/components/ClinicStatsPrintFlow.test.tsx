import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClinicStatsPrintModal, STATS_BLOCKS } from "@/components/ClinicStatsPrintModal";
import { PrintResponsibilityModal } from "@/components/PrintResponsibilityModal";

// Mock supabase client to avoid network calls during test execution
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  },
}));

describe("Clinic Stats Print Flow - Unit & Integration Test Suite", () => {
  it("Requirement 3: Opens ClinicStatsPrintModal displaying all 12 stats blocks and selection controls", () => {
    const handleClose = vi.fn();
    const handleConfirmPrint = vi.fn();

    render(
      <ClinicStatsPrintModal
        isOpen={true}
        onClose={handleClose}
        onConfirmPrint={handleConfirmPrint}
      />
    );

    // Verify modal header
    expect(screen.getByText("Opções de Impressão das Estatísticas")).toBeInTheDocument();
    expect(
      screen.getByText("Selecione quais blocos e gráficos farão parte do documento gerado para impressão ou exportação PDF.")
    ).toBeInTheDocument();

    // Verify default state: all blocks selected
    expect(screen.getByText(`${STATS_BLOCKS.length} de ${STATS_BLOCKS.length} blocos selecionados`)).toBeInTheDocument();

    // Verify all blocks are present by title
    STATS_BLOCKS.forEach((block) => {
      expect(screen.getByText(block.title)).toBeInTheDocument();
    });

    // Verify 'Desmarcar todos' / 'Selecionar todos' toggle button functionality
    const toggleAllBtn = screen.getByRole("button", { name: /desmarcar todos/i });
    expect(toggleAllBtn).toBeInTheDocument();

    // Click 'Desmarcar todos'
    fireEvent.click(toggleAllBtn);
    expect(screen.getByText(`0 de ${STATS_BLOCKS.length} blocos selecionados`)).toBeInTheDocument();

    // Verify submit button is disabled when 0 blocks selected
    const continueBtn = screen.getByRole("button", { name: /continuar para impressão \(0\)/i });
    expect(continueBtn).toBeDisabled();

    // Click 'Selecionar todos'
    const selectAllBtn = screen.getByRole("button", { name: /selecionar todos/i });
    fireEvent.click(selectAllBtn);
    expect(screen.getByText(`${STATS_BLOCKS.length} de ${STATS_BLOCKS.length} blocos selecionados`)).toBeInTheDocument();
  });

  it("Requirement 4: Allows selecting specific blocks and advancing to PrintResponsibilityModal", async () => {
    const handleClose = vi.fn();
    const handleConfirmPrint = vi.fn();

    render(
      <ClinicStatsPrintModal
        isOpen={true}
        onClose={handleClose}
        onConfirmPrint={handleConfirmPrint}
      />
    );

    // Toggle off a few blocks (e.g., desmarcar todos then select 2 specific blocks)
    fireEvent.click(screen.getByRole("button", { name: /desmarcar todos/i }));
    
    // Select block 1 and block 2
    const block1 = screen.getByText("Receita Registrada");
    const block2 = screen.getByText("Agenda de Atendimentos");

    fireEvent.click(block1);
    fireEvent.click(block2);

    expect(screen.getByText(`2 de ${STATS_BLOCKS.length} blocos selecionados`)).toBeInTheDocument();

    // Click 'Continuar para Impressão (2)'
    const continueBtn = screen.getByRole("button", { name: /continuar para impressão \(2\)/i });
    expect(continueBtn).not.toBeDisabled();
    fireEvent.click(continueBtn);

    // Verify PrintResponsibilityModal opens
    await waitFor(() => {
      expect(screen.getByText("Termo de Responsabilidade para Impressão")).toBeInTheDocument();
    });
  });

  it("Requirement 5: PrintResponsibilityModal enforces LGPD checkbox confirmation before enabling print", async () => {
    const handleConfirm = vi.fn();
    const handleCancel = vi.fn();

    render(
      <PrintResponsibilityModal
        isOpen={true}
        documentTitle="Estatísticas Completas da Clínica"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );

    // Verify LGPD and title details
    expect(screen.getByText(/LGPD & Proteção de Dados Sensíveis/i)).toBeInTheDocument();
    expect(screen.getByText("Termo de Responsabilidade para Impressão")).toBeInTheDocument();
    expect(screen.getByText(/Declaro que li, compreendo e aceito a responsabilidade exclusiva/i)).toBeInTheDocument();

    // Confirm button should initially be disabled
    const printBtn = screen.getByRole("button", { name: /aceitar e imprimir/i });
    expect(printBtn).toBeDisabled();

    // Click checkbox
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    // Confirm button should now be enabled
    expect(printBtn).not.toBeDisabled();

    // Click confirm button
    fireEvent.click(printBtn);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it("Requirement 6: Viewport 375px structure has overflow-y-auto scroll containers on both modals", async () => {
    const { unmount: unmount1 } = render(
      <ClinicStatsPrintModal
        isOpen={true}
        onClose={() => {}}
        onConfirmPrint={() => {}}
      />
    );

    const scrollableBlocksContainer = document.body.querySelector(".overflow-y-auto");
    expect(scrollableBlocksContainer).not.toBeNull();
    expect(scrollableBlocksContainer).toHaveClass("flex-1", "min-h-0", "overflow-y-auto");

    unmount1();

    render(
      <PrintResponsibilityModal
        isOpen={true}
        documentTitle="Estatísticas"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );

    await waitFor(() => {
      const scrollableTermsContainer = document.body.querySelector(".overflow-y-auto");
      expect(scrollableTermsContainer).not.toBeNull();
      expect(scrollableTermsContainer).toHaveClass("flex-1", "min-h-0", "overflow-y-auto");
    });
  });
});
