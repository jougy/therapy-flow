import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  AffiliateWhatsAppPlaybooksModal,
  interpolatePlaybook,
  generateWhatsAppUrl,
  PLAYBOOK_TEMPLATES,
} from "./AffiliateWhatsAppPlaybooksModal";

describe("interpolatePlaybook helper", () => {
  const sampleTemplate =
    "Fala, {{PRIMEIRO_NOME}}! Cupom: {{CODIGO_DO_CUPOM}} - Link: {{LINK_CUPOM}}";

  it("replaces coupon code and link correctly without slug", () => {
    const result = interpolatePlaybook(sampleTemplate, "CUPOM10", "Lucas");
    expect(result).toContain("Fala, Lucas!");
    expect(result).toContain("Cupom: CUPOM10");
    expect(result).toContain("Link: https://pluri.health/?cupom=CUPOM10");
  });

  it("includes affiliateSlug in link when provided", () => {
    const result = interpolatePlaybook(sampleTemplate, "CUPOM10", "Lucas", "dr-lucas");
    expect(result).toContain("Link: https://pluri.health/?cupom=CUPOM10&ref=dr-lucas");
  });

  it("falls back to Dr(a) when targetName is not provided", () => {
    const result = interpolatePlaybook(sampleTemplate, "CUPOM10");
    expect(result).toContain("Fala, Dr(a)!");
  });

  it("extracts only the first name when full name is passed", () => {
    const result = interpolatePlaybook(sampleTemplate, "CUPOM10", "Dra. Juliana Silva");
    expect(result).toContain("Fala, Dra.!");
  });
});

describe("generateWhatsAppUrl helper", () => {
  const text = "Olá! Teste de mensagem";

  it("generates url without phone number when none is provided", () => {
    const url = generateWhatsAppUrl(text);
    expect(url).toBe(`https://wa.me/?text=${encodeURIComponent(text)}`);
  });

  it("formats 11-digit brazilian phone with country code 55", () => {
    const url = generateWhatsAppUrl(text, "(11) 98765-4321");
    expect(url).toBe(`https://wa.me/5511987654321?text=${encodeURIComponent(text)}`);
  });

  it("retains existing 55 country code if already present", () => {
    const url = generateWhatsAppUrl(text, "5511987654321");
    expect(url).toBe(`https://wa.me/5511987654321?text=${encodeURIComponent(text)}`);
  });
});

describe("AffiliateWhatsAppPlaybooksModal Component", () => {
  const defaultProps = {
    couponCode: "FISIOVIP",
    affiliateSlug: "dr-carlos",
    isOpen: true,
    onClose: vi.fn(),
    targetPhone: "11988887777",
    targetName: "Mariana",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  it("does not render when isOpen is false", () => {
    render(<AffiliateWhatsAppPlaybooksModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText(/Playbooks & Scripts de WhatsApp/i)).not.toBeInTheDocument();
  });

  it("renders modal header, coupon badge, and all 4 playbook cards when open", () => {
    render(<AffiliateWhatsAppPlaybooksModal {...defaultProps} />);

    expect(screen.getByText(/Playbooks & Scripts de WhatsApp/i)).toBeInTheDocument();
    expect(screen.getByText("Cupom: FISIOVIP")).toBeInTheDocument();

    expect(screen.getByText("Indicação para Colega Autônomo")).toBeInTheDocument();
    expect(screen.getByText("Abordagem para Clínicas e Consultórios")).toBeInTheDocument();
    expect(screen.getByText("Resgate de Teste Grátis / Demonstração")).toBeInTheDocument();
    expect(screen.getByText("Script para Stories e Redes Sociais")).toBeInTheDocument();
  });

  it("initializes input fields with targetName and targetPhone props", () => {
    render(<AffiliateWhatsAppPlaybooksModal {...defaultProps} />);

    const nameInput = screen.getByTestId("playbook-target-name") as HTMLInputElement;
    const phoneInput = screen.getByTestId("playbook-target-phone") as HTMLInputElement;

    expect(nameInput.value).toBe("Mariana");
    expect(phoneInput.value).toBe("11988887777");

    const colegaText = screen.getByTestId("playbook-text-colegas");
    expect(colegaText).toHaveTextContent("Fala, Mariana!");
    expect(colegaText).toHaveTextContent("FISIOVIP");
  });

  it("updates text live when recipient name input changes", () => {
    render(<AffiliateWhatsAppPlaybooksModal {...defaultProps} />);

    const nameInput = screen.getByTestId("playbook-target-name");
    fireEvent.change(nameInput, { target: { value: "Roberto Santos" } });

    const colegaText = screen.getByTestId("playbook-text-colegas");
    expect(colegaText).toHaveTextContent("Fala, Roberto!");
  });

  it("copies formatted text to clipboard and shows visual feedback", async () => {
    render(<AffiliateWhatsAppPlaybooksModal {...defaultProps} />);

    const copyBtn = screen.getByTestId("copy-btn-colegas");
    expect(copyBtn).toHaveTextContent("Copiar Texto");

    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    const copiedText = (navigator.clipboard.writeText as any).mock.calls[0][0];
    expect(copiedText).toContain("Fala, Mariana!");
    expect(copiedText).toContain("FISIOVIP");

    await waitFor(() => {
      expect(screen.getByTestId("copy-btn-colegas")).toHaveTextContent("Copiado!");
    });
  });

  it("opens WhatsApp with correct encoded url when clicking Abrir no WhatsApp", () => {
    render(<AffiliateWhatsAppPlaybooksModal {...defaultProps} />);

    const whatsappBtn = screen.getByTestId("whatsapp-btn-colegas");
    fireEvent.click(whatsappBtn);

    expect(window.open).toHaveBeenCalledTimes(1);
    const calledUrl = (window.open as any).mock.calls[0][0];
    expect(calledUrl).toContain("https://wa.me/5511988887777?text=");
    expect(calledUrl).toContain(encodeURIComponent("Fala, Mariana!"));
    expect(calledUrl).toContain(encodeURIComponent("FISIOVIP"));
  });

  it("calls onClose when clicking Fechar button", () => {
    render(<AffiliateWhatsAppPlaybooksModal {...defaultProps} />);

    const closeBtn = screen.getByRole("button", { name: "Fechar" });
    fireEvent.click(closeBtn);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});
