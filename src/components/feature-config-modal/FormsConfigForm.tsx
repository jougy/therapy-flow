import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { FeatureSubFormProps } from "./featureConfigTypes";

export function FormsConfigForm({ formData, setFormData }: FeatureSubFormProps) {
  return (
    <div className="grid gap-8">
      <div className="grid gap-3">
        <Label className="text-base font-semibold">Links Públicos</Label>
        <div className="flex items-center gap-3">
          <span className="text-sm">Validade do link</span>
          <Input 
            type="number" 
            className="w-24" 
            placeholder="48" 
            min="1"
            value={formData.publicLinkValidityHours ? String(formData.publicLinkValidityHours) : ""}
            onChange={(e) => setFormData({ ...formData, publicLinkValidityHours: Number(e.target.value) })}
          />
          <span className="text-sm">horas.</span>
        </div>
      </div>

      <div className="grid gap-4 pt-4 border-t">
        <Label className="text-base font-semibold">Recursos Avançados</Label>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="sw-assinatura" className="font-normal cursor-pointer">Assinatura digital exigida</Label>
            <Switch 
              id="sw-assinatura"
              checked={(formData.requireDigitalSignature as boolean) ?? false}
              onCheckedChange={(v) => setFormData({ ...formData, requireDigitalSignature: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="sw-upload" className="font-normal cursor-pointer">Upload assíncrono pelo paciente</Label>
            <Switch 
              id="sw-upload"
              checked={(formData.asyncPatientUpload as boolean) ?? false}
              onCheckedChange={(v) => setFormData({ ...formData, asyncPatientUpload: v })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
