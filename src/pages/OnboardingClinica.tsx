import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Building2, HelpCircle, Loader2, ShieldCheck, CreditCard, Lock, Tag, CheckCircle2, AlertCircle } from "lucide-react";
import { TermsOfServiceModal } from "@/components/TermsOfServiceModal";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { isOwnerDocumentValid } from "@/lib/owner-document";
import { createClinicWithVerifiedCard } from "@/services/asaasService";
import {
  detectCardBrand,
  validateLuhn,
  validateExpiry,
  validateCvv,
  validateCardHolder,
  type CardBrand,
} from "@/utils/creditCardValidator";
import { toast } from "sonner";
import { lookupCep } from "@/lib/cep-service";

const formatCPF = (v: string) => {
  v = v.replace(/\D/g, "");
  if (v.length > 11) v = v.slice(0, 11);
  return v
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

const formatCNPJ = (v: string) => {
  v = v.replace(/\D/g, "");
  if (v.length > 14) v = v.slice(0, 14);
  return v
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

const formatPhone = (v: string) => {
  v = v.replace(/\D/g, "");
  if (v.length > 11) v = v.slice(0, 11);
  return v
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{4,5})(\d{4})$/, "$1-$2");
};

const formatCEP = (v: string) => {
  v = v.replace(/\D/g, "");
  if (v.length > 8) v = v.slice(0, 8);
  return v.replace(/(\d{5})(\d)/, "$1-$2");
};

const cleanDigits = (v: string) => v.replace(/\D/g, "");

type ClinicAddress = {
  country?: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
};

type BusinessHours = {
  description?: string;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return "Erro ao salvar os dados.";
};

export default function OnboardingClinica() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clinic, profile, session, selectClinic, refreshAuthState } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  
  const plan = (searchParams.get("plan") as "solo" | "clinic" | null) || "solo";
  const isTrial = searchParams.get("trial") === "true";
  const initialConcurrent = parseInt(searchParams.get("concurrent") || (plan === "clinic" ? "2" : "1"), 10);
  const initialSpaces = parseInt(searchParams.get("spaces") || (plan === "clinic" ? "30" : "1"), 10);

  const isExplicitCreate = searchParams.get("mode") === "create" || !!searchParams.get("plan");
  const isCurrentClinicOwnedByMe = Boolean(clinic?.account_owner_user_id && session?.user?.id && clinic.account_owner_user_id === session.user.id);
  const isCreateMode = !clinic || !isCurrentClinicOwnedByMe || isExplicitCreate;

  const requireOwnerTerms = isFeatureEnabled("require_owner_terms_on_clinic_creation");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);

  const [formData, setFormData] = useState({
    name: !isCreateMode ? (clinic?.name || "") : "",
    logo_url: !isCreateMode ? (clinic?.logo_url || "") : "",
    email: profile?.email || session?.user?.email || "",
    phone: profile?.phone ? formatPhone(profile.phone) : "",
    legal_name: "",
    cpf: profile?.cpf ? formatCPF(profile.cpf) : "",
    cnpj: "",
    business_hours: "",
    country: "BR",
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    subaccount_limit: (!isCreateMode && clinic?.subaccount_limit) ? clinic.subaccount_limit.toString() : initialSpaces.toString(),
    concurrent_access_limit: (!isCreateMode && clinic?.concurrent_access_limit) ? Math.max(plan === "clinic" ? 2 : 1, clinic.concurrent_access_limit).toString() : initialConcurrent.toString(),
  });

  // Estado dos campos do Cartão de Crédito (Obrigatório em modo de criação)
  const [cardForm, setCardForm] = useState({
    holderName: "",
    number: "",
    expiry: "",
    ccv: "",
  });

  const cardBrand = detectCardBrand(cardForm.number);

  // Estado de Cupom Promocional (Opcional, ex: SOUPLURIBETA)
  const [couponInput, setCouponInput] = useState(searchParams.get("coupon") || searchParams.get("cupom") || "");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    valid: boolean;
    code?: string;
    description?: string;
    discount_type?: string;
    discount_value?: number;
  } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const handleValidateCoupon = useCallback(async (codeToValidate?: string) => {
    const targetCode = (codeToValidate || couponInput).trim().toUpperCase();
    if (!targetCode) {
      setCouponError("Informe o código do cupom.");
      setAppliedCoupon(null);
      return;
    }
    setValidatingCoupon(true);
    setCouponError(null);
    try {
      const { data, error } = await supabase.rpc("validate_subscription_coupon", {
        _code: targetCode,
        _plan_type: plan === "clinic" ? "clinic" : "solo",
      });
      if (error) throw error;
      const res = data as any;
      if (res && res.valid) {
        setAppliedCoupon(res);
        setCouponInput(res.code || targetCode);
        setCouponError(null);
        toast.success(`Cupom ${res.code || targetCode} aplicado com sucesso!`);
      } else {
        setAppliedCoupon(null);
        setCouponError(res?.message || "Cupom inválido ou expirado.");
      }
    } catch {
      setAppliedCoupon(null);
      setCouponError("Erro ao validar cupom.");
    } finally {
      setValidatingCoupon(false);
    }
  }, [couponInput, plan]);

  useEffect(() => {
    const urlCoupon = searchParams.get("coupon") || searchParams.get("cupom");
    if (urlCoupon && isCreateMode) {
      void handleValidateCoupon(urlCoupon);
    }
  }, [searchParams, isCreateMode, handleValidateCoupon]);

  // Carregar dados detalhados da clínica existente quando em modo de edição
  useEffect(() => {
    if (isCreateMode || !clinic?.id) return;
    let active = true;

    async function loadExistingClinic() {
      const { data, error } = await supabase
        .from("clinics")
        .select("*")
        .eq("id", clinic.id)
        .single();

      if (!active || error || !data) return;

      const addressData = (data.address && typeof data.address === "object" ? data.address : {}) as ClinicAddress;
      const hoursData = (data.business_hours && typeof data.business_hours === "object" ? data.business_hours : {}) as BusinessHours;

      setFormData((prev) => ({
        ...prev,
        name: data.name || prev.name,
        logo_url: data.logo_url || prev.logo_url,
        email: data.email || prev.email,
        phone: data.phone ? formatPhone(data.phone) : prev.phone,
        legal_name: data.legal_name || prev.legal_name,
        cnpj: data.cnpj ? formatCNPJ(data.cnpj) : prev.cnpj,
        business_hours: hoursData.description || prev.business_hours,
        country: addressData.country || prev.country,
        cep: addressData.cep ? formatCEP(addressData.cep) : prev.cep,
        street: addressData.street || prev.street,
        number: addressData.number || prev.number,
        complement: addressData.complement || prev.complement,
        neighborhood: addressData.neighborhood || prev.neighborhood,
        city: addressData.city || prev.city,
        state: addressData.state || prev.state,
        subaccount_limit: data.subaccount_limit ? data.subaccount_limit.toString() : prev.subaccount_limit,
        concurrent_access_limit: data.concurrent_access_limit ? data.concurrent_access_limit.toString() : prev.concurrent_access_limit,
      }));
    }

    void loadExistingClinic();

    return () => {
      active = false;
    };
  }, [clinic?.id, isCreateMode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fieldName = e.target.name;
    let value = e.target.value;

    if (fieldName === "cpf") value = formatCPF(value);
    if (fieldName === "cnpj") value = formatCNPJ(value);
    if (fieldName === "phone") value = formatPhone(value);
    if (fieldName === "cep") {
      value = formatCEP(value);
      handleCepChange(value);
    }

    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCepChange = async (cepValue: string) => {
    if (formData.country !== "BR") return;
    const cleanCep = cleanDigits(cepValue);
    if (cleanCep.length === 8) {
      setFetchingCep(true);
      try {
        const data = await lookupCep(cleanCep);
        setFormData((prev) => ({
          ...prev,
          street: data.street || prev.street,
          neighborhood: data.neighborhood || prev.neighborhood,
          city: data.city || prev.city,
          state: data.state || prev.state,
        }));
      } catch (error) {
        console.error("Error fetching CEP:", error);
      } finally {
        setFetchingCep(false);
      }
    }
  };

  const parsedConcurrent = Math.max(plan === "clinic" ? 2 : 1, parseInt(formData.concurrent_access_limit || "2", 10));

  const [duplicateCnpjModalOpen, setDuplicateCnpjModalOpen] = useState(false);
  const [existingClinicNameForCnpj, setExistingClinicNameForCnpj] = useState("");

  const executeSignupProcess = async (allowDuplicateCnpj = false) => {
    if (loading) return;

    if (!session?.user?.id) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }

    if (requireOwnerTerms && !termsAccepted) {
      toast.error("Você precisa aceitar os Termos de Uso e Responsabilidade do Titular para prosseguir.");
      return;
    }

    const cleanCpf = cleanDigits(formData.cpf);
    const cleanCnpj = cleanDigits(formData.cnpj);

    if (!cleanCpf && !cleanCnpj) {
      toast.error("Informe o CPF do responsável ou o CNPJ da clínica.");
      return;
    }

    if (cleanCpf && !isOwnerDocumentValid(cleanCpf)) {
      toast.error("CPF informado é inválido.");
      return;
    }

    if (cleanCnpj && !isOwnerDocumentValid(cleanCnpj)) {
      toast.error("CNPJ informado é inválido.");
      return;
    }

    const documentToUse = cleanCnpj || cleanCpf;

    if (isCreateMode) {
      const cleanCard = cleanDigits(cardForm.number);
      const cleanCvv = cleanDigits(cardForm.ccv);
      const cleanExpiry = cardForm.expiry.trim();

      if (!cardForm.holderName.trim() || !validateCardHolder(cardForm.holderName)) {
        toast.error("Informe o nome completo do titular como impresso no cartão.");
        return;
      }

      if (!cleanCard || !validateLuhn(cleanCard)) {
        toast.error("Número de cartão de crédito inválido.");
        return;
      }

      const expRes = validateExpiry(cleanExpiry);
      if (!expRes.valid) {
        toast.error(expRes.error || "Data de validade do cartão inválida.");
        return;
      }

      if (!validateCvv(cleanCvv, cardBrand)) {
        toast.error("Código de segurança (CVV) inválido.");
        return;
      }
    }

    setLoading(true);
    let isSuccess = false;

    try {
      let targetClinicId = clinic?.id;

      const addressJson = {
        country: formData.country,
        cep: formData.cep,
        street: formData.street,
        number: formData.number,
        complement: formData.complement,
        neighborhood: formData.neighborhood,
        city: formData.city,
        state: formData.state,
      };

      const businessHoursJson = {
        description: formData.business_hours,
      };

      const parsedSubaccounts = plan === "clinic" ? Math.max(1, parseInt(formData.subaccount_limit || "30", 10)) : 1;

      if (isCreateMode) {
        const cleanCard = cleanDigits(cardForm.number);
        const cleanCvv = cleanDigits(cardForm.ccv);
        const cleanExpiry = cardForm.expiry.trim();
        const [expMonth, expYearShort] = cleanExpiry.split("/");

        const result = await createClinicWithVerifiedCard({
          plan_type: plan === "clinic" ? "clinic" : "solo",
          billing_cycle: "annual",
          cpf_cnpj: documentToUse,
          coupon_code: appliedCoupon?.code || (couponInput.trim() ? couponInput.trim().toUpperCase() : undefined),
          allow_duplicate_cnpj: allowDuplicateCnpj,
          clinic_data: {
            name: formData.name || "Minha Clínica",
            logo_url: formData.logo_url || undefined,
            email: formData.email || session.user.email || undefined,
            phone: formData.phone || undefined,
            legal_name: formData.legal_name || undefined,
            cnpj: cleanCnpj || undefined,
            cpf: cleanCpf || undefined,
            address: addressJson,
            business_hours: businessHoursJson.description || undefined,
            subaccount_limit: parsedSubaccounts,
            concurrent_access_limit: parsedConcurrent,
          },
          credit_card_data: {
            card: {
              holderName: cardForm.holderName.trim().toUpperCase(),
              number: cleanCard,
              expiryMonth: expMonth,
              expiryYear: `20${expYearShort}`,
              ccv: cleanCvv,
            },
            holder: {
              name: cardForm.holderName.trim().toUpperCase(),
              email: formData.email || session.user.email || undefined,
              cpfCnpj: documentToUse,
              postalCode: cleanDigits(formData.cep) || undefined,
              addressNumber: formData.number || "SN",
              phone: cleanDigits(formData.phone) || undefined,
            },
          },
        });

        if (!result.success) {
          const msg = result.error || "";
          const docLabel = cleanCnpj ? "CNPJ" : "CPF";
          if (msg.includes("CNPJ_REGISTERED_TO_OTHER_USER")) {
            toast.error(`Este ${docLabel} já está sendo utilizado pela conta de outro proprietário na plataforma. Caso este seja o seu documento oficial, entre em contato com nosso suporte.`);
            setLoading(false);
            return;
          }
          if (msg.includes("OWNER_HAS_CLINIC_WITH_CNPJ:")) {
            const existingName = msg.split("OWNER_HAS_CLINIC_WITH_CNPJ:")[1] || "outra clínica sua";
            setExistingClinicNameForCnpj(existingName);
            setDuplicateCnpjModalOpen(true);
            setLoading(false);
            return;
          }
          if (msg.includes("Ja existe uma clinica cadastrada com este CNPJ")) {
            setExistingClinicNameForCnpj("sua outra clínica");
            setDuplicateCnpjModalOpen(true);
            setLoading(false);
            return;
          }
          throw new Error(msg || "Não foi possível validar o cartão e criar a clínica.");
        }

        if (!result.clinic_id) {
          throw new Error("Não foi possível identificar a clínica criada.");
        }

        targetClinicId = result.clinic_id;
      } else {
        if (!targetClinicId) {
          toast.error("Clínica não encontrada.");
          return;
        }

        const clinicPayload: Database["public"]["Tables"]["clinics"]["Update"] = {
          name: formData.name,
          logo_url: formData.logo_url || null,
          email: formData.email || null,
          phone: formData.phone || null,
          legal_name: formData.legal_name || null,
          cnpj: documentToUse,
          address: addressJson,
          business_hours: businessHoursJson,
          subscription_plan: plan || "solo",
          subaccount_limit: parsedSubaccounts,
          concurrent_access_limit: parsedConcurrent,
        };

        const { error: clinicError } = await supabase
          .from("clinics")
          .update(clinicPayload)
          .eq("id", targetClinicId);

        if (clinicError) throw clinicError;
      }

      // Atualizar termos e CPF no perfil do usuário
      const profileUpdates: Database["public"]["Tables"]["profiles"]["Update"] = {
        owner_terms_accepted_at: new Date().toISOString(),
      };
      if (cleanCpf) {
        profileUpdates.cpf = cleanCpf;
      }
      await supabase.from("profiles").update(profileUpdates).eq("id", session.user.id);

      if (isCreateMode && targetClinicId) {
        if (typeof refreshAuthState === "function") {
          await refreshAuthState();
        }
        if (typeof selectClinic === "function") {
          try {
            await selectClinic(targetClinicId);
          } catch (selectErr) {
            console.warn("Auto-seleção de clínica:", selectErr);
          }
        }
        isSuccess = true;
        toast.success("Clínica cadastrada e cartão verificado com sucesso! Degustação de 7 dias ativada.");
        navigate("/espacopessoal", { replace: true });
        return;
      }

      isSuccess = true;
      toast.success("Dados da clínica atualizados com sucesso!");
      navigate("/espacopessoal", { replace: true });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage);
    } finally {
      if (!isSuccess) {
        setLoading(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSignupProcess(false);
  };

  const FieldLabel = ({ label, tooltip, htmlFor, required = false }: { label: string; tooltip: string; htmlFor: string; required?: boolean }) => (
    <div className="flex items-center gap-2 mb-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground/90">
        {label}
      </Label>
      {required && <span className="text-destructive">*</span>}
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" tabIndex={-1} className="rounded-full outline-none focus:ring-2 focus:ring-primary/50">
            <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" className="max-w-[300px] bg-popover border-border text-popover-foreground p-3 text-sm z-50">
          {tooltip}
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center py-6 px-4 sm:py-12 sm:px-6 relative overflow-y-auto overflow-x-hidden">
      {/* Background Glow */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-primary/10 rounded-full blur-[100px] sm:blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-emerald-500/10 rounded-full blur-[100px] sm:blur-[120px]" />
      </div>

      <div className="z-10 w-full max-w-4xl space-y-6 sm:space-y-8">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate("/espacopessoal")}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground hover:bg-muted border border-border rounded-xl px-3 py-2 text-xs sm:text-sm font-medium transition-colors inline-flex items-center gap-2 min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Espaço Pessoal</span>
          </Button>

          {isCreateMode && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigate("/planos")}
              disabled={loading}
              className="text-muted-foreground hover:text-foreground text-xs sm:text-sm inline-flex items-center gap-1.5 min-h-[44px]"
            >
              Trocar plano
            </Button>
          )}
        </div>

        {/* Header */}
        <div className="text-left flex items-start gap-4">
          <img
            src="/branding/logo/pluri_health_icon_gradient.svg"
            alt="Pluri-Health"
            className="h-12 w-12 shrink-0 drop-shadow-md hidden sm:block mt-1"
          />
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs sm:text-sm font-medium mb-3">
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span>{isCreateMode ? (plan === "clinic" ? "Novo Espaço: Clínica com Equipe" : "Novo Espaço: Profissional Solo") : "Configuração da Clínica"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-2">
              {isCreateMode ? "Cadastre seu Próprio Espaço" : "Configure sua Clínica"}
            </h1>
            <p className="text-xs sm:text-base text-muted-foreground max-w-2xl">
              {isTrial
                ? "Preencha os dados abaixo para ativar seu espaço em Modo Degustação Gratuita (20 atendimentos)."
                : "Preencha os dados abaixo para configurar o ambiente de atendimento e prosseguir ao checkout seguro."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
          {/* Identidade e Contato */}
          <Card className="bg-card/80 border-border backdrop-blur-md shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4 border-b border-border/50">
              <CardTitle className="text-lg sm:text-xl text-foreground font-semibold">Identidade e Contato</CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground">Como sua clínica será identificada.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 grid gap-4 sm:gap-6 sm:grid-cols-2">
              <div className="space-y-1">
                <FieldLabel htmlFor="name" label="Nome da Clínica" tooltip="Nome fantasia ou comercial exibido aos pacientes." required />
                <Input id="name" name="name" required value={formData.name} onChange={handleChange} className="bg-background border-border text-foreground h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-primary" placeholder="Ex: Clínica Bem Estar" />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor="logo_url" label="URL do Logo" tooltip="Link da imagem do seu logotipo." />
                <Input id="logo_url" name="logo_url" value={formData.logo_url} onChange={handleChange} className="bg-background border-border text-foreground h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-primary" placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor="email" label="E-mail Institucional" tooltip="E-mail de contato e faturamento." />
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} className="bg-background border-border text-foreground h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-primary" placeholder="contato@clinica.com" />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor="phone" label="Telefone / WhatsApp" tooltip="Telefone de atendimento da clínica." />
                <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} className="bg-background border-border text-foreground h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-primary" placeholder="(00) 00000-0000" />
              </div>
            </CardContent>
          </Card>

          {/* Dados Jurídicos e Validação Rigorosa */}
          <Card className="bg-card/80 border-border backdrop-blur-md shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4 border-b border-border/50">
              <CardTitle className="text-lg sm:text-xl text-foreground font-semibold">Dados Jurídicos (CPF ou CNPJ)</CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground">Preencha o CPF do responsável OU o CNPJ da clínica para emissão das faturas.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 grid gap-4 sm:gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1">
                <FieldLabel htmlFor="legal_name" label="Razão Social" tooltip="Nome jurídico oficial registrado." />
                <Input id="legal_name" name="legal_name" value={formData.legal_name} onChange={handleChange} className="bg-background border-border text-foreground h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-primary" placeholder="Empresa Saúde LTDA" />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor="cpf" label="CPF do Responsável" tooltip="CPF válido do responsável legal." required={!cleanDigits(formData.cnpj)} />
                <Input id="cpf" name="cpf" value={formData.cpf} onChange={handleChange} className="bg-background border-border text-foreground h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-primary" placeholder="000.000.000-00" required={!cleanDigits(formData.cnpj)} />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor="cnpj" label="CNPJ da Clínica" tooltip="CNPJ oficial para emissão via Asaas." required={!cleanDigits(formData.cpf)} />
                <Input id="cnpj" name="cnpj" value={formData.cnpj} onChange={handleChange} className="bg-background border-border text-foreground h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-primary" placeholder="00.000.000/0001-00" required={!cleanDigits(formData.cpf)} />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <FieldLabel htmlFor="business_hours" label="Horário de Funcionamento" tooltip="Descreva os horários de atendimento." />
                <Input id="business_hours" name="business_hours" value={formData.business_hours} onChange={handleChange} className="bg-background border-border text-foreground h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-primary" placeholder="Ex: Seg-Sex, 08h-18h" />
              </div>
            </CardContent>
          </Card>

          {/* Endereço Completo */}
          <Card className="bg-card/80 border-border backdrop-blur-md shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4 border-b border-border/50">
              <CardTitle className="text-lg sm:text-xl text-foreground font-semibold">Endereço do Estabelecimento</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-6">
              <div className="sm:col-span-6 space-y-1">
                <FieldLabel htmlFor="country" label="País" tooltip="País do estabelecimento." required />
                <Select value={formData.country} onValueChange={(val) => handleSelectChange("country", val)}>
                  <SelectTrigger className="bg-background border-border text-foreground h-11 sm:h-10 text-base sm:text-sm rounded-xl">
                    <SelectValue placeholder="Selecione o país" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-popover-foreground">
                    <SelectItem value="BR">Brasil</SelectItem>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="CA">Canada</SelectItem>
                    <SelectItem value="PT">Portugal</SelectItem>
                    <SelectItem value="OTHER">Outro País</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2 space-y-1 relative">
                <FieldLabel htmlFor="cep" label={formData.country === "BR" ? "CEP" : "Zip Code"} tooltip="Preenchimento automático do endereço via ViaCEP." />
                <div className="relative">
                  <Input id="cep" name="cep" value={formData.cep} onChange={handleChange} className="bg-background border-border text-foreground h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-primary" placeholder={formData.country === "BR" ? "00000-000" : ""} />
                  {fetchingCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
              <div className="sm:col-span-4 space-y-1">
                <FieldLabel htmlFor="street" label="Logradouro" tooltip="Rua, avenida ou alameda." required />
                <Input id="street" name="street" required value={formData.street} onChange={handleChange} className="bg-background border-border text-foreground h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-primary" />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <FieldLabel htmlFor="number" label="Número" tooltip="Número do imóvel." />
                <Input id="number" name="number" value={formData.number} onChange={handleChange} className="bg-background border-border text-foreground h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-primary" />
              </div>
              <div className="sm:col-span-4 space-y-1">
                <FieldLabel htmlFor="complement" label="Complemento" tooltip="Sala, andar ou bloco." />
                <Input id="complement" name="complement" value={formData.complement} onChange={handleChange} className="bg-background border-border text-foreground h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-primary" />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <FieldLabel htmlFor="neighborhood" label="Bairro" tooltip="Bairro." />
                <Input id="neighborhood" name="neighborhood" value={formData.neighborhood} onChange={handleChange} className="bg-background border-border text-foreground h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-primary" />
              </div>
              <div className="sm:col-span-3 space-y-1">
                <FieldLabel htmlFor="city" label="Cidade" tooltip="Cidade." required />
                <Input id="city" name="city" required value={formData.city} onChange={handleChange} className="bg-background border-border text-foreground h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-primary" />
              </div>
              <div className="sm:col-span-1 space-y-1">
                <FieldLabel htmlFor="state" label="UF" tooltip="Estado." required />
                <Input id="state" name="state" required value={formData.state} onChange={handleChange} className="bg-background border-border text-foreground h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-primary" maxLength={2} placeholder="SP" />
              </div>
            </CardContent>
          </Card>

          {/* Equipe e Acessos para Plano Clínica */}
          {plan === "clinic" && (
            <Card className="bg-primary/5 border-primary/20 backdrop-blur-md rounded-2xl overflow-hidden">
              <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4 border-b border-primary/10">
                <CardTitle className="text-lg sm:text-xl text-primary font-semibold">Equipe e Acessos</CardTitle>
                <CardDescription className="text-xs sm:text-sm text-muted-foreground">Configure os limites de uso para o plano Clínica com Equipe.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 grid gap-4 sm:gap-6 sm:grid-cols-2">
                <div className="space-y-1">
                  <FieldLabel 
                    htmlFor="subaccount_limit" 
                    label="Colaboradores (Total)" 
                    tooltip="Quantos colaboradores trabalharão na clínica contando com você?" 
                    required
                  />
                  <Input 
                    id="subaccount_limit" 
                    name="subaccount_limit" 
                    type="number" 
                    min={1} 
                    required 
                    value={formData.subaccount_limit} 
                    onChange={handleChange} 
                    className="bg-background border-border text-foreground h-11 sm:h-10 text-base sm:text-sm rounded-xl" 
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel 
                    htmlFor="concurrent_access_limit" 
                    label="Acessos Simultâneos" 
                    tooltip="Quantos acessos simultâneos precisará na clínica? (2 inclusos na base + R$ 10 a R$ 13/mês por extra)" 
                    required
                  />
                  <Input 
                    id="concurrent_access_limit" 
                    name="concurrent_access_limit" 
                    type="number" 
                    min={plan === "clinic" ? 2 : 1} 
                    required 
                    value={formData.concurrent_access_limit} 
                    onChange={handleChange} 
                    className="bg-background border-border text-foreground h-11 sm:h-10 text-base sm:text-sm rounded-xl" 
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Seção Opcional de Cupom Promocional (ex: SOUPLURIBETA para Beta Testers) */}
          {isCreateMode && (
            <Card className="bg-card border-border backdrop-blur-md rounded-2xl overflow-hidden shadow-sm">
              <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3 border-b border-border">
                <CardTitle className="text-base sm:text-lg text-foreground font-semibold flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary" />
                  <span>Possui um Cupom Promocional ou Acesso Beta?</span>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Se você é um participante Beta ou recebeu um código exclusivo, insira-o aqui para resgatar sua condição.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-3">
                <div className="flex gap-2">
                  <Input
                    id="onboarding_coupon_code"
                    name="onboarding_coupon_code"
                    placeholder="EX: SOUPLURIBETA, BETA50"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value.toUpperCase());
                      if (couponError) setCouponError(null);
                    }}
                    className="bg-background border-border text-foreground h-11 sm:h-10 text-sm font-mono tracking-wider uppercase rounded-xl"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleValidateCoupon()}
                    disabled={validatingCoupon || !couponInput.trim()}
                    className="rounded-xl h-11 sm:h-10 px-4 text-xs font-semibold shrink-0"
                  >
                    {validatingCoupon ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                        Validando...
                      </>
                    ) : (
                      "Aplicar Cupom"
                    )}
                  </Button>
                </div>

                {appliedCoupon && appliedCoupon.valid && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>
                        Cupom <strong>{appliedCoupon.code}</strong> aplicado: {appliedCoupon.description}
                      </span>
                    </div>
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 text-[10px]">
                      {appliedCoupon.discount_type === "TRIAL_DAYS" && `${appliedCoupon.discount_value} Dias Grátis`}
                      {appliedCoupon.discount_type === "PERCENTAGE" && `${appliedCoupon.discount_value}% OFF`}
                      {appliedCoupon.discount_type === "FIXED_AMOUNT" && `R$ ${appliedCoupon.discount_value} OFF`}
                    </Badge>
                  </div>
                )}

                {couponError && (
                  <p className="text-xs text-destructive flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {couponError}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Seção Obrigatória de Cartão de Crédito para Ativação da Degustação (Apenas em Modo de Criação) */}
          {isCreateMode && (
            <Card className="bg-card border-border backdrop-blur-md rounded-2xl overflow-hidden shadow-sm">
              <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4 border-b border-border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <CardTitle className="text-lg sm:text-xl text-foreground font-semibold flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    <span>Cartão de Crédito para Ativação (Obrigatório)</span>
                  </CardTitle>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-xs w-fit">
                    Validação Antifraude (R$ 0,01)
                  </Badge>
                </div>
                <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                  Para autenticação de segurança e combate a fraudes, realizamos uma cobrança simbólica de <strong>R$ 0,01</strong> no cartão. Nenhuma mensalidade será debitada durante os 7 dias de degustação gratuita.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 grid gap-4 sm:gap-6 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <FieldLabel
                    htmlFor="card_holder_name"
                    label="Nome Impresso no Cartão"
                    tooltip="Nome completo do titular como impresso no cartão de crédito."
                    required
                  />
                  <Input
                    id="card_holder_name"
                    name="card_holder_name"
                    placeholder="NOME COMO ESTÁ NO CARTÃO"
                    required
                    value={cardForm.holderName}
                    onChange={(e) => setCardForm((prev) => ({ ...prev, holderName: e.target.value.toUpperCase() }))}
                    className="bg-background border-border text-foreground h-11 sm:h-10 text-base sm:text-sm rounded-xl uppercase font-mono"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <FieldLabel
                      htmlFor="card_number"
                      label="Número do Cartão"
                      tooltip="16 dígitos do cartão de crédito (Visa, Mastercard, Elo, Amex, Hipercard)."
                      required
                    />
                    {cardBrand !== "unknown" && (
                      <Badge variant="secondary" className="text-[10px] font-semibold capitalize">
                        {cardBrand}
                      </Badge>
                    )}
                  </div>
                  <Input
                    id="card_number"
                    name="card_number"
                    placeholder="0000 0000 0000 0000"
                    required
                    maxLength={19}
                    value={cardForm.number}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, "").slice(0, 16);
                      const formatted = clean.replace(/(\d{4})(?=\d)/g, "$1 ");
                      setCardForm((prev) => ({ ...prev, number: formatted }));
                    }}
                    className="bg-background border-border text-foreground h-11 sm:h-10 text-base sm:text-sm rounded-xl font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <FieldLabel
                    htmlFor="card_expiry"
                    label="Validade (MM/AA)"
                    tooltip="Mês e ano de vencimento gravados no cartão."
                    required
                  />
                  <Input
                    id="card_expiry"
                    name="card_expiry"
                    placeholder="MM/AA"
                    required
                    maxLength={5}
                    value={cardForm.expiry}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, "").slice(0, 4);
                      const formatted = clean.length > 2 ? `${clean.slice(0, 2)}/${clean.slice(2)}` : clean;
                      setCardForm((prev) => ({ ...prev, expiry: formatted }));
                    }}
                    className="bg-background border-border text-foreground h-11 sm:h-10 text-base sm:text-sm rounded-xl font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <FieldLabel
                    htmlFor="card_ccv"
                    label="Código de Segurança (CVV)"
                    tooltip="Código de 3 ou 4 dígitos no verso do cartão."
                    required
                  />
                  <Input
                    id="card_ccv"
                    name="card_ccv"
                    placeholder="CVV"
                    type="password"
                    required
                    maxLength={4}
                    value={cardForm.ccv}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setCardForm((prev) => ({ ...prev, ccv: clean }));
                    }}
                    className="bg-background border-border text-foreground h-11 sm:h-10 text-base sm:text-sm rounded-xl font-mono"
                  />
                </div>

                <div className="sm:col-span-2 p-3 bg-muted/40 border border-border rounded-xl flex items-start gap-2.5 text-xs text-muted-foreground">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span>
                      Cobrança simbólica de <strong>R$ 0,01</strong> para validação imediata pelo banco emissor. Cancele quando quiser antes do fim dos {appliedCoupon?.discount_type === "TRIAL_DAYS" ? (appliedCoupon.discount_value || 180) : 7} dias sem qualquer cobrança de plano. Criptografia ponta a ponta (PCI-DSS) gerenciada via gateway Asaas.
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Termo de Consentimento e Responsabilidade do Titular */}
          <div className="rounded-2xl border border-border/80 bg-card/80 p-4 sm:p-5 space-y-2 backdrop-blur-md shadow-md">
            <div className="flex items-start gap-3">
              <Checkbox
                id="owner-terms-consent"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(Boolean(checked))}
                className="mt-0.5"
              />
              <label
                htmlFor="owner-terms-consent"
                className="text-xs sm:text-sm leading-relaxed text-foreground cursor-pointer select-none"
              >
                Declaro que li e concordo com os{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsTermsModalOpen(true);
                  }}
                  className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  Termos de Uso e Responsabilidade do Titular
                </button>{" "}
                do Pluri-Health.
              </label>
            </div>
            {requireOwnerTerms && !termsAccepted && (
              <p className="text-xs text-muted-foreground pl-7">
                * O aceite dos termos é obrigatório para cadastrar seu espaço.
              </p>
            )}
          </div>

          {/* Asaas Security Compliance Banner */}
          <div className="p-4 rounded-2xl bg-card border border-border text-xs text-muted-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-xs">Processamento Financeiro Seguro via Asaas (PCI-DSS)</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Ao prosseguir, você será direcionado para a seleção e checkout de pagamento integrado ao gateway Asaas. O Pluri-Health <strong>nunca armazena números de cartão de crédito</strong> em seus servidores.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-[10px] whitespace-nowrap shrink-0">
              Gateway Asaas Oficial
            </Badge>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 pt-4 sm:pt-6 border-t border-border">
            <Button
              type="button"
              onClick={() => navigate("/espacopessoal")}
              disabled={loading}
              variant="outline"
              className="w-full sm:w-auto h-12 px-6 text-base font-medium rounded-xl transition-colors min-h-[48px]"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || (requireOwnerTerms && !termsAccepted)}
              className="w-full sm:w-auto min-w-[220px] h-12 px-6 text-base font-semibold bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl shadow-lg transition-all min-h-[48px]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              {loading
                ? (isCreateMode ? "Validando cartão e criando espaço..." : "Salvando...")
                : (isCreateMode
                    ? (appliedCoupon?.discount_type === "TRIAL_DAYS"
                        ? `Verificar Cartão e Ativar Beta (${appliedCoupon.discount_value || 180} Dias)`
                        : "Verificar Cartão e Criar Clínica (R$ 0,01)")
                    : "Salvar Alterações")}
            </Button>
          </div>
        </form>
      </div>

      {/* Modal de Termos de Uso e Consentimento */}
      <TermsOfServiceModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
        onAccept={() => {
          setTermsAccepted(true);
          setIsTermsModalOpen(false);
        }}
      />

      {/* Modal de Confirmação de CPF/CNPJ Duplicado do Próprio Owner */}
      <Dialog open={duplicateCnpjModalOpen} onOpenChange={setDuplicateCnpjModalOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              {cleanDigits(formData.cnpj) ? "CNPJ" : "CPF"} Já Possui um Espaço Cadastrado
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs mt-1">
              Você já possui a clínica <strong>"{existingClinicNameForCnpj}"</strong> cadastrada sob o {cleanDigits(formData.cnpj) ? "CNPJ" : "CPF"} <strong>{formData.cnpj || formData.cpf}</strong>.
            </DialogDescription>
          </DialogHeader>

          <p className="text-xs text-muted-foreground py-2">
            Deseja prosseguir e cadastrar este novo espaço/unidade adicional sob o mesmo {cleanDigits(formData.cnpj) ? "CNPJ" : "CPF"}?
          </p>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDuplicateCnpjModalOpen(false)}
              className="border-border text-foreground hover:bg-muted rounded-xl text-xs min-h-[40px]"
            >
              Não, Revisar {cleanDigits(formData.cnpj) ? "CNPJ" : "CPF"}
            </Button>
            <Button
              onClick={() => {
                setDuplicateCnpjModalOpen(false);
                executeSignupProcess(true);
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl text-xs min-h-[40px]"
            >
              Sim, Criar Nova Unidade sob este {cleanDigits(formData.cnpj) ? "CNPJ" : "CPF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

