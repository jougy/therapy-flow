import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePlanosState } from "./usePlanosState";
import * as analyticsTracker from "@/lib/analytics-tracker";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

const mockAuthValues = {
  user: { id: "user-1" },
  clinic: null as any,
  clinicId: null as string | null,
  refreshAuthState: vi.fn(),
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockAuthValues,
}));

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({
    isFeatureEnabled: () => true,
    isFreeTrialEnabled: true,
  }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const queryMock: any = {};
  queryMock.select = vi.fn().mockReturnValue(queryMock);
  queryMock.eq = vi.fn().mockReturnValue(queryMock);
  queryMock.order = vi.fn().mockReturnValue(queryMock);
  queryMock.limit = vi.fn().mockReturnValue(queryMock);
  queryMock.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

  return {
    supabase: {
      from: () => queryMock,
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    },
  };
});

describe("usePlanosState - Meta Pixel InitiateCheckout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches trackBeginCheckoutEvent with category 'Solo' for solo plans", async () => {
    const trackSpy = vi.spyOn(analyticsTracker, "trackBeginCheckoutEvent").mockImplementation(() => ({ eventId: "evt_123" }));

    const { result } = renderHook(() => usePlanosState());

    // Seleciona o plano mensal para evitar fluxo de trial gratuito
    act(() => {
      result.current.setSelectedCycle("monthly");
    });

    await act(async () => {
      await result.current.handleSelectPlan("prof_medio");
    });

    expect(trackSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        planKey: "prof_medio",
        category: "Solo",
        value: expect.any(Number),
        valueCents: expect.any(Number),
      })
    );
  });

  it("dispatches trackBeginCheckoutEvent with category 'Equipe' for clinic plans", async () => {
    const trackSpy = vi.spyOn(analyticsTracker, "trackBeginCheckoutEvent").mockImplementation(() => ({ eventId: "evt_456" }));

    const { result } = renderHook(() => usePlanosState());

    act(() => {
      result.current.setSelectedCycle("annual");
    });

    await act(async () => {
      await result.current.handleSelectPlan("clinica_medio");
    });

    expect(trackSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        planKey: "clinica_medio",
        category: "Equipe",
        value: expect.any(Number),
        valueCents: expect.any(Number),
      })
    );
  });


  it("redirects directly to Asaas checkout for solo plans without additional forms when solo clinic exists", async () => {
    mockAuthValues.clinic = { id: "clinic-solo-123", name: "Minha Clínica Solo" };
    mockAuthValues.clinicId = "clinic-solo-123";

    const { result } = renderHook(() => usePlanosState());

    act(() => {
      result.current.setSelectedCycle("monthly");
    });

    await act(async () => {
      await result.current.handleSelectPlan("prof_basico");
    });

    expect(mockNavigate).toHaveBeenCalledWith("/pagamento/clinic-solo-123?plan=prof_basico&cycle=monthly");
  });

  it("redirects to /onboarding-clinica?mode=upgrade when existing clinic owner chooses team clinic plan", async () => {
    mockAuthValues.clinic = { id: "clinic-solo-123", name: "Minha Clínica Solo" };
    mockAuthValues.clinicId = "clinic-solo-123";

    const { result } = renderHook(() => usePlanosState());

    act(() => {
      result.current.setSelectedCycle("annual");
    });

    await act(async () => {
      await result.current.handleSelectPlan("clinica_medio");
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining("/onboarding-clinica?mode=upgrade&clinicId=clinic-solo-123&plan=clinica_medio&cycle=annual")
    );
  });
});
