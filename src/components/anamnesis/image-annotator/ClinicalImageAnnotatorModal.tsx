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
  hitTestAnnotationShape,
  normalizeCoordinate,
  renderAnnotationsToCanvasContext,
  translateAnnotationShape,
  type ClinicalAnnotationShape,
  type ClinicalAnnotationTool,
  type ClinicalImageAnnotationValue,
  type ClinicalLineStyle,
} from "@/lib/image-annotation-vector";
import { AnnotatorToolbar } from "./AnnotatorToolbar";
import { PinLabelDialog } from "./PinLabelDialog";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit2 } from "lucide-react";

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

  // Seleção, arraste e interação com Pin / Formas
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [draggingShapeId, setDraggingShapeId] = useState<string | null>(null);
  const [dragOrigin, setDragOrigin] = useState<{ x: number; y: number } | null>(null);
  const [dragLastPos, setDragLastPos] = useState<{ x: number; y: number } | null>(null);
  const [hasMovedDuringDrag, setHasMovedDuringDrag] = useState<boolean>(false);

  const [selectedPin, setSelectedPin] = useState<ClinicalAnnotationShape | null>(null);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState<boolean>(false);
  const [hoverShapeId, setHoverShapeId] = useState<string | null>(null);

  // Estado de desenho em andamento (com preview ao vivo)
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawingStart, setDrawingStart] = useState<{ x: number; y: number } | null>(null);
  const [drawingCurrent, setDrawingCurrent] = useState<{ x: number; y: number } | null>(null);
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
      setSelectedShapeId(null);
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
      setSelectedShapeId(null);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setShapes(history[nextIdx]);
      setSelectedShapeId(null);
    }
  }, [history, historyIndex]);

  const handleClearAll = useCallback(() => {
    pushStateToHistory([]);
    setSelectedShapeId(null);
  }, [pushStateToHistory]);

  const handleDeleteSelectedShape = useCallback(() => {
    if (!selectedShapeId) return;
    let pinCounter = 1;
    const nextShapes = shapes
      .filter((s) => s.id !== selectedShapeId)
      .map((s) => (s.type === "pin" ? { ...s, pinNumber: pinCounter++ } : s));
    pushStateToHistory(nextShapes);
    setSelectedShapeId(null);
  }, [selectedShapeId, shapes, pushStateToHistory]);

  // Atalho Delete / Backspace para remover elemento selecionado
  useEffect(() => {
    if (!open || isPinDialogOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedShapeId) {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag === "input" || activeTag === "textarea") return;
        e.preventDefault();
        handleDeleteSelectedShape();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isPinDialogOpen, selectedShapeId, handleDeleteSelectedShape]);

  // Constrói forma temporária para pré-visualização em tempo real enquanto arrasta
  const buildLivePreviewShape = useCallback((): ClinicalAnnotationShape | null => {
    if (!isDrawing || !drawingStart) return null;
    const curr = drawingCurrent || drawingStart;

    if (currentTool === "pen" || currentTool === "highlighter") {
      if (currentPoints.length === 0) return null;
      return {
        id: "__preview__",
        type: currentTool === "pen" ? "freehand" : "highlighter",
        x: drawingStart.x,
        y: drawingStart.y,
        points: currentPoints.length === 1 ? [currentPoints[0], [curr.x, curr.y]] : currentPoints,
        strokeColor: currentColor,
        strokeWidth: currentStrokeWidth,
        strokeStyle: currentLineStyle,
      };
    }

    if (currentTool === "line" || currentTool === "arrow") {
      return {
        id: "__preview__",
        type: currentTool,
        x: drawingStart.x,
        y: drawingStart.y,
        width: curr.x - drawingStart.x,
        height: curr.y - drawingStart.y,
        strokeColor: currentColor,
        strokeWidth: currentStrokeWidth,
        strokeStyle: currentLineStyle,
      };
    }

    if (
      currentTool === "rect" ||
      currentTool === "circle" ||
      currentTool === "triangle" ||
      currentTool === "cross"
    ) {
      return {
        id: "__preview__",
        type: currentTool,
        x: Math.min(drawingStart.x, curr.x),
        y: Math.min(drawingStart.y, curr.y),
        width: Math.abs(curr.x - drawingStart.x),
        height: Math.abs(curr.y - drawingStart.y),
        strokeColor: currentColor,
        strokeWidth: currentStrokeWidth,
        strokeStyle: currentLineStyle,
      };
    }

    return null;
  }, [
    isDrawing,
    drawingStart,
    drawingCurrent,
    currentTool,
    currentPoints,
    currentColor,
    currentStrokeWidth,
    currentLineStyle,
  ]);

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
      selectedShapeId,
      hoverShapeId,
    });

    // Desenha prévia em tempo real da forma sendo desenhada
    const previewShape = buildLivePreviewShape();
    if (previewShape) {
      renderAnnotationsToCanvasContext(ctx, [previewShape], canvas.width, canvas.height);
    }
  }, [loadedImage, shapes, selectedShapeId, hoverShapeId, buildLivePreviewShape]);

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

  const findTopmostHitShape = (normX: number, normY: number): ClinicalAnnotationShape | null => {
    for (let i = shapes.length - 1; i >= 0; i--) {
      if (hitTestAnnotationShape(shapes[i], normX, normY)) {
        return shapes[i];
      }
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const { normX, normY } = getCanvasCoordinates(e);

    // 1. Modo Mover / Selecionar
    if (currentTool === "select") {
      const hitShape = findTopmostHitShape(normX, normY);
      if (hitShape) {
        setSelectedShapeId(hitShape.id);
        setDraggingShapeId(hitShape.id);
        setDragOrigin({ x: normX, y: normY });
        setDragLastPos({ x: normX, y: normY });
        setHasMovedDuringDrag(false);
      } else {
        setSelectedShapeId(null);
        setDraggingShapeId(null);
      }
      return;
    }

    // 2. Se a ferramenta for Pin, verifica se clicou num Pin existente para editar ou cria um novo
    if (currentTool === "pin") {
      const existingPin = shapes.find(
        (s) => s.type === "pin" && Math.hypot(s.x - normX, s.y - normY) <= 32
      );
      if (existingPin) {
        setSelectedPin(existingPin);
        setIsPinDialogOpen(true);
        return;
      }

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

    // 3. Ferramenta de Texto: abre prompt imediato ao clicar
    if (currentTool === "text") {
      const promptText = window.prompt("Digite o texto da anotação:");
      if (promptText && promptText.trim()) {
        const newShape: ClinicalAnnotationShape = {
          id: `shape_${Date.now()}`,
          type: "text",
          x: normX,
          y: normY,
          text: promptText.trim(),
          strokeColor: currentColor,
          strokeWidth: currentStrokeWidth,
        };
        pushStateToHistory([...shapes, newShape]);
        setSelectedShapeId(newShape.id);
      }
      return;
    }

    // 4. Demais ferramentas de desenho e formas
    setSelectedShapeId(null);
    setIsDrawing(true);
    setDrawingStart({ x: normX, y: normY });
    setDrawingCurrent({ x: normX, y: normY });
    if (currentTool === "pen" || currentTool === "highlighter") {
      setCurrentPoints([[normX, normY]]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { normX, normY } = getCanvasCoordinates(e);

    // Se estiver arrastando um elemento no modo 'select'
    if (currentTool === "select" && draggingShapeId && dragLastPos && dragOrigin) {
      const deltaX = normX - dragLastPos.x;
      const deltaY = normY - dragLastPos.y;
      if (Math.hypot(normX - dragOrigin.x, normY - dragOrigin.y) > 4) {
        setHasMovedDuringDrag(true);
      }
      if (deltaX !== 0 || deltaY !== 0) {
        setShapes((prev) =>
          prev.map((s) =>
            s.id === draggingShapeId ? translateAnnotationShape(s, deltaX, deltaY) : s
          )
        );
        setDragLastPos({ x: normX, y: normY });
      }
      return;
    }

    // Hover detect em elementos quando na ferramenta 'select' ou em pins
    if (!isDrawing) {
      if (currentTool === "select") {
        const hovered = findTopmostHitShape(normX, normY);
        setHoverShapeId(hovered ? hovered.id : null);
      } else {
        const hoveredPin = shapes.find(
          (s) => s.type === "pin" && Math.hypot(s.x - normX, s.y - normY) <= 32
        );
        setHoverShapeId(hoveredPin ? hoveredPin.id : null);
      }
      return;
    }

    if (!drawingStart) return;

    setDrawingCurrent({ x: normX, y: normY });

    if (currentTool === "pen" || currentTool === "highlighter") {
      setCurrentPoints((prev) => [...prev, [normX, normY]]);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { normX, normY } = getCanvasCoordinates(e);

    // Finalizando arraste na ferramenta 'select'
    if (currentTool === "select") {
      if (draggingShapeId) {
        const draggedShape = shapes.find((s) => s.id === draggingShapeId);
        if (hasMovedDuringDrag) {
          pushStateToHistory(shapes);
        } else if (draggedShape?.type === "pin") {
          // Clique simples em Pin no modo selecionar abre edição da legenda
          setSelectedPin(draggedShape);
          setIsPinDialogOpen(true);
        } else if (draggedShape?.type === "text") {
          // Clique simples em Texto já selecionado permite editar o texto
          if (selectedShapeId === draggedShape.id) {
            const nextText = window.prompt("Editar texto da anotação:", draggedShape.text || "");
            if (nextText !== null && nextText.trim()) {
              pushStateToHistory(
                shapes.map((s) => (s.id === draggedShape.id ? { ...s, text: nextText.trim() } : s))
              );
            }
          }
        }
      }
      setDraggingShapeId(null);
      setDragOrigin(null);
      setDragLastPos(null);
      setHasMovedDuringDrag(false);
      return;
    }

    if (!isDrawing || !drawingStart) return;
    setIsDrawing(false);

    let newShape: ClinicalAnnotationShape | null = null;
    const shapeId = `shape_${Date.now()}`;

    if (currentTool === "pen" || currentTool === "highlighter") {
      const pts: [number, number][] =
        currentPoints.length > 1
          ? currentPoints
          : [
              [drawingStart.x, drawingStart.y],
              [normX === drawingStart.x ? normX + 1 : normX, normY === drawingStart.y ? normY + 1 : normY],
            ];
      newShape = {
        id: shapeId,
        type: currentTool === "pen" ? "freehand" : "highlighter",
        x: drawingStart.x,
        y: drawingStart.y,
        points: pts,
        strokeColor: currentColor,
        strokeWidth: currentStrokeWidth,
        strokeStyle: currentLineStyle,
      };
    } else if (currentTool === "line" || currentTool === "arrow") {
      const w = normX - drawingStart.x;
      const h = normY - drawingStart.y;
      if (Math.hypot(w, h) >= 5) {
        newShape = {
          id: shapeId,
          type: currentTool,
          x: drawingStart.x,
          y: drawingStart.y,
          width: w,
          height: h,
          strokeColor: currentColor,
          strokeWidth: currentStrokeWidth,
          strokeStyle: currentLineStyle,
        };
      }
    } else if (
      currentTool === "rect" ||
      currentTool === "circle" ||
      currentTool === "triangle" ||
      currentTool === "cross"
    ) {
      const w = Math.abs(normX - drawingStart.x);
      const h = Math.abs(normY - drawingStart.y);
      if (w >= 4 || h >= 4) {
        newShape = {
          id: shapeId,
          type: currentTool,
          x: Math.min(drawingStart.x, normX),
          y: Math.min(drawingStart.y, normY),
          width: Math.max(8, w),
          height: Math.max(8, h),
          strokeColor: currentColor,
          strokeWidth: currentStrokeWidth,
          strokeStyle: currentLineStyle,
        };
      }
    }

    if (newShape) {
      pushStateToHistory([...shapes, newShape]);
    }

    setDrawingStart(null);
    setDrawingCurrent(null);
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
    let pinCounter = 1;
    const nextShapes = shapes
      .filter((s) => s.id !== selectedPin.id)
      .map((s) => (s.type === "pin" ? { ...s, pinNumber: pinCounter++ } : s));
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
  const activeSelectedShape = shapes.find((s) => s.id === selectedShapeId) || null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl w-full h-[92dvh] max-h-[92dvh] flex flex-col p-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="p-3 sm:p-4 border-b shrink-0 bg-background/95">
            <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
                <Badge variant="outline" className="text-xs">
                  {pinCount} {pinCount === 1 ? "Ponto Marcado" : "Pontos Marcados"}
                </Badge>
                {shapes.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {shapes.length} {shapes.length === 1 ? "elemento" : "elementos"}
                  </Badge>
                )}
              </div>

              {activeSelectedShape && (
                <div className="flex items-center gap-1.5">
                  {activeSelectedShape.type === "pin" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => {
                        setSelectedPin(activeSelectedShape);
                        setIsPinDialogOpen(true);
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                      Editar Ponto
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs gap-1"
                    onClick={handleDeleteSelectedShape}
                  >
                    <Trash2 className="h-3 w-3" />
                    Excluir Selecionado
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Barra de Ferramentas Estilo Flameshot/Gnome */}
          <AnnotatorToolbar
            currentTool={currentTool}
            onSelectTool={setCurrentTool}
            currentColor={currentColor}
            onSelectColor={(color) => {
              setCurrentColor(color);
              if (selectedShapeId) {
                pushStateToHistory(
                  shapes.map((s) => (s.id === selectedShapeId ? { ...s, strokeColor: color } : s))
                );
              }
            }}
            currentStrokeWidth={currentStrokeWidth}
            onSelectStrokeWidth={(width) => {
              setCurrentStrokeWidth(width);
              if (selectedShapeId) {
                pushStateToHistory(
                  shapes.map((s) => (s.id === selectedShapeId ? { ...s, strokeWidth: width } : s))
                );
              }
            }}
            currentLineStyle={currentLineStyle}
            onSelectLineStyle={(style) => {
              setCurrentLineStyle(style);
              if (selectedShapeId) {
                pushStateToHistory(
                  shapes.map((s) => (s.id === selectedShapeId ? { ...s, strokeStyle: style } : s))
                );
              }
            }}
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
                className={`max-h-full max-w-full object-contain rounded-md shadow-2xl ${
                  currentTool === "select"
                    ? draggingShapeId
                      ? "cursor-grabbing"
                      : hoverShapeId
                      ? "cursor-grab"
                      : "cursor-default"
                    : "cursor-crosshair"
                }`}
                style={{ touchAction: "none" }}
              />
            ) : (
              <div className="text-muted-foreground text-sm">Nenhuma imagem carregada.</div>
            )}
          </div>

          {/* Rodapé de Ações */}
          <DialogFooter className="p-3 border-t bg-background shrink-0 flex items-center justify-between sm:justify-between">
            <div className="text-xs text-muted-foreground">
              {currentTool === "select" ? (
                <span>
                  Clique e arraste qualquer desenho ou ponto para mover. Clique em um{" "}
                  <strong>Ponto</strong> para editar sua legenda.
                </span>
              ) : (
                <span>
                  Dica: Use <strong>Mover / Selecionar</strong> para arrastar elementos ou{" "}
                  <strong>Ponto</strong> para marcar regiões anatômicas.
                </span>
              )}
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
