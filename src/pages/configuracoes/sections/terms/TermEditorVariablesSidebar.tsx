import React, { useMemo, useState } from "react";
import {
  Sparkles,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SUGGESTED_TERM_VARIABLES,
  type TermVariableDefinition,
} from "@/lib/termVariables";

const CATEGORY_LABELS: Record<TermVariableDefinition["category"], string> = {
  paciente: "Paciente",
  responsavel: "Responsável",
  colaborador: "Colaborador",
  owner: "Owner",
  clinica: "Clínica",
  sessao: "Sessão",
  sistema: "Sistema",
};

const CATEGORY_ORDER: TermVariableDefinition["category"][] = [
  "paciente",
  "responsavel",
  "colaborador",
  "owner",
  "clinica",
  "sessao",
  "sistema",
];

interface TermEditorVariablesSidebarProps {
  onInsertVariable: (variableKey: string) => void;
}

export const TermEditorVariablesSidebar: React.FC<TermEditorVariablesSidebarProps> = ({
  onInsertVariable,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    "all" | TermVariableDefinition["category"]
  >("all");

  const sortedVariables = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...SUGGESTED_TERM_VARIABLES]
      .filter((v) => {
        if (selectedCategory !== "all" && v.category !== selectedCategory) {
          return false;
        }
        if (!q) return true;
        return (
          v.key.toLowerCase().includes(q) ||
          v.label.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [search, selectedCategory]);

  if (!open) {
    return (
      <button
        type="button"
        data-variables-sidebar="true"
        onClick={() => setOpen(true)}
        title="Abrir painel de variáveis dinâmicas"
        className="fixed right-0 top-1/2 -translate-y-1/2 z-[60] pointer-events-auto flex flex-col items-center justify-center gap-1.5 py-4 px-2 rounded-l-xl border border-r-0 border-primary/30 bg-background/95 backdrop-blur-md shadow-lg hover:bg-primary/5 transition-colors"
      >
        <PanelRightOpen className="w-4 h-4 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-primary [writing-mode:vertical-rl] rotate-180 select-none">
          Variáveis
        </span>
      </button>
    );
  }

  return (
    <aside
      data-variables-sidebar="true"
      className="fixed right-0 top-1/2 -translate-y-1/2 z-[60] pointer-events-auto w-[85vw] max-w-[320px] sm:w-80 h-[82dvh] max-h-[640px] border border-r-0 rounded-l-2xl bg-background/95 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden"
    >
      <div className="p-3 border-b space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Variáveis Dinâmicas</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setOpen(false)}
            title="Recolher painel de variáveis"
          >
            <PanelRightClose className="w-4 h-4" />
          </Button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar variável..."
            className="h-7 text-xs pl-8 bg-background"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          <Button
            type="button"
            size="sm"
            variant={selectedCategory === "all" ? "default" : "outline"}
            className="h-6 text-[11px] shrink-0 rounded-full px-2.5"
            onClick={() => setSelectedCategory("all")}
          >
            Todas
          </Button>
          {CATEGORY_ORDER.map((cat) => (
            <Button
              key={cat}
              type="button"
              size="sm"
              variant={selectedCategory === cat ? "default" : "outline"}
              className="h-6 text-[11px] shrink-0 rounded-full px-2.5"
              onClick={() => setSelectedCategory(cat)}
            >
              {CATEGORY_LABELS[cat]}
            </Button>
          ))}
        </div>
      </div>

      <div
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-2 space-y-1"
      >
        {sortedVariables.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Nenhuma variável encontrada.
          </p>
        ) : (
          sortedVariables.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => onInsertVariable(v.key)}
              title={`${v.description} (Ex: ${v.example})`}
              className="w-full text-left flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-transparent hover:border-primary/30 hover:bg-primary/5 transition-colors group"
            >
              <div className="min-w-0 flex-1">
                <code className="text-[11px] font-mono font-semibold text-primary block truncate">
                  {v.key}
                </code>
                <span className="text-[11px] text-muted-foreground block truncate">
                  {v.label}
                </span>
              </div>
              <Plus className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
            </button>
          ))
        )}
      </div>
    </aside>
  );
};
