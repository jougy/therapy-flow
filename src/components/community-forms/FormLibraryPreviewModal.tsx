import React from "react";
import {
  Calendar,
  CheckSquare,
  Clock,
  Download,
  FileText,
  Hash,
  HelpCircle,
  Layers,
  List,
  MapPin,
  Sliders,
  Sparkles,
  Table,
  Tag,
  User,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type CommunityFormTemplate } from "@/lib/community-forms";
import { type AnamnesisField } from "@/lib/anamnesis-forms";

interface FormLibraryPreviewModalProps {
  template: CommunityFormTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (template: CommunityFormTemplate) => void;
}

const FIELD_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  short_text: { label: "Texto Curto", icon: <FileText className="h-3.5 w-3.5" />, color: "bg-blue-50 text-blue-700 border-blue-200" },
  long_text: { label: "Texto Longo", icon: <FileText className="h-3.5 w-3.5" />, color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  date: { label: "Data", icon: <Calendar className="h-3.5 w-3.5" />, color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  number: { label: "Número", icon: <Hash className="h-3.5 w-3.5" />, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  checklist: { label: "Checklist", icon: <CheckSquare className="h-3.5 w-3.5" />, color: "bg-amber-50 text-amber-700 border-amber-200" },
  multiple_choice: { label: "Múltipla Escolha", icon: <List className="h-3.5 w-3.5" />, color: "bg-orange-50 text-orange-700 border-orange-200" },
  select: { label: "Droplist", icon: <List className="h-3.5 w-3.5" />, color: "bg-purple-50 text-purple-700 border-purple-200" },
  table: { label: "Tabela", icon: <Table className="h-3.5 w-3.5" />, color: "bg-pink-50 text-pink-700 border-pink-200" },
  slider: { label: "Slidebar (Escala)", icon: <Sliders className="h-3.5 w-3.5" />, color: "bg-teal-50 text-teal-700 border-teal-200" },
  address_block: { label: "Bloco de Endereço", icon: <MapPin className="h-3.5 w-3.5" />, color: "bg-green-50 text-green-700 border-green-200" },
  section: { label: "Seção Sanfona", icon: <Layers className="h-3.5 w-3.5" />, color: "bg-slate-100 text-slate-700 border-slate-300" },
  horizontal_section: { label: "Seção Horizontal", icon: <Layers className="h-3.5 w-3.5" />, color: "bg-slate-100 text-slate-700 border-slate-300" },
  section_selector: { label: "Seletor de Seções", icon: <Layers className="h-3.5 w-3.5" />, color: "bg-slate-100 text-slate-700 border-slate-300" },
};

export const FormLibraryPreviewModal: React.FC<FormLibraryPreviewModalProps> = ({
  template,
  open,
  onOpenChange,
  onImport,
}) => {
  if (!template) return null;

  const totalFields = template.schema.filter(
    (f) => f.type !== "section" && f.type !== "horizontal_section" && f.type !== "section_selector"
  ).length;

  const sectionsCount = template.schema.filter(
    (f) => f.type === "section" || f.type === "horizontal_section" || f.type === "section_selector"
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b bg-muted/20 shrink-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant="outline" className="font-semibold text-xs border-primary/30 text-primary">
              {template.category}
            </Badge>
            {template.is_featured && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-xs gap-1">
                <Sparkles className="h-3 w-3" /> Modelo em Destaque
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {template.kind === "base" ? "Bloco Padrão" : "Ficha Complementar"}
            </Badge>
          </div>

          <DialogTitle className="text-xl font-bold text-foreground">
            {template.title}
          </DialogTitle>

          <DialogDescription className="text-sm text-muted-foreground flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              Por {template.author_name}
              {template.clinic_name ? ` • ${template.clinic_name}` : ""}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Download className="h-3.5 w-3.5" />
              {template.imports_count} importações
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Description */}
          {template.description && (
            <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground leading-relaxed">
              <p className="font-medium text-foreground text-xs uppercase tracking-wide mb-1">
                Sobre este formulário
              </p>
              {template.description}
            </div>
          )}

          {/* Metrics summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <p className="text-xs text-muted-foreground">Total de Campos</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{totalFields}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <p className="text-xs text-muted-foreground">Seções Estruturais</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{sectionsCount}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-center col-span-2 sm:col-span-1">
              <p className="text-xs text-muted-foreground">Tempo Estimado</p>
              <p className="text-lg font-bold text-foreground mt-0.5">~{Math.max(1, Math.round(totalFields * 0.4))} min</p>
            </div>
          </div>

          {/* Tags */}
          {template.tags && template.tags.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {template.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-xs bg-muted px-2.5 py-1 rounded-md text-foreground"
                  >
                    <Tag className="h-3 w-3 opacity-60" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Structured Fields List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Estrutura de Campos ({template.schema.length} itens)
              </p>
            </div>

            <div className="space-y-2.5">
              {template.schema.map((field: AnamnesisField, index: number) => {
                const isContainer =
                  field.type === "section" ||
                  field.type === "horizontal_section" ||
                  field.type === "section_selector";
                const config = FIELD_TYPE_CONFIG[field.type] || FIELD_TYPE_CONFIG.short_text;

                return (
                  <div
                    key={field.id || index}
                    className={`rounded-xl border p-3.5 transition-colors ${
                      isContainer
                        ? "bg-muted/40 border-border/80 font-medium"
                        : "bg-card hover:bg-muted/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-bold mt-0.5">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm ${isContainer ? "font-semibold text-foreground" : "text-foreground"}`}>
                              {field.label || "(Sem rótulo)"}
                            </span>
                            {field.required && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                Obrigatório
                              </Badge>
                            )}
                          </div>

                          {field.helpText && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                              <HelpCircle className="h-3 w-3 shrink-0 mt-0.5 opacity-70" />
                              {field.helpText}
                            </p>
                          )}

                          {/* Options preview if any */}
                          {field.options && field.options.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {field.options.map((opt) => (
                                <span
                                  key={opt.id}
                                  className="text-[11px] bg-background border px-2 py-0.5 rounded text-muted-foreground"
                                >
                                  {opt.label}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Slider range preview */}
                          {field.type === "slider" && (
                            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                              <span>Mín: {field.min ?? 0} ({field.sliderMinLabel || "Mínimo"})</span>
                              <span>•</span>
                              <span>Máx: {field.max ?? 10} ({field.sliderMaxLabel || "Máximo"})</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={`text-[11px] shrink-0 gap-1 font-normal ${config.color}`}
                      >
                        {config.icon}
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 px-6 border-t bg-muted/20 flex flex-row items-center justify-between sm:justify-between shrink-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>

          <Button
            size="sm"
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              onOpenChange(false);
              onImport(template);
            }}
          >
            <Download className="h-4 w-4" />
            Importar para Minha Clínica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
