import React, { useState, useRef, useCallback } from "react";
import { UploadCloud, Loader2, Sparkles, FileText, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  scanAndCompressTermDocument,
  suggestTitleFromFilename,
  type ScannedTermResult,
} from "@/lib/termDocumentScanner";

export interface ScannedDocumentPayload {
  file: File;
  suggestedTitle: string;
  markdownText: string;
  hasRemovedImages: boolean;
  detectedVariables: string[];
}

interface TermDocumentDropzoneProps {
  variant?: "full" | "compact";
  disabled?: boolean;
  onScanned: (payload: ScannedDocumentPayload) => void;
  className?: string;
  label?: string;
  description?: string;
}

const SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".doc", ".md", ".txt"];

export const TermDocumentDropzone: React.FC<TermDocumentDropzoneProps> = ({
  variant = "full",
  disabled = false,
  onScanned,
  className = "",
  label,
  description,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [lastScannedFile, setLastScannedFile] = useState<string | null>(null);

  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFileSupported = (fileName: string): boolean => {
    const lower = fileName.toLowerCase();
    return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
  };

  const processFile = useCallback(
    async (file: File) => {
      if (!isFileSupported(file.name)) {
        toast({
          title: "Formato não suportado",
          description: `O arquivo ${file.name} não é suportado. Envie arquivos .pdf, .docx, .doc ou .md.`,
          variant: "destructive",
        });
        return;
      }

      setIsScanning(true);
      setStatusMessage("Iniciando leitura do arquivo...");

      try {
        const scanned: ScannedTermResult = await scanAndCompressTermDocument(
          file,
          (status) => {
            setStatusMessage(status);
          }
        );

        if (scanned.hasRemovedImages) {
          toast({
            title: "Imagens descartadas automaticamente",
            description:
              "Imagens foram removidas da redação para padronização de impressão A4 e conformidade jurídica.",
            variant: "default",
          });
        }

        const suggestedTitle = suggestTitleFromFilename(file.name);
        setLastScannedFile(file.name);

        onScanned({
          file,
          suggestedTitle,
          markdownText: scanned.markdownText,
          hasRemovedImages: scanned.hasRemovedImages,
          detectedVariables: scanned.detectedVariables,
        });

        toast({
          title: "Documento convertido com sucesso",
          description: `${file.name} formatado em Markdown com ${scanned.detectedVariables.length} variáveis detectadas.`,
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Falha ao escanear documento";
        toast({
          title: "Erro no processamento do documento",
          description: message,
          variant: "destructive",
        });
      } finally {
        setIsScanning(false);
        setStatusMessage("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [onScanned]
  );

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsDragOver(false);
      dragCounterRef.current = 0;
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounterRef.current = 0;

    if (disabled || isScanning) return;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      void processFile(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const triggerClick = () => {
    if (!disabled && !isScanning && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && !disabled && !isScanning) {
      e.preventDefault();
      triggerClick();
    }
  };

  if (variant === "compact") {
    return (
      <div
        role="button"
        tabIndex={disabled || isScanning ? -1 : 0}
        onClick={triggerClick}
        onKeyDown={handleKeyDown}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-label="Zona de upload e conversão por Drag and Drop"
        className={`group relative flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl border-2 border-dashed transition-all cursor-pointer select-none text-left min-h-[58px] ${
          isDragOver
            ? "border-primary bg-primary/10 ring-2 ring-primary/30 scale-[1.005]"
            : "border-neutral-300 dark:border-neutral-700 hover:border-primary/60 bg-muted/20 hover:bg-muted/40"
        } ${disabled || isScanning ? "opacity-70 pointer-events-none cursor-not-allowed" : ""} ${className}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.md,.txt"
          className="hidden"
          onChange={handleFileInputChange}
          disabled={disabled || isScanning}
        />

        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
            {isScanning ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <UploadCloud className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate">
              {isScanning
                ? statusMessage || "Processando arquivo..."
                : label || "Importar redação de arquivo (.pdf, .docx, .md)"}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {isScanning
                ? "OCR local em execução via Tesseract.js"
                : description ||
                  "Arraste ou clique para ler documento com OCR automático"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 flex-wrap">
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
            .PDF (OCR)
          </Badge>
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
            .DOCX
          </Badge>
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
            .MD
          </Badge>
        </div>
      </div>
    );
  }

  // Variant "full" para a seção de Modelos Adicionais
  return (
    <div
      role="button"
      tabIndex={disabled || isScanning ? -1 : 0}
      onClick={triggerClick}
      onKeyDown={handleKeyDown}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-label="Zona de Drag and Drop para criar novo modelo de termo"
      className={`group relative flex flex-col items-center justify-center p-6 text-center rounded-2xl border-2 border-dashed transition-all cursor-pointer select-none ${
        isDragOver
          ? "border-primary bg-primary/10 ring-4 ring-primary/20 scale-[1.01]"
          : "border-neutral-300 dark:border-neutral-700 hover:border-primary/60 bg-muted/15 hover:bg-muted/30"
      } ${disabled || isScanning ? "opacity-70 pointer-events-none cursor-not-allowed" : ""} ${className}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.md,.txt"
        className="hidden"
        onChange={handleFileInputChange}
        disabled={disabled || isScanning}
      />

      <div className="p-3 rounded-2xl bg-primary/10 text-primary mb-3 group-hover:scale-105 transition-transform">
        {isScanning ? (
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        ) : (
          <UploadCloud className="w-6 h-6 text-primary" />
        )}
      </div>

      <h5 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <Sparkles className="w-4 h-4 text-primary shrink-0" />
        {isScanning
          ? statusMessage || "Processando e estruturando documento..."
          : label || "Arraste um documento para criar um novo modelo"}
      </h5>

      {(isScanning || description) && (
        <p className="text-xs text-muted-foreground mt-1 max-w-lg leading-relaxed">
          {isScanning
            ? "Executando OCR local (Tesseract.js) e convertendo para Markdown sem quebras de linha..."
            : description}
        </p>
      )}

      {lastScannedFile && !isScanning && (
        <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Último importado: {lastScannedFile}</span>
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-3 flex-wrap justify-center">
        <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5 bg-background">
          <FileText className="w-3 h-3 mr-1 text-primary" /> .PDF (OCR Local)
        </Badge>
        <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5 bg-background">
          .DOCX
        </Badge>
        <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5 bg-background">
          .DOC
        </Badge>
        <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5 bg-background">
          .MD
        </Badge>
      </div>
    </div>
  );
};
