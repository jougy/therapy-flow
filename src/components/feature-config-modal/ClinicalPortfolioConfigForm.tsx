import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Briefcase } from "lucide-react";
import type { FeatureSubFormProps } from "./featureConfigTypes";

export function ClinicalPortfolioConfigForm({ formData, setFormData }: FeatureSubFormProps) {
  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 mb-1 text-primary font-semibold text-sm">
          <Briefcase className="w-4 h-4" />
          Portfólio Clínico Profissional (Acervo Pessoal)
        </div>
        <p>
          Configurações do acervo técnico e histórico de atendimentos realizados sob a responsabilidade técnica do profissional, acessível no Espaço Pessoal (/espacopessoal).
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
          <div className="space-y-0.5 pr-4">
            <Label htmlFor="show-lgpd-banner" className="font-semibold text-sm cursor-pointer">
              Banner de Conformidade LGPD
            </Label>
            <p className="text-xs text-muted-foreground">
              Exibe banner institucional de conformidade jurídica com a LGPD e sigilo profissional no topo do portfólio.
            </p>
          </div>
          <Switch
            id="show-lgpd-banner"
            checked={(formData.show_lgpd_banner as boolean) ?? true}
            onCheckedChange={(val) => setFormData({ ...formData, show_lgpd_banner: val })}
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
          <div className="space-y-0.5 pr-4">
            <Label htmlFor="allow-clinic-filter" className="font-semibold text-sm cursor-pointer">
              Busca e Filtragem por Clínica
            </Label>
            <p className="text-xs text-muted-foreground">
              Permite ao profissional filtrar seus atendimentos e pacientes por clínica no portfólio pessoal.
            </p>
          </div>
          <Switch
            id="allow-clinic-filter"
            checked={(formData.allow_clinic_filter as boolean) ?? true}
            onCheckedChange={(val) => setFormData({ ...formData, allow_clinic_filter: val })}
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
          <div className="space-y-0.5 pr-4">
            <Label htmlFor="allow-clinic-redirect" className="font-semibold text-sm cursor-pointer">
              Atalho de Redirecionamento para Prontuário
            </Label>
            <p className="text-xs text-muted-foreground">
              Permite abrir diretamente o prontuário completo da clínica quando o profissional ainda for membro ativo.
            </p>
          </div>
          <Switch
            id="allow-clinic-redirect"
            checked={(formData.allow_clinic_redirect as boolean) ?? true}
            onCheckedChange={(val) => setFormData({ ...formData, allow_clinic_redirect: val })}
          />
        </div>

        <div className="space-y-2 pt-2 border-t">
          <Label htmlFor="maintenance-message" className="text-sm font-semibold">
            Mensagem de Manutenção (Opcional)
          </Label>
          <p className="text-xs text-muted-foreground">
            Se preenchida, será exibida aos profissionais como aviso especial ou comunicado de manutenção temporária no Espaço Pessoal.
          </p>
          <Textarea
            id="maintenance-message"
            placeholder="Ex: O acervo de atendimentos está passando por sincronização programada..."
            value={(formData.maintenance_message as string) || ""}
            onChange={(e) => setFormData({ ...formData, maintenance_message: e.target.value })}
            className="resize-none"
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}
