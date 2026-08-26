import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTutorial } from "@/contexts/TutorialContext";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import type { TutorialPlacement, HelpersFeatureFlagValue } from "./tutorial-registry";

export interface ComponentHelpButtonProps {
  helpId?: string;
  targetSelector?: string;
  title?: string;
  description?: string;
  tip?: string;
  placement?: TutorialPlacement;
  className?: string;
  size?: "xs" | "sm" | "default";
  ariaLabel?: string;
}

export const ComponentHelpButton = ({
  helpId,
  targetSelector,
  title,
  description,
  tip,
  placement = "bottom",
  className = "",
  size = "sm",
  ariaLabel,
}: ComponentHelpButtonProps) => {
  const { showComponentHelp } = useTutorial();
  const { flags, isFeatureEnabled } = useFeatureFlags();

  // Verifica se a feature flag global de helpers está ativa
  const helpersEnabled = isFeatureEnabled("system_helpers");
  if (!helpersEnabled) {
    return null;
  }

  // Verifica se este helper específico foi ocultado nas configurações
  const helpersFlagVal = flags?.["system_helpers"] as HelpersFeatureFlagValue | undefined;
  const helperCustomConfig = helpId && helpersFlagVal?.helpers ? helpersFlagVal.helpers[helpId] : undefined;

  if (helperCustomConfig?.hidden) {
    return null;
  }

  const effectiveTitle = helperCustomConfig?.title || title;
  const effectiveDescription = helperCustomConfig?.description || description;
  const effectiveTip = helperCustomConfig?.tip || tip;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (helpId && !helperCustomConfig?.title && !helperCustomConfig?.description && !helperCustomConfig?.tip) {
      showComponentHelp(helpId);
    } else if (helpId) {
      // Se houver texto customizado para o helpId
      showComponentHelp(helpId);
    } else {
      showComponentHelp({
        targetSelector,
        title: effectiveTitle || "Ajuda do Componente 💡",
        description: effectiveDescription || "",
        tip: effectiveTip,
        placement,
      });
    }
  };

  const sizeClasses = {
    xs: "h-4 w-4 text-[10px]",
    sm: "h-5 w-5 text-xs",
    default: "h-6 w-6 text-sm",
  }[size];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            aria-label={ariaLabel || `Ajuda sobre ${title || "este componente"}`}
            className={`inline-flex items-center justify-center rounded-full border border-border/80 bg-background/80 text-muted-foreground shadow-xs transition-all duration-200 hover:border-primary hover:bg-primary/10 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-95 ${sizeClasses} ${className}`}
          >
            <HelpCircle className="h-3 w-3 stroke-[2.2]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-xs font-normal">
          <p>O que é isto? Clique para ver explicação</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
