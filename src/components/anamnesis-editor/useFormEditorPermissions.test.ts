import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFormEditorPermissions } from "./useFormEditorPermissions";
import { DEFAULT_FORM_EDITOR_FLAG_CONFIG } from "@/lib/feature-flags-catalog";

const mockUseFeatureFlags = vi.fn();

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlags: () => mockUseFeatureFlags(),
}));

describe("useFormEditorPermissions", () => {
  it("returns default allowed permissions when flag is not set", () => {
    mockUseFeatureFlags.mockReturnValue({
      flags: {},
      isFeatureEnabled: () => true,
    });

    const { result } = renderHook(() => useFormEditorPermissions());

    expect(result.current.isComponentAllowed("short_text")).toBe(true);
    expect(result.current.isComponentAllowed("table")).toBe(true);
    expect(result.current.isPropertyAllowed("required")).toBe(true);
    expect(result.current.isMenuAllowed("palette_sidebar")).toBe(true);
    expect(result.current.isMenuOptionAllowed("flow", "reorder")).toBe(true);
    expect(result.current.config).toEqual(DEFAULT_FORM_EDITOR_FLAG_CONFIG);
  });

  it("respects customized disallow settings", () => {
    mockUseFeatureFlags.mockReturnValue({
      flags: {
        forms_editor: {
          enabled: true,
          components: {
            table: false,
          },
          properties: {
            enableFilter: false,
          },
          menus: {
            palette_sidebar: false,
          },
          options: {
            flow_reorder: false,
            settings_field_type: false,
          },
        },
      },
      isFeatureEnabled: () => true,
    });

    const { result } = renderHook(() => useFormEditorPermissions());

    expect(result.current.isComponentAllowed("table")).toBe(false);
    expect(result.current.isComponentAllowed("short_text")).toBe(true);
    expect(result.current.isPropertyAllowed("enableFilter")).toBe(false);
    expect(result.current.isPropertyAllowed("required")).toBe(true);
    expect(result.current.isMenuAllowed("palette_sidebar")).toBe(false);
    expect(result.current.isMenuAllowed("flow")).toBe(true);
    expect(result.current.isMenuOptionAllowed("flow", "reorder")).toBe(false);
    expect(result.current.isMenuOptionAllowed("flow", "flow_reorder")).toBe(false);
    expect(result.current.isMenuOptionAllowed("flow", "duplicate")).toBe(true);
    expect(result.current.isMenuOptionAllowed("settings", "field_type")).toBe(false);
  });
});
