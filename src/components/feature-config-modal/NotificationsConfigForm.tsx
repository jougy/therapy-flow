import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import type { FeatureSubFormProps } from "./featureConfigTypes";

export function NotificationsConfigForm({ formData, setFormData }: FeatureSubFormProps) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <Label className="text-base font-semibold">Canais de Envio</Label>
        <div className="flex flex-col gap-3">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="chan-inapp" 
              checked={(formData.channelInApp as boolean) ?? true}
              onCheckedChange={(v) => setFormData({ ...formData, channelInApp: !!v })}
            />
            <Label htmlFor="chan-inapp" className="font-normal cursor-pointer">In-App (Plataforma)</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="chan-email" 
              checked={(formData.channelEmail as boolean) ?? false}
              onCheckedChange={(v) => setFormData({ ...formData, channelEmail: !!v })}
            />
            <Label htmlFor="chan-email" className="font-normal cursor-pointer">E-mail</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="chan-push" 
              checked={(formData.channelPush as boolean) ?? false}
              onCheckedChange={(v) => setFormData({ ...formData, channelPush: !!v })}
            />
            <Label htmlFor="chan-push" className="font-normal cursor-pointer">Push Notification (Celular)</Label>
          </div>
        </div>
      </div>

      <div className="grid gap-3 pt-4 border-t">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Agrupamento Diário</Label>
            <p className="text-sm text-muted-foreground">Enviar um resumo diário em vez de alertas avulsos.</p>
          </div>
          <Switch 
            checked={(formData.dailySummary as boolean) ?? false}
            onCheckedChange={(v) => setFormData({ ...formData, dailySummary: v })}
          />
        </div>
      </div>

      <div className="grid gap-3 pt-4 border-t">
        <Label>Retenção de Notificações</Label>
        <div className="flex items-center gap-3">
          <span className="text-sm">Deletar automaticamente após</span>
          <Input 
            type="number" 
            className="w-24" 
            placeholder="30" 
            min="1"
            value={formData.retentionDays ? String(formData.retentionDays) : ""}
            onChange={(e) => setFormData({ ...formData, retentionDays: Number(e.target.value) })}
          />
          <span className="text-sm">dias.</span>
        </div>
      </div>
    </div>
  );
}
