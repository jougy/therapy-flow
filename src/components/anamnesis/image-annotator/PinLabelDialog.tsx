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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ClinicalAnnotationShape } from "@/lib/image-annotation-vector";

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
  const [severity, setSeverity] = useState<"low" | "medium" | "high">(pinShape?.severity || "medium");

  React.useEffect(() => {
    if (pinShape) {
      setLabel(pinShape.label || "");
      setComment(pinShape.comment || "");
      setSeverity(pinShape.severity || "medium");
    }
  }, [pinShape]);

  if (!pinShape) return null;

  const handleConfirm = () => {
    onSave({
      label: label.trim() || `Ponto ${pinShape.pinNumber ?? 1}`,
      comment: comment.trim(),
      severity,
      strokeColor:
        severity === "high"
          ? "#EF4444" // Vermelho
          : severity === "low"
          ? "#22C55E" // Verde
          : "#EAB308", // Amarelo
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
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

          <div className="space-y-1.5">
            <Label htmlFor="pin-severity">Nível de Alerta / Severidade</Label>
            <Select value={severity} onValueChange={(val) => setSeverity(val as "low" | "medium" | "high")}>
              <SelectTrigger id="pin-severity">
                <SelectValue placeholder="Selecione o nível" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">🟢 Baixo / Evolução Positiva</SelectItem>
                <SelectItem value="medium">🟡 Médio / Atenção & Palpação</SelectItem>
                <SelectItem value="high">🔴 Alto / Dor Aguda ou Alerta</SelectItem>
              </SelectContent>
            </Select>
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
          ) : <div />}
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
