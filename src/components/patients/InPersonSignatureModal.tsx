import React, { useRef, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Eraser, PenTool, ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { SharePatientData } from "@/components/patients/SharePatientRegistrationModal";

interface InPersonSignatureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: SharePatientData | null;
  onSigned?: () => void;
}

export const InPersonSignatureModal: React.FC<InPersonSignatureModalProps> = ({
  open,
  onOpenChange,
  patient,
  onSigned,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Inicializa o canvas
  const setupCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Ajusta resolução para telas retina
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.5;

    // Fundo branco
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasSignature(false);
  };

  useEffect(() => {
    if (open) {
      setTimeout(setupCanvas, 100);
    }
  }, [open]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = (e?: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (e) e.preventDefault();
    setIsDrawing(false);
  };

  const handleClear = () => {
    setupCanvas();
  };

  const handleConfirmSignature = async () => {
    if (!canvasRef.current || !hasSignature || !patient?.id) return;
    setSubmitting(true);

    try {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      const guardianCpf = patient.responsible_cpf || (patient.cpf && patient.responsible_name ? patient.cpf : null);

      const consentPayload = {
        status: "signed",
        method: "in_person",
        signed_at: new Date().toISOString(),
        responsible_name: patient.responsible_name || null,
        responsible_relationship: patient.responsible_relationship || null,
        responsible_cpf: guardianCpf,
        signature_image_url: dataUrl,
        legal_declaration: true,
      };

      const { error } = await supabase.rpc("update_patient_guardian_consent", {
        _patient_id: patient.id,
        _consent_payload: consentPayload,
      });

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: "Consentimento Concluído!",
        description: `Assinatura presencial do responsável registrada com sucesso.`,
      });

      onOpenChange(false);
      onSigned?.();
    } catch (err) {
      toast({
        title: "Erro ao registrar assinatura",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 sm:rounded-2xl space-y-4">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wide">
            <PenTool className="w-4 h-4" />
            Assinatura Digital Presencial
          </div>
          <DialogTitle className="text-lg font-bold">
            Rubrica do(a) Responsável Legal
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            O responsável legal presente na recepção deve assinar no quadro abaixo com o dedo ou mouse, formalizando o consentimento (LGPD Art. 14).
          </DialogDescription>
        </DialogHeader>

        {/* Resumo do Declarante */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">
              {patient?.responsible_name || "Responsável Legal"}
            </span>
            <span className="text-muted-foreground">
              {patient?.responsible_relationship || "Responsável"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Paciente menor: <strong>{patient?.name}</strong>
          </p>
          <p className="text-[10px] text-muted-foreground italic pt-1 border-t border-primary/10">
            "Declaro ser detentor(a) do poder familiar/guarda legal do menor e autorizo o atendimento e tratamento de dados de saúde."
          </p>
        </div>

        {/* Quadro de Assinatura */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Rubrique dentro do quadro abaixo:</span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleClear}
              className="h-6 text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <Eraser className="w-3 h-3" />
              Limpar
            </Button>
          </div>

          <div className="rounded-xl border-2 border-dashed border-border overflow-hidden bg-white touch-none">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-44 cursor-crosshair block"
            />
          </div>
          <p className="text-[11px] text-center text-muted-foreground">
            {hasSignature ? "✓ Assinatura capturada" : "Aguardando assinatura com o dedo ou mouse..."}
          </p>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!hasSignature || submitting}
            onClick={handleConfirmSignature}
            className="w-full sm:w-auto font-semibold gap-1.5"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Concluir Assinatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
