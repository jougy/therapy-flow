import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Building2, HelpCircle, Loader2, Tag, Check, AlertCircle, Calculator, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { isOwnerDocumentValid, validateCPF, validateCNPJ } from "@/lib/owner-document";
import { toast } from "sonner";

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

interface CouponValidationResult {
  valid: boolean;
  coupon_id?: string;
  code?: string;
  description?: string;
  discount_type?: "PERCENTAGE" | "FIXED_AMOUNT" | "TRIAL_DAYS";
  discount_value?: number;
  message?: string;
}

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
  const plan = (searchParams.get("plan") as "solo" | "clinic" | null) || "solo";
  const initialCoupon = searchParams.get("coupon") || "";
  const initialConcurrent = parseInt(searchParams.get("concurrent") || (plan === "clinic" ? "2" : "1"), 10);
  const initialSpaces = parseInt(searchParams.get("spaces") || (plan === "clinic" ? "30" : "1"), 10);

  const isExplicitCreate = searchParams.get("mode") === "create" || !!searchParams.get("plan");
  const isCurrentClinicOwnedByMe = Boolean(clinic?.account_owner_user_id && session?.user?.id && clinic.account_owner_user_id === session.user.id);
  const isCreateMode = !clinic || !isCurrentClinicOwnedByMe || isExplicitCreate;

  const [loading, setLoading] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);

  // State do Cupom de Desconto
  const [couponCode, setCouponCode] = useState(initialCoupon);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResult | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

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

  // Autovalidar cupom inicial vindo da URL
  useEffect(() => {
    if (initialCoupon) {
      validateCoupon(initialCoupon);
    }
  }, [initialCoupon]);

  const validateCoupon = async (codeToValidate: string) => {
    if (!codeToValidate.trim()) return;
    setValidatingCoupon(true);
    setCouponError(null);

    try {
      const { data, error } = await supabase.rpc("validate_subscription_coupon", {
        _code: codeToValidate.trim().toUpperCase(),
        _plan_type: plan,
      });

      if (error) throw error;
      const result = data as CouponValidationResult;
      if (result && result.valid) {
        setAppliedCoupon(result);
        setCouponError(null);
      } else {
        setAppliedCoupon(null);
        setCouponError(result?.message || "Cupom inválido.");
      }
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError("Erro ao validar cupom.");
    } finally {
      setValidatingCoupon(false);
    }
  };

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
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setFormData((prev) => ({
            ...prev,
            street: data.logradouro || prev.street,
            neighborhood: data.bairro || prev.neighborhood,
            city: data.localidade || prev.city,
            state: data.uf || prev.state,
          }));
        }
      } catch (error) {
        console.error("Error fetching CEP:", error);
      } finally {
        setFetchingCep(false);
      }
    }
  };

  // Cálculos Financeiros Dinâmicos em Tempo Real
  const parsedConcurrent = Math.max(plan === "clinic" ? 2 : 1, parseInt(formData.concurrent_access_limit || "2", 10));
  const extraConcurrentSeats = Math.max(0, parsedConcurrent - (plan === "clinic" ? 2 : 1));
  const basePrice = plan === "clinic" ? 60.0 : 50.0;
  const rawPrice = basePrice + extraConcurrentSeats * 10.0;

  let finalPrice = rawPrice;
  if (appliedCoupon && appliedCoupon.valid) {
    if (appliedCoupon.discount_type === "PERCENTAGE") {
      finalPrice = Math.max(0, rawPrice * (1 - (appliedCoupon.discount_value || 0) / 100));
    } else if (appliedCoupon.discount_type === "FIXED_AMOUNT") {
      finalPrice = Math.max(0, rawPrice - (appliedCoupon.discount_value || 0));
    }
  }

  const [duplicateCnpjModalOpen, setDuplicateCnpjModalOpen] = useState(false);
  const [existingClinicNameForCnpj, setExistingClinicNameForCnpj] = useState("");

  const executeSignupProcess = async (allowDuplicateCnpj = false) => {
    if (loading) return;

    if (!session?.user?.id) {
      toast.error("Sessão expirada. Faça login novamente.");
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

    setLoading(true);
    let isSuccess = false;

    try {
      let targetClinicId = clinic?.id;
      const documentToUse = cleanCnpj || cleanCpf;

      if (isCreateMode) {
        // Criar clínica através do RPC handle_signup
        const { data: rpcData, error: rpcError } = await supabase.rpc("handle_signup", {
          _user_id: session.user.id,
          _email: formData.email || session.user.email || "",
          _cnpj: documentToUse,
          _subscription_plan: plan || "solo",
          _full_name: profile?.full_name || session.user.user_metadata?.full_name || null,
          _clinic_name: formData.name || "Minha Clínica",
          _allow_duplicate_cnpj: allowDuplicateCnpj,
        });

        if (rpcError) {
          const msg = rpcError.message || "";
          if (msg.includes("CNPJ_REGISTERED_TO_OTHER_USER")) {
            toast.error("Este CNPJ já está sendo utilizado pela conta de outro proprietário na plataforma. Caso este seja o seu CNPJ oficial, entre em contato com nosso suporte.");
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
          throw rpcError;
        }
        const result = (rpcData ?? {}) as { clinic_id?: string };
        if (!result.clinic_id) throw new Error("Não foi possível criar a nova clínica.");
        targetClinicId = result.clinic_id;
      }

      if (!targetClinicId) {
        toast.error("Clínica não encontrada.");
        return;
      }

      // Atualizar dados da clínica
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

      // Atualizar CPF no perfil do usuário
      if (cleanCpf) {
        await supabase.from("profiles").update({ cpf: cleanCpf }).eq("id", session.user.id);
      }

      // Registrar/Iniciar Assinatura no Asaas através da Edge Function
      if (supabase.functions && typeof supabase.functions.invoke === "function") {
        try {
          const edgeRes = await supabase.functions.invoke("asaas-subscription", {
            body: {
              action: "CREATE",
              clinic_id: targetClinicId,
              plan_type: plan,
              additional_seats_count: extraConcurrentSeats,
              coupon_code: appliedCoupon?.valid ? appliedCoupon.code : couponCode,
              billing_type: "PIX",
              cpf_cnpj: documentToUse,
              billing_name: formData.name,
              billing_email: formData.email || session.user.email,
            },
          });

          if (edgeRes?.error) {
            console.warn("Aviso ao ativar assinatura no Asaas:", edgeRes.error);
          }
        } catch (subErr) {
          console.warn("Erro ao invocar asaas-subscription:", subErr);
        }
      }

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
      }

      isSuccess = true;
      toast.success(isCreateMode ? "Sua clínica foi cadastrada com sucesso!" : "Dados salvos com sucesso!");
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
      <Label htmlFor={htmlFor} className="text-sm font-medium text-neutral-300">
        {label}
      </Label>
      {required && <span className="text-red-500">*</span>}
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" tabIndex={-1} className="rounded-full outline-none focus:ring-2 focus:ring-blue-500/50">
            <HelpCircle className="h-4 w-4 text-neutral-500 hover:text-neutral-300 transition-colors" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" className="max-w-[300px] bg-neutral-900 border-neutral-800 text-neutral-200 p-3 text-sm z-50">
          {tooltip}
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center py-6 px-4 sm:py-12 sm:px-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-blue-500/10 rounded-full blur-[100px] sm:blur-[120px]" />
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
            className="text-neutral-400 hover:text-white hover:bg-neutral-900 border border-neutral-800/80 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium transition-colors inline-flex items-center gap-2"
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
              className="text-neutral-400 hover:text-white text-xs sm:text-sm inline-flex items-center gap-1.5"
            >
              Trocar plano
            </Button>
          )}
        </div>

        {/* Header */}
        <div className="text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs sm:text-sm font-medium mb-3">
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span>{isCreateMode ? (plan === "clinic" ? "Novo Espaço: Clínica com Equipe" : "Novo Espaço: Profissional Solo") : "Configuração da Clínica"}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
            {isCreateMode ? "Cadastre seu Próprio Espaço" : "Configure sua Clínica"}
          </h1>
          <p className="text-xs sm:text-base text-neutral-400 max-w-2xl">
            Preencha os dados abaixo para configurar o ambiente de atendimento da sua clínica.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
          {/* Identidade e Contato */}
          <Card className="bg-neutral-900/60 border-neutral-800 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4 border-b border-neutral-800/50">
              <CardTitle className="text-lg sm:text-xl text-white font-semibold">Identidade e Contato</CardTitle>
              <CardDescription className="text-xs sm:text-sm text-neutral-400">Como sua clínica será identificada.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 grid gap-4 sm:gap-6 sm:grid-cols-2">
              <div className="space-y-1">
                <FieldLabel htmlFor="name" label="Nome da Clínica" tooltip="Nome fantasia ou comercial exibido aos pacientes." required />
                <Input id="name" name="name" required value={formData.name} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" placeholder="Ex: Clínica Bem Estar" />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor="logo_url" label="URL do Logo" tooltip="Link da imagem do seu logotipo." />
                <Input id="logo_url" name="logo_url" value={formData.logo_url} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor="email" label="E-mail Institucional" tooltip="E-mail de contato e faturamento." />
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" placeholder="contato@clinica.com" />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor="phone" label="Telefone / WhatsApp" tooltip="Telefone de atendimento da clínica." />
                <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" placeholder="(00) 00000-0000" />
              </div>
            </CardContent>
          </Card>

          {/* Dados Jurídicos e Validação Rigorosa */}
          <Card className="bg-neutral-900/60 border-neutral-800 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4 border-b border-neutral-800/50">
              <CardTitle className="text-lg sm:text-xl text-white font-semibold">Dados Jurídicos (CPF ou CNPJ)</CardTitle>
              <CardDescription className="text-xs sm:text-sm text-neutral-400">Preencha o CPF do responsável OU o CNPJ da clínica para emissão das faturas.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 grid gap-4 sm:gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1">
                <FieldLabel htmlFor="legal_name" label="Razão Social" tooltip="Nome jurídico oficial registrado." />
                <Input id="legal_name" name="legal_name" value={formData.legal_name} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" placeholder="Empresa Saúde LTDA" />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor="cpf" label="CPF do Responsável" tooltip="CPF válido do responsável legal." required={!cleanDigits(formData.cnpj)} />
                <Input id="cpf" name="cpf" value={formData.cpf} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" placeholder="000.000.000-00" required={!cleanDigits(formData.cnpj)} />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor="cnpj" label="CNPJ da Clínica" tooltip="CNPJ oficial para emissão via Asaas." required={!cleanDigits(formData.cpf)} />
                <Input id="cnpj" name="cnpj" value={formData.cnpj} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" placeholder="00.000.000/0001-00" required={!cleanDigits(formData.cpf)} />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <FieldLabel htmlFor="business_hours" label="Horário de Funcionamento" tooltip="Descreva os horários de atendimento." />
                <Input id="business_hours" name="business_hours" value={formData.business_hours} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" placeholder="Ex: Seg-Sex, 08h-18h" />
              </div>
            </CardContent>
          </Card>

          {/* Endereço Completo */}
          <Card className="bg-neutral-900/60 border-neutral-800 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4 border-b border-neutral-800/50">
              <CardTitle className="text-lg sm:text-xl text-white font-semibold">Endereço do Estabelecimento</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-6">
              <div className="sm:col-span-6 space-y-1">
                <FieldLabel htmlFor="country" label="País" tooltip="País do estabelecimento." required />
                <Select value={formData.country} onValueChange={(val) => handleSelectChange("country", val)}>
                  <SelectTrigger className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl">
                    <SelectValue placeholder="Selecione o país" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200">
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
                  <Input id="cep" name="cep" value={formData.cep} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" placeholder={formData.country === "BR" ? "00000-000" : ""} />
                  {fetchingCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-neutral-500" />}
                </div>
              </div>
              <div className="sm:col-span-4 space-y-1">
                <FieldLabel htmlFor="street" label="Logradouro" tooltip="Rua, avenida ou alameda." required />
                <Input id="street" name="street" required value={formData.street} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <FieldLabel htmlFor="number" label="Número" tooltip="Número do imóvel." />
                <Input id="number" name="number" value={formData.number} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" />
              </div>
              <div className="sm:col-span-4 space-y-1">
                <FieldLabel htmlFor="complement" label="Complemento" tooltip="Sala, andar ou bloco." />
                <Input id="complement" name="complement" value={formData.complement} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <FieldLabel htmlFor="neighborhood" label="Bairro" tooltip="Bairro." />
                <Input id="neighborhood" name="neighborhood" value={formData.neighborhood} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" />
              </div>
              <div className="sm:col-span-3 space-y-1">
                <FieldLabel htmlFor="city" label="Cidade" tooltip="Cidade." required />
                <Input id="city" name="city" required value={formData.city} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" />
              </div>
              <div className="sm:col-span-1 space-y-1">
                <FieldLabel htmlFor="state" label="UF" tooltip="Estado." required />
                <Input id="state" name="state" required value={formData.state} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" maxLength={2} placeholder="SP" />
              </div>
            </CardContent>
          </Card>

          {/* Equipe e Acessos para Plano Clínica */}
          {plan === "clinic" && (
            <Card className="bg-blue-900/10 border-blue-500/20 backdrop-blur-md rounded-2xl overflow-hidden">
              <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4 border-b border-blue-500/10">
                <CardTitle className="text-lg sm:text-xl text-blue-400 font-semibold">Equipe e Acessos</CardTitle>
                <CardDescription className="text-xs sm:text-sm text-neutral-400">Configure os limites de uso para o plano Clínica com Equipe.</CardDescription>
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
                    className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl" 
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel 
                    htmlFor="concurrent_access_limit" 
                    label="Acessos Simultâneos" 
                    tooltip="Quantos acessos simultâneos precisará na clínica? (2 inclusos na base + R$10/mês por extra)" 
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
                    className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl" 
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resumo da Assinatura e Cupom de Desconto */}
          <Card className="bg-blue-900/10 border-blue-500/30 backdrop-blur-md rounded-2xl overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4 border-b border-blue-500/20">
              <CardTitle className="text-lg sm:text-xl text-blue-400 font-semibold flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Resumo da Assinatura e Cupom de Desconto
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-neutral-400">
                Confira o valor recorrente e aplique seu cupom de desconto.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-6">
              {/* Cupom Input */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-blue-400" /> Cupom de Desconto
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="DIGITE O CUPOM (EX: BETA50)"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="bg-neutral-950 border-neutral-800 text-white font-mono uppercase h-10 text-xs sm:text-sm rounded-xl"
                  />
                  <Button
                    type="button"
                    onClick={() => validateCoupon(couponCode)}
                    disabled={validatingCoupon || !couponCode.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-4 text-xs font-semibold rounded-xl"
                  >
                    {validatingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : "Validar"}
                  </Button>
                </div>

                {appliedCoupon && appliedCoupon.valid && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>Cupom <strong>{appliedCoupon.code}</strong> ativo com sucesso!</span>
                    </div>
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                      {appliedCoupon.discount_type === "PERCENTAGE" && `${appliedCoupon.discount_value}% OFF`}
                      {appliedCoupon.discount_type === "FIXED_AMOUNT" && `R$ ${appliedCoupon.discount_value} OFF`}
                      {appliedCoupon.discount_type === "TRIAL_DAYS" && `${appliedCoupon.discount_value} dias degustação`}
                    </Badge>
                  </div>
                )}

                {couponError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{couponError}</span>
                  </div>
                )}
              </div>

              {/* Quadro Resumo */}
              <div className="p-4 rounded-xl bg-neutral-950/90 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between text-xs border-b border-neutral-800 pb-2">
                  <span className="font-semibold text-blue-400 uppercase tracking-wider">Detalhamento dos Recursos</span>
                  <span className="text-emerald-400 font-medium px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">Fase Beta: 100% Isento</span>
                </div>

                <div className="space-y-1.5 text-xs text-neutral-300">
                  <div className="flex justify-between">
                    <span>Plano Selecionado:</span>
                    <span className="font-semibold text-white">{plan === "clinic" ? "Clínica com Equipe" : "Profissional Solo"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mensalidade Base:</span>
                    <span className="font-semibold text-white">R$ {basePrice.toFixed(2)}/mês</span>
                  </div>
                  {plan === "clinic" && extraConcurrentSeats > 0 && (
                    <div className="flex justify-between text-blue-300">
                      <span>Acessos Simultâneos Extras ({extraConcurrentSeats}x R$ 10,00):</span>
                      <span className="font-semibold">+R$ {(extraConcurrentSeats * 10).toFixed(2)}/mês</span>
                    </div>
                  )}

                  {appliedCoupon && appliedCoupon.valid && rawPrice !== finalPrice && (
                    <div className="flex justify-between text-emerald-400 font-semibold border-t border-neutral-800/80 pt-1.5">
                      <span>Desconto do Cupom ({appliedCoupon.code}):</span>
                      <span>-R$ {(rawPrice - finalPrice).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between border-t border-neutral-800 pt-2 text-sm sm:text-base font-bold text-white">
                    <span>Valor Recorrente Final:</span>
                    <div className="text-right">
                      {appliedCoupon && appliedCoupon.valid && rawPrice !== finalPrice && (
                        <span className="text-xs text-neutral-500 line-through mr-2 font-mono">
                          R$ {rawPrice.toFixed(2)}
                        </span>
                      )}
                      <span className="text-emerald-400">R$ {finalPrice.toFixed(2)}/mês</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Asaas PCI-DSS Security Compliance Banner */}
          <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-xs text-neutral-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-white text-xs">Processamento Financeiro Seguro via Asaas (PCI-DSS)</p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Os dados cadastrais acima são utilizados exclusivamente para emissão do cadastro na instituição financeira parceira Asaas. O Pluri-Health <strong>nunca armazena números de cartão de crédito</strong> em seus servidores.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-[10px] whitespace-nowrap shrink-0">
              Gateway Asaas Oficial
            </Badge>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 pt-4 sm:pt-6 border-t border-neutral-800/60">
            <Button
              type="button"
              onClick={() => navigate("/espacopessoal")}
              disabled={loading}
              className="w-full sm:w-auto h-12 px-6 text-base font-medium bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-white rounded-xl transition-colors"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto min-w-[220px] h-12 px-6 text-base font-semibold bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl shadow-lg shadow-blue-600/20 transition-all"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              {loading ? (isCreateMode ? "Conectando ao Asaas..." : "Salvando...") : "Ativar Assinatura no Asaas"}
            </Button>
          </div>
        </form>
      </div>

      {/* Modal de Confirmação de CNPJ Duplicado do Próprio Owner */}
      <Dialog open={duplicateCnpjModalOpen} onOpenChange={setDuplicateCnpjModalOpen}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-white sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              CNPJ Já Possui um Espaço Cadastrado
            </DialogTitle>
            <DialogDescription className="text-neutral-400 text-xs mt-1">
              Você já possui a clínica <strong>"{existingClinicNameForCnpj}"</strong> cadastrada sob o CNPJ <strong>{formData.cnpj || formData.cpf}</strong>.
            </DialogDescription>
          </DialogHeader>

          <p className="text-xs text-neutral-300 py-2">
            Deseja prosseguir e cadastrar este novo espaço/unidade adicional sob o mesmo CNPJ?
          </p>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDuplicateCnpjModalOpen(false)}
              className="border-neutral-800 text-neutral-300 hover:bg-neutral-800 rounded-xl text-xs"
            >
              Não, Revisar CNPJ
            </Button>
            <Button
              onClick={() => {
                setDuplicateCnpjModalOpen(false);
                executeSignupProcess(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs"
            >
              Sim, Criar Nova Unidade sob este CNPJ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
