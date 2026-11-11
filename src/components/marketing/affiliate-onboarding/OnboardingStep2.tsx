import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";
import type { AffiliateFormData } from "./types";

interface OnboardingStep2Props {
  formData: AffiliateFormData;
  setFormData: React.Dispatch<React.SetStateAction<AffiliateFormData>>;
}

export function OnboardingStep2({ formData, setFormData }: OnboardingStep2Props) {
  return (
    <div className="space-y-3.5" data-testid="step-2-container">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2">
        <div className="flex items-center gap-2 text-primary font-semibold text-xs">
          <Building2 className="w-4 h-4 shrink-0" />
          <span>Subconta Asaas de Repasse Direto</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Os valores de comissão de fechamento (30%) e recorrência (10%) serão creditados
          diretamente na sua chave PIX e conta cadastrada via split automático sem bitributação.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Tipo de Chave PIX *</Label>
          <Select
            value={formData.pixKeyType}
            onValueChange={(val) => setFormData((prev) => ({ ...prev, pixKeyType: val }))}
          >
            <SelectTrigger className="min-h-[44px] text-xs" data-testid="select-pix-type">
              <SelectValue placeholder="Tipo de PIX" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CPF">CPF</SelectItem>
              <SelectItem value="CNPJ">CNPJ</SelectItem>
              <SelectItem value="EMAIL">E-mail</SelectItem>
              <SelectItem value="PHONE">Celular</SelectItem>
              <SelectItem value="EVP">Chave Aleatória</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="input-pix" className="text-xs font-medium">
            Chave PIX *
          </Label>
          <Input
            id="input-pix"
            data-testid="input-pix-key"
            value={formData.pixKey}
            onChange={(e) => setFormData((prev) => ({ ...prev, pixKey: e.target.value }))}
            placeholder="Informe a chave PIX para recebimento"
            className="min-h-[44px] text-xs"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="input-bank-name" className="text-xs font-medium">
          Banco (Nome ou Código) *
        </Label>
        <Input
          id="input-bank-name"
          data-testid="input-bank-name"
          value={formData.bankName}
          onChange={(e) => setFormData((prev) => ({ ...prev, bankName: e.target.value }))}
          placeholder="Ex: Nubank (260), Itaú (341), Inter (077)"
          className="min-h-[44px] text-xs"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="input-agency" className="text-xs font-medium">
            Agência *
          </Label>
          <Input
            id="input-agency"
            data-testid="input-bank-agency"
            value={formData.bankAgency}
            onChange={(e) => setFormData((prev) => ({ ...prev, bankAgency: e.target.value }))}
            placeholder="Ex: 0001"
            className="min-h-[44px] text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="input-account" className="text-xs font-medium">
            Conta com Dígito *
          </Label>
          <Input
            id="input-account"
            data-testid="input-bank-account"
            value={formData.bankAccount}
            onChange={(e) => setFormData((prev) => ({ ...prev, bankAccount: e.target.value }))}
            placeholder="Ex: 1234567-8"
            className="min-h-[44px] text-xs"
          />
        </div>
      </div>
    </div>
  );
}
