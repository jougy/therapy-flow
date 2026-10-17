import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FeatureSubFormProps } from "./featureConfigTypes";

export function DashboardsConfigForm({ formData, setFormData }: FeatureSubFormProps) {
  return (
    <div className="grid gap-8">
      <div className="grid gap-4">
        <Label className="text-base font-semibold border-b pb-2">Dashboard Geral da Clínica</Label>
        
        <div className="grid gap-2">
          <Label>Período padrão de visualização</Label>
          <Select 
            value={(formData.defaultPeriod as string) || "this_week"} 
            onValueChange={(val) => setFormData({ ...formData, defaultPeriod: val })}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_week">Esta semana</SelectItem>
              <SelectItem value="this_month">Este mês</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2 mt-2">
          <Label>Métricas visíveis</Label>
          <div className="flex flex-col gap-2 mt-1">
            {['Atendimentos Realizados', 'Faturamento Estimado', 'Pacientes Ativos', 'Taxa de Retorno'].map((metric, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <Checkbox 
                  id={`metric-${idx}`} 
                  checked={(formData[`metric_${idx}`] as boolean) ?? true}
                  onCheckedChange={(v) => setFormData({ ...formData, [`metric_${idx}`]: !!v })}
                />
                <Label htmlFor={`metric-${idx}`} className="font-normal cursor-pointer">{metric}</Label>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 pt-4 border-t">
        <Label className="text-base font-semibold border-b pb-2">Dashboard do Paciente</Label>
        
        <div className="grid gap-2">
          <Label>Módulos visíveis (Abas do paciente)</Label>
          <div className="flex flex-col gap-2 mt-1">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="mod-faturas" 
                checked={(formData.modFaturas as boolean) ?? true}
                onCheckedChange={(v) => setFormData({ ...formData, modFaturas: !!v })}
              />
              <Label htmlFor="mod-faturas" className="font-normal cursor-pointer">Faturas e Cobranças</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="mod-arquivos" 
                checked={(formData.modArquivos as boolean) ?? true}
                onCheckedChange={(v) => setFormData({ ...formData, modArquivos: !!v })}
              />
              <Label htmlFor="mod-arquivos" className="font-normal cursor-pointer">Arquivos e Documentos</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="mod-prescricoes" 
                checked={(formData.modPrescricoes as boolean) ?? true}
                onCheckedChange={(v) => setFormData({ ...formData, modPrescricoes: !!v })}
              />
              <Label htmlFor="mod-prescricoes" className="font-normal cursor-pointer">Prescrições Ativas</Label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
