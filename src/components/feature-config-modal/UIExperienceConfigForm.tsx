import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FeatureSubFormProps } from "./featureConfigTypes";

export function UIExperienceConfigForm({ formData, setFormData }: FeatureSubFormProps) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Label>Nível de animação</Label>
        <Select 
          value={(formData.animationLevel as string) || "fluido"} 
          onValueChange={(val) => setFormData({ ...formData, animationLevel: val })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desligado">Desligado</SelectItem>
            <SelectItem value="basico">Básico</SelectItem>
            <SelectItem value="fluido">Fluido (Padrão)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label>Densidade da UI</Label>
        <Select 
          value={(formData.density as string) || "confortavel"} 
          onValueChange={(val) => setFormData({ ...formData, density: val })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="compacto">Compacto</SelectItem>
            <SelectItem value="confortavel">Confortável</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label>Forçar Tema</Label>
        <Select 
          value={(formData.forceTheme as string) || "user"} 
          onValueChange={(val) => setFormData({ ...formData, forceTheme: val })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="claro">Claro (Light)</SelectItem>
            <SelectItem value="escuro">Escuro (Dark)</SelectItem>
            <SelectItem value="user">Escolha do Usuário (Sistema)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
