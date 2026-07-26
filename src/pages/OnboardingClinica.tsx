import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HelpCircle, Loader2 } from "lucide-react";
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

export default function OnboardingClinica() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // @ts-ignore
  const { clinic, profile, session } = useAuth();
  const plan = searchParams.get("plan") as "solo" | "clinic" | null;

  const [loading, setLoading] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);

  const [formData, setFormData] = useState({
    name: clinic?.name || "",
    logo_url: clinic?.logo_url || "",
    email: clinic?.email || "",
    phone: clinic?.phone ? formatPhone(clinic.phone) : "",
    legal_name: clinic?.legal_name || "",
    cpf: profile?.cpf ? formatCPF(profile.cpf) : "",
    cnpj: clinic?.cnpj ? formatCNPJ(clinic.cnpj) : "",
    business_hours: clinic?.business_hours ? (clinic.business_hours as any).description || "" : "",
    country: (clinic?.address as any)?.country || "BR",
    cep: (clinic?.address as any)?.cep ? formatCEP((clinic?.address as any).cep) : "",
    street: (clinic?.address as any)?.street || "",
    number: (clinic?.address as any)?.number || "",
    complement: (clinic?.address as any)?.complement || "",
    neighborhood: (clinic?.address as any)?.neighborhood || "",
    city: (clinic?.address as any)?.city || "",
    state: (clinic?.address as any)?.state || "",
    subaccount_limit: clinic?.subaccount_limit?.toString() || (plan === "clinic" ? "5" : "1"),
    concurrent_access_limit: clinic?.concurrent_access_limit?.toString() || (plan === "clinic" ? "3" : "1"),
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let { name, value } = e.target;
    
    if (name === "cpf") value = formatCPF(value);
    if (name === "cnpj") value = formatCNPJ(value);
    if (name === "phone") value = formatPhone(value);
    if (name === "cep") {
      value = formatCEP(value);
      handleCepChange(value);
    }
    
    setFormData((prev) => ({ ...prev, [name]: value }));
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
    if (!clinic?.id || !session?.user?.id) {
      toast.error("Sessão ou clínica não encontrada.");
      return;
    }

    if (!cleanDigits(formData.cpf) && !cleanDigits(formData.cnpj)) {
      toast.error("Você deve preencher o CPF do responsável ou o CNPJ da clínica.");
      return;
    }

    setLoading(true);
    try {
      // 1. Save Address and Clinic info
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

      const clinicPayload = {
        name: formData.name,
        logo_url: formData.logo_url || null,
        email: formData.email || null,
        phone: formData.phone || null,
        legal_name: formData.legal_name || null,
        cnpj: cleanDigits(formData.cnpj) || null,
        address: addressJson,
        business_hours: businessHoursJson,
        subscription_plan: plan || "solo",
        ...(plan === "clinic" && {
          subaccount_limit: parseInt(formData.subaccount_limit, 10),
          concurrent_access_limit: parseInt(formData.concurrent_access_limit, 10),
        }),
      };

      const { error: clinicError } = await supabase
        .from("clinics")
        // @ts-ignore - typing might be strict for cnpj if not null
        .update(clinicPayload)
        .eq("id", clinic.id);

      if (clinicError) throw clinicError;

      // 2. Save CPF to Profile
      if (cleanDigits(formData.cpf)) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ cpf: cleanDigits(formData.cpf) })
          .eq("id", session.user.id);
        
        if (profileError) throw profileError;
      }

      toast.success("Dados salvos com sucesso!");
      navigate("/espacopessoal");
    } catch (error: any) {
      console.error("Error updating onboarding data:", error);
      toast.error(error.message || "Erro ao salvar os dados.");
    } finally {
      setLoading(false);
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
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center py-12 px-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="z-10 w-full max-w-4xl space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Configure sua Clínica</h1>
          <p className="text-neutral-400">
            Preencha os dados abaixo para personalizar o ambiente e preparar o sistema para os seus atendimentos.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="bg-neutral-900/50 border-neutral-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl text-white">Identidade e Contato</CardTitle>
              <CardDescription className="text-neutral-400">Como sua clínica será reconhecida.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-1">
                <FieldLabel htmlFor="name" label="Nome da Clínica" tooltip="O nome comercial ou fantasia que será exibido aos pacientes." required />
                <Input id="name" name="name" required value={formData.name} onChange={handleChange} className="bg-neutral-950 border-neutral-800 text-neutral-100" placeholder="Ex: Clínica Bem Estar" />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor="logo_url" label="URL do Logo" tooltip="Insira um link direto para a imagem do seu logo (ex: https://site.com/logo.png)." />
                <Input id="logo_url" name="logo_url" value={formData.logo_url} onChange={handleChange} className="bg-neutral-950 border-neutral-800 text-neutral-100" placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor="email" label="E-mail Institucional" tooltip="E-mail principal para contato profissional e notificações do sistema." />
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} className="bg-neutral-950 border-neutral-800 text-neutral-100" placeholder="contato@clinica.com" />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor="phone" label="Telefone / WhatsApp" tooltip="Número de contato principal da clínica." />
                <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} className="bg-neutral-950 border-neutral-800 text-neutral-100" placeholder="(00) 00000-0000" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-neutral-900/50 border-neutral-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl text-white">Dados Jurídicos e Operação</CardTitle>
              <CardDescription className="text-neutral-400">Você deve preencher o CPF do responsável OU o CNPJ da clínica.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1">
                <FieldLabel htmlFor="legal_name" label="Razão Social" tooltip="Nome oficial registrado no CNPJ, se aplicável." />
                <Input id="legal_name" name="legal_name" value={formData.legal_name} onChange={handleChange} className="bg-neutral-950 border-neutral-800 text-neutral-100" placeholder="Empresa Saúde LTDA" />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor="cpf" label="CPF do Responsável" tooltip="Documento do titular da conta e responsável legal." required={!cleanDigits(formData.cnpj)} />
                <Input id="cpf" name="cpf" value={formData.cpf} onChange={handleChange} className="bg-neutral-950 border-neutral-800 text-neutral-100" placeholder="000.000.000-00" required={!cleanDigits(formData.cnpj)} />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor="cnpj" label="CNPJ da Clínica" tooltip="Documento da clínica para fins de faturamento e registro." required={!cleanDigits(formData.cpf)} />
                <Input id="cnpj" name="cnpj" value={formData.cnpj} onChange={handleChange} className="bg-neutral-950 border-neutral-800 text-neutral-100" placeholder="00.000.000/0001-00" required={!cleanDigits(formData.cpf)} />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <FieldLabel htmlFor="business_hours" label="Horário de Funcionamento" tooltip="Descreva brevemente os horários (ex: Segunda a Sexta, 08h às 18h)." />
                <Input id="business_hours" name="business_hours" value={formData.business_hours} onChange={handleChange} className="bg-neutral-950 border-neutral-800 text-neutral-100" placeholder="Ex: Seg-Sex, 08h-18h" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-neutral-900/50 border-neutral-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl text-white">Endereço Completo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-6">
              <div className="sm:col-span-6 space-y-1">
                <FieldLabel htmlFor="country" label="País" tooltip="Selecione o país. Endereços no Brasil preenchem automaticamente pelo CEP." required />
                <Select value={formData.country} onValueChange={(val) => handleSelectChange("country", val)}>
                  <SelectTrigger className="bg-neutral-950 border-neutral-800 text-neutral-100">
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
                  <Input id="cep" name="cep" value={formData.cep} onChange={handleChange} className="bg-neutral-950 border-neutral-800 text-neutral-100" placeholder={formData.country === "BR" ? "00000-000" : ""} />
                  {fetchingCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-neutral-500" />}
                </div>
              </div>
              <div className="sm:col-span-4 space-y-1">
                <FieldLabel htmlFor="street" label={formData.country === "BR" ? "Logradouro" : "Address Line 1"} tooltip="Rua, avenida, etc." required />
                <Input id="street" name="street" required value={formData.street} onChange={handleChange} className="bg-neutral-950 border-neutral-800 text-neutral-100" />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <FieldLabel htmlFor="number" label={formData.country === "BR" ? "Número" : "Number"} tooltip="Número do estabelecimento." />
                <Input id="number" name="number" value={formData.number} onChange={handleChange} className="bg-neutral-950 border-neutral-800 text-neutral-100" />
              </div>
              <div className="sm:col-span-4 space-y-1">
                <FieldLabel htmlFor="complement" label={formData.country === "BR" ? "Complemento" : "Address Line 2 (Optional)"} tooltip="Sala, andar, bloco." />
                <Input id="complement" name="complement" value={formData.complement} onChange={handleChange} className="bg-neutral-950 border-neutral-800 text-neutral-100" />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <FieldLabel htmlFor="neighborhood" label={formData.country === "BR" ? "Bairro" : "Neighborhood / District"} tooltip="Bairro do estabelecimento." />
                <Input id="neighborhood" name="neighborhood" value={formData.neighborhood} onChange={handleChange} className="bg-neutral-950 border-neutral-800 text-neutral-100" />
              </div>
              <div className="sm:col-span-3 space-y-1">
                <FieldLabel htmlFor="city" label={formData.country === "BR" ? "Cidade" : "City"} tooltip="Cidade do estabelecimento." required />
                <Input id="city" name="city" required value={formData.city} onChange={handleChange} className="bg-neutral-950 border-neutral-800 text-neutral-100" />
              </div>
              <div className="sm:col-span-1 space-y-1">
                <FieldLabel htmlFor="state" label={formData.country === "BR" ? "UF" : "State"} tooltip="Estado ou Província." required />
                <Input id="state" name="state" required value={formData.state} onChange={handleChange} className="bg-neutral-950 border-neutral-800 text-neutral-100" maxLength={formData.country === "BR" ? 2 : 50} placeholder={formData.country === "BR" ? "SP" : ""} />
              </div>
            </CardContent>
          </Card>

          {plan === "clinic" && (
            <Card className="bg-blue-900/10 border-blue-500/20 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl text-blue-400">Equipe e Acessos</CardTitle>
                <CardDescription className="text-neutral-400">Configure os limites de uso para o plano Clínica com Equipe.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-1">
                  <FieldLabel 
                    htmlFor="subaccount_limit" 
                    label="Colaboradores (Total)" 
                    tooltip="Quantos colaboradores trabalham na clínica contando com você?" 
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
                    className="bg-neutral-950 border-neutral-800 text-neutral-100" 
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
                    min={1} 
                    required 
                    value={formData.concurrent_access_limit} 
                    onChange={handleChange} 
                    className="bg-neutral-950 border-neutral-800 text-neutral-100" 
                  />
                  <p className="text-xs text-neutral-500 mt-2">
                    Cada acesso simultâneo adicional aumentaria a mensalidade em +R$10. No entanto, durante a fase Beta, todos os acessos são <strong className="text-emerald-400 font-medium">100% gratuitos</strong>.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[200px] h-12 text-base font-semibold">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              {loading ? "Salvando..." : "Salvar e Continuar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
