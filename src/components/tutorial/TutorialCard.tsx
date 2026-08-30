import { forwardRef } from "react";
import { useTutorial } from "@/contexts/TutorialContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TutorialVisualPreview } from "./TutorialVisualPreview";
import {
  Sparkles,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Lightbulb,
  MousePointerClick,
  Compass,
  HelpCircle,
  ShieldAlert,
  ArrowRight,
  GripHorizontal,
  RotateCcw,
} from "lucide-react";

export interface TutorialCardProps {
  style?: React.CSSProperties;
  onDragPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  isDragged?: boolean;
  onResetPosition?: () => void;
}

export const TutorialCard = forwardRef<HTMLDivElement, TutorialCardProps>(
  ({ style, onDragPointerDown, isDragged, onResetPosition }, ref) => {
    const {
      activeTutorial,
      activeChapter,
      isSingleHelpMode,
      currentStepIndex,
      currentStep,
      totalSteps,
      nextStep,
      prevStep,
      skipTutorial,
      finishTutorial,
      setIsChapterModalOpen,
      executeLearnMoreAction,
    } = useTutorial();

    if (!activeTutorial || !currentStep) return null;

    const isLastStep = currentStepIndex === totalSteps - 1;
    const progressPercent = Math.round(((currentStepIndex + 1) / totalSteps) * 100);

    return (
      <div
        ref={ref}
        style={style}
        className="z-[99999] w-[min(420px,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-primary/30 bg-background/95 p-4 sm:p-5 shadow-2xl backdrop-blur-md transition-shadow duration-200 select-none animate-in fade-in zoom-in-95"
      >
        {/* Drag Handle Bar */}
        <div
          onPointerDown={onDragPointerDown}
          className="group/drag -mx-4 -mt-4 mb-2 flex cursor-grab items-center justify-center rounded-t-2xl bg-muted/40 py-1.5 transition-colors hover:bg-muted/70 active:cursor-grabbing sm:-mx-5 sm:-mt-5 select-none touch-none"
          title="Clique e arraste para mover este card livremente pela tela"
          aria-label="Arrastar janela de explicação"
        >
          <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground/80 group-hover/drag:text-foreground">
            <GripHorizontal className="h-4 w-4 text-muted-foreground transition-transform group-hover/drag:scale-110" />
            <span className="text-[10px] tracking-wide uppercase font-semibold">Mover livremente</span>
          </div>
        </div>

        {/* Header with Chapter/Block and Step badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="default"
              className="bg-primary/20 text-primary border-primary/30 text-[10px] font-bold uppercase tracking-wider gap-1"
            >
              {isSingleHelpMode ? (
                totalSteps > 1 ? (
                  <>
                    <Sparkles className="h-3 w-3 text-primary" />
                    Guia do Bloco (?)
                  </>
                ) : (
                  <>
                    <HelpCircle className="h-3 w-3 text-primary" />
                    Ajuda Rápida (?)
                  </>
                )
              ) : (
                <>
                  <Sparkles className="h-3 w-3" />
                  {activeChapter
                    ? `${activeChapter.badge} · ${activeChapter.shortTitle}`
                    : activeTutorial.badge || "Tutorial"}
                </>
              )}
            </Badge>
            {totalSteps > 1 && (
              <span className="text-[11px] font-semibold text-muted-foreground">
                {isSingleHelpMode ? `Componente ${currentStepIndex + 1} de ${totalSteps}` : `Passo ${currentStepIndex + 1} de ${totalSteps}`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {isDragged && onResetPosition && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onResetPosition}
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                title="Restaurar posição original"
                aria-label="Restaurar posição original"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
            {!isSingleHelpMode && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsChapterModalOpen(true)}
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                title="Abrir Menu de Capítulos"
                aria-label="Abrir Menu de Capítulos"
              >
                <Compass className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={skipTutorial}
              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
              title="Fechar"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

      {/* Title and Description */}
      <div className="mt-2.5 space-y-1.5">
        <h4 className="text-base font-bold text-foreground tracking-tight leading-snug">
          {currentStep.title.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1")}
        </h4>
        <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
          {currentStep.description.split("\n").map((line, idx) => {
            const clean = line
              .replace(/\*\*([^*]+)\*\*/g, "$1")
              .replace(/\*([^*]+)\*/g, "$1")
              .replace(/`([^`]+)`/g, "$1")
              .trim();
            if (!clean) return null;
            if (clean.startsWith("•") || clean.startsWith("-")) {
              return (
                <div key={idx} className="pl-2 text-muted-foreground/90 font-normal leading-relaxed">
                  {clean}
                </div>
              );
            }
            return (
              <p key={idx} className="leading-relaxed">
                {clean}
              </p>
            );
          })}
        </div>
      </div>

      {/* Rich Visual Previews (Badges, Clocks, Recurrence Pills, Keyboard Shortcuts) */}
      {currentStep.visualPreview && (
        <TutorialVisualPreview preview={currentStep.visualPreview} />
      )}

      {/* Interactive Action Prompt Box */}
      {currentStep.actionPrompt && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 animate-pulse">
          <MousePointerClick className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>👉 {currentStep.actionPrompt.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1")}</span>
        </div>
      )}

      {/* Helpful Tip */}
      {currentStep.tip && (
        <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
          <Lightbulb className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-tight">
            {currentStep.tip.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1")}
          </p>
        </div>
      )}

      {/* Cross-Learning Deep Link Action ("Quer saber como...?") */}
      {currentStep.learnMoreAction && (
        <div className="mt-3 rounded-xl border border-primary/25 bg-primary/5 p-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sparkles className="h-4 w-4 text-primary shrink-0 animate-pulse" />
            <span className="text-[11px] font-semibold text-foreground truncate">
              {currentStep.learnMoreAction.label}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => executeLearnMoreAction(currentStep.learnMoreAction!)}
            className="h-7 shrink-0 text-[11px] font-bold text-primary border-primary/30 hover:bg-primary/10 gap-1"
          >
            <span>Aprender</span>
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Demo Patient Safe Notice */}
      {currentStep.isDemoNotice && (
        <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 p-2.5 text-xs text-sky-950 dark:text-sky-200">
          <ShieldAlert className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <p className="leading-tight text-[11px]">
            <strong>Ambiente Seguro:</strong> Este é um paciente hipotético de demonstração. Ao concluir o tutorial, ele será excluído automaticamente para não poluir sua clínica real.
          </p>
        </div>
      )}

      {/* Progress Bar (if more than 1 step) */}
      {totalSteps > 1 && (
        <div className="mt-3.5 space-y-1">
          <Progress value={progressPercent} className="h-1.5 rounded-full" />
        </div>
      )}

      {/* Action Footer */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/40 pt-3">
        {isSingleHelpMode && totalSteps === 1 ? (
          <Button
            size="sm"
            onClick={finishTutorial}
            className="w-full h-8 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm gap-1.5"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Entendi, fechar explicação
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={prevStep}
              disabled={currentStepIndex === 0}
              className="h-8 px-2.5 text-xs text-muted-foreground gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Anterior
            </Button>

            <div className="flex items-center gap-2">
              {isLastStep ? (
                <Button
                  size="sm"
                  onClick={finishTutorial}
                  className="h-8 px-3.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {isSingleHelpMode ? "Concluir Guia do Bloco" : "Concluir Capítulo"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={nextStep}
                  className="h-8 px-3.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 gap-1 shadow-sm"
                >
                  Próximo Componente
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
});

TutorialCard.displayName = "TutorialCard";
