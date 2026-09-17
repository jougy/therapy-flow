import React from "react";
import type { FormEditorFlagConfig } from "@/lib/feature-flags-catalog";
import { ConfigActionBar } from "./ConfigActionBar";
import { ConfigSwitchCard } from "./ConfigSwitchCard";
import { MENU_OPTIONS_GROUPS_CONFIG } from "./form-editor-config-data";

export interface OptionsTabProps {
  options: FormEditorFlagConfig["options"];
  onToggleOption: (key: keyof FormEditorFlagConfig["options"], checked: boolean) => void;
  onEnableAll: () => void;
  onDisableAll: () => void;
}

export const OptionsTab: React.FC<OptionsTabProps> = ({
  options,
  onToggleOption,
  onEnableAll,
  onDisableAll,
}) => {
  return (
    <div className="space-y-6">
      <ConfigActionBar
        title="Opções e Ações por Menu"
        description="Habilite ou restrinja botões de ação e campos específicos dentro de cada painel."
        onEnableAll={onEnableAll}
        onDisableAll={onDisableAll}
        enableLabel="Ativar todas as opções"
        disableLabel="Desativar todas"
        accentColor="emerald"
      />

      <div className="space-y-5">
        {MENU_OPTIONS_GROUPS_CONFIG.map((group) => {
          const GroupIcon = group.icon;
          const activeCount = group.items.filter((item) => options[item.key]).length;

          return (
            <div key={group.groupName} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  <GroupIcon className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{group.groupName}</span>
                </div>
                <span className="text-[10px] text-neutral-400">
                  {activeCount}/{group.items.length} ativas
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {group.items.map((item) => (
                  <ConfigSwitchCard
                    key={item.key}
                    label={item.label}
                    description={item.desc}
                    icon={item.icon}
                    checked={Boolean(options[item.key])}
                    onCheckedChange={(checked) => onToggleOption(item.key, checked)}
                    accentColor="emerald"
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
