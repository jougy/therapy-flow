import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getPinSeverityInfoFromScore,
  resolveInitialPinSeverityScore,
  type ClinicalAnnotationShape,
} from "@/lib/image-annotation-vector";

export interface PinLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pinShape: ClinicalAnnotationShape | null;
  onSave: (updated: Partial<ClinicalAnnotationShape>) => void;
  onDelete?: () => void;
}

export const PinLabelDialog: React.FC<PinLabelDialogProps> = ({
  open,
  onOpenChange,
  pinShape,
  onSave,
  onDelete,
}) => {
  const [label, setLabel] = useState(pinShape?.label || "");
  const [comment, setComment] = useState(pinShape?.comment || "");
  const [severityScore, setSeverityScore] = useState<number>(() =>
    resolveInitialPinSeverityScore(pinShape)
  );

  React.useEffect(() => {
    if (pinShape) {
      setLabel(pinShape.label || "");
      setComment(pinShape.comment || "");
      setSeverityScore(resolveInitialPinSeverityScore(pinShape));
    }
  }, [pinShape]);

  if (!pinShape) return null;

  const currentInfo = getPinSeverityInfoFromScore(severityScore);

  const handleConfirm = () => {
    onSave({
      label: label.trim() || `Ponto ${pinShape.pinNumber ?? 1}`,
      comment: comment.trim(),
      severity: currentInfo.severity,
      severityScore,
      strokeColor: currentInfo.color,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              style={{ backgroundColor: currentInfo.color }}
              className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ring-2 ring-white/80 transition-colors"
            >
              {pinShape.pinNumber ?? 1}
            </span>
            Anotação do Ponto Clínico
          </DialogTitle>
          <DialogDescription>
            Insira a identificação clínica ou queixa do paciente associada a este ponto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="pin-label">Título / Tag rápida (ex: Ponto gatilho, Edema)</Label>
            <Input
              id="pin-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Dor aguda na palpação L4"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="pin-severity-slider">Nível de Alerta / Severidade</Label>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white shadow-xs transition-colors"
                style={{ backgroundColor: currentInfo.color }}
              >
                {currentInfo.label}
              </span>
            </div>

            {/* Barra Slider contínua: Verde (esq) -> Amarelo -> Laranja -> Vermelho -> Roxo (final dir) */}
            <div className="relative pt-1 pb-0.5">
              <div
                className="relative h-3.5 w-full rounded-full shadow-inner border border-black/10"
                style={{
                  background:
                    "linear-gradient(to right, #22C55E 0%, #EAB308 35%, #F97316 62%, #EF4444 82%, #8B5CF6 100%)",
                }}
              >
                {/* Indicador circular customizado sincronizado com a posição e cor */}
                <div
                  className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-6 w-6 rounded-full border-2 border-white shadow-md transition-transform"
                  style={{
                    left: `${severityScore}%`,
                    backgroundColor: currentInfo.color,
                  }}
                />
              </div>

              <input
                id="pin-severity-slider"
                type="range"
                min={0}
                max={100}
                step={1}
                value={severityScore}
                onChange={(e) => setSeverityScore(Number(e.target.value))}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label="Nível de Alerta / Severidade"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground px-0.5">
              <button
                type="button"
                onClick={() => setSeverityScore(0)}
                className="hover:text-foreground transition-colors flex items-center gap-1"
              >
                <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
                Leve / Bom
              </button>
              <button
                type="button"
                onClick={() => setSeverityScore(35)}
                className="hover:text-foreground transition-colors flex items-center gap-1"
              >
                <span className="h-2 w-2 rounded-full bg-[#EAB308]" />
                Atenção
              </button>
              <button
                type="button"
                onClick={() => setSeverityScore(82)}
                className="hover:text-foreground transition-colors flex items-center gap-1"
              >
                <span className="h-2 w-2 rounded-full bg-[#EF4444]" />
                Agudo
              </button>
              <button
                type="button"
                onClick={() => setSeverityScore(100)}
                className="hover:text-foreground transition-colors flex items-center gap-1"
              >
                <span className="h-2 w-2 rounded-full bg-[#8B5CF6]" />
                Crítico / Roxo
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pin-comment">Observação Clínica Detalhada</Label>
            <Textarea
              id="pin-comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Descreva detalhes como irradiação da dor, testes ortopédicos positivos ou conduta..."
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          {onDelete ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                onDelete();
                onOpenChange(false);
              }}
            >
              Excluir Ponto
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleConfirm}>
              Salvar Anotação
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
