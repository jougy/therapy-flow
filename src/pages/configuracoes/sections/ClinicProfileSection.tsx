import { useEffect, useState } from "react";
import { Building2, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { getClinicBrandName } from "@/lib/clinic-settings";

export const ClinicProfileSection = () => {
  const { accountRole, clinic: authClinic, clinicId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [clinicName, setClinicName] = useState("");
  const [clinicLegalName, setClinicLegalName] = useState("");
  const [clinicEmail, setClinicEmail] = useState("");
  const [clinicPhone, setClinicPhone] = useState("");
  const [clinicLogoUrl, setClinicLogoUrl] = useState("");
  const [clinicCnpj, setClinicCnpj] = useState("");
  const [subscriptionPlan, setSubscriptionPlan] = useState("");
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  const [clinicAddress, setClinicAddress] = useState({
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
  });

  const [clinicBusinessHours, setClinicBusinessHours] = useState({ summary: "" });

  useEffect(() => {
    let active = true;
    const loadClinic = async () => {
      if (!clinicId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from("clinics")
        .select("*")
        .eq("id", clinicId)
        .single();

      if (!active) return;
      if (error) {
        toast({ title: "Erro ao carregar clínica", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      if (data) {
        setClinicName(data.name || "");
        setClinicLegalName(data.legal_name || "");
        setClinicEmail(data.email || "");
        setClinicPhone(data.phone || "");
        setClinicLogoUrl(data.logo_url || "");
        setClinicCnpj(data.cnpj || "");
        setSubscriptionPlan(data.subscription_plan || "solo");
        setCreatedAt(data.created_at || null);
        if (data.address && typeof data.address === "object") {
          const addr = data.address as Record<string, string>;
          setClinicAddress({
            cep: addr.cep || "",
            street: addr.street || "",
            number: addr.number || "",
            complement: addr.complement || "",
            neighborhood: addr.neighborhood || "",
            city: addr.city || "",
            state: addr.state || "",
          });
        }
        if (data.business_hours && typeof data.business_hours === "object") {
          const bh = data.business_hours as { summary?: string };
          setClinicBusinessHours({ summary: bh.summary || "" });
        }
      }
      setLoading(false);
    };

    void loadClinic();
    return () => {
      active = false;
    };
  }, [clinicId]);

  const handleSaveClinic = async () => {
    if (!clinicId) return;
    setSaving(true);

    const { error } = await supabase
      .from("clinics")
      .update({
        name: clinicName.trim(),
        legal_name: clinicLegalName.trim() || null,
        email: clinicEmail.trim() || null,
        phone: clinicPhone.trim() || null,
        logo_url: clinicLogoUrl.trim() || null,
        address: clinicAddress,
        business_hours: clinicBusinessHours,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clinicId);

    if (error) {
      toast({ title: "Erro ao salvar clínica", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil da clínica atualizado com sucesso!" });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const formattedPlan =
    subscriptionPlan === "clinic" ? "Plano Clínica" : subscriptionPlan === "solo" ? "Plano Solo" : subscriptionPlan;

  return (
    <Card data-tutorial="settings-clinic-profile-card">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl">Perfil da clínica</CardTitle>
            <p className="text-xs text-muted-foreground">
              Edite os dados institucionais, endereço e logotipo da clínica.
            </p>
          </div>
        </div>
        <ComponentHelpButton helpId="settings-clinic-profile-block" size="sm" />
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div className="rounded-xl border bg-card p-3.5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Marca ativa</p>
            <p className="mt-1 font-bold text-foreground">{getClinicBrandName(clinicName)}</p>
          </div>
          <div className="rounded-xl border bg-card p-3.5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Plano da clínica</p>
            <p className="mt-1 font-bold text-sky-700 dark:text-sky-400">{formattedPlan}</p>
          </div>
          <div className="rounded-xl border bg-card p-3.5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cadastrada em</p>
            <p className="mt-1 font-medium text-foreground">
              {createdAt
                ? new Date(createdAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })
                : "-"}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-3.5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Responsável</p>
            <p className="mt-1 font-medium text-foreground">{accountRole === "account_owner" ? "Você (Proprietário)" : "Administração"}</p>
          </div>
        </div>

        <div className="rounded-xl border p-4 space-y-4 shadow-sm bg-card">
          <div>
            <p className="font-semibold text-foreground">Identidade e Marca</p>
            <p className="text-xs text-muted-foreground">
              O nome e o logo cadastrados aqui passam a representar a clínica no topo da plataforma e documentos.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-[120px,1fr] items-start">
            <div className="rounded-xl border bg-muted/40 p-3 flex items-center justify-center min-h-[100px]">
              {clinicLogoUrl ? (
                <img
                  src={clinicLogoUrl}
                  alt={`Logo da ${getClinicBrandName(clinicName)}`}
                  className="max-h-20 max-w-full object-contain"
                />
              ) : (
                <span className="text-xs text-muted-foreground text-center font-medium">{getClinicBrandName(clinicName)}</span>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome da clínica</Label>
                <Input value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>URL do logotipo</Label>
                <Input value={clinicLogoUrl} onChange={(e) => setClinicLogoUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail institucional</Label>
                <Input value={clinicEmail} onChange={(e) => setClinicEmail(e.target.value)} placeholder="contato@clinica.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone institucional</Label>
                <Input value={clinicPhone} onChange={(e) => setClinicPhone(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-4 space-y-4 shadow-sm bg-card">
          <div>
            <p className="font-semibold text-foreground">Dados Institucionais</p>
            <p className="text-xs text-muted-foreground">Informações formais e operacionais para contratos e recibos.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Razão social</Label>
              <Input value={clinicLegalName} onChange={(e) => setClinicLegalName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ</Label>
              <Input value={clinicCnpj || "Não informado"} disabled className="bg-muted/50" />
            </div>
            <div className="space-y-1.5">
              <Label>Plano contratado</Label>
              <Input value={formattedPlan} disabled className="bg-muted/50" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Horário de funcionamento</Label>
            <Textarea
              value={clinicBusinessHours.summary}
              onChange={(e) => setClinicBusinessHours({ summary: e.target.value })}
              placeholder="Ex.: seg-sex 08h-18h; sábado 08h-12h"
              rows={2}
            />
          </div>
        </div>

        <div className="rounded-xl border p-4 space-y-4 shadow-sm bg-card">
          <div>
            <p className="font-semibold text-foreground">Endereço da Clínica</p>
            <p className="text-xs text-muted-foreground">Preenchimento estruturado para identificação em declarações e relatórios.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>CEP</Label>
              <Input
                value={clinicAddress.cep}
                onChange={(e) => setClinicAddress((prev) => ({ ...prev, cep: e.target.value }))}
                placeholder="00000-000"
              />
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label>Rua / Logradouro</Label>
              <Input
                value={clinicAddress.street}
                onChange={(e) => setClinicAddress((prev) => ({ ...prev, street: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Número</Label>
              <Input
                value={clinicAddress.number}
                onChange={(e) => setClinicAddress((prev) => ({ ...prev, number: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Complemento</Label>
              <Input
                value={clinicAddress.complement}
                onChange={(e) => setClinicAddress((prev) => ({ ...prev, complement: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Bairro</Label>
              <Input
                value={clinicAddress.neighborhood}
                onChange={(e) => setClinicAddress((prev) => ({ ...prev, neighborhood: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input
                value={clinicAddress.city}
                onChange={(e) => setClinicAddress((prev) => ({ ...prev, city: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Estado (UF)</Label>
              <Input
                value={clinicAddress.state}
                onChange={(e) => setClinicAddress((prev) => ({ ...prev, state: e.target.value.toUpperCase() }))}
                maxLength={2}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={() => void handleSaveClinic()}
            disabled={saving || !clinicName.trim()}
            className="bg-primary text-primary-foreground shadow-sm gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar dados da clínica
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
