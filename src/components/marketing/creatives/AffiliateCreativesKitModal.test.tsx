import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AffiliateCreativesKitModal } from "./AffiliateCreativesKitModal";

const TabsContext = React.createContext<{
  value?: string;
  onValueChange?: (val: string) => void;
}>({});

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children, value, onValueChange, ...props }: any) => (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div {...props}>{children}</div>
    </TabsContext.Provider>
  ),
  TabsList: ({ children, ...props }: any) => (
    <div role="tablist" {...props}>{children}</div>
  ),
  TabsTrigger: ({ value, children, onClick, ...props }: any) => {
    const ctx = React.useContext(TabsContext);
    return (
      <button
        role="tab"
        type="button"
        aria-selected={ctx.value === value}
        onClick={(e) => {
          onClick?.(e);
          ctx.onValueChange?.(value);
        }}
        {...props}
      >
        {children}
      </button>
    );
  },
  TabsContent: ({ value, children, ...props }: any) => {
    const ctx = React.useContext(TabsContext);
    if (ctx.value !== value) return null;
    return <div role="tabpanel" {...props}>{children}</div>;
  },
}));

describe("AffiliateCreativesKitModal", () => {
  const defaultProps = {
    couponCode: "FISIO30",
    affiliateSlug: "clinica-move",
    isOpen: true,
    onClose: vi.fn(),
  };

  const originalClipboard = navigator.clipboard;
  const originalShare = navigator.share;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    // Mock anchor click to prevent jsdom navigation error
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    Object.assign(navigator, {
      clipboard: originalClipboard,
      share: originalShare,
    });
    vi.restoreAllMocks();
  });

  it("renders modal with header, coupon badge and default stories tab", () => {
    render(<AffiliateCreativesKitModal {...defaultProps} />);

    expect(screen.getByText("Central de Criativos & Banners")).toBeInTheDocument();
    expect(
      screen.getByText(/Artes prontas e copies persuasivas já com seu cupom exclusivo/i)
    ).toBeInTheDocument();

    // Active coupon code displayed
    expect(screen.getByTestId("active-coupon-code")).toHaveTextContent("FISIO30");

    // Affiliate link with slug
    expect(
      screen.getByText("https://plurihealth.com.br/convite/clinica-move")
    ).toBeInTheDocument();

    // Tabs
    expect(screen.getByTestId("tab-stories")).toBeInTheDocument();
    expect(screen.getByTestId("tab-feed")).toBeInTheDocument();
    expect(screen.getByTestId("tab-banners")).toBeInTheDocument();
    expect(screen.getByTestId("tab-whatsapp")).toBeInTheDocument();

    // Stories cards rendered by default
    expect(
      screen.getByText("Stories: Chega de Prontuário em Papel")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Stories: Evolução em 1 min no Celular")
    ).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(<AffiliateCreativesKitModal {...defaultProps} isOpen={false} />);

    expect(
      screen.queryByText("Central de Criativos & Banners")
    ).not.toBeInTheDocument();
  });

  it("switches to Feed tab and displays carrossel cards", () => {
    render(<AffiliateCreativesKitModal {...defaultProps} />);

    const feedTab = screen.getByTestId("tab-feed");
    fireEvent.click(feedTab);

    expect(
      screen.getByText("Carrossel: 3 Erros Jurídicos no Prontuário")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Feed: Gráficos de Evolução e Alta")
    ).toBeInTheDocument();
  });

  it("switches to WhatsApp tab and displays message templates", () => {
    render(<AffiliateCreativesKitModal {...defaultProps} />);

    const whatsappTab = screen.getByTestId("tab-whatsapp");
    fireEvent.click(whatsappTab);

    expect(
      screen.getByText("WhatsApp: Mensagem 1 a 1 para Colega")
    ).toBeInTheDocument();
    expect(
      screen.getByText("WhatsApp: Recomendação para Grupos")
    ).toBeInTheDocument();
  });

  it("copies caption with interpolated coupon and link to clipboard", async () => {
    render(<AffiliateCreativesKitModal {...defaultProps} />);

    const copyBtn = screen.getByTestId("btn-copy-story-pain-solution");
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    const copiedText = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];

    // Verify interpolation
    expect(copiedText).toContain("FISIO30");
    expect(copiedText).toContain("https://plurihealth.com.br/convite/clinica-move");

    // Button states changes to Copiado!
    await waitFor(() => {
      expect(screen.getByText("Copiado!")).toBeInTheDocument();
    });
  });

  it("calls navigator.share when available", async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share: mockShare });

    render(<AffiliateCreativesKitModal {...defaultProps} />);

    const shareBtn = screen.getByTestId("btn-share-story-pain-solution");
    fireEvent.click(shareBtn);

    expect(mockShare).toHaveBeenCalledTimes(1);
    expect(mockShare).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Stories: Chega de Prontuário em Papel",
        url: "https://plurihealth.com.br/convite/clinica-move",
      })
    );
  });

  it("falls back to copying when navigator.share is not supported", async () => {
    Object.assign(navigator, { share: undefined });

    render(<AffiliateCreativesKitModal {...defaultProps} />);

    const shareBtn = screen.getByTestId("btn-share-story-pain-solution");
    await waitFor(async () => {
      fireEvent.click(shareBtn);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
  });

  it("triggers download when clicking Baixar Arte button", () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(document.body, "removeChild");

    render(<AffiliateCreativesKitModal {...defaultProps} />);

    const downloadBtn = screen.getByTestId("btn-download-story-pain-solution");
    fireEvent.click(downloadBtn);

    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
  });

  it("closes modal when clicking Fechar button", () => {
    render(<AffiliateCreativesKitModal {...defaultProps} />);

    const closeBtn = screen.getByRole("button", { name: "Fechar" });
    fireEvent.click(closeBtn);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});
