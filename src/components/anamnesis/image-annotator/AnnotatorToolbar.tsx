import React from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowUpRight,
  Circle,
  Highlighter,
  Minus,
  MousePointer,
  MapPin,
  Pencil,
  RotateCcw,
  RotateCw,
  Square,
  Triangle,
  Type,
  X,
  Trash2,
} from "lucide-react";
import {
  CLINICAL_PALETTE_COLORS,
  type ClinicalAnnotationTool,
  type ClinicalLineStyle,
} from "@/lib/image-annotation-vector";
import { cn } from "@/lib/utils";

export interface AnnotatorToolbarProps {
  currentTool: ClinicalAnnotationTool;
  onSelectTool: (tool: ClinicalAnnotationTool) => void;
  currentColor: string;
  onSelectColor: (color: string) => void;
  currentStrokeWidth: number;
  onSelectStrokeWidth: (width: number) => void;
  currentLineStyle: ClinicalLineStyle;
  onSelectLineStyle: (style: ClinicalLineStyle) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearAll: () => void;
}

export const AnnotatorToolbar: React.FC<AnnotatorToolbarProps> = ({
  currentTool,
  onSelectTool,
  currentColor,
  onSelectColor,
  currentStrokeWidth,
  onSelectStrokeWidth,
  currentLineStyle,
  onSelectLineStyle,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClearAll,
}) => {
  const tools: { id: ClinicalAnnotationTool; label: string; icon: React.ElementType }[] = [
    { id: "select", label: "Mover / Selecionar", icon: MousePointer },
    { id: "pen", label: "Caneta livre", icon: Pencil },
    { id: "highlighter", label: "Marca-texto", icon: Highlighter },
    { id: "pin", label: "Ponto clínico / Tag", icon: MapPin },
    { id: "arrow", label: "Seta", icon: ArrowUpRight },
    { id: "line", label: "Linha", icon: Minus },
    { id: "circle", label: "Círculo", icon: Circle },
    { id: "rect", label: "Retângulo", icon: Square },
    { id: "triangle", label: "Triângulo", icon: Triangle },
    { id: "cross", label: "Cruz / Alerta", icon: X },
    { id: "text", label: "Texto", icon: Type },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 p-2.5 backdrop-blur-md">
      {/* Ferramentas de Desenho */}
      <div className="flex flex-wrap items-center gap-1">
        {tools.map((t) => {
          const Icon = t.icon;
          const isActive = currentTool === t.id;
          return (
            <Button
              key={t.id}
              type="button"
              variant={isActive ? "default" : "ghost"}
              size="sm"
              title={t.label}
              onClick={() => onSelectTool(t.id)}
              className={cn("h-8 px-2.5 gap-1.5 text-xs", isActive ? "shadow-sm" : "")}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </Button>
          );
        })}
      </div>

      {/* Linha / Estilo / Cores / Undo / Redo */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Estilo de traço (sólido, tracejado, pontilhado) */}
        {(currentTool === "line" || currentTool === "arrow") && (
          <div className="flex items-center rounded-md border bg-background p-0.5">
            <Button
              type="button"
              size="xs"
              variant={currentLineStyle === "solid" ? "secondary" : "ghost"}
              onClick={() => onSelectLineStyle("solid")}
              className="text-[11px] h-6 px-1.5"
            >
              Sólida
            </Button>
            <Button
              type="button"
              size="xs"
              variant={currentLineStyle === "dashed" ? "secondary" : "ghost"}
              onClick={() => onSelectLineStyle("dashed")}
              className="text-[11px] h-6 px-1.5"
            >
              Tracejada
            </Button>
            <Button
              type="button"
              size="xs"
              variant={currentLineStyle === "dotted" ? "secondary" : "ghost"}
              onClick={() => onSelectLineStyle("dotted")}
              className="text-[11px] h-6 px-1.5"
            >
              Pontilhada
            </Button>
          </div>
        )}

        {/* Cores Clínicas Rápidas */}
        <div className="flex items-center gap-1 px-1 py-0.5 rounded-full border bg-background/80 shadow-2xs">
          {CLINICAL_PALETTE_COLORS.slice(0, 6).map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.label}
              onClick={() => onSelectColor(c.hex)}
              className={cn(
                "h-5 w-5 rounded-full transition-transform focus:outline-hidden",
                currentColor === c.hex ? "scale-125 ring-2 ring-primary ring-offset-1" : "hover:scale-110"
              )}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>

        {/* Undo / Redo / Clear */}
        <div className="flex items-center gap-1 border-l pl-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Desfazer (Ctrl+Z)"
            disabled={!canUndo}
            onClick={onUndo}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Refazer (Ctrl+Y)"
            disabled={!canRedo}
            onClick={onRedo}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:bg-destructive/10"
            title="Limpar anotações"
            onClick={onClearAll}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
