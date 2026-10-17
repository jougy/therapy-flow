import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Edit3,
  FolderOpen,
  ImagePlus,
  MapPin,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import {
  convertImageFileToWebp,
  getRecentAnnotationBaseImages,
  renderAnnotationsToCanvasContext,
  saveRecentAnnotationBaseImage,
  type ClinicalImageAnnotationValue,
  type SavedAnnotationBaseImage,
} from "@/lib/image-annotation-vector";
import { uploadImageToBackblazeB2 } from "@/lib/backblaze-b2-upload";
import { ClinicalImageAnnotatorModal } from "./ClinicalImageAnnotatorModal";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export interface AnnotatedImagePreviewProps {
  value: ClinicalImageAnnotationValue;
  className?: string;
  maxHeightClassName?: string;
  showPinLegend?: boolean;
  actionSlot?: React.ReactNode;
  onImageClick?: () => void;
}

/**
 * Componente reutilizável que renderiza a imagem base + todos os traços/formas/setas/textos/pins
 * em um <canvas> responsivo, com popovers interativos nos pins e legenda clínica abaixo.
 */
export const AnnotatedImagePreview: React.FC<AnnotatedImagePreviewProps> = ({
  value,
  className,
  maxHeightClassName = "max-h-[400px]",
  showPinLegend = true,
  actionSlot,
  onImageClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);
  const [activePinTooltip, setActivePinTooltip] = useState<string | null>(null);

  useEffect(() => {
    if (!value?.baseImageUrl) {
      setLoadedImg(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!cancelled) setLoadedImg(img);
    };
    img.src = value.baseImageUrl;
    return () => {
      cancelled = true;
    };
  }, [value?.baseImageUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (loadedImg) {
      ctx.drawImage(loadedImg, 0, 0, canvas.width, canvas.height);
    }

    if (value?.annotations && value.annotations.length > 0) {
      renderAnnotationsToCanvasContext(ctx, value.annotations, canvas.width, canvas.height, {
        selectedShapeId: activePinTooltip,
      });
    }
  }, [loadedImg, value?.annotations, value?.baseImageWidth, value?.baseImageHeight, activePinTooltip]);

  const pins = value?.annotations?.filter((s) => s.type === "pin") || [];
  const totalShapes = value?.annotations?.length || 0;

  return (
    <div className={cn("space-y-2.5 w-full", className)}>
      <div className="relative rounded-lg overflow-hidden border bg-slate-950 flex items-center justify-center group">
        <div className="relative inline-flex items-center justify-center max-w-full">
          <canvas
            ref={canvasRef}
            width={value.baseImageWidth || loadedImg?.naturalWidth || 1200}
            height={value.baseImageHeight || loadedImg?.naturalHeight || 800}
            onClick={(e) => {
              if (onImageClick) {
                e.stopPropagation();
                onImageClick();
              }
            }}
            className={cn(
              "w-auto max-w-full object-contain block",
              maxHeightClassName,
              onImageClick && "cursor-pointer"
            )}
          />

          {/* Pins interativos sobrepostos exatamente sobre a área do canvas */}
          {pins.map((pin) => {
            const leftPercent = (pin.x / 1000) * 100;
            const topPercent = (pin.y / 1000) * 100;
            const isActive = activePinTooltip === pin.id;

            return (
              <div
                key={pin.id}
                style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePinTooltip(isActive ? null : pin.id);
                }}
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

                {isActive && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-52 rounded-md bg-slate-900/95 p-2.5 text-white shadow-xl text-xs z-20 pointer-events-auto border border-slate-700 animate-in fade-in zoom-in-95"
                  >
                    <p className="font-bold text-amber-300">
                      #{pin.pinNumber ?? 1} - {pin.label || `Ponto ${pin.pinNumber ?? 1}`}
                    </p>
                    {pin.comment && <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">{pin.comment}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {actionSlot && (
          <div
            className="absolute top-2 right-2 flex items-center gap-1.5 z-20"
            onClick={(e) => e.stopPropagation()}
          >
            {actionSlot}
          </div>
        )}
      </div>

      {/* Legenda clínica de pontos e contador de anotações */}
      {showPinLegend && (pins.length > 0 || totalShapes > 0) && (
        <div
          className="space-y-1.5 bg-muted/30 p-2.5 rounded-lg border text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              {pins.length > 0
                ? `Pontos de Atenção Clínicos (${pins.length})`
                : `Anotações Gráficas Registradas (${totalShapes})`}
            </p>
            {totalShapes > pins.length && (
              <span className="text-[11px] text-muted-foreground">
                +{totalShapes - pins.length} {totalShapes - pins.length === 1 ? "traço/forma" : "traços/formas"}
              </span>
            )}
          </div>
          {pins.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-0.5">
              {pins.map((pin) => (
                <Badge
                  key={pin.id}
                  variant="outline"
                  onClick={() => setActivePinTooltip(activePinTooltip === pin.id ? null : pin.id)}
                  className={cn(
                    "cursor-pointer gap-1.5 py-1 px-2 hover:bg-muted transition-colors",
                    activePinTooltip === pin.id && "border-primary bg-primary/10"
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: pin.strokeColor }}
                  />
                  <strong className="text-foreground">#{pin.pinNumber}:</strong>
                  <span>{pin.label || "Sem título"}</span>
                  {pin.comment && (
                    <span className="text-muted-foreground truncate max-w-[160px]">
                      — {pin.comment}
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

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
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [savedImages, setSavedImages] = useState<SavedAnnotationBaseImage[]>(() =>
    getRecentAnnotationBaseImages(clinicId)
  );

  // Sincroniza imagens salvas localmente + uploads do Backblaze B2 da clínica
  useEffect(() => {
    const localList = getRecentAnnotationBaseImages(clinicId);
    setSavedImages(localList);

    if (!clinicId) return;
    let isMounted = true;

    const fetchClinicImages = async () => {
      try {
        const { data } = await supabase
          .from("patient_file_uploads")
          .select("id, filename, created_at, metadata")
          .eq("clinic_id", clinicId)
          .eq("category", "image")
          .eq("status", "uploaded")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(20);

        if (!isMounted || !data) return;

        const merged = [...getRecentAnnotationBaseImages(clinicId)];
        for (const row of data) {
          const meta = (row.metadata || {}) as Record<string, unknown>;
          const downloadUrl = typeof meta.downloadUrl === "string" ? meta.downloadUrl : null;
          if (downloadUrl && !merged.some((item) => item.url === downloadUrl || item.id === row.id)) {
            merged.push({
              id: row.id,
              url: downloadUrl,
              filename: row.filename || "Imagem clínica",
              width: typeof meta.width === "number" ? meta.width : 1200,
              height: typeof meta.height === "number" ? meta.height : 800,
              createdAt: row.created_at,
            });
          }
        }
        setSavedImages(merged.slice(0, 24));
      } catch {
        // Silencioso caso offline/teste
      }
    };

    void fetchClinicImages();
    return () => {
      isMounted = false;
    };
  }, [clinicId]);

  // Se houver imagem já existente no campo ou na sessão anterior, garante que esteja na galeria rápida
  useEffect(() => {
    if (value?.baseImageUrl) {
      const updated = saveRecentAnnotationBaseImage(
        {
          id: value.baseImageId || `img_${value.baseImageUrl.slice(-16)}`,
          url: value.baseImageUrl,
          filename: fieldLabel || "Imagem clínica",
          width: value.baseImageWidth || 1200,
          height: value.baseImageHeight || 800,
        },
        clinicId
      );
      if (updated.length > 0) setSavedImages(updated);
    }
  }, [value?.baseImageUrl, value?.baseImageId, value?.baseImageWidth, value?.baseImageHeight, fieldLabel, clinicId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const result = await convertImageFileToWebp(file, 1920, 0.85);

      let finalImageUrl = result.dataUrl;
      let uploadId: string | undefined = undefined;

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

      const updatedGallery = saveRecentAnnotationBaseImage(
        {
          id: uploadId || `img_${Date.now()}`,
          url: finalImageUrl,
          filename: result.filename,
          width: result.width,
          height: result.height,
        },
        clinicId
      );
      setSavedImages(updatedGallery);

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

  const handleSelectSavedBaseImage = (img: SavedAnnotationBaseImage) => {
    const nextValue: ClinicalImageAnnotationValue = {
      baseImageId: img.id,
      baseImageUrl: img.url,
      baseImageWidth: img.width || 1200,
      baseImageHeight: img.height || 800,
      annotations: value?.baseImageUrl === img.url ? value.annotations || [] : [],
      updatedAt: new Date().toISOString(),
    };
    onChange(nextValue);
    setIsGalleryOpen(false);
    setIsModalOpen(true);
  };

  const handleReusePreviousImage = () => {
    if (!previousSessionImage) return;

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

  const quickSuggestions = savedImages.slice(0, 4);

  return (
    <div className="space-y-3 w-full" onClick={(e) => e.stopPropagation()}>
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
          <CardContent className="flex flex-col items-center justify-center p-5 sm:p-6 text-center space-y-4">
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
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                disabled={disabled || isProcessing}
                className="gap-1.5"
              >
                <Upload className="h-4 w-4" />
                {isProcessing ? "Convertendo..." : "Selecionar Foto / Imagem"}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsGalleryOpen(true);
                }}
                disabled={disabled}
                className="gap-1.5"
                title="Abrir pasta com miniaturas de imagens salvas"
              >
                <FolderOpen className="h-4 w-4 text-amber-500" />
                Biblioteca ({savedImages.length})
              </Button>

              {previousSessionImage && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReusePreviousImage();
                  }}
                  disabled={disabled}
                  className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reaproveitar atendimento anterior
                </Button>
              )}
            </div>

            {/* Sugestões rápidas de reutilização logo após primeiro upload */}
            {quickSuggestions.length > 0 && !disabled && (
              <div className="w-full pt-3 border-t border-border/60 space-y-2 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    Sugestões rápidas (clique para usar novamente):
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsGalleryOpen(true);
                    }}
                    className="text-[11px] text-primary hover:underline font-medium flex items-center gap-1"
                  >
                    <FolderOpen className="h-3 w-3" />
                    Ver todas ({savedImages.length})
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {quickSuggestions.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectSavedBaseImage(img);
                      }}
                      className="group relative flex flex-col items-center rounded-md border bg-background p-1.5 hover:border-primary hover:ring-1 hover:ring-primary transition-all text-left overflow-hidden"
                    >
                      <div className="w-full h-16 bg-slate-950/90 rounded flex items-center justify-center overflow-hidden">
                        <img
                          src={img.url}
                          alt={img.filename}
                          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground truncate w-full mt-1 px-0.5">
                        {img.filename}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Caso B: Imagem carregada - Miniatura com todos os desenhos renderizados no canvas + pins interativos */
        <AnnotatedImagePreview
          value={value}
          onImageClick={!disabled ? () => setIsModalOpen(true) : undefined}
          actionSlot={
            !disabled ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsModalOpen(true)}
                  className="gap-1.5 shadow-md bg-background/90 backdrop-blur-xs text-xs h-8"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Editar Desenho / Pontos
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  onClick={() => setIsGalleryOpen(true)}
                  className="h-8 w-8 shadow-md bg-background/90 backdrop-blur-xs"
                  title="Trocar imagem pela Biblioteca Salva"
                >
                  <FolderOpen className="h-3.5 w-3.5 text-amber-500" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  onClick={() => onChange(null)}
                  className="h-8 w-8 shadow-md"
                  title="Remover imagem"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : undefined
          }
        />
      )}

      {/* Popup da Pasta / Galeria de Miniaturas de Imagens Brutas Salvas */}
      <Dialog open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
        <DialogContent className="max-w-2xl w-full max-h-[85dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="h-5 w-5 text-amber-500" />
              Biblioteca de Imagens Base Salvas
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain pr-1 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 p-3 rounded-lg border text-xs">
              <span className="text-muted-foreground">
                Selecione uma imagem bruta para abrir no editor de desenho (reaproveitamento com custo zero de armazenamento).
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsGalleryOpen(false);
                  fileInputRef.current?.click();
                }}
                className="gap-1.5 h-8"
              >
                <Upload className="h-3.5 w-3.5" />
                Novo Upload
              </Button>
            </div>

            {savedImages.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground space-y-2">
                <p>Nenhuma imagem salva na biblioteca ainda.</p>
                <p className="text-xs">
                  Assim que você fizer o primeiro upload, a imagem ficará disponível aqui para uso rápido em qualquer atendimento.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {savedImages.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => handleSelectSavedBaseImage(img)}
                    className="group flex flex-col rounded-lg border bg-card p-2 hover:border-primary hover:ring-2 hover:ring-primary/30 transition-all text-left overflow-hidden"
                  >
                    <div className="w-full h-32 rounded bg-slate-950 flex items-center justify-center overflow-hidden">
                      <img
                        src={img.url}
                        alt={img.filename}
                        className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div className="mt-2 w-full">
                      <p className="text-xs font-medium truncate text-foreground">{img.filename}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {img.width}x{img.height}px • WebP
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
