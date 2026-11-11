import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Copy,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

import { OnboardingStep1 } from "./affiliate-onboarding/OnboardingStep1";
import { OnboardingStep2 } from "./affiliate-onboarding/OnboardingStep2";
import { OnboardingStep3 } from "./affiliate-onboarding/OnboardingStep3";
import { OnboardingStep4 } from "./affiliate-onboarding/OnboardingStep4";
import type {
  AffiliateFormData,
  AffiliateOnboardingModalProps,
  PersonType,
} from "./affiliate-onboarding/types";

export * from "./affiliate-onboarding/types";
export * from "./affiliate-onboarding/helpers";

const INITIAL_FORM_DATA: AffiliateFormData = {
  name: "",
  email: "",
  fiscalEmail: "",
  cpfCnpj: "",
  mobilePhone: "",
  postalCode: "",
  address: "",
  addressNumber: "",
  complement: "",
  province: "",
  city: "",
  state: "",
  pixKeyType: "CPF",
  pixKey: "",
  bankName: "",
  bankAgency: "",
  bankAccount: "",
  totpCode: "",
  acceptedTerms: false,
};

export function AffiliateOnboardingModal({
  isOpen,
  onClose,
  affiliateId,
  defaultName = "",
  defaultEmail = "",
  onSuccess,
  onNavigateToPanel,
}: AffiliateOnboardingModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [personType, setPersonType] = useState<PersonType>("PF");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatedCoupon, setGeneratedCoupon] = useState<string>("CARLOS30");
  const [formData, setFormData] = useState<AffiliateFormData>({
    ...INITIAL_FORM_DATA,
    name: defaultName,
    email: defaultEmail,
    fiscalEmail: defaultEmail,
  });

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setIsSubmitting(false);
      setCopied(false);
    } else {
      if (defaultName && !formData.name) {
        setFormData((prev) => ({ ...prev, name: defaultName }));
      }
      if (defaultEmail && !formData.email) {
        setFormData((prev) => ({ ...prev, email: defaultEmail, fiscalEmail: defaultEmail }));
      }
    }
  }, [isOpen, defaultName, defaultEmail]);

  const isStep1Valid =
    formData.name.trim().length >= 3 &&
    formData.cpfCnpj.replace(/\D/g, "").length >= 11 &&
    formData.email.includes("@") &&
    formData.fiscalEmail.includes("@") &&
    formData.mobilePhone.replace(/\D/g, "").length >= 10 &&
    formData.postalCode.replace(/\D/g, "").length === 8 &&
    formData.address.trim().length > 0;

  const isStep2Valid =
    formData.pixKey.trim().length > 0 &&
    formData.bankName.trim().length > 0 &&
    formData.bankAgency.trim().length > 0 &&
    formData.bankAccount.trim().length > 0;

  const isStep3Valid =
    formData.totpCode.replace(/\D/g, "").length === 6 && formData.acceptedTerms && !isSubmitting;

  const handleSubmit = async () => {
    if (!isStep3Valid) return;
    setIsSubmitting(true);
    try {
      const cleanCpfCnpj = formData.cpfCnpj.replace(/\D/g, "");
      const cleanMobile = formData.mobilePhone.replace(/\D/g, "");
      const cleanCep = formData.postalCode.replace(/\D/g, "");

      let targetAffiliateId = affiliateId;
      if (!targetAffiliateId) {
        const { data: userRes } = await supabase.auth.getUser();
        if (userRes?.user?.id) {
          const { data: existingAff } = await supabase
            .from("affiliates")
            .select("id, coupon_code")
            .eq("user_id", userRes.user.id)
            .maybeSingle();
          if (existingAff?.id) {
            targetAffiliateId = existingAff.id;
            if (existingAff.coupon_code) setGeneratedCoupon(existingAff.coupon_code);
          }
        }
      }

      const { error } = await supabase.functions.invoke("provision-affiliate-asaas-account", {
        body: {
          affiliateId: targetAffiliateId || "00000000-0000-0000-0000-000000000000",
          name: formData.name.trim(),
          email: formData.email.trim(),
          fiscalEmail: formData.fiscalEmail.trim(),
          cpfCnpj: cleanCpfCnpj,
          mobilePhone: cleanMobile,
          address: formData.address.trim(),
          addressNumber: formData.addressNumber.trim(),
          complement: formData.complement.trim() || undefined,
          province: formData.province.trim() || undefined,
          postalCode: cleanCep,
          pixKey: formData.pixKey.trim(),
          pixKeyType: formData.pixKeyType,
          companyType: personType === "PJ" ? "LIMITED" : undefined,
          totpCode: formData.totpCode.replace(/\D/g, ""),
        },
      });

      if (error) throw error;

      const firstName = formData.name.trim().split(" ")[0].toUpperCase().replace(/[^A-Z0-9]/g, "");
      const coupon = firstName ? `${firstName}30` : "PLURI30";
      setGeneratedCoupon(coupon);
      setStep(4);
      onSuccess?.({ couponCode: coupon, referralLink: `https://pluri.health/?cupom=${coupon}` });
      toast({
        title: "Subconta criada com sucesso!",
        description: `Seu cupom nominal ${coupon} foi ativado com split automático Asaas.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao provisionar subconta Asaas.";
      toast({ title: "Falha no credenciamento", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = async () => {
    const link = `https://pluri.health/?cupom=${generatedCoupon}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({ title: "Link copiado!", description: "Link oficial copiado para a área de transferência." });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ title: "Copie o link manualmente", description: link });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-full max-w-lg min-w-0 overflow-x-hidden p-0 rounded-2xl border bg-background shadow-2xl flex flex-col max-h-[88dvh]"
        data-testid="affiliate-onboarding-modal"
      >
        <DialogHeader className="p-5 pb-3 border-b bg-muted/20 text-left space-y-1.5 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary w-fit">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Programa de Parceiros Oficiais</span>
          </div>
          <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            {step === 4 ? "Cadastro Concluído com Sucesso!" : "Credenciamento de Afiliado"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {step === 1 && "Etapa 1 de 3: Identificação fiscal e contato da subconta."}
            {step === 2 && "Etapa 2 de 3: Domicílio bancário para depósito líquido via split."}
            {step === 3 && "Etapa 3 de 3: Blindagem 2FA obrigatória e aceite de governança."}
            {step === 4 && "Sua subconta Asaas e cupom nominal já estão operacionais."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4 text-sm min-w-0 max-w-full">
          {step === 1 && (
            <OnboardingStep1
              personType={personType}
              setPersonType={setPersonType}
              formData={formData}
              setFormData={setFormData}
            />
          )}

          {step === 2 && (
            <OnboardingStep2 formData={formData} setFormData={setFormData} />
          )}

          {step === 3 && (
            <OnboardingStep3 formData={formData} setFormData={setFormData} />
          )}

          {step === 4 && <OnboardingStep4 couponCode={generatedCoupon} />}
        </div>

        <div className="p-4 border-t bg-muted/10 flex items-center justify-between gap-2 shrink-0">
          {step === 1 && (
            <>
              <Button type="button" variant="ghost" onClick={onClose} className="min-h-[44px] text-xs">
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => setStep(2)}
                disabled={!isStep1Valid}
                className="min-h-[44px] text-xs gap-1.5"
                data-testid="btn-step1-next"
              >
                <span>Avançar para Dados Bancários</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                className="min-h-[44px] text-xs gap-1"
                data-testid="btn-step2-back"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span>Voltar</span>
              </Button>
              <Button
                type="button"
                onClick={() => setStep(3)}
                disabled={!isStep2Valid}
                className="min-h-[44px] text-xs gap-1.5"
                data-testid="btn-step2-next"
              >
                <span>Avançar para 2FA</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </Button>
            </>
          )}

          {step === 3 && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(2)}
                disabled={isSubmitting}
                className="min-h-[44px] text-xs gap-1"
                data-testid="btn-step3-back"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span>Voltar</span>
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!isStep3Valid}
                className="min-h-[44px] text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                data-testid="btn-submit-onboarding"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Ativando Subconta...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Finalizar Cadastro e Ativar Subconta</span>
                  </>
                )}
              </Button>
            </>
          )}

          {step === 4 && (
            <div className="w-full flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyLink}
                className="flex-1 min-h-[44px] text-xs gap-1.5"
                data-testid="btn-copy-link"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
                <span>{copied ? "Link Copiado!" : "Copiar Link"}</span>
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToPanel?.();
                }}
                className="flex-1 min-h-[44px] text-xs gap-1.5"
                data-testid="btn-access-dashboard"
              >
                <span>Acessar Painel de Afiliado</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
