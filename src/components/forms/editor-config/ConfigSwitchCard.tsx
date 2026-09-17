import React, { type ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { ConfigAccentColor } from "./form-editor-config-data";

export interface ConfigSwitchCardProps {
  label: string;
  description: string;
  icon: ComponentType<LucideProps>;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  accentColor?: ConfigAccentColor;
  className?: string;
}

const ACCENT_COLOR_CLASSES: Record<ConfigAccentColor, string> = {
  blue: "bg-blue-100 text-blue-600",
  purple: "bg-purple-100 text-purple-600",
  amber: "bg-amber-100 text-amber-700",
  emerald: "bg-emerald-100 text-emerald-700",
};

export const ConfigSwitchCard: React.FC<ConfigSwitchCardProps> = ({
  label,
  description,
  icon: Icon,
  checked,
  onCheckedChange,
  accentColor = "blue",
  className,
}) => {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-xl border transition-all",
        checked
          ? "bg-white border-neutral-200/90 shadow-2xs"
          : "bg-neutral-50/70 border-neutral-200/50 opacity-70",
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0 pr-2">
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
            checked ? ACCENT_COLOR_CLASSES[accentColor] : "bg-neutral-200 text-neutral-500"
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-neutral-900 truncate leading-tight">
            {label}
          </p>
          <p className="text-[11px] text-neutral-500 truncate leading-snug">
            {description}
          </p>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </div>
  );
};
