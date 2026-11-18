import React from "react";
import { Copy, Check, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DismissibleInfoTip } from "@/components/ui/dismissible-info-tip";
import { SUGGESTED_TERM_VARIABLES, type TermVariableDefinition } from "@/lib/termVariables";
import { toast } from "@/hooks/use-toast";

const CATEGORY_LABELS: Record<TermVariableDefinition["category"], string> = {
  paciente: "Paciente",
  responsavel: "Responsável Legal",
  colaborador: "Colaborador",
  owner: "Proprietário (Owner)",
  clinica: "Clínica",
  sessao: "Sessão",
  sistema: "Sistema (Data e Hora)",
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

interface VariablesHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectVariable?: (variableKey: string) => void;
}

export const VariablesHelpDialog: React.FC<VariablesHelpDialogProps> = ({
  open,
  onOpenChange,
  onSelectVariable,
}) => {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = React.useState<
    "all" | TermVariableDefinition["category"]
  >("all");

  const handleCopy = (key: string) => {
    void navigator.clipboard.writeText(key);
    setCopiedKey(key);
    toast({
      title: "Copiado!",
      description: `Variável ${key} copiada para a área de transferência.`,
    });
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const categoriesToRender =
    selectedCategory === "all" ? CATEGORY_ORDER : [selectedCategory];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88dvh] flex flex-col p-0 overflow-hidden rounded-2xl bg-background border shadow-xl">
        <DialogHeader className="p-5 pb-3 border-b space-y-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <DialogTitle className="text-base font-bold">
              Catálogo de Variáveis Dinâmicas
            </DialogTitle>
          </div>
          <DismissibleInfoTip id="variables-catalog-intro">
            Insira tags no formato <code>&lt;nome_da_variavel&gt;</code> em qualquer termo. Nos atendimentos ou na impressão, o sistema substituirá automaticamente essas tags pelos dados reais do paciente, colaborador ou clínica.
          </DismissibleInfoTip>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5">
            <Button
              type="button"
              size="sm"
              variant={selectedCategory === "all" ? "default" : "outline"}
              className="h-7 text-xs shrink-0 rounded-full px-3"
              onClick={() => setSelectedCategory("all")}
            >
              Todas ({SUGGESTED_TERM_VARIABLES.length})
            </Button>
            {CATEGORY_ORDER.map((cat) => {
              const count = SUGGESTED_TERM_VARIABLES.filter((v) => v.category === cat).length;
              if (count === 0) return null;
              return (
                <Button
                  key={cat}
                  type="button"
                  size="sm"
                  variant={selectedCategory === cat ? "default" : "outline"}
                  className="h-7 text-xs shrink-0 rounded-full px-3"
                  onClick={() => setSelectedCategory(cat)}
                >
                  {CATEGORY_LABELS[cat]} ({count})
                </Button>
              );
            })}
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 p-5 overflow-y-auto overscroll-contain space-y-5">
          {categoriesToRender.map((cat) => {
            const items = SUGGESTED_TERM_VARIABLES.filter((v) => v.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} className="space-y-2">
                <div className="flex items-center gap-2 sticky top-0 bg-background/95 backdrop-blur-sm py-1 z-10">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {CATEGORY_LABELS[cat]}
                  </h3>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    {items.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {items.map((v) => {
                    const isCopied = copiedKey === v.key;
                    return (
                      <div
                        key={v.key}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-card border rounded-xl hover:border-primary/40 transition-colors"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-xs font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                              {v.key}
                            </code>
                            <span className="text-xs font-medium text-foreground">
                              {v.label}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {v.description}
                          </p>
                          <p className="text-[11px] text-muted-foreground/80 italic">
                            Exemplo: {v.example}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          {onSelectVariable && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs text-primary"
                              onClick={() => {
                                onSelectVariable(v.key);
                                onOpenChange(false);
                              }}
                            >
                              Inserir
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5"
                            onClick={() => handleCopy(v.key)}
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copiar</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="p-3 border-t bg-muted/10">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
