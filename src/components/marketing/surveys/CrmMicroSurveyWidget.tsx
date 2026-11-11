import React, { useState, useEffect, useRef } from "react";
import { X, CheckCircle2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type MicroSurveyTriggerEvent =
  | "clinical_record_saved"
  | "report_generated"
  | "first_affiliate_click";

export type MicroSurveyScore = "fast" | "normal" | "slow";

export interface CrmMicroSurveyWidgetProps {
  triggerEvent: MicroSurveyTriggerEvent;
  onClose: () => void;
  onSubmit?: (data: { score: MicroSurveyScore; comment?: string }) => void;
  autoDismissDelayMs?: number;
  className?: string;
}

const EVENT_QUESTIONS: Record<MicroSurveyTriggerEvent, string> = {
  clinical_record_saved: "O preenchimento do prontuário foi rápido o suficiente?",
  report_generated: "A geração do relatório foi rápida o suficiente?",
  first_affiliate_click: "A navegação pelo link de afiliado foi rápida o suficiente?",
};

interface RatingOption {
  score: MicroSurveyScore;
  emoji: string;
  label: string;
}

const RATING_OPTIONS: RatingOption[] = [
  { score: "fast", emoji: "🚀", label: "Super rápido" },
  { score: "normal", emoji: "👍", label: "Normal" },
  { score: "slow", emoji: "🐢", label: "Achei demorado" },
];

export function CrmMicroSurveyWidget({
  triggerEvent,
  onClose,
  onSubmit,
  autoDismissDelayMs = 2500,
  className,
}: CrmMicroSurveyWidgetProps) {
  const [step, setStep] = useState<"rating" | "feedback" | "submitted">("rating");
  const [selectedScore, setSelectedScore] = useState<MicroSurveyScore | null>(null);
  const [comment, setComment] = useState("");
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  const handleSelectScore = (score: MicroSurveyScore) => {
    setSelectedScore(score);
    if (score === "slow") {
      setStep("feedback");
    } else {
      finalizeSubmission(score);
    }
  };

  const finalizeSubmission = (score: MicroSurveyScore, userComment?: string) => {
    onSubmit?.({
      score,
      comment: userComment?.trim() ? userComment.trim() : undefined,
    });
    setStep("submitted");

    dismissTimerRef.current = setTimeout(() => {
      onClose();
    }, autoDismissDelayMs);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScore) return;
    finalizeSubmission(selectedScore, comment);
  };

  const question = EVENT_QUESTIONS[triggerEvent] || EVENT_QUESTIONS.clinical_record_saved;

  return (
    <aside
      role="region"
      aria-label="Micro-pesquisa contextual"
      data-testid="crm-micro-survey-widget"
      className={cn(
        "fixed bottom-4 right-4 z-50 w-full max-w-[340px] sm:max-w-sm min-w-0 overflow-x-hidden",
        "rounded-2xl border bg-card/95 backdrop-blur-md shadow-xl text-card-foreground p-4",
        "transition-all duration-300 animate-in fade-in slide-in-from-bottom-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>Feedback Relâmpago</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar pesquisa"
          className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {step === "rating" && (
        <div className="space-y-3">
          <p className="text-xs sm:text-sm font-medium leading-snug text-foreground">
            {question}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {RATING_OPTIONS.map((opt) => (
              <button
                key={opt.score}
                type="button"
                onClick={() => handleSelectScore(opt.score)}
                aria-label={opt.label}
                className={cn(
                  "min-h-[44px] min-w-[44px] w-full flex flex-col items-center justify-center gap-1 p-2 rounded-xl",
                  "border border-border/60 bg-muted/20 hover:bg-muted/60 active:scale-95",
                  "text-center transition-all text-foreground select-none",
                )}
              >
                <span className="text-xl leading-none" role="img" aria-hidden="true">
                  {opt.emoji}
                </span>
                <span className="text-[11px] font-medium leading-tight text-muted-foreground">
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "feedback" && (
        <form onSubmit={handleCommentSubmit} className="space-y-3 pt-1">
          <label
            htmlFor="micro-survey-comment"
            className="block text-xs sm:text-sm font-medium leading-snug text-foreground"
          >
            O que mais travou seu fluxo?
          </label>
          <Input
            id="micro-survey-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ex: Muitos campos, lentidão..."
            className="min-h-[44px] text-xs sm:text-sm"
            autoFocus
          />
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="submit"
              size="sm"
              className="flex-1 min-h-[44px] text-xs font-semibold"
            >
              <Send className="w-3.5 h-3.5 mr-1.5 shrink-0" />
              Enviar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => finalizeSubmission("slow")}
              className="min-h-[44px] text-xs text-muted-foreground"
            >
              Pular
            </Button>
          </div>
        </form>
      )}

      {step === "submitted" && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-3 py-2 text-foreground"
        >
          <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-semibold text-foreground">
              Obrigado pelo feedback!
            </p>
            <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">
              Sua resposta ajuda a deixar o Pluri cada vez mais ágil.
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
