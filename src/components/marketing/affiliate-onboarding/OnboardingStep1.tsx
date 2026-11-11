import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Building2 } from "lucide-react";
import { formatCpfCnpj, formatPhone, formatCep, lookupCep } from "./helpers";
import type { AffiliateFormData, PersonType } from "./types";

interface OnboardingStep1Props {
  personType: PersonType;
  setPersonType: (type: PersonType) => void;
  formData: AffiliateFormData;
  setFormData: React.Dispatch<React.SetStateAction<AffiliateFormData>>;
}

export function OnboardingStep1({
  personType,
  setPersonType,
  formData,
  setFormData,
}: OnboardingStep1Props) {
  const [isSearchingCep, setIsSearchingCep] = useState(false);

  const handleCepChange = async (val: string) => {
    const formatted = formatCep(val);
    setFormData((prev) => ({ ...prev, postalCode: formatted }));
    const clean = formatted.replace(/\D/g, "");
    if (clean.length === 8) {
      setIsSearchingCep(true);
      const res = await lookupCep(clean);
      setIsSearchingCep(false);
      if (res) {
        setFormData((prev) => ({
          ...prev,
          address: res.address || prev.address,
          province: res.province || prev.province,
          city: res.city || prev.city,
          state: res.state || prev.state,
        }));
      }
    }
  };

  return (
    <div className="space-y-3.5" data-testid="step-1-container">
      <div className="grid grid-cols-2 gap-2 p-1 bg-muted/50 rounded-xl">
        <Button
          type="button"
          variant={personType === "PF" ? "default" : "ghost"}
          size="sm"
          onClick={() => setPersonType("PF")}
          className="min-h-[44px] gap-2 text-xs font-semibold rounded-lg"
          data-testid="toggle-pf"
        >
          <User className="w-4 h-4 shrink-0" />
          <span>Pessoa Física (PF)</span>
        </Button>
        <Button
          type="button"
          variant={personType === "PJ" ? "default" : "ghost"}
          size="sm"
          onClick={() => setPersonType("PJ")}
          className="min-h-[44px] gap-2 text-xs font-semibold rounded-lg"
          data-testid="toggle-pj"
        >
          <Building2 className="w-4 h-4 shrink-0" />
          <span>Pessoa Jurídica (PJ)</span>
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="input-name" className="text-xs font-medium">
          {personType === "PF" ? "Nome Completo" : "Razão Social"} *
        </Label>
        <Input
          id="input-name"
          data-testid="input-name"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder={personType === "PF" ? "Ex: Carlos Eduardo Silva" : "Ex: Silva Fisioterapia LTDA"}
          className="min-h-[44px] text-xs"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="input-doc" className="text-xs font-medium">
            {personType === "PF" ? "CPF" : "CNPJ"} *
          </Label>
          <Input
            id="input-doc"
            data-testid="input-cpf-cnpj"
            value={formData.cpfCnpj}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, cpfCnpj: formatCpfCnpj(e.target.value) }))
            }
            placeholder={personType === "PF" ? "000.000.000-00" : "00.000.000/0000-00"}
            className="min-h-[44px] text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="input-phone" className="text-xs font-medium">
            WhatsApp / Celular *
          </Label>
          <Input
            id="input-phone"
            data-testid="input-phone"
            value={formData.mobilePhone}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, mobilePhone: formatPhone(e.target.value) }))
            }
            placeholder="(00) 00000-0000"
            className="min-h-[44px] text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="input-email" className="text-xs font-medium">
            E-mail Financeiro *
          </Label>
          <Input
            id="input-email"
            type="email"
            data-testid="input-email"
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="financeiro@email.com"
            className="min-h-[44px] text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="input-fiscal-email" className="text-xs font-medium">
            E-mail Fiscal (NFTS / NFS-e) *
          </Label>
          <Input
            id="input-fiscal-email"
            type="email"
            data-testid="input-fiscal-email"
            value={formData.fiscalEmail}
            onChange={(e) => setFormData((prev) => ({ ...prev, fiscalEmail: e.target.value }))}
            placeholder="notas@email.com"
            className="min-h-[44px] text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1 space-y-1.5">
          <Label htmlFor="input-cep" className="text-xs font-medium">
            CEP *
          </Label>
          <Input
            id="input-cep"
            data-testid="input-cep"
            value={formData.postalCode}
            onChange={(e) => handleCepChange(e.target.value)}
            placeholder="00000-000"
            className="min-h-[44px] text-xs"
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="input-address" className="text-xs font-medium">
            Endereço {isSearchingCep ? "(Buscando...)" : "*"}
          </Label>
          <Input
            id="input-address"
            data-testid="input-address"
            value={formData.address}
            onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
            placeholder="Logradouro, Avenida, Rua"
            className="min-h-[44px] text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="input-number" className="text-xs font-medium">
            Número *
          </Label>
          <Input
            id="input-number"
            data-testid="input-number"
            value={formData.addressNumber}
            onChange={(e) => setFormData((prev) => ({ ...prev, addressNumber: e.target.value }))}
            placeholder="Ex: 123"
            className="min-h-[44px] text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="input-complement" className="text-xs font-medium">
            Complemento
          </Label>
          <Input
            id="input-complement"
            value={formData.complement}
            onChange={(e) => setFormData((prev) => ({ ...prev, complement: e.target.value }))}
            placeholder="Sala 4, Bloco B"
            className="min-h-[44px] text-xs"
          />
        </div>
      </div>
    </div>
  );
}
