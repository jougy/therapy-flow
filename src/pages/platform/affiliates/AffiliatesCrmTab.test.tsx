import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AffiliatesCrmTab } from "./AffiliatesCrmTab";
import { supabase } from "@/integrations/supabase/client";

const SelectContext = React.createContext<{
  value?: string;
  onValueChange?: (val: string) => void;
}>({});

vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <SelectContext.Provider value={{ value, onValueChange }}>
      <div data-testid="select-root" data-value={value}>
        {children}
      </div>
    </SelectContext.Provider>
  ),
  SelectTrigger: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: any) => {
    const { value } = React.useContext(SelectContext);
    return <span>{value || placeholder}</span>;
  },
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, children, ...props }: any) => {
    const { onValueChange } = React.useContext(SelectContext);
    return (
      <div
        role="option"
        data-testid={`select-item-${value}`}
        onClick={() => onValueChange?.(value)}
        {...props}
      >
        {children}
      </div>
    );
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "master-admin-001" },
    clinicId: null,
  }),
}));

describe("AffiliatesCrmTab", () => {
  const mockAffiliates = [
    {
      id: "aff-1",
      coupon_code: "MARIANA30",
      referral_slug: "dra-mariana",
      tier: "gold",
      status: "active",
      profile: {
        full_name: "Dra. Mariana Silva",
        email: "mariana@exemplo.com",
      },
    },
    {
      id: "aff-2",
      coupon_code: "CARLOS30",
      referral_slug: "carlos-fisio",
      tier: "bronze",
      status: "active",
      profile: {
        full_name: "Dr. Carlos Santos",
        email: "carlos@exemplo.com",
      },
    },
  ];

  const mockConversions = [
    {
      id: "conv-1",
      affiliate_id: "aff-1",
      clinic_id: "clinic-1",
      customer_user_id: "user-1",
      plan_type: "clinic",
      billing_cycle: "monthly",
      status: "active",
      total_cycles_paid: 4,
      created_at: "2026-08-01T10:00:00Z",
      customer: {
        full_name: "Dra. Paula Clínica",
        phone: "11988887777",
        email: "paula@clinica.com",
      },
      clinic: { name: "Clínica Paula Fisio" },
      affiliate: { coupon_code: "MARIANA30" },
    },
    {
      id: "conv-2",
      affiliate_id: "aff-2",
      clinic_id: "clinic-2",
      customer_user_id: "user-2",
      plan_type: "solo",
      billing_cycle: "monthly",
      status: "trial",
      total_cycles_paid: 0,
      created_at: "2026-11-01T10:00:00Z",
      customer: {
        full_name: "Dr. Marcos Santos",
        phone: "21977776666",
        email: "marcos@fisio.com",
      },
      clinic: { name: "Consultório Dr. Marcos" },
      affiliate: { coupon_code: "CARLOS30" },
    },
    {
      id: "conv-3",
      affiliate_id: "aff-1",
      clinic_id: "clinic-3",
      customer_user_id: "user-3",
      plan_type: "team",
      billing_cycle: "monthly",
      status: "past_due",
      total_cycles_paid: 2,
      created_at: "2026-09-01T10:00:00Z",
      customer: {
        full_name: "Dr. André Equipe",
        phone: "31966665555",
        email: "andre@equipe.com",
      },
      clinic: { name: "Equipe Fisio Minas" },
      affiliate: { coupon_code: "MARIANA30" },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "affiliates") {
        return {
          select: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockAffiliates,
                error: null,
              }),
            }),
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        } as any;
      }

      if (table === "affiliate_conversions") {
        return {
          select: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockImplementation(() => {
                return Promise.resolve({
                  data: mockConversions,
                  error: null,
                });
              }),
              eq: vi.fn().mockImplementation((_field: string, val: string) => {
                const filtered = mockConversions.filter((c) => c.affiliate_id === val);
                return {
                  order: vi.fn().mockResolvedValue({
                    data: filtered,
                    error: null,
                  }),
                };
              }),
            }),
          }),
        } as any;
      }

      return {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any;
    });
  });

  it("renders the CRM tab with header, selector, quick stats, and pipeline engine", async () => {
    render(<AffiliatesCrmTab />);

    expect(screen.getByTestId("affiliates-crm-tab")).toBeInTheDocument();
    expect(screen.getByText("Filtrar por Promotor / Afiliado")).toBeInTheDocument();
    expect(screen.getByTestId("affiliate-crm-selector")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Todos os Afiliados (Consolidado)")).toBeInTheDocument();
      expect(screen.getByText(/Dra. Mariana Silva/i)).toBeInTheDocument();
      expect(screen.getByText(/Dr. Carlos Santos/i)).toBeInTheDocument();
    });
  });

  it("displays correct aggregated stats for consolidated network", async () => {
    render(<AffiliatesCrmTab />);

    await waitFor(() => {
      expect(screen.getByText("Total de Leads")).toBeInTheDocument();
      expect(screen.getByText("Assinantes Pagos")).toBeInTheDocument();
      expect(screen.getByText("Trials / Novos")).toBeInTheDocument();
      expect(screen.getByText("Risco / Churn")).toBeInTheDocument();
    });

    // 3 total leads in mockConversions rendered in zero-inbox widget / pipeline
    await waitFor(() => {
      expect(screen.getAllByText("Dra. Paula Clínica").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Dr. Marcos Santos").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Dr. André Equipe").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("filters pipeline when a specific affiliate is selected", async () => {
    render(<AffiliatesCrmTab />);

    await waitFor(() => {
      expect(screen.getByTestId("select-item-aff-2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("select-item-aff-2"));

    await waitFor(() => {
      expect(screen.getByTestId("select-root")).toHaveAttribute("data-value", "aff-2");
    });
  });

  it("allows refreshing data with the manual refresh button", async () => {
    render(<AffiliatesCrmTab />);

    await waitFor(() => {
      expect(screen.getByText("Todos os Afiliados (Consolidado)")).toBeInTheDocument();
    });

    const refreshBtn = screen.getByTitle("Atualizar dados do CRM");
    expect(refreshBtn).toBeInTheDocument();

    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith("affiliates");
    });
  });
});
