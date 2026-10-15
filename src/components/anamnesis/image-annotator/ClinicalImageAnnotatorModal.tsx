import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  normalizeCoordinate,
  renderAnnotationsToCanvasContext,
  type ClinicalAnnotationShape,
  type ClinicalAnnotationTool,
  type ClinicalImageAnnotationValue,
  type ClinicalLineStyle,
} from "@/lib/image-annotation-vector";
import { AnnotatorToolbar } from "./AnnotatorToolbar";
import { PinLabelDialog } from "./PinLabelDialog";
import { Badge } from "@/components/ui/badge";

export interface ClinicalImageAnnotatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue: ClinicalImageAnnotationValue | null;
  onSave: (value: ClinicalImageAnnotationValue) => void;
  title?: string;
}

export const ClinicalImageAnnotatorModal: React.FC<ClinicalImageAnnotatorModalProps> = ({
  open,
  onOpenChange,
  initialValue,
  onSave,
  title = "Anotador Clínico de Imagem",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Estados da Toolbar
  const [currentTool, setCurrentTool] = useState<ClinicalAnnotationTool>("pen");
  const [currentColor, setCurrentColor] = useState<string>("#EF4444");
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState<number>(4);
  const [currentLineStyle, setCurrentLineStyle] = useState<ClinicalLineStyle>("solid");

  // Lista de formas e histórico Undo/Redo
  const [shapes, setShapes] = useState<ClinicalAnnotationShape[]>(initialValue?.annotations || []);
  const [history, setHistory] = useState<ClinicalAnnotationShape[][]>([initialValue?.annotations || []]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Seleção e interação com Pin
  const [selectedPin, setSelectedPin] = useState<ClinicalAnnotationShape | null>(null);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState<boolean>(false);
  const [hoverShapeId, setHoverShapeId] = useState<string | null>(null);

  // Estado de desenho em andamento
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawingStart, setDrawingStart] = useState<{ x: number; y: number } | null>(null);
  const [currentPoints, setCurrentPoints] = useState<[number, number][]>([]);

  // Carrega imagem de fundo
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (initialValue?.baseImageUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => setLoadedImage(img);
      img.src = initialValue.baseImageUrl;
    }
  }, [initialValue?.baseImageUrl]);

  useEffect(() => {
    if (initialValue?.annotations) {
      setShapes(initialValue.annotations);
      setHistory([initialValue.annotations]);
      setHistoryIndex(0);
    }
  }, [initialValue]);

  // Atualiza histórico
  const pushStateToHistory = useCallback((nextShapes: ClinicalAnnotationShape[]) => {
    setHistory((prev) => {
      const upToCurrent = prev.slice(0, historyIndex + 1);
      return [...upToCurrent, nextShapes];
    });
    setHistoryIndex((prev) => prev + 1);
    setShapes(nextShapes);
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      setHistoryIndex(nextIdx);
      setShapes(history[nextIdx]);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setShapes(history[nextIdx]);
    }
  }, [history, historyIndex]);

  const handleClearAll = useCallback(() => {
    pushStateToHistory([]);
  }, [pushStateToHistory]);

  // Redesenho contínuo no Canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Desenha imagem de fundo mantendo escala
    if (loadedImage) {
      ctx.drawImage(loadedImage, 0, 0, canvas.width, canvas.height);
    }

    // Desenha formas já consolidadas
    renderAnnotationsToCanvasContext(ctx, shapes, canvas.width, canvas.height, {
      hoverShapeId,
    });

    // Se estiver desenhando uma forma temporária
    if (isDrawing && drawingStart) {
      ctx.save();
      ctx.strokeStyle = currentColor;
      ctx.fillStyle = currentColor;
      ctx.lineWidth = Math.max(1, (currentStrokeWidth / 1000) * canvas.width);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (currentTool === "highlighter") {
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = Math.max(12, (currentStrokeWidth / 1000) * canvas.width * 3);
      }

      if (currentLineStyle === "dashed") {
        ctx.setLineDash([ctx.lineWidth * 2.5, ctx.lineWidth * 2]);
      } else if (currentLineStyle === "dotted") {
        ctx.setLineDash([ctx.lineWidth, ctx.lineWidth * 1.5]);
      }

      if ((currentTool === "pen" || currentTool === "highlighter") && currentPoints.length > 0) {
        ctx.beginPath();
        const startX = (currentPoints[0][0] / 1000) * canvas.width;
        const startY = (currentPoints[0][1] / 1000) * canvas.height;
        ctx.moveTo(startX, startY);
        for (let i = 1; i < currentPoints.length; i++) {
          const px = (currentPoints[i][0] / 1000) * canvas.width;
          const py = (currentPoints[i][1] / 1000) * canvas.height;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      ctx.restore();
    }
  }, [
    loadedImage,
    shapes,
    hoverShapeId,
    isDrawing,
    drawingStart,
    currentColor,
    currentStrokeWidth,
    currentTool,
    currentLineStyle,
    currentPoints,
  ]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Manipulação de Eventos do Ponteiro (Mouse e Touch nativos)
  const getCanvasCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { normX: 0, normY: 0, pixelX: 0, pixelY: 0 };
    const rect = canvas.getBoundingClientRect();
    const pixelX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const pixelY = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const normX = normalizeCoordinate(pixelX, canvas.width);
    const normY = normalizeCoordinate(pixelY, canvas.height);
    return { normX, normY, pixelX, pixelY };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const { normX, normY } = getCanvasCoordinates(e);

    // Se a ferramenta for Pin, cria imediatamente um novo ponto e abre o diálogo de anotação
    if (currentTool === "pin") {
      const nextPinNumber = shapes.filter((s) => s.type === "pin").length + 1;
      const newPin: ClinicalAnnotationShape = {
        id: `pin_${Date.now()}`,
        type: "pin",
        x: normX,
        y: normY,
        pinNumber: nextPinNumber,
        label: `Ponto ${nextPinNumber}`,
        comment: "",
        strokeColor: currentColor,
        strokeWidth: 4,
        severity: "medium",
      };
      setSelectedPin(newPin);
      setIsPinDialogOpen(true);
      return;
    }

    // Se estiver no modo selecionar ou clicar em um Pin existente
    if (currentTool === "select") {
      // Checa se clicou perto de algum pin (raio de 30 unidades normalizadas)
      const clickedPin = shapes.find(
        (s) => s.type === "pin" && Math.hypot(s.x - normX, s.y - normY) < 35
      );
      if (clickedPin) {
        setSelectedPin(clickedPin);
        setIsPinDialogOpen(true);
        return;
      }
    }

    setIsDrawing(true);
    setDrawingStart({ x: normX, y: normY });
    if (currentTool === "pen" || currentTool === "highlighter") {
      setCurrentPoints([[normX, normY]]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { normX, normY } = getCanvasCoordinates(e);

    // Hover detect em pins
    const hoveredPin = shapes.find(
      (s) => s.type === "pin" && Math.hypot(s.x - normX, s.y - normY) < 35
    );
    setHoverShapeId(hoveredPin ? hoveredPin.id : null);

    if (!isDrawing || !drawingStart) return;

    if (currentTool === "pen" || currentTool === "highlighter") {
      setCurrentPoints((prev) => [...prev, [normX, normY]]);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawingStart) return;
    const { normX, normY } = getCanvasCoordinates(e);
    setIsDrawing(false);

    let newShape: ClinicalAnnotationShape | null = null;
    const shapeId = `shape_${Date.now()}`;

    if (currentTool === "pen" || currentTool === "highlighter") {
      if (currentPoints.length > 1) {
        newShape = {
          id: shapeId,
          type: currentTool,
          x: drawingStart.x,
          y: drawingStart.y,
          points: currentPoints,
          strokeColor: currentColor,
          strokeWidth: currentStrokeWidth,
        };
      }
    } else if (currentTool === "line" || currentTool === "arrow") {
      newShape = {
        id: shapeId,
        type: currentTool,
        x: drawingStart.x,
        y: drawingStart.y,
        width: normX - drawingStart.x,
        height: normY - drawingStart.y,
        strokeColor: currentColor,
        strokeWidth: currentStrokeWidth,
        strokeStyle: currentLineStyle,
      };
    } else if (
      currentTool === "rect" ||
      currentTool === "circle" ||
      currentTool === "triangle" ||
      currentTool === "cross"
    ) {
      newShape = {
        id: shapeId,
        type: currentTool,
        x: Math.min(drawingStart.x, normX),
        y: Math.min(drawingStart.y, normY),
        width: Math.abs(normX - drawingStart.x),
        height: Math.abs(normY - drawingStart.y),
        strokeColor: currentColor,
        strokeWidth: currentStrokeWidth,
      };
    } else if (currentTool === "text") {
      const promptText = window.prompt("Digite o texto da anotação:");
      if (promptText && promptText.trim()) {
        newShape = {
          id: shapeId,
          type: "text",
          x: normX,
          y: normY,
          text: promptText.trim(),
          strokeColor: currentColor,
          strokeWidth: currentStrokeWidth,
        };
      }
    }

    if (newShape) {
      pushStateToHistory([...shapes, newShape]);
    }

    setDrawingStart(null);
    setCurrentPoints([]);
  };

  const handleSavePin = (updated: Partial<ClinicalAnnotationShape>) => {
    if (!selectedPin) return;
    const exists = shapes.some((s) => s.id === selectedPin.id);
    let nextShapes: ClinicalAnnotationShape[];

    if (exists) {
      nextShapes = shapes.map((s) => (s.id === selectedPin.id ? { ...s, ...updated } : s));
    } else {
      nextShapes = [...shapes, { ...selectedPin, ...updated }];
    }

    pushStateToHistory(nextShapes);
    setSelectedPin(null);
  };

  const handleDeletePin = () => {
    if (!selectedPin) return;
    const nextShapes = shapes
      .filter((s) => s.id !== selectedPin.id)
      .map((s, idx) => (s.type === "pin" ? { ...s, pinNumber: idx + 1 } : s));
    pushStateToHistory(nextShapes);
    setSelectedPin(null);
  };

  const handleSaveAndClose = () => {
    if (!initialValue) return;
    onSave({
      ...initialValue,
      annotations: shapes,
      updatedAt: new Date().toISOString(),
    });
    onOpenChange(false);
  };

  const pinCount = shapes.filter((s) => s.type === "pin").length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl w-full h-[92vh] max-h-[92vh] flex flex-col p-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="p-4 border-b shrink-0 bg-background/95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
                <Badge variant="outline" className="text-xs">
                  {pinCount} {pinCount === 1 ? "Ponto Marcado" : "Pontos Marcados"}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          {/* Barra de Ferramentas Estilo Flameshot/Gnome */}
          <AnnotatorToolbar
            currentTool={currentTool}
            onSelectTool={setCurrentTool}
            currentColor={currentColor}
            onSelectColor={setCurrentColor}
            currentStrokeWidth={currentStrokeWidth}
            onSelectStrokeWidth={setCurrentStrokeWidth}
            currentLineStyle={currentLineStyle}
            onSelectLineStyle={setCurrentLineStyle}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClearAll={handleClearAll}
          />

          {/* Área de Visualização e Canvas */}
          <div
            ref={containerRef}
            className="flex-1 min-h-0 bg-slate-950/90 relative flex items-center justify-center p-2 overflow-hidden touch-none"
          >
            {initialValue?.baseImageUrl ? (
              <canvas
                ref={canvasRef}
                width={initialValue.baseImageWidth || 1200}
                height={initialValue.baseImageHeight || 800}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className="max-h-full max-w-full object-contain cursor-crosshair rounded-md shadow-2xl"
                style={{ touchAction: "none" }}
              />
            ) : (
              <div className="text-muted-foreground text-sm">Nenhuma imagem carregada.</div>
            )}
          </div>

          {/* Rodapé de Ações */}
          <DialogFooter className="p-3 border-t bg-background shrink-0 flex items-center justify-between sm:justify-between">
            <div className="text-xs text-muted-foreground">
              Dica: Clique com a ferramenta <strong>Ponto</strong> para marcar e legendar regiões anatômicas.
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={handleSaveAndClose}>
                Concluir Anotações
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Configuração do Pin */}
      <PinLabelDialog
        open={isPinDialogOpen}
        onOpenChange={setIsPinDialogOpen}
        pinShape={selectedPin}
        onSave={handleSavePin}
        onDelete={handleDeletePin}
      />
    </>
  );
};
