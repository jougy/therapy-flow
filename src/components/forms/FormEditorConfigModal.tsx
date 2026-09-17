import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileCode2,
  Layers3,
  Settings2,
  SlidersHorizontal,
  Workflow,
} from "lucide-react";
import {
  DEFAULT_FORM_EDITOR_FLAG_CONFIG,
  type FormEditorFlagConfig,
} from "@/lib/feature-flags-catalog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  type FormEditorTabKey,
  TOTAL_FORM_COMPONENTS,
  TOTAL_FIELD_PROPERTIES,
  TOTAL_EDITOR_MENUS,
  TOTAL_MENU_OPTIONS,
  ComponentsTab,
  PropertiesTab,
  MenusTab,
  OptionsTab,
} from "./editor-config";

export interface FormEditorConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Record<string, unknown>;
  onSave?: (payload: Record<string, unknown>) => void;
  scope?: "global" | "tag" | "clinic";
  tagId?: string;
  clinicId?: string;
}

interface NavTabItem {
  key: FormEditorTabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  activeCount: number;
  totalCount: number;
}

export const FormEditorConfigModal: React.FC<FormEditorConfigModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSave,
  scope = "global",
  tagId,
  clinicId,
}) => {
  const [activeTab, setActiveTab] = useState<FormEditorTabKey>("components");
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState<FormEditorFlagConfig>(DEFAULT_FORM_EDITOR_FLAG_CONFIG);

  useEffect(() => {
    if (isOpen) {
      const data = (initialData as Partial<FormEditorFlagConfig>) || {};
      setConfig({
        enabled: data.enabled !== undefined ? Boolean(data.enabled) : true,
        components: {
          ...DEFAULT_FORM_EDITOR_FLAG_CONFIG.components,
          ...(data.components || {}),
        },
        properties: {
          ...DEFAULT_FORM_EDITOR_FLAG_CONFIG.properties,
          ...(data.properties || {}),
        },
        menus: {
          ...DEFAULT_FORM_EDITOR_FLAG_CONFIG.menus,
          ...(data.menus || {}),
        },
        options: {
          ...DEFAULT_FORM_EDITOR_FLAG_CONFIG.options,
          ...(data.options || {}),
        },
      });
      setActiveTab("components");
    }
  }, [isOpen, initialData]);

  // Counts for each tab
  const activeComponentsCount = useMemo(
    () => Object.values(config.components).filter(Boolean).length,
    [config.components]
  );
  const activePropertiesCount = useMemo(
    () => Object.values(config.properties).filter(Boolean).length,
    [config.properties]
  );
  const activeMenusCount = useMemo(
    () => Object.values(config.menus).filter(Boolean).length,
    [config.menus]
  );
  const activeOptionsCount = useMemo(
    () => Object.values(config.options).filter(Boolean).length,
    [config.options]
  );

  const tabs: NavTabItem[] = [
    {
      key: "components",
      label: "Componentes",
      icon: Layers3,
      activeCount: activeComponentsCount,
      totalCount: TOTAL_FORM_COMPONENTS,
    },
    {
      key: "properties",
      label: "Propriedades",
      icon: Settings2,
      activeCount: activePropertiesCount,
      totalCount: TOTAL_FIELD_PROPERTIES,
    },
    {
      key: "menus",
      label: "Menus",
      icon: SlidersHorizontal,
      activeCount: activeMenusCount,
      totalCount: TOTAL_EDITOR_MENUS,
    },
    {
      key: "options",
      label: "Opções por Menu",
      icon: Workflow,
      activeCount: activeOptionsCount,
      totalCount: TOTAL_MENU_OPTIONS,
    },
  ];

  // Bulk toggle actions
  const setAllComponents = (enabled: boolean) => {
    setConfig((prev) => {
      const next = { ...prev.components };
      (Object.keys(next) as (keyof typeof next)[]).forEach((key) => {
        next[key] = enabled;
      });
      return { ...prev, components: next };
    });
    toast({
      title: enabled ? "Todos os componentes ativados" : "Todos os componentes desativados",
      description: `Total de ${TOTAL_FORM_COMPONENTS} componentes atualizados.`,
    });
  };

  const setAllProperties = (enabled: boolean) => {
    setConfig((prev) => {
      const next = { ...prev.properties };
      (Object.keys(next) as (keyof typeof next)[]).forEach((key) => {
        next[key] = enabled;
      });
      return { ...prev, properties: next };
    });
    toast({
      title: enabled ? "Todas as propriedades ativadas" : "Todas as propriedades desativadas",
      description: "Propriedades dos campos atualizadas.",
    });
  };

  const setAllMenus = (enabled: boolean) => {
    setConfig((prev) => {
      const next = { ...prev.menus };
      (Object.keys(next) as (keyof typeof next)[]).forEach((key) => {
        next[key] = enabled;
      });
      return { ...prev, menus: next };
    });
    toast({
      title: enabled ? "Todos os menus ativados" : "Todos os menus desativados",
      description: "Menus e abas do editor atualizados.",
    });
  };

  const setAllOptions = (enabled: boolean) => {
    setConfig((prev) => {
      const next = { ...prev.options };
      (Object.keys(next) as (keyof typeof next)[]).forEach((key) => {
        next[key] = enabled;
      });
      return { ...prev, options: next };
    });
    toast({
      title: enabled ? "Todas as opções ativadas" : "Todas as opções desativadas",
      description: "Opções por menu atualizadas.",
    });
  };

  // Toggle individual items
  const handleToggleComponent = (
    key: keyof FormEditorFlagConfig["components"],
    checked: boolean
  ) => {
    setConfig((prev) => ({
      ...prev,
      components: { ...prev.components, [key]: checked },
    }));
  };

  const handleToggleProperty = (
    key: keyof FormEditorFlagConfig["properties"],
    checked: boolean
  ) => {
    setConfig((prev) => ({
      ...prev,
      properties: { ...prev.properties, [key]: checked },
    }));
  };

  const handleToggleMenu = (
    key: keyof FormEditorFlagConfig["menus"],
    checked: boolean
  ) => {
    setConfig((prev) => ({
      ...prev,
      menus: { ...prev.menus, [key]: checked },
    }));
  };

  const handleToggleOption = (
    key: keyof FormEditorFlagConfig["options"],
    checked: boolean
  ) => {
    setConfig((prev) => ({
      ...prev,
      options: { ...prev.options, [key]: checked },
    }));
  };

  // Strict payload sanitizer to eliminate prototype pollution and spurious parameters
  const sanitizePayload = (raw: FormEditorFlagConfig): FormEditorFlagConfig => {
    const sanitizeMap = <T extends Record<string, boolean>>(
      input: Record<string, unknown>,
      template: T
    ): T => {
      const sanitized = { ...template };
      for (const key of Object.keys(template) as (keyof T)[]) {
        if (typeof key === "string" && Object.prototype.hasOwnProperty.call(input, key)) {
          sanitized[key] = Boolean(input[key]) as unknown as T[keyof T];
        }
      }
      return sanitized;
    };

    return {
      enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : true,
      components: sanitizeMap(raw.components, DEFAULT_FORM_EDITOR_FLAG_CONFIG.components),
      properties: sanitizeMap(raw.properties, DEFAULT_FORM_EDITOR_FLAG_CONFIG.properties),
      menus: sanitizeMap(raw.menus, DEFAULT_FORM_EDITOR_FLAG_CONFIG.menus),
      options: sanitizeMap(raw.options, DEFAULT_FORM_EDITOR_FLAG_CONFIG.options),
    };
  };

  // Save handler with security validation
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Validate scope integrity
      const validScope = scope === "tag" ? "tag" : scope === "clinic" ? "clinic" : "global";
      const cleanTagId = validScope === "tag" && tagId ? String(tagId).trim() : undefined;
      const cleanClinicId = validScope === "clinic" && clinicId ? String(clinicId).trim() : undefined;

      if (validScope === "tag" && !cleanTagId) {
        throw new Error("Tag ID é obrigatório para o escopo por tag.");
      }
      if (validScope === "clinic" && !cleanClinicId) {
        throw new Error("ID da Clínica é obrigatório para o escopo por clínica.");
      }

      let matchQuery = supabase
        .from("feature_flags")
        .select("value")
        .eq("key", "forms_editor")
        .eq("scope", validScope);

      if (validScope === "tag" && cleanTagId) matchQuery = matchQuery.eq("tag_id", cleanTagId);
      if (validScope === "clinic" && cleanClinicId) matchQuery = matchQuery.eq("clinic_id", cleanClinicId);
      if (validScope === "global") matchQuery = matchQuery.is("tag_id", null).is("clinic_id", null);

      const { data: existingData } = await matchQuery.maybeSingle();

      const currentVal = (existingData?.value as Record<string, unknown>) || {};
      const mergedPayload: FormEditorFlagConfig = sanitizePayload({
        ...currentVal,
        enabled: currentVal.enabled !== undefined ? Boolean(currentVal.enabled) : true,
        components: config.components,
        properties: config.properties,
        menus: config.menus,
        options: config.options,
      });

      const { error: upsertError } = await supabase.rpc("upsert_feature_flag", {
        _key: "forms_editor",
        _scope: validScope,
        _clinic_id: validScope === "clinic" ? cleanClinicId : undefined,
        _tag_id: validScope === "tag" ? cleanTagId : undefined,
        _value: mergedPayload,
        _description: "Editor de Formulários",
      });

      if (upsertError) throw upsertError;

      toast({
        title: "Configurações do Editor salvas",
        description: "As permissões e componentes do editor de formulários foram atualizados com sucesso.",
      });

      if (onSave) onSave(mergedPayload as unknown as Record<string, unknown>);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido ao salvar configurações";
      toast({
        title: "Erro ao salvar",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const scopeBadgeLabel = scope === "global" ? "Global" : scope === "tag" ? "Tag de Clínica" : "Clínica Específica";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[880px] w-[95vw] p-0 overflow-hidden flex flex-col max-h-[90dvh] rounded-2xl border-neutral-200/80 shadow-2xl">
        {/* Cabeçalho */}
        <DialogHeader className="px-5 py-4 border-b border-neutral-100 bg-neutral-50/80 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-xs shrink-0">
                <FileCode2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-base sm:text-lg font-bold text-neutral-900 leading-tight">
                    Editor de Formulários
                  </DialogTitle>
                  <Badge variant="outline" className="text-[11px] font-medium bg-white">
                    {scopeBadgeLabel}
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-neutral-500 line-clamp-1 mt-0.5">
                  Personalize a visibilidade de componentes, propriedades, menus e ferramentas do construtor.
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Seletor de Abas Mobile Friendly */}
          <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar border-t border-neutral-200/60 pt-3">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                    isActive
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200/80"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                      isActive ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-600"
                    )}
                  >
                    {tab.activeCount}/{tab.totalCount}
                  </span>
                </button>
              );
            })}
          </div>
        </DialogHeader>

        {/* Conteúdo com rolagem vertical suave para mobile */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          {activeTab === "components" && (
            <ComponentsTab
              components={config.components}
              onToggleComponent={handleToggleComponent}
              onEnableAll={() => setAllComponents(true)}
              onDisableAll={() => setAllComponents(false)}
            />
          )}

          {activeTab === "properties" && (
            <PropertiesTab
              properties={config.properties}
              onToggleProperty={handleToggleProperty}
              onEnableAll={() => setAllProperties(true)}
              onDisableAll={() => setAllProperties(false)}
            />
          )}

          {activeTab === "menus" && (
            <MenusTab
              menus={config.menus}
              onToggleMenu={handleToggleMenu}
              onEnableAll={() => setAllMenus(true)}
              onDisableAll={() => setAllMenus(false)}
            />
          )}

          {activeTab === "options" && (
            <OptionsTab
              options={config.options}
              onToggleOption={handleToggleOption}
              onEnableAll={() => setAllOptions(true)}
              onDisableAll={() => setAllOptions(false)}
            />
          )}
        </div>

        {/* Rodapé fixo */}
        <DialogFooter className="px-5 py-3.5 border-t border-neutral-100 bg-neutral-50/80 shrink-0 flex items-center justify-between gap-3">
          <div className="text-xs text-neutral-500 hidden sm:block">
            Configurações salvas no escopo {scope === "global" ? "Global" : scope === "tag" ? "Tag" : "Clínica"}.
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <DialogClose asChild>
              <Button variant="outline" onClick={onClose} disabled={isSaving}>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
            >
              {isSaving ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
