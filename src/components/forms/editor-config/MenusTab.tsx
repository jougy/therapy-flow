import React from "react";
import type { FormEditorFlagConfig } from "@/lib/feature-flags-catalog";
import { ConfigActionBar } from "./ConfigActionBar";
import { ConfigSwitchCard } from "./ConfigSwitchCard";
import { EDITOR_MENUS_CONFIG } from "./form-editor-config-data";

export interface MenusTabProps {
  menus: FormEditorFlagConfig["menus"];
  onToggleMenu: (key: keyof FormEditorFlagConfig["menus"], checked: boolean) => void;
  onEnableAll: () => void;
  onDisableAll: () => void;
}

export const MenusTab: React.FC<MenusTabProps> = ({
  menus,
  onToggleMenu,
  onEnableAll,
  onDisableAll,
}) => {
  return (
    <div className="space-y-6">
      <ConfigActionBar
        title="Menus e Painéis do Editor"
        description="Controle a visibilidade da barra de componentes, abas principais e sub-painéis de edição."
        onEnableAll={onEnableAll}
        onDisableAll={onDisableAll}
        enableLabel="Ativar todos os menus"
        disableLabel="Desativar todos os menus"
        accentColor="amber"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {EDITOR_MENUS_CONFIG.map((menu) => (
          <ConfigSwitchCard
            key={menu.key}
            label={menu.label}
            description={menu.desc}
            icon={menu.icon}
            checked={Boolean(menus[menu.key])}
            onCheckedChange={(checked) => onToggleMenu(menu.key, checked)}
            accentColor="amber"
          />
        ))}
      </div>
    </div>
  );
};
