import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck } from "lucide-react";
import type { AffiliateFormData } from "./types";

interface OnboardingStep3Props {
  formData: AffiliateFormData;
  setFormData: React.Dispatch<React.SetStateAction<AffiliateFormData>>;
}

export function OnboardingStep3({ formData, setFormData }: OnboardingStep3Props) {
  return (
    <div className="space-y-4" data-testid="step-3-container">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-xs sm:text-sm">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Blindagem 2FA Obrigatória (Ente Auth / TOTP)</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Para garantir a soberania patrimonial e proteger seus saques de comissões, a criação da
          subconta Asaas exige a confirmação de um código de 6 dígitos do seu autenticador TOTP
          (ex: Ente Auth, Google Authenticator).
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="input-totp" className="text-xs font-medium">
          Código de Autenticação (6 dígitos) *
        </Label>
        <Input
          id="input-totp"
          data-testid="input-totp-code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={formData.totpCode}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              totpCode: e.target.value.replace(/\D/g, "").slice(0, 6),
            }))
          }
          placeholder="000000"
          className="min-h-[48px] text-center tracking-widest text-base font-mono font-bold"
        />
      </div>

      <div className="rounded-xl border p-3.5 bg-muted/20 space-y-2">
        <div className="flex items-start gap-2.5">
          <Checkbox
            id="terms-checkbox"
            data-testid="checkbox-terms"
            checked={formData.acceptedTerms}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, acceptedTerms: Boolean(checked) }))
            }
            className="mt-0.5"
          />
          <Label htmlFor="terms-checkbox" className="text-xs leading-relaxed text-foreground cursor-pointer">
            Declaro que li e concordo com os{" "}
            <span className="font-semibold text-primary underline">
              Termos de Adesão do Programa de Afiliados Pluri-Health
            </span>
            , garantindo conformidade fiscal, regras anti-pirâmide e carência de 40 dias.
          </Label>
        </div>
      </div>
    </div>
  );
}
