import React, { useCallback, useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SignaturePadCanvasProps {
  onSignatureChange: (dataUrl: string | null) => void;
  label?: string;
  helperText?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Exporta o canvas em `.webp` transparente (com fallback para `.png` caso o ambiente não suporte WebP).
 */
function exportCanvasSignatureDataUrl(canvas: HTMLCanvasElement): string {
  try {
    const webp = canvas.toDataURL("image/webp", 0.85);
    if (webp.startsWith("data:image/webp")) {
      return webp;
    }
  } catch {
    // Fallback para PNG abaixo
  }
  return canvas.toDataURL("image/png");
}

export const SignaturePadCanvas: React.FC<SignaturePadCanvasProps> = ({
  onSignatureChange,
  label = "Rubrique dentro do quadro abaixo:",
  helperText,
  disabled = false,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const hasStrokeRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : 360;
    const height = rect.height > 0 ? rect.height : 176;

    canvas.width = width * 2;
    canvas.height = height * 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.4;

    isDrawingRef.current = false;
    hasStrokeRef.current = false;
    setHasSignature(false);
    onSignatureChange(null);
  }, [onSignatureChange]);

  useEffect(() => {
    const timer = setTimeout(setupCanvas, 60);
    return () => clearTimeout(timer);
  }, [setupCanvas]);

  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ("touches" in e && e.touches.length > 0) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }

    if ("clientX" in e) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }

    return { x: 0, y: 0 };
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.01, y + 0.01);
    ctx.stroke();
    isDrawingRef.current = true;
    hasStrokeRef.current = true;
    setHasSignature(true);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (disabled || !isDrawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasStrokeRef.current) {
      hasStrokeRef.current = true;
      setHasSignature(true);
    }
  };

  const stopDrawing = (
    e?: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (e) e.preventDefault();
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas && hasStrokeRef.current) {
      onSignatureChange(exportCanvasSignatureDataUrl(canvas));
    }
  };

  return (
    <div className={`space-y-2 w-full min-w-0 ${className}`}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={setupCanvas}
          className="h-9 min-h-[36px] px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
        >
          <Eraser className="w-3.5 h-3.5" />
          Limpar
        </Button>
      </div>

      <div className="relative rounded-xl border-2 border-dashed border-border overflow-hidden bg-white touch-none">
        <canvas
          ref={canvasRef}
          aria-label="Quadro de assinatura digital"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-44 cursor-crosshair block"
        />
        {!hasSignature && (
          <div className="pointer-events-none absolute inset-x-6 bottom-6 border-b border-slate-300/80" />
        )}
      </div>

      <p className="text-[11px] text-center text-muted-foreground">
        {helperText ??
          (hasSignature
            ? "✓ Assinatura capturada com sucesso"
            : "Assine com o dedo na tela ou com o mouse sobre a linha acima")}
      </p>
    </div>
  );
};
