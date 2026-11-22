import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformMarketingPage } from "../PlatformMarketingPage";
import {
  FALLBACK_DEFAULT_AGENTS,
  FALLBACK_PRIMARY_INSTANCE,
  type MarketingZapConversation,
} from "../marketing-agents/types";

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
    isPlatformMarketing: false,
  }),
}));

vi.mock("../PlatformAffiliatesPage", () => ({
  PlatformAffiliatesPage: () => <div data-testid="mock-platform-affiliates-page">Afiliados Mock</div>,
}));

vi.mock("../auto-leads", () => ({
  PlatformAutoLeadsView: () => <div data-testid="mock-platform-auto-leads-view">Auto-Lead Mock</div>,
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

const mockConversations: MarketingZapConversation[] = [
  {
    id: "conv-1",
    tenant_scope: "platform",
    phone_e164: "5511991234455",
    contact_name: "Dra. Camila Nogueira",
    clinic_or_origin: "Clínica Movimento Pleno",
    agent_mode: "ai",
    funnel_stage: "qualified",
    intent_classification: "pricing",
    last_message_preview: "Gostaria de saber os planos para minha clínica com 4 fisios.",
    last_message_direction: "inbound",
    unread_count: 1,
    ai_turns_count: 2,
    updated_at: "2026-11-21T20:00:00.000Z",
  },
];

const mockInvoke = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    from: vi.fn((table: string) => {
      if (table === "marketing_whatsapp_instances") {
        return {
          select: () => ({
            is: () => ({
              order: async () => ({ data: [FALLBACK_PRIMARY_INSTANCE], error: null }),
            }),
          }),
          update: (payload: unknown) => {
            mockUpdate(table, payload);
            return { eq: async () => ({ error: null }) };
          },
          insert: (payload: unknown) => {
            mockInsert(table, payload);
            return {
              select: () => ({
                single: async () => ({
                  data: { ...FALLBACK_PRIMARY_INSTANCE, id: "inst-extra", ...(payload as object) },
                  error: null,
                }),
              }),
            };
          },
        };
      }

      if (table === "marketing_ai_agents") {
        return {
          select: () => ({
            is: () => ({
              order: async () => ({ data: FALLBACK_DEFAULT_AGENTS, error: null }),
            }),
          }),
          update: (payload: unknown) => {
            mockUpdate(table, payload);
            return {
              eq: () => ({
                select: () => ({
                  single: async () => ({
                    data: { ...FALLBACK_DEFAULT_AGENTS[0], ...(payload as object) },
                    error: null,
                  }),
                }),
              }),
            };
          },
          insert: (payload: unknown) => {
            mockInsert(table, payload);
            return {
              select: () => ({
                single: async () => ({
                  data: { ...FALLBACK_DEFAULT_AGENTS[0], id: "agent-new-1", ...(payload as object) },
                  error: null,
                }),
              }),
            };
          },
        };
      }

      if (table === "marketing_zap_campaigns") {
        return {
          select: () => ({
            is: () => ({
              order: async () => ({ data: [], error: null }),
            }),
          }),
          insert: (payload: unknown) => {
            mockInsert(table, payload);
            return {
              select: () => ({
                single: async () => ({
                  data: { id: "camp-1", ...(payload as object) },
                  error: null,
                }),
              }),
            };
          },
        };
      }

      if (table === "marketing_zap_conversations") {
        return {
          select: () => ({
            is: () => ({
              order: () => ({
                limit: async () => ({ data: mockConversations, error: null }),
              }),
            }),
          }),
          update: (payload: unknown) => {
            mockUpdate(table, payload);
            return { eq: async () => ({ error: null }) };
          },
        };
      }

      if (table === "marketing_opt_outs") {
        return {
          select: () => ({
            order: () => ({
              limit: async () => ({ data: [], error: null }),
            }),
          }),
          insert: (payload: unknown) => {
            mockInsert(table, payload);
            return {
              select: () => ({
                single: async () => ({
                  data: { id: "opt-1", created_at: new Date().toISOString(), ...(payload as object) },
                  error: null,
                }),
              }),
            };
          },
        };
      }

      if (table === "platform_auto_leads") {
        return {
          select: () => ({
            is: () => ({
              not: async () => ({ count: 24, error: null }),
            }),
          }),
        };
      }

      return {
        select: () => ({
          is: () => ({
            order: async () => ({ data: [], error: null }),
          }),
        }),
      };
    }),
  },
}));

describe("PlatformMarketingPage — Painel Agentes (Ninja Zap Style)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation(async (fnPath: string) => {
      if (fnPath.includes("simulate_agent_reply")) {
        return {
          data: {
            reply: "Entendido! Removemos seu contato da nossa lista de comunicações (LGPD).",
            intent: "opt_out",
            isOptOut: true,
            triggeredHandoff: false,
            typingMs: 2800,
            modelUsed: "gemini-decision-1",
          },
          error: null,
        };
      }
      return { data: { success: true, configured: false }, error: null };
    });
  });

  it("exibe aba Agentes, chip (11) 96512-0431 e os 2 agentes iniciais", async () => {
    render(<PlatformMarketingPage />);

    const agentesTab = screen.getByTestId("marketing-subtab-agentes");
    expect(agentesTab).toBeInTheDocument();
    fireEvent.click(agentesTab);

    await waitFor(() => {
      expect(screen.getByTestId("platform-marketing-agents-view")).toBeInTheDocument();
      expect(screen.getAllByText(/\(11\) 96512-0431/).length).toBeGreaterThan(0);
      expect(screen.getByTestId("agent-card-sdr-pluri-fisio")).toBeInTheDocument();
      expect(screen.getByTestId("agent-card-triagem-reativacao-lite")).toBeInTheDocument();
    });
  });

  it("executa simulação no Playground incluindo detecção de Opt-Out PARAR e abre criação de novo agente", async () => {
    render(<PlatformMarketingPage initialSubtab="agentes" />);

    await waitFor(() => {
      expect(screen.getByTestId("agent-playground-input")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("agent-playground-input"), {
      target: { value: "PARAR" },
    });
    fireEvent.click(screen.getByTestId("agent-playground-send"));

    await waitFor(() => {
      const playground = screen.getByTestId("agent-playground-messages");
      expect(within(playground).getByText(/Opt-Out LGPD/i)).toBeInTheDocument();
      expect(within(playground).getByText(/Removemos seu contato/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("agents-create-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("agent-editor-sheet")).toBeInTheDocument();
    });
  });

  it("navega pelas 5 sub-visões internas (Conexões QR, Disparos, Aquecimento e CRM com Assumir Humano)", async () => {
    render(<PlatformMarketingPage initialSubtab="agentes" />);

    await waitFor(() => {
      expect(screen.getByTestId("agents-inner-tab-connections")).toBeInTheDocument();
    });

    // Conexões & QR
    fireEvent.click(screen.getByTestId("agents-inner-tab-connections"));
    await waitFor(() => {
      expect(screen.getByTestId("instance-card-pluri-mkt-5511965120431")).toBeInTheDocument();
      expect(screen.getByTestId("connect-qr-btn-pluri-mkt-5511965120431")).toBeInTheDocument();
    });

    // Disparos
    fireEvent.click(screen.getByTestId("agents-inner-tab-campaigns"));
    await waitFor(() => {
      expect(screen.getByTestId("enqueue-campaign-btn")).toBeInTheDocument();
    });

    // Aquecimento & Anti-Ban
    fireEvent.click(screen.getByTestId("agents-inner-tab-warmup"));
    await waitFor(() => {
      expect(screen.getByText(/Lista de Opt-Out LGPD/i)).toBeInTheDocument();
    });

    // CRM & Inbox + Assumir Humano
    fireEvent.click(screen.getByTestId("agents-inner-tab-crm"));
    await waitFor(() => {
      expect(screen.getByTestId("crm-conversation-card-conv-1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("toggle-human-btn-conv-1"));
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith("marketing_zap_conversations", { agent_mode: "human" });
    });

    // Filtro Turbo & Grupos (6ª sub-aba)
    fireEvent.click(screen.getByTestId("agents-inner-tab-filter-groups"));
    await waitFor(() => {
      expect(screen.getByText(/Turbo Filter — Validador de WhatsApp em Massa/i)).toBeInTheDocument();
      expect(screen.getByText(/WaGroup & GroupMaster/i)).toBeInTheDocument();
    });
  });

  it("abre o Harness LLM Local-First (Ollama, OpenCode Free e Compactação de Contexto)", async () => {
    render(<PlatformMarketingPage initialSubtab="agentes" />);

    await waitFor(() => {
      expect(screen.getByTestId("agents-open-harness-btn")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("agents-open-harness-btn"));
    await waitFor(() => {
      expect(screen.getByText(/Harness LLM Local-First \(Este Dispositivo\)/i)).toBeInTheDocument();
      expect(screen.getAllByText(/OpenCode Free/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Compactação Inteligente de Memória/i)).toBeInTheDocument();
    });
  });
});
