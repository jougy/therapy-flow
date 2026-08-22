import React from "react";
import { Badge } from "@/components/ui/badge";
import type { TutorialVisualPreviewConfig } from "./tutorial-registry";
import {
  Clock,
  DollarSign,
  Calendar,
  UsersRound,
  FileText,
  Clock3,
  AlertCircle,
  Command,
  Type,
  AlignLeft,
  Hash,
  ChevronDownSquare,
  CircleDot,
  CheckSquare,
  Sliders,
  FolderOpen,
  Columns,
  ToggleLeft,
  Table,
  MapPin,
  Check,
  ChevronDown,
  Sparkles,
  Activity,
  Layers3,
} from "lucide-react";

export interface TutorialVisualPreviewProps {
  preview: TutorialVisualPreviewConfig;
}

export const TutorialVisualPreview: React.FC<TutorialVisualPreviewProps> = ({ preview }) => {
  switch (preview.type) {
    case "form-field-mock": {
      const mockType = preview.fieldMockType || "short_text";

      switch (mockType) {
        case "short_text":
          return (
            <div className="mt-3 space-y-2 rounded-xl border border-primary/20 bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Type className="h-3.5 w-3.5 text-primary" />
                  Visualização do Campo de Texto Curto
                </span>
                <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30">
                  Linha Única
                </Badge>
              </div>
              <div className="space-y-1 rounded-lg border border-border/80 bg-background p-2.5 shadow-xs">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span>Profissão do Paciente</span>
                  <span className="text-[10px] text-rose-500 font-bold">*Obrigatório</span>
                </div>
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-1.5 text-xs text-foreground font-medium">
                  <Type className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
                  <span>Fisioterapeuta Especialista em Coluna</span>
                </div>
              </div>
            </div>
          );

        case "long_text":
          return (
            <div className="mt-3 space-y-2 rounded-xl border border-primary/20 bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <AlignLeft className="h-3.5 w-3.5 text-primary" />
                  Visualização da Área de Texto Livre
                </span>
                <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30">
                  Área Expansível
                </Badge>
              </div>
              <div className="space-y-1.5 rounded-lg border border-border/80 bg-background p-2.5 shadow-xs">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span>História da Doença Atual (H.D.A.)</span>
                  <span className="text-[10px] text-muted-foreground">120/1000 caracteres</span>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-2 text-xs text-muted-foreground leading-relaxed">
                  Paciente relata desconforto na região lombar L4-L5 há 3 semanas, com piora progressiva ao permanecer sentado por longos períodos.
                </div>
              </div>
            </div>
          );

        case "number":
          return (
            <div className="mt-3 space-y-2 rounded-xl border border-primary/20 bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-primary" />
                  Visualização do Campo Numérico
                </span>
                <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30">
                  Apenas Dígitos
                </Badge>
              </div>
              <div className="space-y-1 rounded-lg border border-border/80 bg-background p-2.5 shadow-xs">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span>Peso Corporal</span>
                  <span className="text-[10px] text-muted-foreground">Unidade: kg</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-2.5 py-1.5 text-xs text-foreground font-semibold">
                  <div className="flex items-center gap-2">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
                    <span>78.5</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">kg</span>
                </div>
              </div>
            </div>
          );

        case "date":
          return (
            <div className="mt-3 space-y-2 rounded-xl border border-primary/20 bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  Visualização do Campo de Data
                </span>
                <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30">
                  Formato DD/MM/AAAA
                </Badge>
              </div>
              <div className="space-y-1 rounded-lg border border-border/80 bg-background p-2.5 shadow-xs">
                <div className="text-xs font-semibold text-foreground">
                  Data do Trauma / Procedimento
                </div>
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-2.5 py-1.5 text-xs text-foreground font-semibold">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>18/04/2026</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Calendário Ativo</span>
                </div>
              </div>
            </div>
          );

        case "select":
          return (
            <div className="mt-3 space-y-2 rounded-xl border border-primary/20 bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ChevronDownSquare className="h-3.5 w-3.5 text-primary" />
                  Visualização do Droplist (Menu Suspenso)
                </span>
                <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30">
                  Escolha Única
                </Badge>
              </div>
              <div className="space-y-1 rounded-lg border border-border/80 bg-background p-2.5 shadow-xs">
                <div className="text-xs font-semibold text-foreground">
                  Lado Acometido
                </div>
                <div className="flex items-center justify-between rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1.5 text-xs text-foreground font-semibold">
                  <div className="flex items-center gap-2">
                    <ChevronDownSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Membro Superior Direito (MSD)</span>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-primary" />
                </div>
              </div>
            </div>
          );

        case "multiple_choice":
          return (
            <div className="mt-3 space-y-2 rounded-xl border border-primary/20 bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CircleDot className="h-3.5 w-3.5 text-primary" />
                  Visualização de Múltipla Escolha (Radio)
                </span>
                <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30">
                  Opção Exclusiva
                </Badge>
              </div>
              <div className="space-y-1.5 rounded-lg border border-border/80 bg-background p-2.5 shadow-xs">
                <div className="text-xs font-semibold text-foreground">
                  Apresenta irradiação de dor para outros membros?
                </div>
                <div className="grid grid-cols-1 gap-1.5 text-xs">
                  <div className="flex items-center gap-2 rounded-md border border-primary bg-primary/10 px-2.5 py-1.5 font-medium text-foreground">
                    <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-primary bg-primary text-white">
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    </div>
                    <span>Sim, irradia para a face posterior da perna</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/20 px-2.5 py-1.5 text-muted-foreground">
                    <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/60" />
                    <span>Não, dor estritamente localizada</span>
                  </div>
                </div>
              </div>
            </div>
          );

        case "checklist":
          return (
            <div className="mt-3 space-y-2 rounded-xl border border-primary/20 bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CheckSquare className="h-3.5 w-3.5 text-primary" />
                  Visualização do Checklist
                </span>
                <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30">
                  Múltiplas Marcações
                </Badge>
              </div>
              <div className="space-y-1.5 rounded-lg border border-border/80 bg-background p-2.5 shadow-xs">
                <div className="text-xs font-semibold text-foreground">
                  Sintomas e Sinais Associados
                </div>
                <div className="grid grid-cols-1 gap-1 text-xs">
                  <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-2 py-1 text-foreground font-medium">
                    <div className="flex h-3.5 w-3.5 items-center justify-center rounded bg-primary text-white">
                      <Check className="h-2.5 w-2.5" />
                    </div>
                    <span>Edema periarticular moderado</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-2 py-1 text-foreground font-medium">
                    <div className="flex h-3.5 w-3.5 items-center justify-center rounded bg-primary text-white">
                      <Check className="h-2.5 w-2.5" />
                    </div>
                    <span>Dor à palpação local</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-muted-foreground">
                    <div className="h-3.5 w-3.5 rounded border border-muted-foreground/60" />
                    <span>Crepitação ou estalos articulares</span>
                  </div>
                </div>
              </div>
            </div>
          );

        case "slider":
          return (
            <div className="mt-3 space-y-2 rounded-xl border border-primary/20 bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-primary" />
                  Visualização da Escala Deslizante (EVA)
                </span>
                <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30">
                  Régua de 0 a 10
                </Badge>
              </div>
              <div className="space-y-2 rounded-lg border border-border/80 bg-background p-2.5 shadow-xs">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span>Nível de Dor no Movimento</span>
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                    Grau 6 / 10
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-600 shadow-inner" />
                <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
                  <span className="text-emerald-600 dark:text-emerald-400">0 - Sem Dor</span>
                  <span className="text-amber-600 dark:text-amber-400">5 - Moderada</span>
                  <span className="text-rose-600 dark:text-rose-400">10 - Intensa</span>
                </div>
              </div>
            </div>
          );

        case "section":
          return (
            <div className="mt-3 space-y-2 rounded-xl border border-primary/20 bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5 text-primary" />
                  Visualização da Seção Sanfona
                </span>
                <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30">
                  Bloco Retrátil
                </Badge>
              </div>
              <div className="rounded-lg border-2 border-primary/40 bg-background overflow-hidden shadow-xs">
                <div className="flex items-center justify-between bg-primary/10 px-3 py-2 text-xs font-bold text-primary">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-3.5 w-3.5" />
                    <span>1. Exame Físico e Testes Especiais</span>
                  </div>
                  <Badge className="bg-primary text-white text-[9px] px-1.5 py-0 font-semibold">
                    4 perguntas
                  </Badge>
                </div>
                <div className="p-2.5 space-y-1.5 text-xs bg-muted/10">
                  <div className="rounded border border-border/70 bg-background px-2 py-1 text-[11px] text-foreground font-medium">
                    Teste de Neer / Hawkins-Kennedy
                  </div>
                  <div className="rounded border border-border/70 bg-background px-2 py-1 text-[11px] text-foreground font-medium">
                    Amplitude de Movimento Ativa (Graus)
                  </div>
                </div>
              </div>
            </div>
          );

        case "horizontal_section":
          return (
            <div className="mt-3 space-y-2 rounded-xl border border-primary/20 bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Columns className="h-3.5 w-3.5 text-primary" />
                  Visualização da Seção Horizontal
                </span>
                <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30">
                  Colunas Lado a Lado
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/80 bg-background p-2.5 shadow-xs">
                <div className="space-y-1 rounded border border-primary/30 bg-primary/5 p-2">
                  <span className="text-[10px] font-bold text-primary block">Coluna 1: Membro Direito</span>
                  <div className="rounded bg-background border px-2 py-1 text-xs font-semibold text-foreground">
                    120° Flexão
                  </div>
                </div>
                <div className="space-y-1 rounded border border-primary/30 bg-primary/5 p-2">
                  <span className="text-[10px] font-bold text-primary block">Coluna 2: Membro Esquerdo</span>
                  <div className="rounded bg-background border px-2 py-1 text-xs font-semibold text-foreground">
                    95° Flexão
                  </div>
                </div>
              </div>
            </div>
          );

        case "section_selector":
          return (
            <div className="mt-3 space-y-2 rounded-xl border border-primary/20 bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ToggleLeft className="h-3.5 w-3.5 text-primary" />
                  Visualização do Seletor de Seções
                </span>
                <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30">
                  Módulos Ativáveis
                </Badge>
              </div>
              <div className="space-y-1.5 rounded-lg border border-border/80 bg-background p-2.5 shadow-xs">
                <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs text-foreground font-semibold">
                  <span>Avaliar Módulo Coluna Lombar</span>
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                    Ativo
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border/70 bg-muted/20 px-2.5 py-1.5 text-xs text-muted-foreground font-medium">
                  <span>Avaliar Módulo Membros Inferiores</span>
                  <span className="rounded-full bg-muted-foreground/30 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    Inativo
                  </span>
                </div>
              </div>
            </div>
          );

        case "table":
          return (
            <div className="mt-3 space-y-2 rounded-xl border border-primary/20 bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Table className="h-3.5 w-3.5 text-primary" />
                  Visualização da Grade de Tabela
                </span>
                <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30">
                  Colunas Customizáveis
                </Badge>
              </div>
              <div className="rounded-lg border border-border/80 bg-background overflow-hidden shadow-xs text-xs">
                <div className="grid grid-cols-3 bg-muted/60 px-2.5 py-1.5 font-bold text-muted-foreground text-[10px] uppercase">
                  <span>Exercício</span>
                  <span>Séries</span>
                  <span>Carga</span>
                </div>
                <div className="divide-y divide-border/50 font-medium">
                  <div className="grid grid-cols-3 px-2.5 py-1 text-[11px]">
                    <span className="text-foreground font-semibold">Ponte Glútea</span>
                    <span className="text-muted-foreground">3 x 15 rep</span>
                    <span className="text-primary font-bold">3 kg</span>
                  </div>
                  <div className="grid grid-cols-3 px-2.5 py-1 text-[11px]">
                    <span className="text-foreground font-semibold">Agachamento</span>
                    <span className="text-muted-foreground">3 x 12 rep</span>
                    <span className="text-primary font-bold">10 kg</span>
                  </div>
                </div>
              </div>
            </div>
          );

        case "address_block":
          return (
            <div className="mt-3 space-y-2 rounded-xl border border-primary/20 bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  Visualização do Bloco de Endereço
                </span>
                <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30">
                  Busca por CEP
                </Badge>
              </div>
              <div className="space-y-1.5 rounded-lg border border-border/80 bg-background p-2.5 shadow-xs text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">CEP: 01310-100</span>
                  <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[9px]">
                    Autocompletado
                  </Badge>
                </div>
                <div className="rounded border bg-muted/20 px-2 py-1 text-[11px] text-muted-foreground">
                  Av. Paulista, 1000 - Bela Vista - São Paulo / SP
                </div>
              </div>
            </div>
          );

        default:
          return null;
      }
    }

    case "payment-status":
      return (
        <div className="mt-3 space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-primary" />
              Variações do Símbolo Financeiro ($)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-emerald-950 dark:text-emerald-200">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-[10px] shadow-xs">
                $
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[11px]">Quitado</span>
                <span className="text-[10px] text-muted-foreground leading-tight">Sem pendências</span>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-950 dark:text-amber-200">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white font-bold text-[10px] shadow-xs">
                $
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[11px]">Pendente</span>
                <span className="text-[10px] text-muted-foreground leading-tight">Sessão a acertar</span>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-rose-950 dark:text-rose-200">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white font-bold text-[10px] shadow-xs">
                $
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[11px]">Em Débito</span>
                <span className="text-[10px] text-muted-foreground leading-tight">Sessões vencidas</span>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 p-2 text-sky-950 dark:text-sky-200">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white font-bold text-[10px] shadow-xs">
                $
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[11px]">Com Crédito</span>
                <span className="text-[10px] text-muted-foreground leading-tight">Pacote antecipado</span>
              </div>
            </div>
          </div>
        </div>
      );

    case "clock-colors":
      return (
        <div className="mt-3 space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              As 4 Cores do Relógio de Agendamento
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-emerald-950 dark:text-emerald-200">
              <Clock className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="flex flex-col">
                <span className="font-bold text-[11px]">Verde: Hoje</span>
                <span className="text-[10px] text-muted-foreground leading-tight">Agendado para hoje</span>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 p-2 text-sky-950 dark:text-sky-200">
              <Clock className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" />
              <div className="flex flex-col">
                <span className="font-bold text-[11px]">Azul: Futuro</span>
                <span className="text-[10px] text-muted-foreground leading-tight">Datas posteriores</span>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-950 dark:text-amber-200">
              <Clock3 className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="flex flex-col">
                <span className="font-bold text-[11px]">Laranja: Chegou</span>
                <span className="text-[10px] text-muted-foreground leading-tight">Na sala de espera</span>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-rose-950 dark:text-rose-200">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
              <div className="flex flex-col">
                <span className="font-bold text-[11px]">Vermelho: Atraso</span>
                <span className="text-[10px] text-muted-foreground leading-tight">Horário ultrapassado</span>
              </div>
            </div>
          </div>
        </div>
      );

    case "recurrence-pill": {
      const defaultDays = [
        { letter: "D", active: false, dayName: "Domingo" },
        { letter: "S", active: true, dayName: "Segunda-feira" },
        { letter: "T", active: false, dayName: "Terça-feira" },
        { letter: "Q", active: true, dayName: "Quarta-feira" },
        { letter: "Q", active: false, dayName: "Quinta-feira" },
        { letter: "S", active: true, dayName: "Sexta-feira" },
        { letter: "S", active: false, dayName: "Sábado" },
      ];
      const days = preview.recurrenceDays || defaultDays;

      return (
        <div className="mt-3 space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              Pílula de Recorrência Semanal
            </span>
          </div>
          <div className="flex items-center justify-center gap-1.5 py-1">
            {days.map((day, idx) => (
              <div
                key={idx}
                className={`flex h-7 w-7 items-center justify-center rounded-lg font-bold text-xs shadow-xs transition-all ${
                  day.active
                    ? "bg-primary text-primary-foreground scale-105 shadow-primary/30"
                    : "bg-muted/80 text-muted-foreground border border-border/40"
                }`}
                title={`${day.dayName}: ${day.active ? "Ativo" : "Inativo"}`}
              >
                {day.letter}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-center text-muted-foreground leading-tight">
            Exemplo: As letras destacadas <strong className="text-primary">S, Q, S</strong> indicam atendimentos fixos toda Segunda, Quarta e Sexta.
          </p>
        </div>
      );
    }

    case "keyboard-shortcuts": {
      const shortcuts = preview.shortcuts || [
        { keys: ["⌘K", "Ctrl+K"], label: "Focar barra de busca rápida de pacientes" },
        { keys: ["/"], label: "Ativar busca de pacientes instantaneamente" },
        { keys: ["N"], label: "Abrir cadastro de novo paciente" },
        { keys: ["Esc"], label: "Limpar busca ou fechar janelas" },
      ];

      return (
        <div className="mt-3 space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Command className="h-3.5 w-3.5 text-primary" />
              Atalhos de Teclado & Produtividade
            </span>
          </div>
          <div className="space-y-1.5">
            {shortcuts.map((sc, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">
                <span className="text-muted-foreground text-[11px]">{sc.label}</span>
                <div className="flex items-center gap-1">
                  {sc.keys.map((k, kIdx) => (
                    <kbd
                      key={kIdx}
                      className="inline-flex h-5 items-center justify-center rounded border border-border/80 bg-background px-1.5 font-mono text-[10px] font-bold text-foreground shadow-xs"
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "list-mode":
      return (
        <div className="mt-3 space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Alternador de Visualização da Home
            </span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Badge className="bg-primary text-primary-foreground font-semibold px-3 py-1 gap-1.5 shadow-xs text-xs">
              <UsersRound className="h-3.5 w-3.5" />
              Pacientes (Prontuários)
            </Badge>
            <span className="text-xs text-muted-foreground">vs</span>
            <Badge variant="outline" className="text-muted-foreground font-medium px-3 py-1 gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" />
              Atendimentos (Sessões)
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground text-center">
            Alterne entre a visão cadastral e a esteira de sessões clínicas em tempo real.
          </p>
        </div>
      );

    case "status-badge":
      return (
        <div className="mt-3 flex items-center justify-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs font-bold">
              Ativo
            </Badge>
            <span className="text-[11px] text-muted-foreground">(Em tratamento)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-slate-400" />
            <Badge variant="outline" className="text-muted-foreground text-xs font-semibold">
              Inativo
            </Badge>
            <span className="text-[11px] text-muted-foreground">(Alta / Pausa)</span>
          </div>
        </div>
      );

    case "pain-scale":
      return (
        <div className="mt-3 space-y-1.5 rounded-xl border border-border/60 bg-muted/30 p-3">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>Escala EVA de Dor (0 a 10)</span>
          </div>
          <div className="h-3 w-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-600 shadow-inner" />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
            <span className="text-emerald-600 dark:text-emerald-400">0 - Sem Dor</span>
            <span className="text-amber-600 dark:text-amber-400">5 - Moderada</span>
            <span className="text-rose-600 dark:text-rose-400">10 - Intensa</span>
          </div>
        </div>
      );

    case "custom-badges":
      return (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-2.5">
          {preview.items?.map((item, idx) => (
            <Badge
              key={idx}
              className={`${item.bgClass || "bg-primary/15"} ${item.colorClass || "text-primary"} ${item.borderClass || "border-primary/30"} text-[11px] font-semibold`}
            >
              {item.badgeText || item.label}
            </Badge>
          ))}
        </div>
      );

    default:
      return null;
  }
};
