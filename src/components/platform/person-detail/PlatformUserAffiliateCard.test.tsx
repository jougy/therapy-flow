import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { PlatformUserAffiliateCard } from "./PlatformUserAffiliateCard";
import { supabase } from "@/integrations/supabase/client";

const { mockToast } = vi.hoisted(() => ({
  mockToast: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: mockToast,
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/components/platform/PlatformInviteAffiliateModal", () => ({
  PlatformInviteAffiliateModal: ({ isOpen, onClose, user, onInviteSuccess }: any) =>
    isOpen ? (
      <div data-testid="mock-invite-modal">
        <span>Modal Convidar Afiliado: {user?.fullName}</span>
        <button
          type="button"
          data-testid="mock-invite-submit"
          onClick={() => onInviteSuccess?.()}
        >
          Confirmar Envio
        </button>
        <button type="button" onClick={onClose}>
          Fechar
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/platform/PlatformAffiliateManagementModal", () => ({
  PlatformAffiliateManagementModal: ({ isOpen, onClose, affiliateId, onSuccess }: any) =>
    isOpen ? (
      <div data-testid="mock-manage-modal">
        <span>Modal Gerenciar Afiliado: {affiliateId}</span>
        <button
          type="button"
          data-testid="mock-manage-save"
          onClick={() => onSuccess?.()}
        >
          Salvar
        </button>
        <button type="button" onClick={onClose}>
          Fechar
        </button>
      </div>
    ) : null,
}));

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn(),
    },
  };
});

describe("PlatformUserAffiliateCard", () => {
  const mockUserId = "usr-test-1234-uuid";
  const mockUserName = "Dr. Roberto Silva";
  const mockUserEmail = "roberto@clinica.com.br";
  const mockUserPhone = "11999887766";
  const mockClinicId = "clinic-test-5678";

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renderiza o estado 'Não Afiliado' e abre modal de convite com dados pré-preenchidos", async () => {
    // Configura supabase para não retornar afiliado nem convite
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "affiliates") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "affiliate_invitations") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                or: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                    }),
                  }),
                }),
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    render(
      <PlatformUserAffiliateCard
        userId={mockUserId}
        userName={mockUserName}
        userEmail={mockUserEmail}
        userPhone={mockUserPhone}
        primaryClinicId={mockClinicId}
      />
    );

    // Aguarda carregar
    await waitFor(() => {
      expect(screen.getByTestId("affiliate-status-none")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Este usuário ainda não faz parte do programa de afiliados.")
    ).toBeInTheDocument();

    const inviteBtn = screen.getByTestId("btn-invite-affiliate");
    expect(inviteBtn).toBeInTheDocument();

    // Clica para convidar
    fireEvent.click(inviteBtn);

    expect(screen.getByTestId("mock-invite-modal")).toBeInTheDocument();
    expect(
      screen.getByText(`Modal Convidar Afiliado: ${mockUserName}`)
    ).toBeInTheDocument();
  });

  it("renderiza o estado 'Convite Pendente' com detalhes, permite copiar link e confirmação master", async () => {
    const mockInvitation = {
      id: "inv-999-uuid",
      token: "aff-token-xyz-123",
      floor_tier: "silver",
      status: "pending",
      clinic_id: mockClinicId,
      invited_user_id: mockUserId,
      invited_email: mockUserEmail,
      created_at: "2026-11-01T10:00:00Z",
      metadata: {
        is_custom: true,
        custom_commissions: {
          first_month_percent: 35,
          recurring_percent: 15,
        },
      },
    };

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: { id: "inv-999-uuid" }, error: null }),
    });

    const insertMock = vi.fn().mockResolvedValue({ data: { id: "aff-created-123" }, error: null });

    let affiliateQueryCount = 0;

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "affiliates") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: vi.fn().mockImplementation(() => {
                  affiliateQueryCount++;
                  // Primeira busca: não é afiliado. Durante a ativação: ainda não existe.
                  return Promise.resolve({ data: null, error: null });
                }),
              }),
            }),
          }),
          insert: insertMock,
        };
      }
      if (table === "affiliate_invitations") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                or: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: mockInvitation,
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
          update: updateMock,
        };
      }
      return { select: vi.fn() };
    });

    (supabase.rpc as any).mockResolvedValue({
      data: { success: true, status: "accepted" },
      error: null,
    });

    const onStatusChangeMock = vi.fn();

    render(
      <PlatformUserAffiliateCard
        userId={mockUserId}
        userName={mockUserName}
        userEmail={mockUserEmail}
        userPhone={mockUserPhone}
        primaryClinicId={mockClinicId}
        onAffiliateStatusChange={onStatusChangeMock}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("affiliate-status-pending")).toBeInTheDocument();
    });

    expect(screen.getByText("Convite de Afiliação Enviado")).toBeInTheDocument();
    expect(screen.getByText(/35% \(1º mês\) \/ 15% \(recorrente\)/)).toBeInTheDocument();

    // Copiar link
    const copyBtn = screen.getByTestId("btn-copy-invite-link");
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("aff-token-xyz-123")
      );
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Link copiado!",
        })
      );
    });

    // Confirmar e ativar
    const confirmBtn = screen.getByTestId("btn-confirm-invitation");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith(
        "respond_affiliate_invitation",
        expect.objectContaining({
          _invitation_id: "inv-999-uuid",
          _response: "accepted",
        })
      );
      expect(updateMock).toHaveBeenCalled();
      expect(insertMock).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Afiliação ativada!",
        })
      );
      expect(onStatusChangeMock).toHaveBeenCalled();
    });
  });

  it("renderiza o estado 'Já é Afiliado' exibindo tier, métricas e botão para gerenciar", async () => {
    const mockAffiliate = {
      id: "aff-existing-888-uuid",
      user_id: mockUserId,
      clinic_id: mockClinicId,
      tier: "gold",
      minimum_tier_floor: "gold",
      status: "active",
      coupon_code: "ROBERTO40",
      referral_slug: "dr-roberto",
      active_referrals_count: 14,
      total_sales_count: 32,
      lifetime_commission_cents: 185000, // R$ 1.850,00
      created_at: "2026-10-15T12:00:00Z",
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "affiliates") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: mockAffiliate,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    render(
      <PlatformUserAffiliateCard
        userId={mockUserId}
        userName={mockUserName}
        userEmail={mockUserEmail}
        userPhone={mockUserPhone}
        primaryClinicId={mockClinicId}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("affiliate-status-active")).toBeInTheDocument();
    });

    expect(screen.getByText("Ouro")).toBeInTheDocument();
    expect(screen.getByText("ROBERTO40")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("32")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.850,00")).toBeInTheDocument();

    const manageBtn = screen.getByTestId("btn-manage-affiliate");
    expect(manageBtn).toBeInTheDocument();

    fireEvent.click(manageBtn);

    expect(screen.getByTestId("mock-manage-modal")).toBeInTheDocument();
    expect(
      screen.getByText(`Modal Gerenciar Afiliado: ${mockAffiliate.id}`)
    ).toBeInTheDocument();
  });
});
