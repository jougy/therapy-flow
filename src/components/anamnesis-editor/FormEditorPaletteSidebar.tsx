import React from "react";
import { Layers3, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { COMPONENT_CATEGORIES } from "./types";
import type { AnamnesisField } from "@/lib/anamnesis-forms";

const getCategorySlug = (name: string) => {
  if (name.includes("Básic")) return "basicos";
  if (name.includes("Opç")) return "opcoes";
  if (name.includes("Estrut")) return "estrutura";
  if (name.includes("Espec")) return "especiais";
  return name.toLowerCase().replace(/[^a-z0-9]/g, "-");
};

export interface FormEditorPaletteSidebarProps {
  flowSidebarCollapsed: boolean;
  setFlowSidebarCollapsed: (collapsed: boolean) => void;
  handleAddField: (type: AnamnesisField["type"]) => void;
  setDraggedNewFieldType: (type: AnamnesisField["type"] | null) => void;
  isBase?: boolean;
}

export const FormEditorPaletteSidebar: React.FC<FormEditorPaletteSidebarProps> = ({
  flowSidebarCollapsed,
  setFlowSidebarCollapsed,
  handleAddField,
  setDraggedNewFieldType,
  isBase = false,
}) => {
  return (
    <Card
      data-tutorial="form-editor-palette"
      className={`flex flex-col h-full max-h-full overflow-hidden border-border/70 bg-background/95 shadow-sm ${
        flowSidebarCollapsed ? "w-full" : ""
      }`}
    >
      {flowSidebarCollapsed ? (
        <CardContent className="flex flex-col items-center gap-3 p-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Expandir menu de componentes"
            onClick={() => setFlowSidebarCollapsed(false)}
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Layers3 className="h-4 w-4" />
          </div>
          <div className="flex flex-col items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="[writing-mode:vertical-rl]">Componentes</span>
          </div>
        </CardContent>
      ) : (
        <>
          <CardHeader className="shrink-0 space-y-1 border-b bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Componentes</CardTitle>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Recolher menu de componentes"
                onClick={() => setFlowSidebarCollapsed(true)}
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Clique para adicionar ou arraste para a posição desejada.</p>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 space-y-4 p-3 overflow-y-auto">
            {COMPONENT_CATEGORIES.map((category) => {
              const catSlug = getCategorySlug(category.name);
              return (
                <div key={category.name} data-tutorial={`form-palette-cat-${catSlug}`} className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/90">
                      {category.name}
                    </p>
                    <ComponentHelpButton helpId={`form-palette-cat-${catSlug}`} size="xs" />
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {category.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.type}
                          data-tutorial={`form-palette-item-${item.type}`}
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("application/x-form-new-field-type", item.type);
                            setDraggedNewFieldType(item.type);
                          }}
                          onDragEnd={() => setDraggedNewFieldType(null)}
                          onClick={() => handleAddField(item.type)}
                          className="group flex items-center justify-between rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-left transition hover:border-primary/60 hover:bg-primary/5 hover:shadow-xs cursor-pointer active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/70 text-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold leading-tight text-foreground">
                                {item.label}
                              </p>
                              <p className="truncate text-[10px] text-muted-foreground">{item.description}</p>
                            </div>
                          </div>
                          <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100 group-hover:text-primary transition-all" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {isBase && (
              <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                No bloco padrão universal, você pode manter os campos fixos, adicionar novos campos e escolher quais
                aparecem no bloco de atendimentos do paciente.
              </p>
            )}
          </CardContent>
        </>
      )}
    </Card>
  );
};
