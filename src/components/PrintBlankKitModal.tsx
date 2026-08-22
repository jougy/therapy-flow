import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, FileText, CheckSquare, Building2, Palette, Layers, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isAnamnesisTemplateSchema, sanitizeAnamnesisTemplateSchema, type AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";
import PrintBlankKitSheet from "./PrintBlankKitSheet";
import PrintResponsibilityModal from "./PrintResponsibilityModal";

export interface PrintBlankKitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTemplateId?: string | null;
}

interface TemplateOption {
  id: string;
  name: string;
  description: string | null;
  schema: AnamnesisTemplateSchema;
}

export const PrintBlankKitModal: React.FC<PrintBlankKitModalProps> = ({
  open,
  onOpenChange,
  defaultTemplateId,
}) => {
  const { clinic, clinicId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [includePatientRegistration, setIncludePatientRegistration] = useState(true);
  const [includeUniversalBase, setIncludeUniversalBase] = useState(true);
  const [includeHeader, setIncludeHeader] = useState(true);
  const [printColorMode, setPrintColorMode] = useState<"color" | "monochrome">("color");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [baseSchema, setBaseSchema] = useState<AnamnesisTemplateSchema>([]);
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
  const [showTermsModal, setShowTermsModal] = useState(false);

  useEffect(() => {
    if (defaultTemplateId) {
      setSelectedTemplateId(defaultTemplateId);
    }
  }, [defaultTemplateId]);

  useEffect(() => {
    if (!open || !clinicId) return;

    const fetchData = async () => {
      setLoading(true);

      // Fetch base schema and clinic details
      const { data: clinicData } = await supabase
        .from("clinics")
        .select("anamnesis_base_schema")
        .eq("id", clinicId)
        .single();

      if (clinicData && isAnamnesisTemplateSchema(clinicData.anamnesis_base_schema)) {
        setBaseSchema(sanitizeAnamnesisTemplateSchema(clinicData.anamnesis_base_schema));
      }

      // Fetch clinic form templates
      const { data: templatesData } = await supabase
        .from("anamnesis_form_templates")
        .select("id, name, description, schema")
        .eq("clinic_id", clinicId)
        .order("name", { ascending: true });

      if (templatesData) {
        const formatted = templatesData.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          schema: isAnamnesisTemplateSchema(t.schema) ? sanitizeAnamnesisTemplateSchema(t.schema) : [],
        }));
        setTemplates(formatted);
      }

      setLoading(false);
    };

    void fetchData();
  }, [open, clinicId]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // Extract all printable sections from active schemas
  const availableSections = useMemo(() => {
    const list: { id: string; label: string; type: string; source: string; fieldCount: number }[] = [];

    if (includeUniversalBase && baseSchema.length > 0) {
      baseSchema.forEach((field) => {
        if (field.type === "section" || field.type === "horizontal_section") {
          const childCount = baseSchema.filter((f) => f.groupKey === field.id).length;
          list.push({
            id: field.id,
            label: field.label || "Seção sem título",
            type: field.type === "horizontal_section" ? "Seção Horizontal" : "Seção",
            source: "Bloco Universal",
            fieldCount: childCount,
          });
        }
      });
    }

    if (selectedTemplate && selectedTemplate.schema.length > 0) {
      selectedTemplate.schema.forEach((field) => {
        if (field.type === "section" || field.type === "horizontal_section") {
          const childCount = selectedTemplate.schema.filter((f) => f.groupKey === field.id).length;
          list.push({
            id: field.id,
            label: field.label || "Seção sem título",
            type: field.type === "horizontal_section" ? "Seção Horizontal" : "Seção",
            source: selectedTemplate.name,
            fieldCount: childCount,
          });
        }
      });
    }

    return list;
  }, [includeUniversalBase, baseSchema, selectedTemplate]);

  // Keep selected sections synced (all on by default when new sections appear)
  useEffect(() => {
    if (availableSections.length > 0) {
      setSelectedSectionIds((prev) => {
        const availableIdSet = new Set(availableSections.map((s) => s.id));
        const kept = prev.filter((id) => availableIdSet.has(id));
        const existingSet = new Set(kept);
        const newIds = availableSections.map((s) => s.id).filter((id) => !existingSet.has(id));
        return [...kept, ...newIds];
      });
    }
  }, [availableSections]);

  const toggleSection = (sectionId: string) => {
    setSelectedSectionIds((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId]
    );
  };

  const selectAllSections = () => {
    setSelectedSectionIds(availableSections.map((s) => s.id));
  };

  const deselectAllSections = () => {
    setSelectedSectionIds([]);
  };

  const handlePrint = () => {
    const originalTitle = document.title;

    let targetName = "";
    if (selectedTemplate?.name) {
      targetName = selectedTemplate.name;
    } else if (includeUniversalBase) {
      targetName = "Bloco Padrão Universal";
    } else if (includePatientRegistration) {
      targetName = "Ficha de Cadastro do Paciente";
    }

    const clinicClean = clinic?.name ? ` - ${clinic.name}` : "";
    const cleanFormName = targetName.replace(/[^a-zA-Z0-9-_\s]/g, " ").replaceAll(/\s+/g, " ").trim();
    document.title = `Ficha em Branco - ${cleanFormName}${clinicClean}`;

    window.print();

    window.setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const handleStartPrintFlow = () => {
    setShowTermsModal(true);
  };

  const handleAcceptTermsAndPrint = () => {
    setShowTermsModal(false);
    handlePrint();
  };

  return (
    <>
      <Dialog open={open && !showTermsModal} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl sm:max-w-2xl max-h-[90dvh] overflow-y-auto print:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Printer className="h-5 w-5 text-primary" />
              Imprimir Ficha e Kit de Atendimento em Branco
            </DialogTitle>
            <DialogDescription>
              Gere formulários limpos em formato A4 para atendimento presencial, visitas externas ou uso offline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Opções de Conteúdo */}
            <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Selecione os blocos para incluir na impressão:
              </h4>

              {/* 1. Ficha de Cadastro */}
              <div className="flex items-start space-x-3 rounded-md border p-3 bg-background">
                <Checkbox
                  id="include-registration"
                  checked={includePatientRegistration}
                  onCheckedChange={(checked) => setIncludePatientRegistration(Boolean(checked))}
                />
                <div className="grid gap-1 leading-none">
                  <Label htmlFor="include-registration" className="font-medium cursor-pointer">
                    Ficha de Cadastro do Paciente em Branco
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Campos para dados pessoais, CPF, contatos, endereço, responsável legal e convênio.
                  </p>
                </div>
              </div>

              {/* 2. Bloco Universal */}
              <div className="flex items-start space-x-3 rounded-md border p-3 bg-background">
                <Checkbox
                  id="include-universal"
                  checked={includeUniversalBase}
                  onCheckedChange={(checked) => setIncludeUniversalBase(Boolean(checked))}
                />
                <div className="grid gap-1 leading-none">
                  <Label htmlFor="include-universal" className="font-medium cursor-pointer">
                    Bloco Padrão Universal da Clínica ({baseSchema.length} campos)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Avaliação inicial obrigatória e perguntas padrão configuradas para a clínica.
                  </p>
                </div>
              </div>

              {/* 3. Ficha Extra / Template */}
              <div className="space-y-2 rounded-md border p-3 bg-background">
                <Label className="font-medium flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-muted-foreground" />
                  Ficha Extra de Atendimento Específico (Opcional)
                </Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um modelo da clínica..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (Apenas cadastro/bloco base)</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.schema.length} campos)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTemplate?.description && (
                  <p className="text-xs text-muted-foreground italic pl-1">
                    {selectedTemplate.description}
                  </p>
                )}
              </div>
            </div>

            {/* SELETOR DE SEÇÕES DINÂMICAS COM TOGGLES */}
            {availableSections.length > 0 && (
              <div className="space-y-3 rounded-lg border p-4 bg-muted/10">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold">Seções que entrarão na impressão:</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={selectAllSections}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Todas
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-muted-foreground"
                      onClick={deselectAllSections}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Nenhuma
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {availableSections.map((section) => {
                    const isChecked = selectedSectionIds.includes(section.id);
                    return (
                      <div
                        key={section.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                          isChecked
                            ? "bg-background border-border/80 shadow-xs"
                            : "bg-muted/40 border-dashed border-border/50 opacity-60"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Switch
                            id={`section-toggle-${section.id}`}
                            checked={isChecked}
                            onCheckedChange={() => toggleSection(section.id)}
                          />
                          <Label
                            htmlFor={`section-toggle-${section.id}`}
                            className="text-xs font-medium cursor-pointer truncate"
                          >
                            {section.label}
                          </Label>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {section.fieldCount} {section.fieldCount === 1 ? "campo" : "campos"}
                          </Badge>
                          <Badge variant="secondary" className="text-[9px] font-normal hidden sm:inline-flex">
                            {section.source}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Opções Visuais e Modo de Cor */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-lg border p-3 bg-background">
                <div className="space-y-0.5 pr-2">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    Cabeçalho da Clínica
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Logo, dados e linhas de assinatura.
                  </p>
                </div>
                <Switch checked={includeHeader} onCheckedChange={setIncludeHeader} />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3 bg-background">
                <div className="space-y-0.5 pr-2">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                    {printColorMode === "color" ? "Modo Colorido" : "Preto & Branco"}
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    {printColorMode === "color" ? "Cores dos campos e seções." : "Econômico para tinta."}
                  </p>
                </div>
                <Switch
                  checked={printColorMode === "color"}
                  onCheckedChange={(checked) => setPrintColorMode(checked ? "color" : "monochrome")}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleStartPrintFlow}
              disabled={
                loading ||
                (!includePatientRegistration && !includeUniversalBase && selectedTemplateId === "none") ||
                ((includeUniversalBase || selectedTemplateId !== "none") && selectedSectionIds.length === 0 && !includePatientRegistration)
              }
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Imprimir Modelo em Branco
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrintResponsibilityModal
        isOpen={showTermsModal}
        documentTitle="Ficha em Branco / Kit Offline"
        onConfirm={handleAcceptTermsAndPrint}
        onCancel={() => setShowTermsModal(false)}
      />

      {/* ÁREA DE IMPRESSÃO (Renderizada via React Portal diretamente no document.body para isolamento CSS de impressão) */}
      {typeof document !== "undefined" &&
        createPortal(
          <div id="print-blank-kit-root" className="hidden print:block">
            <PrintBlankKitSheet
              clinicName={clinic?.name}
              clinicLogoUrl={clinic?.logo_url}
              includeHeader={includeHeader}
              includePatientRegistration={includePatientRegistration}
              includeUniversalBase={includeUniversalBase}
              universalBaseSchema={baseSchema}
              selectedTemplateName={selectedTemplate?.name}
              selectedTemplateSchema={selectedTemplate?.schema}
              selectedSectionIds={selectedSectionIds}
              printColorMode={printColorMode}
            />
          </div>,
          document.body
        )}
    </>
  );
};

export default PrintBlankKitModal;


