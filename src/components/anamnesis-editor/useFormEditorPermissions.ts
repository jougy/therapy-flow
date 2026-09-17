import { useCallback, useMemo } from "react";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import {
  DEFAULT_FORM_EDITOR_FLAG_CONFIG,
  type FormEditorFlagConfig,
} from "@/lib/feature-flags-catalog";
import type { AnamnesisField } from "@/lib/anamnesis-forms";

export interface FormEditorPermissions {
  isComponentAllowed: (type: AnamnesisField["type"] | string) => boolean;
  isPropertyAllowed: (prop: keyof FormEditorFlagConfig["properties"]) => boolean;
  isMenuAllowed: (menu: keyof FormEditorFlagConfig["menus"]) => boolean;
  isMenuOptionAllowed: (
    menu: "flow" | "settings" | "design" | "logic",
    option: string
  ) => boolean;
  config: FormEditorFlagConfig;
  isEditorEnabled: boolean;
}

export function useFormEditorPermissions(): FormEditorPermissions {
  const { flags, isFeatureEnabled } = useFeatureFlags();

  const isEditorEnabled = isFeatureEnabled("forms_editor");

  const config = useMemo<FormEditorFlagConfig>(() => {
    const raw = flags["forms_editor"];
    if (!raw || typeof raw !== "object") {
      return DEFAULT_FORM_EDITOR_FLAG_CONFIG;
    }

    const val = raw as Partial<FormEditorFlagConfig>;

    return {
      enabled: val.enabled !== undefined ? Boolean(val.enabled) : true,
      components: {
        ...DEFAULT_FORM_EDITOR_FLAG_CONFIG.components,
        ...(val.components || {}),
      },
      properties: {
        ...DEFAULT_FORM_EDITOR_FLAG_CONFIG.properties,
        ...(val.properties || {}),
      },
      menus: {
        ...DEFAULT_FORM_EDITOR_FLAG_CONFIG.menus,
        ...(val.menus || {}),
      },
      options: {
        ...DEFAULT_FORM_EDITOR_FLAG_CONFIG.options,
        ...(val.options || {}),
      },
    };
  }, [flags]);

  const isComponentAllowed = useCallback(
    (type: AnamnesisField["type"] | string): boolean => {
      if (!isEditorEnabled) return true;
      const allowed = config.components[type as keyof FormEditorFlagConfig["components"]];
      return allowed !== undefined ? allowed : true;
    },
    [isEditorEnabled, config.components]
  );

  const isPropertyAllowed = useCallback(
    (prop: keyof FormEditorFlagConfig["properties"]): boolean => {
      if (!isEditorEnabled) return true;
      const allowed = config.properties[prop];
      return allowed !== undefined ? allowed : true;
    },
    [isEditorEnabled, config.properties]
  );

  const isMenuAllowed = useCallback(
    (menu: keyof FormEditorFlagConfig["menus"]): boolean => {
      if (!isEditorEnabled) return true;
      const allowed = config.menus[menu];
      return allowed !== undefined ? allowed : true;
    },
    [isEditorEnabled, config.menus]
  );

  const isMenuOptionAllowed = useCallback(
    (
      menu: "flow" | "settings" | "design" | "logic",
      option: string
    ): boolean => {
      if (!isEditorEnabled) return true;
      const prefixedKey = option.startsWith(`${menu}_`) ? option : `${menu}_${option}`;
      const optionsObj = config.options as Record<string, boolean | undefined>;
      const allowed = optionsObj[prefixedKey] ?? optionsObj[option];
      return allowed !== undefined ? allowed : true;
    },
    [isEditorEnabled, config.options]
  );

  return {
    isComponentAllowed,
    isPropertyAllowed,
    isMenuAllowed,
    isMenuOptionAllowed,
    config,
    isEditorEnabled,
  };
}
