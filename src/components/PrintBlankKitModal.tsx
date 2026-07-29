import React, { useEffect, useState } from "react";
import { Printer, FileText, CheckSquare, Sparkles, Building2 } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isAnamnesisTemplateSchema, sanitizeAnamnesisTemplateSchema, type AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";
import PrintBlankKitSheet from "./PrintBlankKitSheet";

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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [baseSchema, setBaseSchema] = useState<AnamnesisTemplateSchema>([]);

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

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl sm:max-w-2xl print:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Printer className="h-5 w-5 text-primary" />
              Imprimir Ficha e Kit de Atendimento em Branco
            </DialogTitle>
            <DialogDescription>
              Gere formulários limpos em formato A4 para atendimento presencial, visitas externas ou uso offline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Opções de Conteúdo */}
            <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
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
                  Ficha Extra de Atendimento Especifico (Opcional)
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

            {/* Opções Visuais */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Incluir Cabeçalho e Logo da Clínica
                </Label>
                <p className="text-xs text-muted-foreground">
                  Imprime nome da clínica, logo e linhas para carimbo/assinatura do profissional.
                </p>
              </div>
              <Switch checked={includeHeader} onCheckedChange={setIncludeHeader} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handlePrint}
              disabled={loading || (!includePatientRegistration && !includeUniversalBase && selectedTemplateId === "none")}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Imprimir Modelo em Branco
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ÁREA DE IMPRESSÃO (Oculta na tela, visível na janela de impressão do navegador) */}
      <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:z-[999999]">
        <PrintBlankKitSheet
          clinicName={clinic?.name}
          clinicLogoUrl={clinic?.logo_url}
          includeHeader={includeHeader}
          includePatientRegistration={includePatientRegistration}
          includeUniversalBase={includeUniversalBase}
          universalBaseSchema={baseSchema}
          selectedTemplateName={selectedTemplate?.name}
          selectedTemplateSchema={selectedTemplate?.schema}
        />
      </div>
    </>
  );
};

export default PrintBlankKitModal;
