import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  Edit3,
  ImagePlus,
  MapPin,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import {
  convertImageFileToWebp,
  type ClinicalImageAnnotationValue,
} from "@/lib/image-annotation-vector";
import { uploadImageToBackblazeB2 } from "@/lib/backblaze-b2-upload";
import { ClinicalImageAnnotatorModal } from "./ClinicalImageAnnotatorModal";
import { cn } from "@/lib/utils";

export interface ImageAnnotationRuntimeInputProps {
  value: ClinicalImageAnnotationValue | null;
  onChange: (value: ClinicalImageAnnotationValue | null) => void;
  disabled?: boolean;
  fieldLabel?: string;
  previousSessionImage?: ClinicalImageAnnotationValue | null;
  clinicId?: string | null;
  patientId?: string | null;
  sessionId?: string | null;
}

export const ImageAnnotationRuntimeInput: React.FC<ImageAnnotationRuntimeInputProps> = ({
  value,
  onChange,
  disabled = false,
  fieldLabel = "Anotação de Imagem",
  previousSessionImage,
  clinicId,
  patientId,
  sessionId,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activePinTooltip, setActivePinTooltip] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      // 1. Converte client-side para WebP otimizado preservando aspect ratio
      const result = await convertImageFileToWebp(file, 1920, 0.85);

      let finalImageUrl = result.dataUrl;
      let uploadId: string | undefined = undefined;

      // 2. Se houver clinicId (ambiente com backend), envia DIRETAMENTE para o Backblaze B2 (NUNCA Supabase Storage)
      if (clinicId) {
        try {
          const b2Result = await uploadImageToBackblazeB2({
            blob: result.blob,
            filename: result.filename,
            width: result.width,
            height: result.height,
            clinicId,
            patientId,
            sessionId,
          });

          if (b2Result.downloadUrl) {
            finalImageUrl = b2Result.downloadUrl;
            uploadId = b2Result.uploadId;
          }
        } catch (b2Err) {
          console.warn("[image-annotator] Falha no upload Backblaze B2, mantendo preview local resiliente:", b2Err);
        }
      }

      const newValue: ClinicalImageAnnotationValue = {
        baseImageId: uploadId,
        baseImageUrl: finalImageUrl,
        baseImageWidth: result.width,
        baseImageHeight: result.height,
        annotations: [],
        updatedAt: new Date().toISOString(),
      };

      onChange(newValue);
      setIsModalOpen(true);
    } catch (err) {
      console.error("Falha ao converter imagem para WebP:", err);
      alert("Não foi possível processar a imagem selecionada.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleReusePreviousImage = () => {
    if (!previousSessionImage) return;

    // Reaproveita estritamente a mesma imagem base, iniciando com zero ou as mesmas anotações
    const reusedValue: ClinicalImageAnnotationValue = {
      baseImageId: previousSessionImage.baseImageId,
      baseImageUrl: previousSessionImage.baseImageUrl,
      baseImageWidth: previousSessionImage.baseImageWidth,
      baseImageHeight: previousSessionImage.baseImageHeight,
      annotations: previousSessionImage.annotations || [],
      updatedAt: new Date().toISOString(),
      sourceSessionId: previousSessionImage.sourceSessionId,
    };

    onChange(reusedValue);
    setIsModalOpen(true);
  };

  const pins = value?.annotations?.filter((s) => s.type === "pin") || [];

  return (
    <div className="space-y-3 w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        onChange={handleFileUpload}
        className="hidden"
        disabled={disabled}
      />

      {/* Caso A: Nenhuma imagem carregada ainda */}
      {!value?.baseImageUrl ? (
        <Card className="border-dashed border-2 bg-muted/20 hover:bg-muted/30 transition-colors">
          <CardContent className="flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <ImagePlus className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium">Carregar imagem para anotação clínica</p>
              <p className="text-xs text-muted-foreground">
                Suporta JPG, PNG e WebP. Otimização automática e compressão instantânea.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isProcessing}
                className="gap-1.5"
              >
                <Upload className="h-4 w-4" />
                {isProcessing ? "Convertendo..." : "Selecionar Foto / Imagem"}
              </Button>

              {previousSessionImage && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReusePreviousImage}
                  disabled={disabled}
                  className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reaproveitar foto anterior
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Caso B: Imagem carregada - Miniatura interativa com os pins e botões de ação */
        <div className="space-y-3">
          <div className="relative rounded-lg overflow-hidden border bg-slate-950 flex items-center justify-center max-h-[420px] group">
            <img
              src={value.baseImageUrl}
              alt="Anotação clínica"
              className="max-h-[400px] w-auto object-contain"
            />

            {/* Pins interativos sobre a imagem no formulário */}
            {pins.map((pin) => {
              const leftPercent = (pin.x / 1000) * 100;
              const topPercent = (pin.y / 1000) * 100;
              const isActive = activePinTooltip === pin.id;

              return (
                <div
                  key={pin.id}
                  style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer"
                  onClick={() => setActivePinTooltip(isActive ? null : pin.id)}
                >
                  <div
                    style={{ backgroundColor: pin.strokeColor }}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-white text-[11px] font-bold shadow-md ring-2 ring-white transition-transform",
                      isActive ? "scale-125 ring-primary" : "hover:scale-110"
                    )}
                  >
                    {pin.pinNumber ?? 1}
                  </div>

                  {/* Popover / Tooltip do Pin */}
                  {isActive && (
                    <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-48 rounded-md bg-slate-900/95 p-2 text-white shadow-xl text-xs z-20 pointer-events-auto border border-slate-700 animate-in fade-in zoom-in-95">
                      <p className="font-bold text-amber-300">{pin.label || `Ponto ${pin.pinNumber}`}</p>
                      {pin.comment && <p className="mt-1 text-[11px] text-slate-300">{pin.comment}</p>}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Overlay com botão de editar */}
            <div className="absolute top-2 right-2 flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setIsModalOpen(true)}
                disabled={disabled}
                className="gap-1.5 shadow-md bg-background/90 backdrop-blur-xs text-xs h-8"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Editar Desenho / Pontos
              </Button>
              <Button
                type="button"
                size="icon"
                variant="destructive"
                onClick={() => onChange(null)}
                disabled={disabled}
                className="h-8 w-8 shadow-md"
                title="Remover imagem"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Lista de Pontos Marcados / Legenda clínica */}
          {pins.length > 0 && (
            <div className="space-y-1.5 bg-muted/30 p-2.5 rounded-lg border text-xs">
              <p className="font-semibold text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                Pontos de Atenção Clínicos ({pins.length}):
              </p>
              <div className="flex flex-wrap gap-2">
                {pins.map((pin) => (
                  <Badge
                    key={pin.id}
                    variant="outline"
                    onClick={() => setActivePinTooltip(activePinTooltip === pin.id ? null : pin.id)}
                    className="cursor-pointer gap-1.5 py-1 px-2 hover:bg-muted"
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: pin.strokeColor }}
                    />
                    <strong className="text-foreground">#{pin.pinNumber}:</strong>
                    <span>{pin.label || "Sem título"}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Anotação Vetorial */}
      {isModalOpen && value && (
        <ClinicalImageAnnotatorModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          initialValue={value}
          onSave={onChange}
          title={fieldLabel}
        />
      )}
    </div>
  );
};
