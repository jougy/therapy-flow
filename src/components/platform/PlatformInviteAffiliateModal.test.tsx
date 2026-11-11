import React, { createContext, useContext } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  PlatformInviteAffiliateModal,
  buildAffiliateWhatsAppUrl,
  type PlatformInviteAffiliateUser,
} from "./PlatformInviteAffiliateModal";
import { DirectoryCard } from "./DirectoryCard";
import type { PlatformDirectoryItem } from "./types";
import { supabase } from "@/integrations/supabase/client";

const mockToast = vi.fn();
vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <>{children}</>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

const MockSelectContext = createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
}>({});

vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <MockSelectContext.Provider value={{ value, onValueChange }}>
      <div>{children}</div>
    </MockSelectContext.Provider>
  ),
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => {
    const ctx = useContext(MockSelectContext);
    return (
      <select
        id="floor-tier-select"
        aria-label="Piso Garantido Inicial (Floor Tier)"
        value={ctx.value}
        onChange={(e) => ctx.onValueChange?.(e.target.value)}
      >
        {children}
      </select>
    );
  },
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));

const { affiliateInsertMock, notificationsInsertMock, rpcMock } = vi.hoisted(() => ({
  affiliateInsertMock: vi.fn().mockResolvedValue({ data: { id: "inv-123" }, error: null }),
  notificationsInsertMock: vi.fn().mockResolvedValue({ data: { id: "notif-123" }, error: null }),
  rpcMock: vi.fn().mockResolvedValue({ data: "notif-123", error: null }),
}));

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === "affiliate_invitations") {
          return { insert: affiliateInsertMock };
        }
        if (table === "app_notifications") {
          return { insert: notificationsInsertMock };
        }
        return {
          insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
        };
      }),
      rpc: rpcMock,
    },
  };
});

describe("PlatformInviteAffiliateModal & buildAffiliateWhatsAppUrl", () => {
  const mockUser: PlatformInviteAffiliateUser = {
    id: "usr-456-abcdef123456",
    fullName: "Dra. Juliana Mendes",
    email: "juliana@exemplo.com",
    phone: "11987654321",
    clinicId: "clinic-789",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    affiliateInsertMock.mockResolvedValue({ data: { id: "inv-123" }, error: null });
    notificationsInsertMock.mockResolvedValue({ data: { id: "notif-123" }, error: null });
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  describe("buildAffiliateWhatsAppUrl helper", () => {
    it("formats phone without 55 by prepending Brazil country code", () => {
      const url = buildAffiliateWhatsAppUrl("11987654321", "https://link.test/token", "Juliana");
      expect(url).toContain("https://wa.me/5511987654321?text=");
      expect(url).toContain(encodeURIComponent("Olá Juliana!"));
      expect(url).toContain(encodeURIComponent("https://link.test/token"));
    });

    it("does not duplicate 55 if phone already includes country code", () => {
      const url = buildAffiliateWhatsAppUrl("+55 (11) 98765-4321", "https://link.test/token", "Juliana");
      expect(url).toContain("https://wa.me/5511987654321?text=");
    });
  });

  describe("Modal rendering & channels", () => {
    it("renders user information and modal titles when open", () => {
      render(
        <PlatformInviteAffiliateModal
          user={mockUser}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText("Convidar para Afiliado")).toBeInTheDocument();
      expect(screen.getByText("Dra. Juliana Mendes")).toBeInTheDocument();
      expect(screen.getByText("Email: juliana@exemplo.com")).toBeInTheDocument();
      expect(screen.getByText("Tel: 11987654321")).toBeInTheDocument();
      expect(screen.getByText("usr-456-")).toBeInTheDocument();
    });

    it("disables email and whatsapp checkboxes when user lacks respective contact info", () => {
      const userWithoutContacts: PlatformInviteAffiliateUser = {
        id: "usr-no-contacts",
        fullName: "Usuário Sem Contatos",
      };

      render(
        <PlatformInviteAffiliateModal
          user={userWithoutContacts}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText("Sem e-mail cadastrado")).toBeInTheDocument();
      expect(screen.getByText("Sem telefone cadastrado")).toBeInTheDocument();
    });

    it("calls onClose when Cancel button is clicked", () => {
      const handleClose = vi.fn();
      render(
        <PlatformInviteAffiliateModal
          user={mockUser}
          isOpen={true}
          onClose={handleClose}
        />
      );

      fireEvent.click(screen.getByText("Cancelar"));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Custom tier & custom commissions flow", () => {
    it("renders custom option in floor tier select", () => {
      render(
        <PlatformInviteAffiliateModal
          user={mockUser}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      const option = screen.getByRole("option", { name: /Personalizado \(Definir Comissões\)/i });
      expect(option).toBeInTheDocument();
      expect(option).toHaveValue("custom");
    });

    it("does not render custom commission fields by default (bronze tier)", () => {
      render(
        <PlatformInviteAffiliateModal
          user={mockUser}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      expect(screen.queryByLabelText(/Comissão Inicial - 1º Mês/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Comissão Recorrente/i)).not.toBeInTheDocument();
    });

    it("renders custom commission numeric inputs with defaults and helper texts when custom is selected", () => {
      render(
        <PlatformInviteAffiliateModal
          user={mockUser}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      fireEvent.change(screen.getByLabelText("Piso Garantido Inicial (Floor Tier)"), {
        target: { value: "custom" },
      });

      const firstMonthInput = screen.getByLabelText("Comissão Inicial - 1º Mês (%)") as HTMLInputElement;
      const recurringInput = screen.getByLabelText("Comissão Recorrente (%)") as HTMLInputElement;

      expect(firstMonthInput).toBeInTheDocument();
      expect(firstMonthInput.value).toBe("30");
      expect(firstMonthInput).toHaveAttribute("min", "0");
      expect(firstMonthInput).toHaveAttribute("max", "100");
      expect(firstMonthInput).toHaveAttribute("step", "0.5");

      expect(recurringInput).toBeInTheDocument();
      expect(recurringInput.value).toBe("10");
      expect(recurringInput).toHaveAttribute("min", "0");
      expect(recurringInput).toHaveAttribute("max", "100");
      expect(recurringInput).toHaveAttribute("step", "0.5");

      expect(screen.getByText("Percentual sobre a 1ª mensalidade paga (0 a 100%).")).toBeInTheDocument();
      expect(screen.getByText("Percentual recorrente mensal vitalício (0 a 100%).")).toBeInTheDocument();
      expect(screen.getByText(/Piso Personalizado: Definir percentuais acordados com o afiliado\./i)).toBeInTheDocument();
    });

    it("submits custom invitation saving floor_tier='bronze' and is_custom+custom_commissions in metadata", async () => {
      const handleSuccess = vi.fn();

      render(
        <PlatformInviteAffiliateModal
          user={mockUser}
          isOpen={true}
          onClose={vi.fn()}
          onInviteSuccess={handleSuccess}
        />
      );

      fireEvent.change(screen.getByLabelText("Piso Garantido Inicial (Floor Tier)"), {
        target: { value: "custom" },
      });

      const firstMonthInput = screen.getByLabelText("Comissão Inicial - 1º Mês (%)");
      const recurringInput = screen.getByLabelText("Comissão Recorrente (%)");

      fireEvent.change(firstMonthInput, { target: { value: "45.5" } });
      fireEvent.change(recurringInput, { target: { value: "15" } });

      fireEvent.click(screen.getByText("Gerar e Enviar Convite"));

      await waitFor(() => {
        expect(affiliateInsertMock).toHaveBeenCalledWith(
          expect.objectContaining({
            floor_tier: "bronze",
            metadata: expect.objectContaining({
              is_custom: true,
              custom_commissions: {
                first_month_percent: 45.5,
                recurring_percent: 15,
              },
            }),
          })
        );
      });

      await waitFor(() => {
        expect(rpcMock).toHaveBeenCalledWith(
          "create_user_notification",
          expect.objectContaining({
            _body: expect.stringContaining("comissões personalizadas (45.5% / 15%)"),
            _payload: expect.objectContaining({
              floor_tier: "custom",
              custom_commissions: {
                first_month_percent: 45.5,
                recurring_percent: 15,
              },
            }),
          })
        );
      });

      expect(handleSuccess).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Convite gerado com sucesso!")).toBeInTheDocument();
    });

    it("rejects invalid percentages and shows error toast without submitting", async () => {
      render(
        <PlatformInviteAffiliateModal
          user={mockUser}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      fireEvent.change(screen.getByLabelText("Piso Garantido Inicial (Floor Tier)"), {
        target: { value: "custom" },
      });

      const firstMonthInput = screen.getByLabelText("Comissão Inicial - 1º Mês (%)");
      fireEvent.change(firstMonthInput, { target: { value: "150" } });

      fireEvent.click(screen.getByText("Gerar e Enviar Convite"));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Percentuais inválidos",
            variant: "destructive",
          })
        );
      });

      expect(affiliateInsertMock).not.toHaveBeenCalled();
    });
  });

  describe("Submitting invitations & success view", () => {
    it("submits invitation, registers in-app notification, and renders link copier", async () => {
      const handleSuccess = vi.fn();
      const handleClose = vi.fn();

      render(
        <PlatformInviteAffiliateModal
          user={mockUser}
          isOpen={true}
          onClose={handleClose}
          onInviteSuccess={handleSuccess}
        />
      );

      const submitBtn = screen.getByText("Gerar e Enviar Convite");
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith("affiliate_invitations");
      });

      await waitFor(() => {
        expect(screen.getByText("Convite gerado com sucesso!")).toBeInTheDocument();
      });

      expect(handleSuccess).toHaveBeenCalledTimes(1);
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Convite gerado com sucesso!",
        })
      );

      // Link input is rendered
      const input = screen.getByDisplayValue(/https:\/\/app\.plurifisio\.com\.br\/afiliados\/onboarding\?token=/);
      expect(input).toBeInTheDocument();

      // Copy link
      const copyBtn = screen.getByText("Copiar");
      fireEvent.click(copyBtn);
      expect(navigator.clipboard.writeText).toHaveBeenCalled();

      // WhatsApp direct action button is present because user had phone
      expect(screen.getByText("Enviar pelo WhatsApp")).toBeInTheDocument();

      // Conclude button closes modal
      fireEvent.click(screen.getByText("Concluir"));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("handles database submission error gracefully with toast", async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockResolvedValueOnce({
          data: null,
          error: new Error("Erro de constraint do banco"),
        }),
      } as any);

      render(
        <PlatformInviteAffiliateModal
          user={mockUser}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      fireEvent.click(screen.getByText("Gerar e Enviar Convite"));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Erro ao gerar convite",
            variant: "destructive",
          })
        );
      });
    });
  });

  describe("DirectoryCard quick actions integration", () => {
    it("renders user quick action button and triggers onInviteAffiliate when clicked", () => {
      const handleInvite = vi.fn();
      const mockAccountItem: PlatformDirectoryItem = {
        item_id: "user-test-999",
        item_type: "account",
        title: "Dra. Beatriz Santos",
        subtitle: "beatriz@clinica.com",
        status: "active",
        clinic_id: "clinic-1",
        clinic_name: "Clínica Pluri",
        primary_document: "987.654.321-00",
        secondary_document: "11999998888",
        metadata: {
          email: "beatriz@clinica.com",
          phone: "11999998888",
        },
        updated_at: "2026-11-01T12:00:00Z",
      };

      render(
        <DirectoryCard
          item={mockAccountItem}
          onClick={vi.fn()}
          onInviteAffiliate={handleInvite}
        />
      );

      const actionTrigger = screen.getByLabelText("Ações do usuário");
      expect(actionTrigger).toBeInTheDocument();

      fireEvent.click(actionTrigger);

      const inviteMenuItem = screen.getByText("Convidar para Afiliado");
      expect(inviteMenuItem).toBeInTheDocument();

      fireEvent.click(inviteMenuItem);
      expect(handleInvite).toHaveBeenCalledWith(mockAccountItem);
    });
  });
});

