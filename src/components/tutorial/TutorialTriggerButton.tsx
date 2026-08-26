import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTutorial } from "@/contexts/TutorialContext";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";

interface TutorialTriggerButtonProps {
  className?: string;
  variant?: "outline" | "default" | "ghost" | "secondary";
  size?: "sm" | "default" | "icon";
  showLabel?: boolean;
}

export const TutorialTriggerButton = ({
  className = "",
  variant = "outline",
  size = "sm",
  showLabel = true,
}: TutorialTriggerButtonProps) => {
  const { setIsChapterModalOpen, isOpen } = useTutorial();
  const { isFeatureEnabled } = useFeatureFlags();

  if (isOpen || !isFeatureEnabled("tutorial_training_center")) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            onClick={() => setIsChapterModalOpen(true)}
            className={`relative group border-primary/40 hover:border-primary text-primary hover:bg-primary/10 transition-all duration-200 shadow-sm rounded-xl ${className}`}
            aria-label="Abrir Central de Tutoriais e Treinamento"
          >
            <Sparkles className="h-4 w-4 text-primary animate-pulse group-hover:rotate-12 transition-transform duration-300" />
            {showLabel && (
              <span className="ml-1.5 font-medium text-xs hidden sm:inline">
                Tutorial & Guia
              </span>
            )}
            {/* Subtle neon ping indicator */}
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p>Abrir Central de Tutoriais Passo a Passo</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
