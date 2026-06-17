import { cn } from "@/lib/utils";

interface ThemeModeSwitchProps {
  checked: boolean;
  className?: string;
  "aria-label"?: string;
  onCheckedChange: (checked: boolean) => void;
}

const ThemeModeSwitch = ({
  checked,
  className,
  "aria-label": ariaLabel = "Alternar tema noturno",
  onCheckedChange,
}: ThemeModeSwitchProps) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      data-state={checked ? "checked" : "unchecked"}
      className={cn("theme-mode-switch", className)}
      onClick={() => onCheckedChange(!checked)}
    >
      <span className="theme-mode-switch__track" aria-hidden="true">
        <span className="theme-mode-switch__stars" />
        <span className="theme-mode-switch__cloud" />
        <span className="theme-mode-switch__orb" />
      </span>
    </button>
  );
};

export default ThemeModeSwitch;
