import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformMarketingPage } from "../PlatformMarketingPage";
import { buildLeadWhatsAppUrl, normalizeBrPhoneKey } from "../auto-leads/usePlatformAutoLeads";
import type { PlatformAutoLead } from "../auto-leads/types";

window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "usr-owner-1" },
    isPlatformOwner: true,
  }),
}));

vi.mock("../PlatformAffiliatesPage", () => ({
  PlatformAffiliatesPage: () => (
    <div data-testid="mock-platform-affiliates-page">Painel de Afiliados Mock</div>
  ),
}));

const TabsContext = React.createContext<{
  activeValue?: string;
  onValueChange?: (v: string) => void;
}>({});

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children, value, onValueChange, ...props }: any) => (
    <TabsContext.Provider value={{ activeValue: value, onValueChange }}>
      <div {...props}>{children}</div>
    </TabsContext.Provider>
  ),
  TabsList: ({ children, ...props }: any) => (
    <div role="tablist" {...props}>
      {children}
    </div>
  ),
  TabsTrigger: ({ value, children, ...props }: any) => {
    const { activeValue, onValueChange } = React.useContext(TabsContext);
    return (
      <button
        role="tab"
        type="button"
        aria-selected={value === activeValue}
        onClick={() => onValueChange?.(value)}
        {...props}
      >
        {children}
      </button>
    );
  },
  TabsContent: ({ value, children, ...props }: any) => {
    const { activeValue } = React.useContext(TabsContext);
    if (value !== activeValue) return null;
    return (
      <div role="tabpanel" {...props}>
        {children}
      </div>
    );
  },
}));

const mockLeadsData: PlatformAutoLead[] = [
  {
    id: "lead-1",
    full_name: "Dra. Camila Nogueira",
    phone: "5511991234455",
    email: "camila@movimentopleno.com.br",
    instagram_handle: "@camilanogueira.fisio",
    facebook_group_name: "Fisioterapia Brasil - Gestão e Clínica",
    clinic_name: "Clínica Movimento Pleno",
    city: "São Paulo",
    state: "SP",
    specialty: "Fisioterapia Ortopédica",
    icp_tier: "clinic_owner",
    source_platform: "facebook_group",
    source_post_excerpt: "Qual sistema de prontuário vocês usam na clínica?",
    ai_score: 92,
    ai_icebreaker_message: "Olá Camila! Vi seu post no Fisioterapia Brasil sobre prontuário.",
    stage: "meeting_scheduled",
    meeting_status: "scheduled",
    meeting_scheduled_at: "2026-11-20T14:30:00.000Z",
    meeting_channel: "whatsapp_bot_5511960474566",
    meeting_booked_by: "Dra. Camila Nogueira (Bot +55 11 96047-4566)",
    external_lead_key: "lead:11991234455",
    created_at: "2026-11-18T10:00:00.000Z",
    updated_at: "2026-11-18T10:00:00.000Z",
  },
  {
    id: "lead-2",
    full_name: "Dr. Henrique Bastos",
    phone: "5521988776655",
    instagram_handle: "@hbastos.pilates",
    facebook_group_name: "Pilates Clínico & Estúdios Brasil",
    clinic_name: "Studio Bastos Pilates",
    city: "Niterói",
    state: "RJ",
    specialty: "Pilates Clínico",
    icp_tier: "studio_pilates",
    source_platform: "facebook_group",
    source_post_excerpt: "Preciso organizar as evoluções e agenda do estúdio.",
    ai_score: 85,
    ai_icebreaker_message: "Olá Henrique! Vi que você está buscando organizar seu estúdio de Pilates.",
    stage: "qualified",
    meeting_status: "none",
    external_lead_key: "lead:21988776655",
    created_at: "2026-11-18T11:00:00.000Z",
    updated_at: "2026-11-18T11:00:00.000Z",
  },
];

const mockSessionsData = [
  {
    id: "ws-2",
    phone: "5521988776655",
    current_step: "waiting_time",
    last_message_at: "2026-11-18T18:10:00.000Z",
    metadata: { selected_day_label: "Quinta 20/11" },
  },
];

const mockMeetingsData = [
  {
    id: "meet-1",
    lead_name: "Dra. Camila Nogueira",
    phone: "11991234455",
    email: "camila@movimentopleno.com.br",
    scheduled_at: "2026-11-20T14:30:00.000Z",
    duration_minutes: 15,
    status: "scheduled",
    origin: "whatsapp_bot_5511960474566",
    confirmation_channel: "whatsapp_bot_5511960474566",
    booked_by_name: "Dra. Camila Nogueira (Bot +55 11 96047-4566)",
    whatsapp_line: "5511960474566",
  },
];

const mockUpdate = vi.fn();
const mockMeetingInsert = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "platform_auto_leads") {
        return {
          select: vi.fn(() => ({
            is: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: mockLeadsData, error: null }),
            })),
          })),
          update: (...args: unknown[]) => {
            mockUpdate(table, ...args);
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
              in: vi.fn().mockResolvedValue({ error: null }),
            };
          },
        };
      }
      if (table === "platform_onboarding_meetings") {
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: mockMeetingsData, error: null }),
          })),
          insert: (...args: unknown[]) => {
            mockMeetingInsert(...args);
            return {
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "meet-created-1" },
                  error: null,
                }),
              })),
            };
          },
        };
      }
      if (table === "whatsapp_chat_sessions") {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({ data: mockSessionsData, error: null }),
            })),
          })),
        };
      }
      if (table === "affiliates") {
        return {
          select: vi.fn(() => ({
            is: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "aff-1",
                  coupon_code: "MARIANA30",
                  tier: "gold",
                  profile: { full_name: "Dra. Mariana Silva" },
                },
              ],
              error: null,
            }),
          })),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

describe("Auto-Lead Utilities & Phone Reconciliation", () => {
  it("normalizes Brazilian phones with and without 55 prefix identically", () => {
    expect(normalizeBrPhoneKey("+55 (11) 99123-4455")).toBe("11991234455");
    expect(normalizeBrPhoneKey("11991234455")).toBe("11991234455");
  });

  it("builds 1-click WhatsApp link prefilled with icebreaker", () => {
    const url = buildLeadWhatsAppUrl(mockLeadsData[0]);
    expect(url).toContain("https://wa.me/5511991234455");
    expect(decodeURIComponent(url)).toContain("Fisioterapia Brasil sobre prontuário");
  });
});

describe("PlatformMarketingPage & Clean Auto-Lead Contacts Table", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({
      data: { inserted_count: 1, updated_count: 0, total_processed: 1 },
      error: null,
    });
  });

  it("renders Afiliados subtab by default and switches to Auto-Lead contacts table", async () => {
    render(<PlatformMarketingPage />);

    expect(screen.getByTestId("marketing-subtab-affiliates")).toBeInTheDocument();
    expect(screen.getByTestId("marketing-subtab-auto-lead")).toBeInTheDocument();
    expect(screen.getByTestId("mock-platform-affiliates-page")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("marketing-subtab-auto-lead"));

    await waitFor(() => {
      expect(screen.getByTestId("platform-auto-leads-view")).toBeInTheDocument();
      expect(screen.getByTestId("auto-leads-contacts-table")).toBeInTheDocument();
      expect(screen.queryByTestId("auto-leads-subagents-panel")).not.toBeInTheDocument();
    });
  });

  it("reconciles leads with Bot (+5511960474566), Commercial, and Backoffice agendas", async () => {
    render(<PlatformMarketingPage initialSubtab="auto-lead" />);

    await waitFor(() => {
      expect(screen.getAllByText("Dra. Camila Nogueira").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Dr. Henrique Bastos").length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/Dra\. Camila Nogueira \(Bot \+55 11 96047-4566\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tentou Agendar \(Bot\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/parou em: waiting_time/i).length).toBeGreaterThan(0);
  });

  it("allows scheduling a meeting for a lead from the table and syncs to agenda", async () => {
    render(<PlatformMarketingPage initialSubtab="auto-lead" />);

    await waitFor(() => {
      expect(screen.getAllByTestId("quick-schedule-lead-btn").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByTestId("quick-schedule-lead-btn")[0]);

    await waitFor(() => {
      expect(screen.getByText(/Agendar Reunião & Sincronizar Agendas/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Confirmar & Sincronizar/i }));

    await waitFor(() => {
      expect(mockMeetingInsert).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  it("opens clean manual add / CSV-JSON import modal", async () => {
    render(<PlatformMarketingPage initialSubtab="auto-lead" />);

    await waitFor(() => {
      expect(screen.getByTestId("add-import-leads-btn")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("add-import-leads-btn"));

    await waitFor(() => {
      expect(screen.getByText(/Adicionar ou Importar Contatos de Leads/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Nome completo/i)).toBeInTheDocument();
    });
  });

  it("renders compact mobile card with stage, location, ICP, channel icons, and pipeline controls in detail sheet", async () => {
    render(<PlatformMarketingPage initialSubtab="auto-lead" />);

    await waitFor(() => {
      expect(screen.getByTestId("mobile-lead-card-lead-1")).toBeInTheDocument();
      expect(screen.getByTestId("mobile-lead-card-lead-2")).toBeInTheDocument();
    });

    const card1 = screen.getByTestId("mobile-lead-card-lead-1");
    expect(card1).toHaveTextContent(/Clínica Movimento Pleno • São Paulo\/SP/i);
    expect(card1).toHaveTextContent(/Reunião Marcada/i);
    expect(card1).toHaveTextContent(/Clínica/i);
    expect(screen.getByLabelText("Abrir WhatsApp de Dra. Camila Nogueira")).toBeInTheDocument();
    expect(screen.getByLabelText("Abrir Instagram de Dra. Camila Nogueira")).toBeInTheDocument();
    expect(screen.getByLabelText("Enviar e-mail para Dra. Camila Nogueira")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mobile-detail-btn-lead-2"));

    await waitFor(() => {
      expect(screen.getByTestId("detail-sheet-stage-select")).toBeInTheDocument();
      expect(screen.getByTestId("detail-sheet-affiliate-select")).toBeInTheDocument();
      expect(screen.getByTestId("detail-sheet-bot-link")).toHaveAttribute(
        "href",
        "https://wa.me/5511960474566"
      );
    });

    // Alterar estágio dentro da ficha de detalhes
    fireEvent.click(screen.getByTestId("detail-sheet-stage-select"));
    const contactedOption = await screen.findByRole("option", { name: "Abordado" });
    fireEvent.click(contactedOption);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith("platform_auto_leads", { stage: "contacted" });
    });

    // Atribuir afiliado dentro da ficha de detalhes
    fireEvent.click(screen.getByTestId("detail-sheet-affiliate-select"));
    const affiliateOption = await screen.findByRole("option", { name: /Dra\. Mariana Silva/i });
    fireEvent.click(affiliateOption);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        "platform_auto_leads",
        expect.objectContaining({ assigned_affiliate_id: "aff-1" })
      );
    });
  });
});
