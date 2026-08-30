import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PagamentoClinica from "@/pages/PagamentoClinica";
import { useAuth } from "@/hooks/useAuth";
import * as asaasService from "@/services/asaasService";

let realtimeCallback: ((payload: any) => void) | null = null;

const mockChannel = {
  on: vi.fn((_event: string, _config: any, callback: (payload: any) => void) => {
    realtimeCallback = callback;
    return mockChannel;
  }),
  subscribe: vi.fn().mockReturnThis(),
};

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: supabaseMocks.from,
    channel: supabaseMocks.channel,
    removeChannel: supabaseMocks.removeChannel,
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/services/asaasService", () => ({
  processAsaasPayment: vi.fn(),
  checkAsaasPaymentStatus: vi.fn(),
  getPixQrCode: vi.fn(),
}));

describe("PagamentoClinica", () => {
  beforeEach(() => {
    realtimeCallback = null;
    supabaseMocks.from.mockReset();
    supabaseMocks.channel.mockReset().mockReturnValue(mockChannel);
    supabaseMocks.removeChannel.mockReset();
    mockChannel.on.mockClear();
    mockChannel.subscribe.mockClear();

    vi.mocked(asaasService.processAsaasPayment).mockReset();
    vi.mocked(asaasService.checkAsaasPaymentStatus).mockReset();
    vi.mocked(asaasService.getPixQrCode).mockReset();

    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-123", email: "owner@clinica.com" },
      profile: { cpf: "12345678901", full_name: "Dr. Owner" },
      clinic: { id: "clinic-123", name: "Clínica Teste" },
      refreshAuthState: vi.fn().mockResolvedValue(undefined),
      selectClinic: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof useAuth>);
  });

  const setupDefaultMocks = (existingInvoices: any[] = []) => {
    const mockSelectClinic = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "clinic-123",
            name: "Clínica Teste",
            cnpj: "12345678000199",
            email: "owner@clinica.com",
            address: { cep: "01001000", number: "100" },
          },
          error: null,
        }),
      }),
    });

    const mockSelectSub = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "sub-123",
            clinic_id: "clinic-123",
            plan_type: "solo",
            billing_cycle: "ANNUAL",
            status: "TRIAL",
            total_recurring_monthly_price: 40.0,
            payment_method: "TRIAL",
          },
          error: null,
        }),
      }),
    });

    const mockSelectInv = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: existingInvoices,
            error: null,
          }),
        }),
      }),
    });

    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "clinics") return { select: mockSelectClinic };
      if (table === "clinic_subscriptions") return { select: mockSelectSub };
      if (table === "subscription_invoices") return { select: mockSelectInv };
      return { select: vi.fn() };
    });
  };

  it("loads clinic without auto-generating PIX invoice on mount, and allows on-demand generation", async () => {
    setupDefaultMocks([]);

    vi.mocked(asaasService.processAsaasPayment).mockResolvedValue({
      success: true,
      source: "EDGE_FUNCTION",
      pixQrCode: "fake-base64-qr",
      pixCopyPaste: "00020126580014br.gov.bcb.pix...",
      rawResponse: { id: "pay_12345" },
    });

    render(
      <MemoryRouter initialEntries={["/pagamento/clinic-123?plan=solo&cycle=annual"]}>
        <Routes>
          <Route path="/pagamento/:clinicId" element={<PagamentoClinica />} />
        </Routes>
      </MemoryRouter>
    );

    // Initial Loading text
    expect(screen.getByText(/Conectando com segurança ao gateway Asaas.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Checkout Oficial da Assinatura/i)).toBeInTheDocument();
      expect(screen.getByText(/Clínica Teste/i)).toBeInTheDocument();
    });

    // Verify it did NOT auto-generate on mount
    expect(asaasService.processAsaasPayment).not.toHaveBeenCalled();

    // Verify on-demand generation button is present
    const generatePixBtn = screen.getByRole("button", { name: /Gerar QR Code PIX/i });
    expect(generatePixBtn).toBeInTheDocument();

    // Click to generate on demand
    fireEvent.click(generatePixBtn);

    await waitFor(() => {
      expect(asaasService.processAsaasPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          clinic_id: "clinic-123",
          plan_type: "solo",
          billing_cycle: "annual",
          billing_type: "PIX",
        })
      );
      expect(screen.getByText(/Chave PIX Copia e Cola/i)).toBeInTheDocument();
      expect(screen.getByAltText(/QR Code PIX Oficial Asaas/i)).toBeInTheDocument();
    });
  });

  it("subscribes to Realtime and confirms payment reactively on database event", async () => {
    setupDefaultMocks([]);

    render(
      <MemoryRouter initialEntries={["/pagamento/clinic-123?plan=solo&cycle=annual"]}>
        <Routes>
          <Route path="/pagamento/:clinicId" element={<PagamentoClinica />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Checkout Oficial da Assinatura/i)).toBeInTheDocument();
    });

    // Check Realtime channel subscribed
    expect(supabaseMocks.channel).toHaveBeenCalledWith("invoice-status-clinic-123");
    expect(realtimeCallback).not.toBeNull();

    // Simulate incoming Realtime event with CONFIRMED invoice
    act(() => {
      realtimeCallback?.({
        new: {
          id: "inv-confirmed",
          clinic_id: "clinic-123",
          status: "CONFIRMED",
          asaas_payment_id: "pay_confirmed_999",
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Assinatura Ativa com Sucesso!/i)).toBeInTheDocument();
      expect(screen.getByText(/Acessar Meu Espaço Agora/i)).toBeInTheDocument();
    });
  });

  it("switches to Credit Card tab and processes card payment without client-side DB updates", async () => {
    setupDefaultMocks([]);

    vi.mocked(asaasService.processAsaasPayment).mockResolvedValue({
      success: true,
      source: "EDGE_FUNCTION",
      rawResponse: { id: "pay_card_123" },
    });

    render(
      <MemoryRouter initialEntries={["/pagamento/clinic-123?plan=solo&cycle=annual"]}>
        <Routes>
          <Route path="/pagamento/:clinicId" element={<PagamentoClinica />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Checkout Oficial da Assinatura/i)).toBeInTheDocument();
    });

    // Click Cartão tab
    const cardTab = screen.getByRole("tab", { name: /Cartão/i });
    fireEvent.pointerDown(cardTab, { button: 0, ctrlKey: false });
    fireEvent.click(cardTab);
    fireEvent.keyDown(cardTab, { key: " " });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/NOME COMPLETO IGUAL AO CARTÃO/i)).toBeInTheDocument();
    });

    // Fill valid card details (Luhn-valid test card)
    const nameInput = screen.getByPlaceholderText(/NOME COMPLETO IGUAL AO CARTÃO/i);
    const numberInput = screen.getByPlaceholderText(/0000 0000 0000 0000/i);
    const expiryInput = screen.getByPlaceholderText(/MM\/AA/i);
    const cvvInput = screen.getByPlaceholderText(/123/i);

    fireEvent.change(nameInput, { target: { name: "holderName", value: "DR TESTE OWNER" } });
    fireEvent.change(numberInput, { target: { name: "number", value: "4111 1111 1111 1111" } });
    fireEvent.change(expiryInput, { target: { name: "expiry", value: "12/30" } });
    fireEvent.change(cvvInput, { target: { name: "ccv", value: "123" } });

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /Pagar em/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(asaasService.processAsaasPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          clinic_id: "clinic-123",
          billing_type: "CREDIT_CARD",
        })
      );
      expect(screen.getByText(/Assinatura Ativa com Sucesso!/i)).toBeInTheDocument();
    });
  });

  it("switches to Boleto tab and generates boleto on demand with linha digitável", async () => {
    setupDefaultMocks([]);

    vi.mocked(asaasService.processAsaasPayment).mockResolvedValue({
      success: true,
      source: "EDGE_FUNCTION",
      bankSlipUrl: "https://asaas.com/b/test_slip",
      rawResponse: {
        id: "pay_boleto_123",
        identificationField: "34191.79001 01043.510047 91020.150008 5 99990000010000",
      },
    });

    render(
      <MemoryRouter initialEntries={["/pagamento/clinic-123?plan=solo&cycle=annual"]}>
        <Routes>
          <Route path="/pagamento/:clinicId" element={<PagamentoClinica />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Checkout Oficial da Assinatura/i)).toBeInTheDocument();
    });

    // Click Boleto tab
    const boletoTab = screen.getByRole("tab", { name: /Boleto/i });
    fireEvent.pointerDown(boletoTab, { button: 0, ctrlKey: false });
    fireEvent.click(boletoTab);
    fireEvent.keyDown(boletoTab, { key: " " });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Gerar Boleto Bancário/i })).toBeInTheDocument();
    });

    // Generate Boleto on demand
    const generateBoletoBtn = screen.getByRole("button", { name: /Gerar Boleto Bancário/i });
    fireEvent.click(generateBoletoBtn);

    await waitFor(() => {
      expect(asaasService.processAsaasPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          clinic_id: "clinic-123",
          billing_type: "BOLETO",
        })
      );
      expect(screen.getByText(/Visualizar e Imprimir Boleto Bancário Oficial/i)).toBeInTheDocument();
      expect(screen.getByText(/Linha Digitável \/ Código de Barras/i)).toBeInTheDocument();
    });
  });
});
