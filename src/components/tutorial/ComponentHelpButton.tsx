import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTutorial } from "@/contexts/TutorialContext";
import type { TutorialPlacement } from "./tutorial-registry";

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

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (helpId) {
      showComponentHelp(helpId);
    } else {
      showComponentHelp({
        targetSelector,
        title: title || "Ajuda do Componente 💡",
        description: description || "",
        tip,
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
