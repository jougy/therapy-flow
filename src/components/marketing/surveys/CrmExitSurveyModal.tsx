import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { HeartHandshake, Loader2, Send } from "lucide-react";

export interface ExitSurveyReasonOption {
  id: string;
  label: string;
}

export const EXIT_SURVEY_REASONS: ExitSurveyReasonOption[] = [
  { id: "price_tight", label: "Preço / Momento financeiro apertado" },
  { id: "no_time", label: "Não tive tempo de testar com calma" },
  { id: "missing_feature", label: "Faltou um recurso essencial para a minha especialidade" },
  { id: "migration_friction", label: "Já uso outro sistema e deu preguiça de migrar" },
  { id: "other", label: "Outro motivo (campo aberto)" },
];

export interface ExitSurveySubmitData {
  reasons: string[];
  otherReason?: string;
}

export interface CrmExitSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: ExitSurveySubmitData) => Promise<void> | void;
  doctorName?: string;
  clinicName?: string;
}

export function CrmExitSurveyModal({
  isOpen,
  onClose,
  onSubmit,
  doctorName,
  clinicName: _clinicName,
}: CrmExitSurveyModalProps) {
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [otherText, setOtherText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSelectedReasons([]);
      setOtherText("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleToggleReason = (id: string) => {
    setSelectedReasons((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  const isOtherSelected = selectedReasons.includes("other");
  const canSubmit = selectedReasons.length > 0 && (!isOtherSelected || otherText.trim().length > 0 || selectedReasons.length > 1);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const selectedLabels = selectedReasons.map((id) => {
        const found = EXIT_SURVEY_REASONS.find((r) => r.id === id);
        return found ? found.label : id;
      });

      await onSubmit?.({
        reasons: selectedLabels,
        otherReason: isOtherSelected && otherText.trim() ? otherText.trim() : undefined,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const titleGreeting = doctorName ? `Dr(a). ${doctorName}, para` : "Para";
  const titleText = `${titleGreeting} não sermos chatos e não incomodar mais: o que mais pesou para você não continuar agora?`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent
        data-testid="crm-exit-survey-modal"
        className="w-full max-w-lg min-w-0 overflow-x-hidden p-0 rounded-2xl border bg-background shadow-2xl flex flex-col max-h-[90dvh]"
      >
        <DialogHeader className="p-5 pb-3 border-b bg-muted/20 text-left space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 w-fit">
            <HeartHandshake className="w-3.5 h-3.5 shrink-0" />
            <span>Pesquisa de Encerramento Sincera</span>
          </div>
          <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground leading-snug">
            {titleText}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Sua resposta é 100% sincera e confidencial. Prometemos não insistir em ligações nem encher sua caixa de mensagens.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4 min-w-0 max-w-full">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Selecione todos os motivos que se aplicam:
            </p>
            <div className="space-y-1.5 pt-1">
              {EXIT_SURVEY_REASONS.map((option) => {
                const isChecked = selectedReasons.includes(option.id);
                return (
                  <label
                    key={option.id}
                    htmlFor={`exit-reason-${option.id}`}
                    className="min-h-[44px] flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:bg-muted/40 cursor-pointer select-none transition-colors"
                  >
                    <Checkbox
                      id={`exit-reason-${option.id}`}
                      checked={isChecked}
                      onCheckedChange={() => handleToggleReason(option.id)}
                      className="h-4 w-4 shrink-0"
                    />
                    <span className="text-xs sm:text-sm font-medium text-foreground flex-1 leading-snug">
                      {option.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {isOtherSelected && (
            <div className="space-y-1.5 pt-1 animate-in fade-in duration-200">
              <Label
                htmlFor="exit-survey-other-text"
                className="text-xs sm:text-sm font-medium text-foreground block"
              >
                Conte com suas palavras o que pesou na sua decisão:
              </Label>
              <Input
                id="exit-survey-other-text"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="Ex: Faltou prescrição digital para fisioterapia..."
                className="min-h-[44px] text-xs sm:text-sm"
                autoFocus
              />
            </div>
          )}
        </form>

        <DialogFooter className="p-4 border-t bg-muted/10 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[44px] w-full sm:w-auto text-xs sm:text-sm text-muted-foreground"
          >
            Agora não
          </Button>
          <Button
            type="button"
            onClick={() => handleSubmit()}
            disabled={!canSubmit || isSubmitting}
            className="min-h-[44px] w-full sm:w-auto text-xs sm:text-sm font-semibold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin shrink-0" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                Enviar Resposta
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
