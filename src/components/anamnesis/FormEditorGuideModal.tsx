import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Layers,
  FolderPlus,
  Sliders,
  PlayCircle,
  Smartphone,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
} from "lucide-react";

interface FormEditorGuideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GUIDE_STEPS = [
  {
    id: 1,
    title: "1. Escolha e Adicione Perguntas",
    subtitle: "Biblioteca de Componentes",
    icon: Layers,
    color: "from-sky-500 to-blue-600",
    bgLight: "bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800",
    description:
      "Na barra da esquerda, você tem todos os tipos de perguntas prontas: texto para respostas livres, datas, múltipla escolha, lista de opções e notas de 0 a 10.",
    tip: "💡 Como fazer: Basta clicar no botão '+' ao lado de qualquer componente ou arrastá-lo diretamente para a ficha.",
  },
  {
    id: 2,
    title: "2. Agrupe em Seções e Módulos",
    subtitle: "Organização Limpa",
    icon: FolderPlus,
    color: "from-indigo-500 to-violet-600",
    bgLight: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
    description:
      "Use a 'Seção Sanfona' para dividir sua ficha em partes organizadas (por exemplo: 'Dados Gerais', 'Queixa Principal', 'Exame Físico' ou 'Condutas').",
    tip: "💡 Dica: Você também pode usar a 'Seção Horizontal' para colocar 2 ou 3 perguntas curtas lado a lado na mesma linha!",
  },
  {
    id: 3,
    title: "3. Personalize Títulos e Opções",
    subtitle: "Painel de Propriedades",
    icon: Sliders,
    color: "from-amber-500 to-orange-600",
    bgLight: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    description:
      "Clique em qualquer pergunta na tela para abrir o painel de ajustes à direita. Você pode alterar o texto da pergunta, adicionar opções de marcação ou torná-la obrigatória.",
    tip: "💡 Você também pode escolher cores personalizadas para cada seção destacar visualmente no atendimento.",
  },
  {
    id: 4,
    title: "4. Teste Antes de Usar",
    subtitle: "Modo Teste Interativo",
    icon: PlayCircle,
    color: "from-emerald-500 to-teal-600",
    bgLight: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    description:
      "Quer ver como a ficha vai ficar durante uma consulta real? Clique no botão 'Testar Preenchimento' no topo da tela e digite respostas simuladas!",
    tip: "💡 Suas respostas no modo teste não são salvas no paciente; servem apenas para você testar se tudo ficou perfeito.",
  },
  {
    id: 5,
    title: "5. Dicas de Celular e Toque Rápido",
    subtitle: "Praticidade no Mobile",
    icon: Smartphone,
    color: "from-rose-500 to-pink-600",
    bgLight: "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800",
    description:
      "No celular ou tablet, tudo foi pensado para seus dedos. Toque e segure em uma pergunta por 1 segundo para selecionar várias de uma vez e mover ou duplicar juntas.",
    tip: "💡 Se errar alguma coisa, use os botões 'Desfazer' e 'Refazer' no topo para voltar atrás com segurança.",
  },
];

export const FormEditorGuideModal: React.FC<FormEditorGuideModalProps> = ({
  open,
  onOpenChange,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const current = GUIDE_STEPS[activeStep];
  const isLast = activeStep === GUIDE_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onOpenChange(false);
      setActiveStep(0);
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden border-border/80 gap-0">
        {/* Banner Superior Decorativo */}
        <div className="bg-gradient-to-r from-primary/15 via-primary/8 to-transparent p-6 pb-4 border-b border-border/60">
          <DialogHeader>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold tracking-tight">
                  Como Criar e Personalizar Fichas
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Guia passo a passo simples e prático para montar suas fichas clínicas.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Indicadores de Progresso em Pílulas */}
          <div className="flex items-center justify-between gap-1.5 mt-4 pt-2">
            {GUIDE_STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isCurrent = idx === activeStep;
              const isPast = idx < activeStep;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStep(idx)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all border ${
                    isCurrent
                      ? "bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/20"
                      : isPast
                      ? "bg-muted/80 text-foreground border-border/60 hover:bg-muted"
                      : "bg-background/60 text-muted-foreground border-transparent hover:bg-muted/40"
                  }`}
                  title={step.title}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline text-[11px]">Passo {idx + 1}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Conteúdo do Passo Ativo */}
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 border ${current.bgLight}`}
            >
              <current.icon className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {current.subtitle}
              </span>
              <h3 className="text-base font-bold text-foreground tracking-tight">
                {current.title}
              </h3>
            </div>
          </div>

          <p className="text-sm text-foreground/90 leading-relaxed">
            {current.description}
          </p>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground/90 flex items-start gap-2.5">
            <p className="leading-relaxed font-medium">{current.tip}</p>
          </div>
        </div>

        {/* Rodapé com Navegação */}
        <DialogFooter className="p-4 bg-muted/30 border-t border-border/60 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handlePrev}
            disabled={activeStep === 0}
            className="gap-1.5 text-xs text-muted-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                setActiveStep(0);
              }}
              className="text-xs"
            >
              Pular Guia
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleNext}
              className="gap-1.5 text-xs font-semibold shadow-xs"
            >
              {isLast ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Pronto, começar!
                </>
              ) : (
                <>
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FormEditorGuideModal;
