import React from "react";
import { CheckCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ConfigAccentColor } from "./form-editor-config-data";

export interface ConfigActionBarProps {
  title: string;
  description: string;
  onEnableAll: () => void;
  onDisableAll: () => void;
  enableLabel?: string;
  disableLabel?: string;
  accentColor?: ConfigAccentColor;
}

interface ActionTheme {
  wrapper: string;
  title: string;
  description: string;
  enableBtn: string;
}

const ACTION_THEMES: Record<ConfigAccentColor, ActionTheme> = {
  blue: {
    wrapper: "bg-blue-50/60 border-blue-100",
    title: "text-blue-900",
    description: "text-blue-700",
    enableBtn: "bg-white text-blue-700 hover:bg-blue-100 border-blue-200",
  },
  purple: {
    wrapper: "bg-purple-50/60 border-purple-100",
    title: "text-purple-900",
    description: "text-purple-700",
    enableBtn: "bg-white text-purple-700 hover:bg-purple-100 border-purple-200",
  },
  amber: {
    wrapper: "bg-amber-50/60 border-amber-100",
    title: "text-amber-900",
    description: "text-amber-700",
    enableBtn: "bg-white text-amber-800 hover:bg-amber-100 border-amber-200",
  },
  emerald: {
    wrapper: "bg-emerald-50/60 border-emerald-100",
    title: "text-emerald-900",
    description: "text-emerald-700",
    enableBtn: "bg-white text-emerald-800 hover:bg-emerald-100 border-emerald-200",
  },
};

export const ConfigActionBar: React.FC<ConfigActionBarProps> = ({
  title,
  description,
  onEnableAll,
  onDisableAll,
  enableLabel = "Ativar todos",
  disableLabel = "Desativar todos",
  accentColor = "blue",
}) => {
  const theme = ACTION_THEMES[accentColor];

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border",
        theme.wrapper
      )}
    >
      <div>
        <h4 className={cn("text-xs font-bold", theme.title)}>{title}</h4>
        <p className={cn("text-[11px]", theme.description)}>{description}</p>
      </div>
      <div className="flex items-center gap-2 self-start sm:self-auto">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onEnableAll}
          className={cn("h-7 text-xs", theme.enableBtn)}
        >
          <CheckCheck className="w-3.5 h-3.5 mr-1" />
          {enableLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onDisableAll}
          className="h-7 text-xs bg-white text-neutral-600 hover:bg-neutral-100"
        >
          <XCircle className="w-3.5 h-3.5 mr-1" />
          {disableLabel}
        </Button>
      </div>
    </div>
  );
};
