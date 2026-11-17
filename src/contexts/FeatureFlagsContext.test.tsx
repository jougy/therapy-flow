import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "@/test/harness";
import { FeatureFlagsProvider, useFeatureFlags } from "./FeatureFlagsContext";

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({
          data: [
            { key: "normal_flag", value: true },
            { key: "testers_only_flag", value: { enabled: true, visibility: "testers" } },
            { key: "disabled_testers_flag", value: { enabled: false, visibility: "testers" } },
          ],
          error: null,
        }),
      }),
    }),
    rpc: () => Promise.resolve({ data: {}, error: null }),
  },
}));

describe("FeatureFlagsContext - Visibility & Audience Resolution", () => {
  it("resolves testers_only_flag as enabled when in simulation with audienceMode='tester'", async () => {
    mockUseAuth.mockReturnValue({
      clinicId: null,
      platformAccess: { isSimulation: true },
      isPlatformOwner: true,
    });

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <FeatureFlagsProvider>{children}</FeatureFlagsProvider>
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    // Wait for flags to load from query
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.simulationAudienceMode).toBe("tester");
    expect(result.current.isFeatureEnabled("normal_flag")).toBe(true);
    expect(result.current.isFeatureEnabled("testers_only_flag")).toBe(true);
    expect(result.current.isFeatureEnabled("disabled_testers_flag")).toBe(false);
  });

  it("resolves testers_only_flag as false when audienceMode switches to 'common'", async () => {
    mockUseAuth.mockReturnValue({
      clinicId: null,
      platformAccess: { isSimulation: true },
      isPlatformOwner: true,
    });

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <FeatureFlagsProvider>{children}</FeatureFlagsProvider>
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setSimulationAudienceMode("common");
    });

    expect(result.current.simulationAudienceMode).toBe("common");
    expect(result.current.isFeatureEnabled("normal_flag")).toBe(true);
    // Flag restrita a testers fica desativada na visão comum
    expect(result.current.isFeatureEnabled("testers_only_flag")).toBe(false);
  });
});
