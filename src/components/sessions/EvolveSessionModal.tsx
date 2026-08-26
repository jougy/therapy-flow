import { useState, useEffect } from "react";
import { Copy, Sparkles, X, Loader2, FileText, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type DatabaseAnamnesisTemplate = Database["public"]["Tables"]["anamnesis_form_templates"]["Row"];

export interface EvolveSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEvolveCopy: () => Promise<void> | void;
  onEvolveBlank: (templateId: string | null) => Promise<void> | void;
  templates?: DatabaseAnamnesisTemplate[];
  defaultTemplateId?: string | null;
  isEvolving?: boolean;
}

export const EvolveSessionModal = ({
  isOpen,
  onClose,
  onEvolveCopy,
  onEvolveBlank,
  templates = [],
  defaultTemplateId = null,
  isEvolving = false,
}: EvolveSessionModalProps) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(defaultTemplateId);

  useEffect(() => {
    if (defaultTemplateId) {
      setSelectedTemplateId(defaultTemplateId);
    } else if (templates.length > 0) {
      setSelectedTemplateId(templates[0].id);
    } else {
      setSelectedTemplateId(null);
    }
  }, [defaultTemplateId, templates, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isEvolving && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg p-5 sm:p-6 overflow-hidden rounded-2xl">
        <DialogHeader className="space-y-1.5 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            <span>Evoluir Atendimento</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            Escolha como deseja iniciar a evolução deste caso no histórico do paciente:
          </DialogDescription>
        </DialogHeader>

        {templates.length > 1 && (
          <div className="space-y-1.5 py-1">
            <Label htmlFor="evolve-template-select" className="text-xs font-semibold text-muted-foreground">
              Formulário / Ficha (para ficha em branco):
            </Label>
            <Select
              value={selectedTemplateId ?? "default"}
              onValueChange={(val) => setSelectedTemplateId(val === "default" ? null : val)}
              disabled={isEvolving}
            >
              <SelectTrigger id="evolve-template-select" className="h-9 text-xs">
                <SelectValue placeholder="Selecione o formulário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Formulário padrão da clínica</SelectItem>
                {templates.map((tmpl) => (
                  <SelectItem key={tmpl.id} value={tmpl.id}>
                    {tmpl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-3 pt-2">
          {/* Opção 1: Iniciar a partir deste (Duplicar) */}
          <button
            type="button"
            className="w-full text-left rounded-xl border border-primary/30 bg-card p-3.5 sm:p-4 hover:border-primary hover:bg-primary/5 transition-all duration-150 cursor-pointer shadow-2xs group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none"
            onClick={() => void onEvolveCopy()}
            disabled={isEvolving}
          >
            <div className="flex items-start gap-3 w-full">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Copy className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm sm:text-base text-foreground leading-tight">
                    Iniciar atendimento a partir deste
                  </p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-normal break-words">
                  Duplica os dados clínicos, queixas e testes da sessão anterior para você apenas ajustar a evolução.
                </p>
              </div>
            </div>
          </button>

          {/* Opção 2: Iniciar em branco */}
          <button
            type="button"
            className="w-full text-left rounded-xl border border-border bg-card p-3.5 sm:p-4 hover:border-primary/60 hover:bg-accent/40 transition-all duration-150 cursor-pointer shadow-2xs group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none"
            onClick={() => void onEvolveBlank(selectedTemplateId)}
            disabled={isEvolving}
          >
            <div className="flex items-start gap-3 w-full">
              <div className="p-2.5 rounded-xl bg-muted text-muted-foreground shrink-0 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm sm:text-base text-foreground leading-tight">
                    Iniciar atendimento em branco
                  </p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-normal break-words">
                  Abre uma ficha limpa vinculada ao mesmo ciclo para registrar uma nova avaliação ou conduta do zero.
                </p>
              </div>
            </div>
          </button>

          {/* Opção 3: Cancelar */}
          <div className="pt-1 flex justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-9 text-xs gap-1.5 px-4 rounded-lg"
              onClick={onClose}
              disabled={isEvolving}
            >
              {isEvolving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              <span>{isEvolving ? "Criando evolução..." : "Cancelar"}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
