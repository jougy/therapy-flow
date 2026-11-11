import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AffiliatePortalView, type AffiliatePortalPartner } from "./AffiliatePortalView";
import * as telemetryModule from "@/lib/telemetry/affiliate-telemetry";

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children, value, onValueChange, ...props }: { children: React.ReactNode; value?: string; onValueChange?: (v: string) => void }) => (
    <div {...props}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return null;
        return React.cloneElement(child, { activeValue: value, onValueChange } as Record<string, unknown>);
      })}
    </div>
  ),
  TabsList: ({ children, activeValue, onValueChange }: { children: React.ReactNode; activeValue?: string; onValueChange?: (v: string) => void }) => (
    <div role="tablist">
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return null;
        return React.cloneElement(child, { activeValue, onValueChange } as Record<string, unknown>);
      })}
    </div>
  ),
  TabsTrigger: ({ value, activeValue, onValueChange, children, ...props }: { value: string; activeValue?: string; onValueChange?: (v: string) => void; children: React.ReactNode }) => {
    const rest = { ...props } as Record<string, unknown>;
    delete rest.activeValue;
    delete rest.onValueChange;
    return (
      <button
        role="tab"
        type="button"
        aria-selected={value === activeValue}
        onClick={() => onValueChange?.(value)}
        {...rest}
      >
        {children}
      </button>
    );
  },
  TabsContent: ({ value, activeValue, children, ...props }: { value: string; activeValue?: string; children: React.ReactNode }) => {
    if (value !== activeValue) return null;
    const rest = { ...props } as Record<string, unknown>;
    delete rest.activeValue;
    delete rest.onValueChange;
    return <div role="tabpanel" {...rest}>{children}</div>;
  },
}));

vi.mock("@/lib/telemetry/affiliate-telemetry", async () => {
  const actual = await vi.importActual<typeof import("@/lib/telemetry/affiliate-telemetry")>(
    "@/lib/telemetry/affiliate-telemetry"
  );
  return {
    ...actual,
    getConsolidatedAffiliateTelemetry: vi.fn(),
  };
});

describe("AffiliatePortalView", () => {
  const mockPartner: AffiliatePortalPartner = {
    id: "aff_123",
    name: "Dr. Carlos Silva",
    email: "carlos@clinicaplus.com",
    slug: "carlos-silva",
    couponCode: "CARLOS30",
    tier: "silver",
    lifetimeCommissionCents: 125000,
    availableBalanceCents: 85000,
    retainedBalanceCents: 40000,
    overdueGraceDaysRemaining: 34,
    kycStatus: "APPROVED",
    bankName: "Banco Itaú S.A.",
    bankAgency: "1234",
    bankAccount: "98765-4",
    pixKey: "carlos@clinicaplus.com",
    pixKeyType: "EMAIL",
    hasActiveTransactions: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(telemetryModule.getConsolidatedAffiliateTelemetry).mockResolvedValue({
      slug: "carlos-silva",
      clicksCount: 250,
      trialLeadsCount: 45,
      activeSubscribersCount: 8,
      churnCount: 1,
      lifetimeCommissionCents: 125000,
      availableBalanceCents: 85000,
      retainedBalanceCents: 40000,
      overdueGraceDaysRemaining: 34,
      conversionRatePercent: 3.2,
      churnRatePercent: 11.1,
    });

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    global.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  it("renders header with partner name, coupon, and tier badge", async () => {
    await act(async () => {
      render(<AffiliatePortalView partner={mockPartner} />);
    });

    expect(screen.getByText("Portal do Parceiro Afiliado")).toBeInTheDocument();
    expect(screen.getByText(/Dr\. Carlos Silva/)).toBeInTheDocument();
    expect(screen.getByText("CARLOS30")).toBeInTheDocument();
    expect(screen.getByText("Prata")).toBeInTheDocument();
  });

  it("Aba 1 (Desempenho): renders Upstash clicks, trials, subscribers, balances and grace window", async () => {
    await act(async () => {
      render(<AffiliatePortalView partner={mockPartner} />);
    });

    await waitFor(() => {
      expect(screen.getByText("250")).toBeInTheDocument();
      expect(screen.getByText("45")).toBeInTheDocument();
      expect(screen.getByText("8")).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    expect(screen.getByText("Saldo Líquido Asaas")).toBeInTheDocument();
    expect(screen.getByText("R$ 850,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 400,00")).toBeInTheDocument();
    expect(screen.getByText("34 dias restantes")).toBeInTheDocument();
    expect(screen.getByTestId("affiliate-seasonal-campaign-card")).toBeInTheDocument();
    expect(screen.getByText("Desafio Sazonal Ativo")).toBeInTheDocument();
    expect(screen.getByText("+ R$ 300,00 no Asaas")).toBeInTheDocument();
  });

  it("Aba 2 (Hook): switches tab, builds UTM links, copies link, downloads QR Code and shows tier ladder", async () => {
    await act(async () => {
      render(<AffiliatePortalView partner={mockPartner} defaultTab="performance" />);
    });

    const hookTabTrigger = screen.getByRole("tab", { name: /Hook & Tier/i });
    await act(async () => {
      fireEvent.click(hookTabTrigger);
    });

    expect(screen.getByText(/Link Parametrizado & Construtor de UTMs/i)).toBeInTheDocument();
    expect(
      screen.getByText(/https:\/\/pluri\.health\/\?cupom=CARLOS30&ref=carlos-silva/)
    ).toBeInTheDocument();

    const whatsappBtn = screen.getByRole("button", { name: "WhatsApp" });
    await act(async () => {
      fireEvent.click(whatsappBtn);
    });
    expect(
      screen.getByText(
        /https:\/\/pluri\.health\/\?cupom=CARLOS30&ref=carlos-silva&utm_source=whatsapp&utm_medium=chat&utm_campaign=afiliado/
      )
    ).toBeInTheDocument();

    const copyBtn = screen.getByRole("button", { name: /Copiar Link/i });
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("utm_source=whatsapp")
    );

    const qrBtn = screen.getByRole("button", { name: /Baixar QR Code SVG/i });
    await act(async () => {
      fireEvent.click(qrBtn);
    });
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();

    expect(screen.getByText("Esteira dos 8 Tiers de Gamificação")).toBeInTheDocument();
    expect(screen.getByText("Bronze")).toBeInTheDocument();
    expect(screen.getAllByText("Ouro").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Legendary")).toBeInTheDocument();
  });

  it("Aba 3 (Registro): renders KYC badge, bank details, and triggers 2FA TOTP flow", async () => {
    const handleBankChange = vi.fn();
    await act(async () => {
      render(
        <AffiliatePortalView partner={mockPartner} onRequestBankChange={handleBankChange} />
      );
    });

    const registryTabTrigger = screen.getByRole("tab", { name: /Registro/i });
    await act(async () => {
      fireEvent.click(registryTabTrigger);
    });

    expect(screen.getByText("KYC Aprovado")).toBeInTheDocument();
    expect(screen.getByText("Banco Itaú S.A.")).toBeInTheDocument();
    expect(screen.getByText("•••• 65-4")).toBeInTheDocument();

    const totpRequestBtn = screen.getByRole("button", {
      name: /Solicitar Alteração Bancária \(2FA TOTP\)/i,
    });
    await act(async () => {
      fireEvent.click(totpRequestBtn);
    });

    expect(screen.getByRole("button", { name: /Confirmar com Ente Auth/i })).toBeInTheDocument();
    const inputTotp = screen.getByPlaceholderText("000000");
    await act(async () => {
      fireEvent.change(inputTotp, { target: { value: "123456" } });
    });

    const confirmBtn = screen.getByRole("button", { name: /Confirmar com Ente Auth/i });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(handleBankChange).toHaveBeenCalledWith("123456");
  });

  it("Aba 3 (Registro): disables bank edit button and shows security lock if transactions are active", async () => {
    const lockedPartner: AffiliatePortalPartner = {
      ...mockPartner,
      hasActiveTransactions: true,
      kycStatus: "PENDING",
    };

    await act(async () => {
      render(<AffiliatePortalView partner={lockedPartner} />);
    });

    const registryTabTrigger = screen.getByRole("tab", { name: /Registro/i });
    await act(async () => {
      fireEvent.click(registryTabTrigger);
    });

    expect(screen.getByText("Em Análise Asaas")).toBeInTheDocument();
    expect(screen.getByText(/Trava de Segurança Ativa/i)).toBeInTheDocument();

    const totpRequestBtn = screen.getByRole("button", {
      name: /Solicitar Alteração Bancária \(2FA TOTP\)/i,
    });
    expect(totpRequestBtn).toBeDisabled();
  });
});
