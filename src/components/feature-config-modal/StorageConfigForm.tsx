import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { FeatureSubFormProps } from "./featureConfigTypes";

export function StorageConfigForm({ formData, setFormData }: FeatureSubFormProps) {
  return (
    <div className="grid gap-6">
      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3.5 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Armazenamento Seguro em Nuvem (Backblaze B2 / S3)</p>
        <p>
          As credenciais e endpoints de conexão do storage são gerenciados de forma segura e criptografada pelo servidor backend (Edge Functions), evitando qualquer exposição de chaves de infraestrutura no navegador.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Tamanho máximo por arquivo (MB)</Label>
          <Input 
            type="number"
            min="1"
            max="50"
            placeholder="50" 
            value={formData.maxSizeMb ? String(formData.maxSizeMb) : ""}
            onChange={(e) => setFormData({ ...formData, maxSizeMb: Math.max(1, Number(e.target.value)) })}
          />
        </div>
        <div className="grid gap-2">
          <Label>Extensões permitidas</Label>
          <Input 
            placeholder=".pdf, .jpg, .png, .webp" 
            value={(formData.allowedExtensions as string) || ""}
            onChange={(e) => setFormData({ ...formData, allowedExtensions: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
