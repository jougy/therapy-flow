import React from "react";
import type { FormEditorFlagConfig } from "@/lib/feature-flags-catalog";
import { ConfigActionBar } from "./ConfigActionBar";
import { ConfigSwitchCard } from "./ConfigSwitchCard";
import { FIELD_PROPERTIES_CONFIG } from "./form-editor-config-data";

export interface PropertiesTabProps {
  properties: FormEditorFlagConfig["properties"];
  onToggleProperty: (key: keyof FormEditorFlagConfig["properties"], checked: boolean) => void;
  onEnableAll: () => void;
  onDisableAll: () => void;
}

export const PropertiesTab: React.FC<PropertiesTabProps> = ({
  properties,
  onToggleProperty,
  onEnableAll,
  onDisableAll,
}) => {
  return (
    <div className="space-y-6">
      <ConfigActionBar
        title="Propriedades dos Campos"
        description="Controle quais metadados e comportamentos clínicos podem ser configurados em cada campo."
        onEnableAll={onEnableAll}
        onDisableAll={onDisableAll}
        enableLabel="Ativar todas"
        disableLabel="Desativar todas"
        accentColor="purple"
      />

      <div className="grid grid-cols-1 gap-3">
        {FIELD_PROPERTIES_CONFIG.map((prop) => (
          <ConfigSwitchCard
            key={prop.key}
            label={prop.label}
            description={prop.desc}
            icon={prop.icon}
            checked={Boolean(properties[prop.key])}
            onCheckedChange={(checked) => onToggleProperty(prop.key, checked)}
            accentColor="purple"
          />
        ))}
      </div>
    </div>
  );
};
