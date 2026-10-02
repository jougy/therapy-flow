import React, { useRef, useState, useCallback, useEffect } from "react";
import { UploadCloud, Image as ImageIcon, Trash2, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatByteSize, ImageProcessingMetrics } from "@/lib/image-processing";

export interface ImageUploadSquareProps {
  value?: string | null;
  fallbackText?: string;
  disabled?: boolean;
  isProcessing?: boolean;
  onImageSelected: (file: File) => Promise<void> | void;
  onImageRemoved?: () => void;
  metrics?: ImageProcessingMetrics | null;
  className?: string;
}

export const ImageUploadSquare: React.FC<ImageUploadSquareProps> = ({
  value,
  fallbackText = "Logotipo",
  disabled = false,
  isProcessing = false,
  onImageSelected,
  onImageRemoved,
  metrics,
  className,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  // Reset erro de preview quando o valor da url mudar
  useEffect(() => {
    setPreviewError(false);
  }, [value]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isProcessing) {
      setIsDragging(true);
    }
  }, [disabled, isProcessing]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled || isProcessing) return;

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        onImageSelected(file);
      }
    },
    [disabled, isProcessing, onImageSelected]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const file = files[0];
        onImageSelected(file);
      }
      // Reset input value para permitir selecionar o mesmo arquivo novamente se necessário
      if (e.target) {
        e.target.value = "";
      }
    },
    [onImageSelected]
  );

  const triggerFileInput = () => {
    if (!disabled && !isProcessing && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const hasImage = Boolean(value && !previewError);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
        {/* Container quadrado 1:1 com drag-and-drop */}
        <div
          tabIndex={0}
          role="button"
          aria-label="Upload de logotipo da clínica"
          onClick={triggerFileInput}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              triggerFileInput();
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative group flex flex-col items-center justify-center w-36 h-36 sm:w-40 sm:h-40 rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer overflow-hidden select-none outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            isDragging
              ? "border-primary bg-primary/10 scale-[1.02] shadow-md"
              : "border-muted-foreground/25 hover:border-primary/60 bg-muted/20 hover:bg-muted/40",
            disabled && "opacity-60 cursor-not-allowed pointer-events-none",
            isProcessing && "pointer-events-none"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.svg,image/jpeg,image/png,image/webp,image/svg+xml"
            onChange={handleFileChange}
            disabled={disabled || isProcessing}
            className="hidden"
            aria-hidden="true"
          />

          {/* Imagem de preview */}
          {hasImage ? (
            <div className="relative w-full h-full flex items-center justify-center p-2.5 bg-background/50">
              <img
                src={value!}
                alt={fallbackText}
                onError={() => setPreviewError(true)}
                className="max-h-full max-w-full object-contain rounded-lg transition-transform duration-200 group-hover:scale-105"
              />
              {/* Overlay hover para troca rápida */}
              {!isProcessing && !disabled && (
                <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 text-white p-2">
                  <RefreshCw className="h-5 w-5 animate-in fade-in zoom-in-75 duration-150" />
                  <span className="text-[11px] font-medium text-center leading-tight">
                    Alterar imagem
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-3 text-center gap-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                <UploadCloud className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-foreground block">
                  Escolher logo
                </span>
                <span className="text-[10px] text-muted-foreground block leading-tight">
                  Arraste ou clique
                </span>
              </div>
            </div>
          )}

          {/* Estado de loading sobreposto */}
          {isProcessing && (
            <div className="absolute inset-0 bg-background/85 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-10 p-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-[11px] font-medium text-muted-foreground text-center">
                Otimizando em WebP...
              </span>
            </div>
          )}
        </div>

        {/* Informações laterais e ações */}
        <div className="flex flex-col justify-between flex-1 min-w-0 space-y-3 text-center sm:text-left">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Proporção 1:1
              </span>
              <Badge variant="secondary" className="text-[10px] font-normal py-0 px-1.5">
                WebP Otimizado
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Formatos aceitos: <strong>JPG, PNG, WebP ou SVG</strong> (máx. 10MB).
              O corte é centralizado automaticamente para manter alta nitidez.
            </p>
          </div>

          {/* Badge de compressão e economia */}
          {metrics && metrics.originalSize > 0 && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-[11px] text-emerald-800 dark:text-emerald-300 w-fit self-center sm:self-start">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                {formatByteSize(metrics.originalSize)} ➔{" "}
                <strong>{formatByteSize(metrics.compressedSize)}</strong>
                {metrics.reductionPercent > 0 && (
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 ml-1">
                    (-{metrics.reductionPercent}%)
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={triggerFileInput}
              disabled={disabled || isProcessing}
              className="h-8 text-xs gap-1.5 shadow-none"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              {hasImage ? "Substituir logotipo" : "Selecionar logotipo"}
            </Button>

            {hasImage && onImageRemoved && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onImageRemoved}
                disabled={disabled || isProcessing}
                className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remover
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
