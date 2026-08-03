import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Building2, HelpCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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
  // @ts-expect-error - useAuth context property types
  const { clinic, profile, session, selectClinic, refreshAuthState } = useAuth();
  const plan = searchParams.get("plan") as "solo" | "clinic" | null;
  const isExplicitCreate = searchParams.get("mode") === "create" || !!plan;

  const isCurrentClinicOwnedByMe = Boolean(clinic?.account_owner_user_id && session?.user?.id && clinic.account_owner_user_id === session.user.id);
  const isCreateMode = !clinic || !isCurrentClinicOwnedByMe || isExplicitCreate;

  const [loading, setLoading] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);

  const clinicAddress = (clinic?.address || {}) as ClinicAddress;
  const clinicHours = (clinic?.business_hours || {}) as BusinessHours;

  const [formData, setFormData] = useState({
    name: !isCreateMode ? (clinic?.name || "") : "",
    logo_url: !isCreateMode ? (clinic?.logo_url || "") : "",
    email: !isCreateMode ? (clinic?.email || "") : (profile?.email || session?.user?.email || ""),
    phone: !isCreateMode ? (clinic?.phone ? formatPhone(clinic.phone) : "") : (profile?.phone ? formatPhone(profile.phone) : ""),
    legal_name: !isCreateMode ? (clinic?.legal_name || "") : "",
    cpf: profile?.cpf ? formatCPF(profile.cpf) : "",
    cnpj: !isCreateMode ? (clinic?.cnpj ? formatCNPJ(clinic.cnpj) : "") : "",
    business_hours: !isCreateMode ? (clinicHours.description || "") : "",
    country: (!isCreateMode && clinicAddress.country) ? clinicAddress.country : "BR",
    cep: (!isCreateMode && clinicAddress.cep) ? formatCEP(clinicAddress.cep) : "",
    street: (!isCreateMode && clinicAddress.street) ? clinicAddress.street : "",
    number: (!isCreateMode && clinicAddress.number) ? clinicAddress.number : "",
    complement: (!isCreateMode && clinicAddress.complement) ? clinicAddress.complement : "",
    neighborhood: (!isCreateMode && clinicAddress.neighborhood) ? clinicAddress.neighborhood : "",
    city: (!isCreateMode && clinicAddress.city) ? clinicAddress.city : "",
    state: (!isCreateMode && clinicAddress.state) ? clinicAddress.state : "",
    subaccount_limit: (!isCreateMode && clinic?.subaccount_limit) ? clinic.subaccount_limit.toString() : (plan === "clinic" ? "5" : "1"),
    concurrent_access_limit: (!isCreateMode && clinic?.concurrent_access_limit) ? Math.max(plan === "clinic" ? 2 : 1, clinic.concurrent_access_limit).toString() : (plan === "clinic" ? "2" : "1"),
  });

  useEffect(() => {
    if (!isCreateMode && clinic) {
      const addr = (clinic.address || {}) as ClinicAddress;
      const hours = (clinic.business_hours || {}) as BusinessHours;
      setFormData({
        name: clinic.name || "",
        logo_url: clinic.logo_url || "",
        email: clinic.email || "",
        phone: clinic.phone ? formatPhone(clinic.phone) : "",
        legal_name: clinic.legal_name || "",
        cpf: profile?.cpf ? formatCPF(profile.cpf) : "",
        cnpj: clinic.cnpj ? formatCNPJ(clinic.cnpj) : "",
        business_hours: hours.description || "",
        country: addr.country || "BR",
        cep: addr.cep ? formatCEP(addr.cep) : "",
        street: addr.street || "",
        number: addr.number || "",
        complement: addr.complement || "",
        neighborhood: addr.neighborhood || "",
        city: addr.city || "",
        state: addr.state || "",
        subaccount_limit: clinic.subaccount_limit?.toString() || (plan === "clinic" ? "5" : "1"),
        concurrent_access_limit: clinic.concurrent_access_limit ? Math.max(plan === "clinic" ? 2 : 1, clinic.concurrent_access_limit).toString() : (plan === "clinic" ? "2" : "1"),
      });
    }
  }, [clinic, isCreateMode, plan, profile?.cpf]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!session?.user?.id) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }

    if (!cleanDigits(formData.cpf) && !cleanDigits(formData.cnpj)) {
      toast.error("Você deve preencher o CPF do responsável ou o CNPJ da clínica.");
      return;
    }

    setLoading(true);
    let isSuccess = false;

    try {
      let targetClinicId = clinic?.id;
      const documentToUse = cleanDigits(formData.cnpj) || cleanDigits(formData.cpf);

      if (isCreateMode) {
        // Create brand new clinic for user via handle_signup RPC
        const { data: rpcData, error: rpcError } = await supabase.rpc("handle_signup", {
          _user_id: session.user.id,
          _email: formData.email || session.user.email || "",
          _cnpj: documentToUse,
          _subscription_plan: plan || "solo",
          _full_name: profile?.full_name || session.user.user_metadata?.full_name || null,
          _clinic_name: formData.name || "Minha Clínica",
        });

        if (rpcError) {
          throw rpcError;
        }

        const result = (rpcData ?? {}) as { clinic_id?: string };
        if (!result.clinic_id) {
          throw new Error("Não foi possível criar a nova clínica.");
        }

        targetClinicId = result.clinic_id;
      }

      if (!targetClinicId) {
        toast.error("Clínica não encontrada.");
        return;
      }

      // Save Address and Detailed Clinic info
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

      const parsedSubaccounts = plan === "clinic" ? Math.max(1, parseInt(formData.subaccount_limit || "5", 10)) : 0;
      const parsedConcurrent = plan === "clinic" ? Math.max(2, parseInt(formData.concurrent_access_limit || "2", 10)) : 1;

      const clinicPayload = {
        name: formData.name,
        logo_url: formData.logo_url || null,
        email: formData.email || null,
        phone: formData.phone || null,
        legal_name: formData.legal_name || null,
        cnpj: documentToUse || null,
        address: addressJson,
        business_hours: businessHoursJson,
        subscription_plan: plan || "solo",
        ...(plan === "clinic" && {
          subaccount_limit: parsedSubaccounts,
          concurrent_access_limit: parsedConcurrent,
        }),
      };

      const { error: clinicError } = await supabase
        .from("clinics")
        // @ts-expect-error - typing check
        .update(clinicPayload)
        .eq("id", targetClinicId);

      if (clinicError) throw clinicError;

      // Save CPF to Profile if provided
      if (cleanDigits(formData.cpf)) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ cpf: cleanDigits(formData.cpf) })
          .eq("id", session.user.id);
        
        if (profileError) console.error("Error updating profile CPF:", profileError);
      }

      // Refresh auth state first so accessibleClinics includes the new clinic, then select it
      if (isCreateMode && targetClinicId) {
        if (typeof refreshAuthState === "function") {
          await refreshAuthState();
        }
        if (typeof selectClinic === "function") {
          try {
            await selectClinic(targetClinicId);
          } catch (selectErr) {
            console.warn("Could not auto-select newly created clinic right away:", selectErr);
          }
        }
      }

      isSuccess = true;
      toast.success(isCreateMode ? "Sua clínica foi criada com sucesso! Redirecionando para seu espaço pessoal..." : "Dados salvos com sucesso!");
      
      // Automatic immediate redirect to personal space (where all clinics are listed)
      navigate("/espacopessoal", { replace: true });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error("Error updating/creating onboarding data:", error);
      toast.error(errorMessage);
    } finally {
      if (!isSuccess) {
        setLoading(false);
      }
    }
  };

  const FieldLabel = ({ label, tooltip, htmlFor, required = false }: { label: string; tooltip: string; htmlFor: string; required?: boolean }) => (
    <div className="flex items-center gap-2 mb-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-neutral-300">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
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
      {/* Background Ambient Glow */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-blue-500/10 rounded-full blur-[100px] sm:blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-emerald-500/10 rounded-full blur-[100px] sm:blur-[120px]" />
      </div>

      <div className="z-10 w-full max-w-4xl space-y-6 sm:space-y-8">
        {/* Navigation / Back Action Bar */}
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

        {/* Page Header */}
        <div className="text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs sm:text-sm font-medium mb-3">
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span>{isCreateMode ? (plan === "clinic" ? "Novo Espaço: Clínica com Equipe" : "Novo Espaço: Profissional Solo") : "Configuração da Clínica"}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
            {isCreateMode ? "Cadastre seu Próprio Espaço" : "Configure sua Clínica"}
          </h1>
          <p className="text-xs sm:text-base text-neutral-400 max-w-2xl">
            {isCreateMode
              ? "Preencha os dados para criar a sua própria clínica independente no Pluri-Health."
              : "Preencha os dados abaixo para personalizar o ambiente e preparar o sistema para os seus atendimentos."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
          {/* Identidade e Contato */}
          <Card className="bg-neutral-900/60 border-neutral-800 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4 border-b border-neutral-800/50">
              <CardTitle className="text-lg sm:text-xl text-white font-semibold">Identidade e Contato</CardTitle>
              <CardDescription className="text-xs sm:text-sm text-neutral-400">Como sua clínica será reconhecida pelos pacientes.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 grid gap-4 sm:gap-6 sm:grid-cols-2">
              <div className="space-y-1">
                <FieldLabel htmlFor="name" label="Nome da Clínica" tooltip="O nome comercial ou fantasia que será exibido aos pacientes." required />
                <Input id="name" name="name" required value={formData.name} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" placeholder="Ex: Clínica Bem Estar" />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor="logo_url" label="URL do Logo" tooltip="Insira um link direto para a imagem do seu logo (ex: https://site.com/logo.png)." />
                <Input id="logo_url" name="logo_url" value={formData.logo_url} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor="email" label="E-mail Institucional" tooltip="E-mail principal para contato profissional e notificações do sistema." />
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" placeholder="contato@clinica.com" />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor="phone" label="Telefone / WhatsApp" tooltip="Número de contato principal da clínica." />
                <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" placeholder="(00) 00000-0000" />
              </div>
            </CardContent>
          </Card>

          {/* Dados Jurídicos e Operação */}
          <Card className="bg-neutral-900/60 border-neutral-800 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4 border-b border-neutral-800/50">
              <CardTitle className="text-lg sm:text-xl text-white font-semibold">Dados Jurídicos e Operação</CardTitle>
              <CardDescription className="text-xs sm:text-sm text-neutral-400">Você deve preencher o CPF do responsável OU o CNPJ da clínica.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 grid gap-4 sm:gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1">
                <FieldLabel htmlFor="legal_name" label="Razão Social" tooltip="Nome oficial registrado no CNPJ, se aplicável." />
                <Input id="legal_name" name="legal_name" value={formData.legal_name} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" placeholder="Empresa Saúde LTDA" />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor="cpf" label="CPF do Responsável" tooltip="Documento do titular da conta e responsável legal." required={!cleanDigits(formData.cnpj)} />
                <Input id="cpf" name="cpf" value={formData.cpf} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" placeholder="000.000.000-00" required={!cleanDigits(formData.cnpj)} />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor="cnpj" label="CNPJ da Clínica" tooltip="Documento da clínica para fins de faturamento e registro." required={!cleanDigits(formData.cpf)} />
                <Input id="cnpj" name="cnpj" value={formData.cnpj} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" placeholder="00.000.000/0001-00" required={!cleanDigits(formData.cpf)} />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <FieldLabel htmlFor="business_hours" label="Horário de Funcionamento" tooltip="Descreva brevemente os horários (ex: Segunda a Sexta, 08h às 18h)." />
                <Input id="business_hours" name="business_hours" value={formData.business_hours} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" placeholder="Ex: Seg-Sex, 08h-18h" />
              </div>
            </CardContent>
          </Card>

          {/* Endereço Completo */}
          <Card className="bg-neutral-900/60 border-neutral-800 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4 border-b border-neutral-800/50">
              <CardTitle className="text-lg sm:text-xl text-white font-semibold">Endereço Completo</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-6">
              <div className="sm:col-span-6 space-y-1">
                <FieldLabel htmlFor="country" label="País" tooltip="Selecione o país. Endereços no Brasil preenchem automaticamente pelo CEP." required />
                <Select value={formData.country} onValueChange={(val) => handleSelectChange("country", val)}>
                  <SelectTrigger className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl">
                    <SelectValue placeholder="Selecione o país" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200">
                    <SelectItem value="BR">Brasil</SelectItem>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="CA">Canada</SelectItem>
                    <SelectItem value="PT">Portugal</SelectItem>
                    <SelectItem value="AR">Argentina</SelectItem>
                    <SelectItem value="OTHER">Outro País</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2 space-y-1 relative">
                <FieldLabel 
                  htmlFor="cep" 
                  label={formData.country === "BR" ? "CEP" : "Zip / Postal Code"} 
                  tooltip={formData.country === "BR" ? "Código postal do endereço (preenchimento automático do restante do endereço se válido)." : "Código postal"} 
                />
                <div className="relative">
                  <Input id="cep" name="cep" value={formData.cep} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" placeholder={formData.country === "BR" ? "00000-000" : ""} />
                  {fetchingCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-neutral-500" />}
                </div>
              </div>
              <div className="sm:col-span-4 space-y-1">
                <FieldLabel htmlFor="street" label={formData.country === "BR" ? "Logradouro" : "Address Line 1"} tooltip="Rua, avenida, etc." required />
                <Input id="street" name="street" required value={formData.street} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <FieldLabel htmlFor="number" label={formData.country === "BR" ? "Número" : "Number"} tooltip="Número do estabelecimento." />
                <Input id="number" name="number" value={formData.number} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" />
              </div>
              <div className="sm:col-span-4 space-y-1">
                <FieldLabel htmlFor="complement" label={formData.country === "BR" ? "Complemento" : "Address Line 2 (Optional)"} tooltip="Sala, andar, bloco." />
                <Input id="complement" name="complement" value={formData.complement} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <FieldLabel htmlFor="neighborhood" label={formData.country === "BR" ? "Bairro" : "Neighborhood / District"} tooltip="Bairro do estabelecimento." />
                <Input id="neighborhood" name="neighborhood" value={formData.neighborhood} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" />
              </div>
              <div className="sm:col-span-3 space-y-1">
                <FieldLabel htmlFor="city" label={formData.country === "BR" ? "Cidade" : "City"} tooltip="Cidade do estabelecimento." required />
                <Input id="city" name="city" required value={formData.city} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" />
              </div>
              <div className="sm:col-span-1 space-y-1">
                <FieldLabel htmlFor="state" label={formData.country === "BR" ? "UF" : "State"} tooltip="Estado ou Província." required />
                <Input id="state" name="state" required value={formData.state} onChange={handleChange} className="bg-neutral-950/80 border-neutral-800 text-neutral-100 h-11 sm:h-10 text-base sm:text-sm rounded-xl focus:border-blue-500" maxLength={formData.country === "BR" ? 2 : 50} placeholder={formData.country === "BR" ? "SP" : ""} />
              </div>
            </CardContent>
          </Card>

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
                    tooltip="Quantos acessos simultâneos precisará?" 
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
                  <p className="text-xs text-neutral-500 mt-2">
                    Cada acesso simultâneo adicional aumentaria a mensalidade em +R$10. No entanto, durante a fase Beta, todos os acessos são <strong className="text-emerald-400 font-medium">100% gratuitos</strong>.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons (Mobile-First Responsive Bar) */}
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
              className="w-full sm:w-auto min-w-[200px] h-12 px-6 text-base font-semibold bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl shadow-lg shadow-blue-600/20 transition-all"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              {loading ? (isCreateMode ? "Criando clínica..." : "Salvando...") : "Salvar e Continuar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
