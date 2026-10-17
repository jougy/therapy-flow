import React from "react";
import { Folder, HelpCircle, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnamnesisField } from "@/lib/anamnesis-forms";

export interface CanvasEmptyStateProps {
  handleAddField: (type: AnamnesisField["type"], customTargetGroupKey?: string | null) => void;
  setGuideModalOpen: (open: boolean) => void;
}

export const CanvasEmptyState: React.FC<CanvasEmptyStateProps> = ({
  handleAddField,
  setGuideModalOpen,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4 max-w-lg mx-auto">
      <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4 text-primary shadow-xs">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <div className="space-y-1.5">
        <h3 className="font-bold text-base text-foreground">Sua ficha está pronta para ser montada!</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Clique nos componentes da biblioteca à esquerda para adicionar perguntas, ou comece com um dos
          atalhos rápidos abaixo.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs gap-1.5 hover:border-primary/50 hover:bg-primary/5"
          onClick={() => handleAddField("short_text", null)}
        >
          <Plus className="h-3.5 w-3.5 text-primary" />
          + Pergunta de Texto
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs gap-1.5 hover:border-primary/50 hover:bg-primary/5"
          onClick={() => handleAddField("section", null)}
        >
          <Folder className="h-3.5 w-3.5 text-primary" />
          + Nova Seção
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs gap-1.5 text-primary hover:bg-primary/10"
          onClick={() => setGuideModalOpen(true)}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Como Funciona?
        </Button>
      </div>
    </div>
  );
};
