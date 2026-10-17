import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { FeatureSubFormProps } from "./featureConfigTypes";

export function AntiPrintConfigForm({ formData, setFormData }: FeatureSubFormProps) {
  const availableRoutes = [
    { path: "/pacientes", label: "/pacientes (Fichas e Prontuários)", defaultChecked: true },
    { path: "/sessoes", label: "/sessoes (Atendimentos e Evoluções)", defaultChecked: true },
    { path: "/formularios", label: "/formularios (Respostas de Formulários)", defaultChecked: true },
    { path: "/configuracoes/equipe", label: "/configuracoes/equipe (Dados de Colaboradores)", defaultChecked: true },
    { path: "/dashboard", label: "/dashboard (Painel Geral da Clínica)", defaultChecked: false },
    { path: "/configuracoes/clinica", label: "/configuracoes/clinica (Configurações Gerais)", defaultChecked: false },
  ];

  const currentRoutes: string[] = Array.isArray(formData.protectedRoutes)
    ? (formData.protectedRoutes as string[])
    : availableRoutes.filter(r => r.defaultChecked).map(r => r.path);

  const toggleRoute = (path: string, checked: boolean) => {
    let updated: string[];
    if (checked) {
      updated = Array.from(new Set([...currentRoutes, path]));
    } else {
      updated = currentRoutes.filter(r => r !== path);
    }
    setFormData({ ...formData, protectedRoutes: updated });
  };

  return (
    <div className="grid gap-6">
      <div className="space-y-1">
        <Label className="text-base font-semibold">Checklist de Páginas Protegidas</Label>
        <p className="text-xs text-muted-foreground">
          Selecione quais páginas da aplicação ativam o desfoque imediato, alerta visual e log de auditoria ao tentar tirar captura de tela.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 bg-neutral-50/50">
        {availableRoutes.map((route) => {
          const isChecked = currentRoutes.includes(route.path);
          return (
            <div key={route.path} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white transition-colors">
              <Checkbox
                id={`route-${route.path}`}
                checked={isChecked}
                onCheckedChange={(v) => toggleRoute(route.path, !!v)}
              />
              <Label htmlFor={`route-${route.path}`} className="font-medium text-sm cursor-pointer text-neutral-800">
                {route.label}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
