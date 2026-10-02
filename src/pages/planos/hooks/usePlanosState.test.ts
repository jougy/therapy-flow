import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePlanosState } from "./usePlanosState";
import * as metaPixel from "@/lib/meta-pixel";

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

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  },
}));

describe("usePlanosState - Meta Pixel InitiateCheckout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches trackInitiateCheckout with category 'Solo' for solo plans", async () => {
    const trackSpy = vi.spyOn(metaPixel, "trackInitiateCheckout").mockImplementation(async () => {});

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
        currency: "BRL",
        value: expect.any(Number),
        valueCents: expect.any(Number),
      })
    );
  });

  it("dispatches trackInitiateCheckout with category 'Equipe' for clinic plans", async () => {
    const trackSpy = vi.spyOn(metaPixel, "trackInitiateCheckout").mockImplementation(async () => {});

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
        currency: "BRL",
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
