import React from "react";
import type { FormEditorFlagConfig } from "@/lib/feature-flags-catalog";
import { ConfigActionBar } from "./ConfigActionBar";
import { ConfigSwitchCard } from "./ConfigSwitchCard";
import { COMPONENT_CATEGORIES_CONFIG } from "./form-editor-config-data";

export interface ComponentsTabProps {
  components: FormEditorFlagConfig["components"];
  onToggleComponent: (key: keyof FormEditorFlagConfig["components"], checked: boolean) => void;
  onEnableAll: () => void;
  onDisableAll: () => void;
}

export const ComponentsTab: React.FC<ComponentsTabProps> = ({
  components,
  onToggleComponent,
  onEnableAll,
  onDisableAll,
}) => {
  return (
    <div className="space-y-6">
      <ConfigActionBar
        title="Paleta de Componentes"
        description="Defina quais blocos arrastáveis ficam disponíveis para criação de formulários."
        onEnableAll={onEnableAll}
        onDisableAll={onDisableAll}
        enableLabel="Ativar todos"
        disableLabel="Desativar todos"
        accentColor="blue"
      />

      <div className="space-y-5">
        {COMPONENT_CATEGORIES_CONFIG.map((category) => {
          const activeCount = category.items.filter((item) => components[item.key]).length;
          return (
            <div key={category.name} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  {category.name}
                </span>
                <span className="text-[10px] text-neutral-400">
                  {activeCount}/{category.items.length} ativos
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {category.items.map((item) => (
                  <ConfigSwitchCard
                    key={item.key}
                    label={item.label}
                    description={item.desc}
                    icon={item.icon}
                    checked={Boolean(components[item.key])}
                    onCheckedChange={(checked) => onToggleComponent(item.key, checked)}
                    accentColor="blue"
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
