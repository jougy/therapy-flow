import React, { useRef, useState } from "react";
import { FileCheck, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ANAMNESIS_TEMPLATE_IMPORT_MAX_BYTES,
  parseAnamnesisTemplateExchangePayload,
  sanitizeAnamnesisTemplateSchema,
  type AnamnesisTemplateSchema,
} from "@/lib/anamnesis-forms";
import { toast } from "@/hooks/use-toast";

export interface PluriformDropzoneProps {
  /**
   * Called when a file is successfully parsed.
   */
  onFileLoaded: (result: {
    fileName: string;
    schema: AnamnesisTemplateSchema;
    title?: string;
    description?: string;
  }) => void;
  /**
   * Currently loaded file name (if any).
   */
  uploadedFileName?: string | null;
  /**
   * Currently loaded schema (if any).
   */
  uploadedSchema?: AnamnesisTemplateSchema | null;
  /**
   * Called when the user removes/clears the loaded file.
   */
  onClear?: () => void;
  /**
   * Optional custom CSS class.
   */
  className?: string;
  /**
   * Compact display variant.
   */
  compact?: boolean;
  /**
   * Disabled state.
   */
  disabled?: boolean;
}

/**
 * Reusable Dropzone component for importing .pluriform and .json form templates.
 * Enforces file size limits, safe parsing, schema sanitization and visual feedback.
 */
export const PluriformDropzone: React.FC<PluriformDropzoneProps> = ({
  onFileLoaded,
  uploadedFileName,
  uploadedSchema,
  onClear,
  className,
  compact = false,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleProcessFile = async (file: File) => {
    if (disabled || isProcessing) return;

    if (file.size > ANAMNESIS_TEMPLATE_IMPORT_MAX_BYTES) {
      toast({
        title: "Arquivo excede o limite",
        description: "O tamanho máximo permitido para formulários é de 256KB.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      const imported = await parseAnamnesisTemplateExchangePayload(buffer);
      const cleanSchema = sanitizeAnamnesisTemplateSchema(imported.template.schema);

      if (cleanSchema.length === 0) {
        throw new Error("O arquivo não possui nenhum campo de formulário válido.");
      }

      onFileLoaded({
        fileName: file.name,
        schema: cleanSchema,
        title: imported.template.name,
        description: imported.template.description,
      });

      toast({
        title: "Arquivo carregado com sucesso",
        description: `Modelo "${imported.template.name || file.name}" pronto com ${cleanSchema.length} campos identificados.`,
      });
    } catch (err) {
      console.error("Erro ao processar arquivo .pluriform/.json:", err);
      toast({
        title: "Erro ao ler arquivo",
        description: err instanceof Error ? err.message : "Arquivo .pluriform ou .json inválido ou corrompido.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleProcessFile(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) {
      void handleProcessFile(file);
    }
  };

  const fieldsCount = uploadedSchema?.length ?? 0;

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept=".pluriform,.json,application/json,application/x-pluriform"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled || isProcessing}
      />

      {uploadedFileName && uploadedSchema ? (
        <div className="p-3.5 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <FileCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{uploadedFileName}</p>
              <p className="text-[11px] text-muted-foreground">
                {fieldsCount} {fieldsCount === 1 ? "campo identificado" : "campos identificados"} no schema
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || isProcessing}
            >
              Substituir
            </Button>
            {onClear && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={onClear}
                disabled={disabled || isProcessing}
                aria-label="Remover arquivo"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => {
            if (!disabled && !isProcessing) {
              inputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={cn(
            "border-2 border-dashed rounded-xl text-center cursor-pointer transition-all select-none",
            compact ? "p-3.5" : "p-5",
            isDragging
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50 hover:bg-muted/40",
            disabled && "opacity-50 pointer-events-none"
          )}
        >
          <Upload className={cn("text-primary mx-auto", compact ? "h-5 w-5 mb-1" : "h-6 w-6 mb-2")} />
          <p className="text-xs font-semibold text-foreground">
            {isProcessing ? "Processando arquivo..." : "Arraste seu arquivo .pluriform ou .json aqui"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            ou clique para selecionar do computador (máx 256KB)
          </p>
        </div>
      )}
    </div>
  );
};
