import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AffiliateFinancialStatsBlock } from "./AffiliateFinancialStatsBlock";
import type { AffiliateFinancialStatsData } from "./types";

const mockToast = vi.fn();
vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe("AffiliateFinancialStatsBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders default top cards and values correctly", () => {
    render(<AffiliateFinancialStatsBlock />);

    // 1. Saldo Disponível
    expect(screen.getByText("Saldo Disponível Asaas")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.840,00")).toBeInTheDocument();
    expect(screen.getByText("Liberado para saque/PIX")).toBeInTheDocument();

    // 2. Saldo em Garantia
    expect(screen.getByText("Saldo em Garantia")).toBeInTheDocument();
    expect(screen.getByText("R$ 620,00")).toBeInTheDocument();
    expect(screen.getByText("Quarentena de 40 dias")).toBeInTheDocument();

    // 3. MRR de Afiliados
    expect(screen.getByText("MRR de Afiliados")).toBeInTheDocument();
    expect(screen.getByText("R$ 2.450,00")).toBeInTheDocument();

    // 4. Status Fiscal
    expect(screen.getByText("Status Fiscal")).toBeInTheDocument();
    expect(screen.getByText("Em dia (MEI / NFS-e)")).toBeInTheDocument();
  });

  it("renders table of splits and badges correctly", () => {
    render(<AffiliateFinancialStatsBlock />);

    // Headers
    expect(screen.getByText("Extrato Resumido de Comissões e Splits")).toBeInTheDocument();
    expect(screen.getByText("Clínica Indicada")).toBeInTheDocument();
    expect(screen.getByText("Plano/Ciclo")).toBeInTheDocument();
    expect(screen.getByText("Status Asaas")).toBeInTheDocument();

    // Rows
    expect(screen.getByText("Clínica FisioLife")).toBeInTheDocument();
    expect(screen.getByText("Plano Equipe (Mensal)")).toBeInTheDocument();
    expect(screen.getByText("Espaço Integrar Saúde")).toBeInTheDocument();
    expect(screen.getByText("Centro Reab Vital")).toBeInTheDocument();
    expect(screen.getByText("Studio Pilates Postura")).toBeInTheDocument();

    // Badges
    expect(screen.getAllByText("Recebido").length).toBeGreaterThan(0);
    expect(screen.getByText("Em Retenção")).toBeInTheDocument();
    expect(screen.getByText("Estornado")).toBeInTheDocument();
  });

  it("renders pending invoice badge when tax status is pending_invoice", () => {
    const customData: Partial<AffiliateFinancialStatsData> = {
      taxStatus: "pending_invoice",
    };

    render(<AffiliateFinancialStatsBlock data={customData} />);
    expect(screen.getByText("Pendente de Nota")).toBeInTheDocument();
    expect(screen.getByText("Envie a NFS-e do mês para liberar o split")).toBeInTheDocument();
  });

  it("handles annual report download callback", () => {
    const onDownloadReport = vi.fn();
    render(<AffiliateFinancialStatsBlock onDownloadReport={onDownloadReport} />);

    const downloadBtn = screen.getByRole("button", { name: /Baixar Informe Anual/i });
    fireEvent.click(downloadBtn);

    expect(onDownloadReport).toHaveBeenCalledWith("pdf", 2026);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Informe baixado com sucesso",
      })
    );
  });

  it("handles year change in fiscal report module", () => {
    const onDownloadReport = vi.fn();
    render(<AffiliateFinancialStatsBlock onDownloadReport={onDownloadReport} />);

    const select = screen.getByLabelText("Ano de referência fiscal");
    fireEvent.change(select, { target: { value: "2025" } });

    const downloadBtn = screen.getByRole("button", { name: /Baixar Informe Anual/i });
    fireEvent.click(downloadBtn);

    expect(onDownloadReport).toHaveBeenCalledWith("pdf", 2025);
  });

  it("calls onNavigateFullStats when full history button is clicked", () => {
    const onNavigateFullStats = vi.fn();
    render(<AffiliateFinancialStatsBlock onNavigateFullStats={onNavigateFullStats} />);

    const historyBtn = screen.getByRole("button", { name: /Ver histórico completo/i });
    fireEvent.click(historyBtn);

    expect(onNavigateFullStats).toHaveBeenCalledTimes(1);
  });

  it("displays empty state when splits array is empty", () => {
    const emptyData: Partial<AffiliateFinancialStatsData> = {
      splits: [],
    };

    render(<AffiliateFinancialStatsBlock data={emptyData} />);
    expect(
      screen.getByText("Nenhuma comissão ou split registrado neste período.")
    ).toBeInTheDocument();
  });
});
