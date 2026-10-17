import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FeatureSubFormProps } from "./featureConfigTypes";

export function MedicalRecordConfigForm({ formData, setFormData, feature }: FeatureSubFormProps) {
  if (feature?.key === "clinic_sessions_list") {
    return (
      <div className="grid gap-8">
        <div className="grid gap-3">
          <Label className="text-base font-semibold">Configurações da Lista</Label>
          <div className="flex flex-col gap-4 mt-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="bulk-selection" className="font-normal cursor-pointer">Ativar Seleção em Lote (Bulk Actions)</Label>
              <Switch 
                id="bulk-selection"
                checked={(formData.bulk_selection as boolean) ?? true}
                onCheckedChange={(v) => setFormData({ ...formData, bulk_selection: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show-financials" className="font-normal cursor-pointer">Exibir Valores Financeiros na Lista</Label>
              <Switch 
                id="show-financials"
                checked={(formData.show_financials as boolean) ?? false}
                onCheckedChange={(v) => setFormData({ ...formData, show_financials: v })}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 pt-4 border-t">
          <Label className="text-base font-semibold">Ações em Lote Permitidas</Label>
          <div className="flex flex-col gap-3 mt-1">
            {['Alterar Status', 'Mover para Grupo', 'Excluir Atendimentos'].map((action, idx) => {
              const key = `allowAction_${idx}`;
              return (
                <div key={idx} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`action-${idx}`} 
                    checked={(formData[key] as boolean) ?? true}
                    onCheckedChange={(v) => setFormData({ ...formData, [key]: !!v })}
                  />
                  <Label htmlFor={`action-${idx}`} className="font-normal cursor-pointer">{action}</Label>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 pt-4 border-t">
          <Label className="text-base font-semibold">Filtro Padrão de Dias</Label>
          <Select 
            value={(formData.default_filter_days as string) || "30"} 
            onValueChange={(val) => setFormData({ ...formData, default_filter_days: val })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o filtro padrão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="15">Últimos 15 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="current_month">Mês Atual</SelectItem>
              <SelectItem value="all">Todos (Pode causar lentidão)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <div className="grid gap-3">
        <Label className="text-base font-semibold">Blocos do Resumo Rápido</Label>
        <div className="flex flex-col gap-3 mt-1">
          {['Queixa Principal', 'Sinais Vitais', 'Evolução', 'Prescrições'].map((block, idx) => (
            <div key={idx} className="flex items-center space-x-2">
              <Checkbox 
                id={`block-${idx}`} 
                checked={(formData[`summaryBlock_${idx}`] as boolean) ?? true}
                onCheckedChange={(v) => setFormData({ ...formData, [`summaryBlock_${idx}`]: !!v })}
              />
              <Label htmlFor={`block-${idx}`} className="font-normal cursor-pointer">{block}</Label>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 pt-4 border-t">
        <Label className="text-base font-semibold">Impressão em PDF</Label>
        <div className="flex flex-col gap-4 mt-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="pdf-header" className="font-normal cursor-pointer">Cabeçalho oficial da clínica</Label>
            <Switch 
              id="pdf-header"
              checked={(formData.pdfClinicHeader as boolean) ?? true}
              onCheckedChange={(v) => setFormData({ ...formData, pdfClinicHeader: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="pdf-signature" className="font-normal cursor-pointer">Espaço para assinatura do profissional</Label>
            <Switch 
              id="pdf-signature"
              checked={(formData.pdfProfessionalSignature as boolean) ?? true}
              onCheckedChange={(v) => setFormData({ ...formData, pdfProfessionalSignature: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="pdf-datetime" className="font-normal cursor-pointer">Exibir data/hora exata no rodapé</Label>
            <Switch 
              id="pdf-datetime"
              checked={(formData.pdfExactDateTime as boolean) ?? true}
              onCheckedChange={(v) => setFormData({ ...formData, pdfExactDateTime: v })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
