import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  Check,
  Clock,
  Copy,
  Edit3,
  Globe,
  Loader2,
  Lock,
  MoonStar,
  Save,
  Shield,
  UserCheck,
  UserRound,
  X,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import ThemeModeSwitch from "@/components/ThemeModeSwitch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { generateGlobalUserId } from "@/lib/user-identity";

interface AddressState {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

const formatCpf = (val: string) => {
  const clean = val.replace(/\D/g, "").slice(0, 11);
  if (clean.length <= 3) return clean;
  if (clean.length <= 6) return `${clean.slice(0, 3)}.${clean.slice(3)}`;
  if (clean.length <= 9) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
};

const formatPhone = (val: string) => {
  const clean = val.replace(/\D/g, "").slice(0, 11);
  if (clean.length <= 2) return clean;
  if (clean.length <= 6) return `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
  if (clean.length <= 10) return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
};

const formatCep = (val: string) => {
  const clean = val.replace(/\D/g, "").slice(0, 8);
  if (clean.length <= 5) return clean;
  return `${clean.slice(0, 5)}-${clean.slice(5)}`;
};

const formatDateBr = (isoStr: string | null | undefined): string => {
  if (!isoStr) return "-";
  try {
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? isoStr : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return isoStr;
  }
};

const formatDateTimeBr = (isoStr: string | null | undefined): string => {
  if (!isoStr) return "-";
  try {
    const d = new Date(isoStr);
    return isNaN(d.getTime())
      ? isoStr
      : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return isoStr;
  }
};

export const PersonalProfileSection = () => {
  const { clinic: authClinic, profile, refreshAuthState, user } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const isDarkTheme = resolvedTheme === "dark";

  const [isEditing, setIsEditing] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Form State
  const [fullName, setFullName] = useState("");
  const [socialName, setSocialName] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [professionalLicense, setProfessionalLicense] = useState("");
  const [address, setAddress] = useState<AddressState>({
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
  });

  // Identificador Global Descritivo em Base 36 com Checksum
  const globalUserId = useMemo(() => {
    return generateGlobalUserId({
      userId: user?.id,
      publicCode: profile?.public_code,
      email: user?.email,
    });
  }, [user?.id, user?.email, profile?.public_code]);

  const loadProfileIntoForm = () => {
    if (!profile) return;
    setFullName(profile.full_name || "");
    setSocialName(profile.social_name || "");
    setCpf(profile.cpf ? formatCpf(profile.cpf) : "");
    setBirthDate(profile.birth_date || "");
    setPhone(profile.phone ? formatPhone(profile.phone) : "");
    setProfessionalLicense(profile.professional_license || "");

    const rawAddr = profile.address && typeof profile.address === "object" ? (profile.address as Record<string, unknown>) : {};
    setAddress({
      cep: typeof rawAddr.cep === "string" ? formatCep(rawAddr.cep) : "",
      street: typeof rawAddr.street === "string" ? rawAddr.street : "",
      number: typeof rawAddr.number === "string" ? rawAddr.number : "",
      complement: typeof rawAddr.complement === "string" ? rawAddr.complement : "",
      neighborhood: typeof rawAddr.neighborhood === "string" ? rawAddr.neighborhood : "",
      city: typeof rawAddr.city === "string" ? rawAddr.city : "",
      state: typeof rawAddr.state === "string" ? rawAddr.state : "",
    });
  };

  useEffect(() => {
    loadProfileIntoForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const handleCopyGlobalId = () => {
    navigator.clipboard.writeText(globalUserId);
    setCopiedId(true);
    toast({ title: "ID Global copiado!", description: globalUserId });
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCancelEdit = () => {
    loadProfileIntoForm();
    setIsEditing(false);
  };

  const handleOpenConfirmDialog = () => {
    if (!fullName.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe seu nome completo.", variant: "destructive" });
      return;
    }
    setConfirmDialogOpen(true);
  };

  const handleSaveConfirmed = async () => {
    if (!user?.id) return;
    setSaving(true);

    try {
      // 1. Identifica alterações sensíveis em dados previamente preenchidos
      const sensitiveChanges: Record<string, { from: unknown; to: unknown }> = {};

      const checkChange = (fieldName: string, prevVal: string | null | undefined, newVal: string) => {
        const cleanPrev = (prevVal || "").trim();
        const cleanNew = newVal.trim();
        // Apenas considera sensível se já havia um valor preenchido e foi alterado para outro valor diferente
        if (cleanPrev && cleanNew && cleanPrev !== cleanNew) {
          sensitiveChanges[fieldName] = { from: cleanPrev, to: cleanNew };
        }
      };

      checkChange("full_name", profile?.full_name, fullName);
      checkChange("cpf", profile?.cpf, cpf.replace(/\D/g, ""));
      checkChange("phone", profile?.phone, phone.replace(/\D/g, ""));
      checkChange("professional_license", profile?.professional_license, professionalLicense);
      checkChange("birth_date", profile?.birth_date, birthDate);

      // 2. Atualiza os dados no profiles
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          social_name: socialName.trim() || null,
          cpf: cpf.replace(/\D/g, "") || null,
          birth_date: birthDate || null,
          phone: phone.replace(/\D/g, "") || null,
          professional_license: professionalLicense.trim() || null,
          address: {
            cep: address.cep.replace(/\D/g, ""),
            street: address.street.trim(),
            number: address.number.trim(),
            complement: address.complement.trim(),
            neighborhood: address.neighborhood.trim(),
            city: address.city.trim(),
            state: address.state.trim(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      // 3. Se houve alterações sensíveis em campos preenchidos, registra evento de auditoria
      if (Object.keys(sensitiveChanges).length > 0) {
        await supabase.from("security_events").insert({
          actor_user_id: user.id,
          target_user_id: user.id,
          clinic_id: authClinic?.id || null,
          event_type: "profile_data_updated",
          visibility_scope: "personal",
          payload: {
            changed_fields: Object.keys(sensitiveChanges),
            changes: sensitiveChanges,
            timestamp: new Date().toISOString(),
          },
        });
      }

      toast({
        title: "Perfil pessoal salvo com sucesso!",
        description: "Seus dados cadastrais foram atualizados na identidade global.",
      });

      await refreshAuthState();
      setIsEditing(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast({
        title: "Erro ao salvar dados pessoais",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
      setConfirmDialogOpen(false);
    }
  };

  return (
    <>
      {/* Modal de Confirmação de Salvamento */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Confirmar alteração de dados pessoais?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Os novos dados cadastrais serão atualizados na sua identidade global Pluri-Health e refletidos em seus vínculos profissionais.
              </p>
              <p className="text-xs text-muted-foreground">
                Alterações em dados preenchidos serão registradas no seu histórico de segurança pessoal para sua proteção.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleSaveConfirmed()}
              disabled={saving}
              className="gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Confirmar e salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-6">
        {/* Header com 4 Cards de Identidade Global */}
        <Card data-tutorial="settings-profile-personal-card">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl">Perfil Pessoal</CardTitle>
                <CardDescription className="text-xs">
                  Dados cadastrais da sua identidade global na plataforma Pluri-Health.
                </CardDescription>
              </div>
            </div>
            <ComponentHelpButton helpId="settings-profile-personal-block" size="sm" />
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Grid com 4 KPIs: ID Global, Último acesso, Membro desde, Contexto */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Card 1: ID Global Descritivo */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-1.5 transition-all hover:bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-primary" />
                    ID Global
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary font-mono border-primary/20">
                    Conta Global
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <p className="font-mono text-sm font-bold text-foreground tracking-tight select-all">
                    {globalUserId}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={handleCopyGlobalId}
                    title="Copiar ID Global"
                  >
                    {copiedId ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {/* Card 2: Último Acesso */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Último Acesso
                </span>
                <p className="text-sm font-semibold text-foreground pt-0.5">
                  {formatDateTimeBr(profile?.last_seen_at)}
                </p>
              </div>

              {/* Card 3: Membro Desde */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  Membro Desde
                </span>
                <p className="text-sm font-semibold text-foreground pt-0.5">
                  {formatDateBr(profile?.created_at)}
                </p>
              </div>

              {/* Card 4: Contexto Atual */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  Contexto Atual
                </span>
                <p className="text-sm font-semibold text-foreground truncate pt-0.5">
                  {authClinic?.name || "Clínica Principal"}
                </p>
              </div>
            </div>

            {/* Banner LGPD / Posse dos Dados Pessoais */}
            <div className="rounded-xl border border-sky-200/80 bg-sky-50/70 p-4 text-xs leading-relaxed text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200">
              Estes dados pertencem à sua conta pessoal. A clínica pode criar o primeiro acesso e manter dados
              operacionais do vínculo, mas alterações nos seus dados pessoais e de segurança ficam sob seu controle.
              Compartilhamentos mais sensíveis com clínicas são protegidos por consentimento explícito e conformidade LGPD.
            </div>

            {/* Toggle de Tema Noturno Animado */}
            <div data-tutorial="settings-profile-theme" className="rounded-xl border p-4 bg-card transition-colors hover:bg-muted/20">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                    <MoonStar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">Tema noturno</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Troque entre o visual claro e o novo tema escuro. A escolha fica salva neste dispositivo.
                    </p>
                  </div>
                </div>
                <ThemeModeSwitch
                  checked={isDarkTheme}
                  className="self-end sm:self-auto"
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                  aria-label="Alternar tema noturno"
                />
              </div>
            </div>

            {/* Seção 1: Dados de Acesso */}
            <div className="rounded-xl border p-5 space-y-3 bg-card">
              <div>
                <p className="font-semibold text-sm text-foreground">Dados de acesso</p>
                <p className="text-xs text-muted-foreground">
                  Seu e-mail principal da identidade global. A troca de senha é gerenciada na aba de Segurança.
                </p>
              </div>
              <div className="max-w-md space-y-1.5">
                <Label className="text-xs">E-mail de acesso</Label>
                <div className="flex items-center gap-2">
                  <Input value={user?.email || ""} disabled className="bg-muted/50 font-medium text-xs" />
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    Verificado
                  </Badge>
                </div>
              </div>
            </div>

            {/* Seção 2: Dados Pessoais e Cadastrais */}
            <div className="rounded-xl border p-5 space-y-4 bg-card">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-sm text-foreground">Identificação Pessoal & Cadastro</p>
                  <p className="text-xs text-muted-foreground">
                    Dados cadastrais que pertencem à sua pessoa, independentemente da clínica conectada.
                  </p>
                </div>
                {!isEditing && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 shrink-0 self-start sm:self-auto"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Editar dados pessoais
                  </Button>
                )}
              </div>

              {/* Modo Visualização Formatada (Read-Only) */}
              {!isEditing ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-1">
                  <div className="rounded-lg border bg-muted/15 p-3 space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">Nome completo</span>
                    <p className="text-sm font-semibold text-foreground">{fullName || "Não informado"}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/15 p-3 space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">Nome social</span>
                    <p className="text-sm font-semibold text-foreground">{socialName || "Não informado"}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/15 p-3 space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">CPF</span>
                    <p className="text-sm font-semibold text-foreground font-mono">{cpf || "Não informado"}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/15 p-3 space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">Data de nascimento</span>
                    <p className="text-sm font-semibold text-foreground">{formatDateBr(birthDate)}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/15 p-3 space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">Telefone / WhatsApp</span>
                    <p className="text-sm font-semibold text-foreground">{phone || "Não informado"}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/15 p-3 space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">Registro Profissional</span>
                    <p className="text-sm font-semibold text-foreground">{professionalLicense || "Não informado"}</p>
                  </div>

                  {/* Endereço em visualização se houver */}
                  {(address.cep || address.street || address.city) && (
                    <div className="sm:col-span-2 lg:col-span-3 rounded-lg border bg-muted/15 p-3 space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground">Endereço</span>
                      <p className="text-sm text-foreground">
                        {[
                          address.street && `${address.street}${address.number ? `, ${address.number}` : ""}`,
                          address.complement,
                          address.neighborhood,
                          address.city && address.state ? `${address.city} - ${address.state}` : address.city,
                          address.cep && `CEP: ${address.cep}`,
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Modo Edição com Inputs e Confirmação */
                <div className="space-y-4 pt-1">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-semibold">Nome completo *</Label>
                      <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome completo" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Nome social</Label>
                      <Input value={socialName} onChange={(e) => setSocialName(e.target.value)} placeholder="Opcional" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">CPF</Label>
                      <Input
                        value={cpf}
                        onChange={(e) => setCpf(formatCpf(e.target.value))}
                        placeholder="000.000.000-00"
                        maxLength={14}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Data de nascimento</Label>
                      <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Telefone / WhatsApp</Label>
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(formatPhone(e.target.value))}
                        placeholder="(11) 99999-9999"
                        maxLength={15}
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                      <Label className="text-xs font-semibold">Registro profissional (CRP / CRM / CREFITO)</Label>
                      <Input
                        value={professionalLicense}
                        onChange={(e) => setProfessionalLicense(e.target.value)}
                        placeholder="Ex: CRP 06/123456"
                      />
                    </div>
                  </div>

                  {/* Campos de Endereço no modo edição */}
                  <div className="border-t pt-3 space-y-3">
                    <p className="text-xs font-semibold text-foreground">Endereço Pessoal</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">CEP</Label>
                        <Input
                          value={address.cep}
                          onChange={(e) => setAddress((prev) => ({ ...prev, cep: formatCep(e.target.value) }))}
                          placeholder="00000-000"
                          maxLength={9}
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">Logradouro / Rua</Label>
                        <Input
                          value={address.street}
                          onChange={(e) => setAddress((prev) => ({ ...prev, street: e.target.value }))}
                          placeholder="Ex: Av. Paulista"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Número</Label>
                        <Input
                          value={address.number}
                          onChange={(e) => setAddress((prev) => ({ ...prev, number: e.target.value }))}
                          placeholder="123"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Complemento</Label>
                        <Input
                          value={address.complement}
                          onChange={(e) => setAddress((prev) => ({ ...prev, complement: e.target.value }))}
                          placeholder="Apto 45"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Bairro</Label>
                        <Input
                          value={address.neighborhood}
                          onChange={(e) => setAddress((prev) => ({ ...prev, neighborhood: e.target.value }))}
                          placeholder="Bairro"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Cidade</Label>
                        <Input
                          value={address.city}
                          onChange={(e) => setAddress((prev) => ({ ...prev, city: e.target.value }))}
                          placeholder="Cidade"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Estado / UF</Label>
                        <Input
                          value={address.state}
                          onChange={(e) => setAddress((prev) => ({ ...prev, state: e.target.value.toUpperCase().slice(0, 2) }))}
                          placeholder="UF"
                          maxLength={2}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Barra de Ações: Salvar / Cancelar */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                      disabled={saving}
                      className="gap-1.5"
                    >
                      <X className="h-4 w-4" />
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleOpenConfirmDialog}
                      disabled={saving || !fullName.trim()}
                      className="gap-1.5 bg-primary text-primary-foreground"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Salvar alterações
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
