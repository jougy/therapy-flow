import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  CreditCard,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Settings,
  Shield,
  UsersRound,
  Wallet,
  Save,
  Trash2,
  UserRound,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  ANAMNESIS_FIELD_LIBRARY,
  countTemplateQuestionFields,
  countTemplateSections,
  createDefaultTemplateSchema,
  isAnamnesisTemplateSchema,
} from "@/lib/anamnesis-forms";
import {
  formatLastSeenAt,
  getMembershipStatusMeta,
  getSubaccountCapacity,
  sortMembershipsForDisplay,
} from "@/lib/subaccounts";
import {
  buildProfileAddress,
  formatCep,
  formatCpf,
  formatPhone,
  getProfilePublicCodeLabel,
  readProfileAddress,
  type ProfileAddress,
} from "@/lib/profile-settings";

type TemplateRow = Database["public"]["Tables"]["anamnesis_form_templates"]["Row"];
type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type ClinicRow = Database["public"]["Tables"]["clinics"]["Row"];
type MembershipRow = Database["public"]["Tables"]["clinic_memberships"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type SubaccountOperationalRole = Exclude<MembershipRow["operational_role"], "owner">;
type TeamProfileRow = Pick<
  ProfileRow,
  | "address"
  | "bio"
  | "birth_date"
  | "cpf"
  | "email"
  | "full_name"
  | "id"
  | "job_title"
  | "last_seen_at"
  | "phone"
  | "professional_license"
  | "public_code"
  | "social_name"
  | "specialty"
  | "working_hours"
>;

type EditableSubaccountState = {
  address: ProfileAddress;
  bio: string;
  birthDate: string;
  cpf: string;
  email: string;
  fullName: string;
  jobTitle: string;
  membershipStatus: MembershipRow["membership_status"];
  operationalRole: SubaccountOperationalRole;
  phone: string;
  professionalLicense: string;
  socialName: string;
  resetPassword: string;
  specialty: string;
  workingHours: string;
};

type EditableOwnProfileState = {
  address: ProfileAddress;
  bio: string;
  birthDate: string;
  cpf: string;
  email: string;
  fullName: string;
  jobTitle: string;
  phone: string;
  professionalLicense: string;
  resetPassword: string;
  socialName: string;
  specialty: string;
  workingHours: string;
};

type SettingsSection =
  | "profile"
  | "clinic"
  | "team"
  | "billing"
  | "treasury"
  | "analytics"
  | "security"
  | "forms"
  | "signout";

const OPERATIONAL_ROLE_LABELS: Record<SubaccountOperationalRole | "owner", string> = {
  admin: "Admin",
  assistant: "Assistente",
  owner: "Owner",
  professional: "Profissional",
};

const Configuracoes = () => {
  const navigate = useNavigate();
  const { accountRole, can, clinic: authClinic, clinicId, profile, signOut, subscriptionPlan, user } = useAuth();
  const [clinic, setClinic] = useState<ClinicRow | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [sessions, setSessions] = useState<Pick<SessionRow, "anamnesis_template_id" | "session_date">[]>([]);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [profiles, setProfiles] = useState<TeamProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const [savingClinic, setSavingClinic] = useState(false);
  const [savingMembershipId, setSavingMembershipId] = useState<string | null>(null);
  const [savingOwnProfile, setSavingOwnProfile] = useState(false);
  const [creatingSubaccount, setCreatingSubaccount] = useState(false);
  const [expandedSubaccountIds, setExpandedSubaccountIds] = useState<string[]>([]);
  const [editingMembershipId, setEditingMembershipId] = useState<string | null>(null);
  const [editingSubaccount, setEditingSubaccount] = useState<EditableSubaccountState | null>(null);
  const [clinicName, setClinicName] = useState("");
  const [clinicLegalName, setClinicLegalName] = useState("");
  const [clinicEmail, setClinicEmail] = useState("");
  const [clinicPhone, setClinicPhone] = useState("");
  const [ownProfileForm, setOwnProfileForm] = useState<EditableOwnProfileState>({
    address: readProfileAddress(null),
    bio: "",
    birthDate: "",
    cpf: "",
    email: "",
    fullName: "",
    jobTitle: "",
    phone: "",
    professionalLicense: "",
    resetPassword: "",
    socialName: "",
    specialty: "",
    workingHours: "",
  });
  const [newSubaccountName, setNewSubaccountName] = useState("");
  const [newSubaccountEmail, setNewSubaccountEmail] = useState("");
  const [newSubaccountPassword, setNewSubaccountPassword] = useState("123456");
  const [newSubaccountJobTitle, setNewSubaccountJobTitle] = useState("");
  const [newSubaccountSpecialty, setNewSubaccountSpecialty] = useState("");
  const [newSubaccountRole, setNewSubaccountRole] = useState<SubaccountOperationalRole>("professional");

  const fetchData = useCallback(async () => {
    if (!clinicId) return;

    setLoading(true);
    const [clinicRes, templatesRes, sessionsRes, membershipsRes, profilesRes] = await Promise.all([
      supabase.from("clinics").select("*").eq("id", clinicId).single(),
      supabase
        .from("anamnesis_form_templates")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("is_system_default", false)
        .order("updated_at", { ascending: false }),
      supabase
        .from("sessions")
        .select("anamnesis_template_id, session_date")
        .eq("clinic_id", clinicId),
      supabase
        .from("clinic_memberships")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("address, bio, birth_date, cpf, email, full_name, id, job_title, last_seen_at, phone, professional_license, public_code, social_name, specialty, working_hours")
        .eq("clinic_id", clinicId),
    ]);

    if (templatesRes.error) {
      toast({ title: "Erro ao carregar formulários", description: templatesRes.error.message, variant: "destructive" });
    }

    setClinic(clinicRes.data ?? null);
    setTemplates(templatesRes.data ?? []);
    setSessions(sessionsRes.data ?? []);
    setMemberships(membershipsRes.data ?? []);
    setProfiles(profilesRes.data ?? []);
    setClinicName(clinicRes.data?.name ?? "");
    setClinicLegalName(clinicRes.data?.legal_name ?? "");
    setClinicEmail(clinicRes.data?.email ?? "");
    setClinicPhone(clinicRes.data?.phone ?? "");
    const ownProfileRow = (profilesRes.data ?? []).find((row) => row.id === user?.id) ?? null;
    setOwnProfileForm({
      address: readProfileAddress(ownProfileRow?.address),
      bio: ownProfileRow?.bio ?? "",
      birthDate: ownProfileRow?.birth_date ?? "",
      cpf: formatCpf(ownProfileRow?.cpf ?? ""),
      email: ownProfileRow?.email ?? user?.email ?? "",
      fullName: ownProfileRow?.full_name ?? "",
      jobTitle: ownProfileRow?.job_title ?? "",
      phone: formatPhone(ownProfileRow?.phone ?? ""),
      professionalLicense: ownProfileRow?.professional_license ?? "",
      resetPassword: "",
      socialName: ownProfileRow?.social_name ?? "",
      specialty: ownProfileRow?.specialty ?? "",
      workingHours: ownProfileRow?.working_hours ?? "",
    });
    setSelectedTemplateId((current) => current ?? templatesRes.data?.[0]?.id ?? null);
    setLoading(false);
  }, [clinicId, user?.email, user?.id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? templates[0] ?? null,
    [selectedTemplateId, templates]
  );

  const selectedSchema = useMemo(
    () => (selectedTemplate && isAnamnesisTemplateSchema(selectedTemplate.schema) ? selectedTemplate.schema : []),
    [selectedTemplate]
  );

  const selectedStats = useMemo(() => {
    if (!selectedTemplate) {
      return { fieldCount: 0, lastUsedAt: null as string | null, sectionCount: 0, totalUses: 0 };
    }

    const relatedSessions = sessions.filter((session) => session.anamnesis_template_id === selectedTemplate.id);
    const sortedDates = relatedSessions
      .map((session) => session.session_date)
      .filter(Boolean)
      .sort((left, right) => right.localeCompare(left));

    return {
      fieldCount: countTemplateQuestionFields(selectedSchema),
      lastUsedAt: sortedDates[0] ?? null,
      sectionCount: countTemplateSections(selectedSchema),
      totalUses: relatedSessions.length,
    };
  }, [selectedSchema, selectedTemplate, sessions]);

  const baseSchema = useMemo(
    () => (clinic && isAnamnesisTemplateSchema(clinic.anamnesis_base_schema) ? clinic.anamnesis_base_schema : createDefaultTemplateSchema()),
    [clinic]
  );

  const profileMap = useMemo(
    () => new Map(profiles.map((row) => [row.id, row])),
    [profiles]
  );

  const sortedMemberships = useMemo(
    () => sortMembershipsForDisplay(memberships),
    [memberships]
  );

  const subaccountMemberships = useMemo(
    () => sortedMemberships.filter((membershipRow) => membershipRow.account_role !== "account_owner"),
    [sortedMemberships]
  );

  const subaccountCapacity = useMemo(
    () => getSubaccountCapacity(authClinic?.subaccount_limit ?? 0, memberships),
    [authClinic?.subaccount_limit, memberships]
  );

  const availableSections = useMemo(
    () =>
      [
        {
          description: "Veja os dados básicos da sua conta dentro da clínica.",
          icon: UserRound,
          id: "profile" as const,
          title: "Editar perfil",
        },
        can("clinic_profile.manage") && {
          description: "Edite os dados institucionais e o plano atual da clínica.",
          icon: Building2,
          id: "clinic" as const,
          title: "Perfil da clínica",
        },
        (can("subaccounts.manage") || can("subaccounts_roles.manage") || subscriptionPlan === "solo") && {
          description: "Visualize subcontas, papéis e status de membership.",
          icon: UsersRound,
          id: "team" as const,
          title: "Colaboradores e acessos",
        },
        can("subscription_billing.manage") && {
          description: "Assinatura, cobrança e limites do plano contratado.",
          icon: CreditCard,
          id: "billing" as const,
          title: "Assinatura e pagamentos",
        },
        can("treasury.manage") && {
          description: "Área reservada para tesouraria e visão financeira da clínica.",
          icon: Wallet,
          id: "treasury" as const,
          title: "Tesouraria",
        },
        can("subaccounts_analytics.read") && {
          description: "Acompanhe desempenho e atividade das subcontas.",
          icon: BarChart3,
          id: "analytics" as const,
          title: "Desempenho da equipe",
        },
        {
          description: "Ajustes de acesso e orientações de proteção da conta.",
          icon: Shield,
          id: "security" as const,
          title: "Segurança",
        },
        can("forms.manage") && {
          description: "Criar, editar e analisar fichas de anamnese.",
          icon: ClipboardList,
          id: "forms" as const,
          title: "Gerenciar formulários",
        },
        {
          description: "Encerrar a sessão atual neste dispositivo.",
          icon: LogOut,
          id: "signout" as const,
          title: "Sair da conta",
        },
      ].filter(Boolean) as Array<{
        description: string;
        icon: typeof UserRound;
        id: SettingsSection;
        title: string;
      }>,
    [can, subscriptionPlan]
  );

  useEffect(() => {
    if (!availableSections.some((section) => section.id === activeSection)) {
      setActiveSection(availableSections[0]?.id ?? "profile");
    }
  }, [activeSection, availableSections]);

  const handleSaveClinicProfile = async () => {
    if (!clinicId || !can("clinic_profile.manage")) {
      return;
    }

    setSavingClinic(true);
    const { error } = await supabase
      .from("clinics")
      .update({
        email: clinicEmail.trim() || null,
        legal_name: clinicLegalName.trim() || null,
        name: clinicName.trim(),
        phone: clinicPhone.trim() || null,
      })
      .eq("id", clinicId);

    if (error) {
      toast({ title: "Erro ao salvar clínica", description: error.message, variant: "destructive" });
      setSavingClinic(false);
      return;
    }

    toast({ title: "Perfil da clínica atualizado" });
    setSavingClinic(false);
    void fetchData();
  };

  const updateOwnProfileField = <K extends keyof EditableOwnProfileState>(key: K, value: EditableOwnProfileState[K]) => {
    setOwnProfileForm((current) => ({ ...current, [key]: value }));
  };

  const updateOwnProfileAddressField = (key: keyof ProfileAddress, value: string) => {
    setOwnProfileForm((current) => ({
      ...current,
      address: {
        ...current.address,
        [key]: value,
      },
    }));
  };

  const updateEditingSubaccountField = <K extends keyof EditableSubaccountState>(key: K, value: EditableSubaccountState[K]) => {
    setEditingSubaccount((current) => (current ? { ...current, [key]: value } : current));
  };

  const updateEditingSubaccountAddressField = (key: keyof ProfileAddress, value: string) => {
    setEditingSubaccount((current) =>
      current
        ? {
            ...current,
            address: {
              ...current.address,
              [key]: value,
            },
          }
        : current
    );
  };

  const handleSaveOwnProfile = async () => {
    if (!user?.id) {
      return;
    }

    setSavingOwnProfile(true);
    const { error } = await supabase.rpc("update_current_profile", {
      _address: buildProfileAddress(ownProfileForm.address),
      _bio: ownProfileForm.bio || null,
      _birth_date: ownProfileForm.birthDate || null,
      _cpf: ownProfileForm.cpf || null,
      _email: ownProfileForm.email,
      _full_name: ownProfileForm.fullName,
      _job_title: ownProfileForm.jobTitle || null,
      _new_password: ownProfileForm.resetPassword || null,
      _phone: ownProfileForm.phone || null,
      _professional_license: ownProfileForm.professionalLicense || null,
      _social_name: ownProfileForm.socialName || null,
      _specialty: ownProfileForm.specialty || null,
      _working_hours: ownProfileForm.workingHours || null,
    });

    if (error) {
      toast({ title: "Erro ao salvar perfil", description: error.message, variant: "destructive" });
      setSavingOwnProfile(false);
      return;
    }

    toast({ title: "Perfil atualizado" });
    setSavingOwnProfile(false);
    setOwnProfileForm((current) => ({ ...current, resetPassword: "" }));
    void fetchData();
  };

  const toggleExpandedSubaccount = (membershipId: string) => {
    setExpandedSubaccountIds((current) =>
      current.includes(membershipId) ? current.filter((id) => id !== membershipId) : [...current, membershipId]
    );
  };

  const startEditingSubaccount = (membershipRow: MembershipRow) => {
    const relatedProfile = profileMap.get(membershipRow.user_id);

    setExpandedSubaccountIds((current) =>
      current.includes(membershipRow.id) ? current : [...current, membershipRow.id]
    );
    setEditingMembershipId(membershipRow.id);
    setEditingSubaccount({
      address: readProfileAddress(relatedProfile?.address),
      bio: relatedProfile?.bio ?? "",
      birthDate: relatedProfile?.birth_date ?? "",
      cpf: relatedProfile?.cpf ?? "",
      email: relatedProfile?.email ?? "",
      fullName: relatedProfile?.full_name ?? "",
      jobTitle: relatedProfile?.job_title ?? "",
      membershipStatus: membershipRow.membership_status,
      operationalRole: membershipRow.operational_role as SubaccountOperationalRole,
      phone: relatedProfile?.phone ?? "",
      professionalLicense: relatedProfile?.professional_license ?? "",
      socialName: relatedProfile?.social_name ?? "",
      resetPassword: "",
      specialty: relatedProfile?.specialty ?? "",
      workingHours: relatedProfile?.working_hours ?? "",
    });
  };

  const cancelEditingSubaccount = () => {
    setEditingMembershipId(null);
    setEditingSubaccount(null);
  };

  const handleCreateSubaccount = async () => {
    if (!clinicId || !can("subaccounts.manage")) {
      return;
    }

    if (subaccountCapacity.reached) {
      toast({
        title: "Limite de subcontas atingido",
        description: "Inative uma subconta existente ou aumente o plano clinic antes de criar outra.",
        variant: "destructive",
      });
      return;
    }

    setCreatingSubaccount(true);
    const { error } = await supabase.rpc("create_clinic_subaccount", {
      _clinic_id: clinicId,
      _email: newSubaccountEmail,
      _full_name: newSubaccountName,
      _job_title: newSubaccountJobTitle || null,
      _operational_role: newSubaccountRole,
      _password: newSubaccountPassword,
      _specialty: newSubaccountSpecialty || null,
    });

    if (error) {
      toast({ title: "Erro ao criar subconta", description: error.message, variant: "destructive" });
      setCreatingSubaccount(false);
      return;
    }

    toast({ title: "Subconta criada", description: "A nova conta já pode entrar com o e-mail e a senha informados." });
    setNewSubaccountName("");
    setNewSubaccountEmail("");
    setNewSubaccountPassword("123456");
    setNewSubaccountJobTitle("");
    setNewSubaccountSpecialty("");
    setNewSubaccountRole("professional");
    setCreatingSubaccount(false);
    void fetchData();
  };

  const handleSaveSubaccount = async (membershipRow: MembershipRow) => {
    if (!editingSubaccount || !can("subaccounts.manage")) {
      return;
    }

    setSavingMembershipId(membershipRow.id);
    const { error } = await supabase.rpc("update_clinic_subaccount_profile", {
      _address: buildProfileAddress(editingSubaccount.address),
      _bio: editingSubaccount.bio || null,
      _birth_date: editingSubaccount.birthDate || null,
      _membership_id: membershipRow.id,
      _cpf: editingSubaccount.cpf || null,
      _email: editingSubaccount.email,
      _full_name: editingSubaccount.fullName,
      _job_title: editingSubaccount.jobTitle || null,
      _membership_status: editingSubaccount.membershipStatus,
      _new_password: editingSubaccount.resetPassword || null,
      _operational_role: editingSubaccount.operationalRole,
      _phone: editingSubaccount.phone || null,
      _professional_license: editingSubaccount.professionalLicense || null,
      _social_name: editingSubaccount.socialName || null,
      _specialty: editingSubaccount.specialty || null,
      _working_hours: editingSubaccount.workingHours || null,
    });

    if (error) {
      toast({ title: "Erro ao salvar subconta", description: error.message, variant: "destructive" });
      setSavingMembershipId(null);
      return;
    }

    toast({ title: "Subconta atualizada" });
    setSavingMembershipId(null);
    cancelEditingSubaccount();
    void fetchData();
  };

  const handleDeleteTemplate = async (template: TemplateRow) => {
    const { error } = await supabase.from("anamnesis_form_templates").delete().eq("id", template.id);

    if (error) {
      toast({ title: "Erro ao excluir formulário", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Formulário excluído" });
    if (selectedTemplateId === template.id) {
      setSelectedTemplateId(null);
    }
    void fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            aria-label="Voltar para a página inicial"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Ajuste preferências da conta e acesse as ferramentas administrativas do projeto.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Opções
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {availableSections.map((item) => (
              <button
                key={item.id}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  activeSection === item.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                }`}
                onClick={() => setActiveSection(item.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-muted p-2">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {activeSection === "profile" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Editar perfil</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">ID simbólico</p>
                    <p className="mt-2 font-medium">{getProfilePublicCodeLabel(profile?.public_code ?? null)}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Último acesso</p>
                    <p className="mt-2 font-medium">{formatLastSeenAt(profile?.last_seen_at ?? null)}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Clínica</p>
                    <p className="mt-2 font-medium">{authClinic?.name || "Não identificada"}</p>
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-4">
                  <div>
                    <p className="font-medium">Dados de acesso</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ajuste o e-mail da conta e, se quiser, já defina uma nova senha.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>E-mail de acesso</Label>
                      <Input value={ownProfileForm.email} onChange={(event) => updateOwnProfileField("email", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Nova senha</Label>
                      <Input
                        type="text"
                        placeholder="Deixe em branco para manter"
                        value={ownProfileForm.resetPassword}
                        onChange={(event) => updateOwnProfileField("resetPassword", event.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-4">
                  <div>
                    <p className="font-medium">Dados pessoais</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Preenchimento rápido com máscara para CPF e telefone, mantendo o cadastro prático.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Nome completo</Label>
                      <Input value={ownProfileForm.fullName} onChange={(event) => updateOwnProfileField("fullName", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Nome social</Label>
                      <Input value={ownProfileForm.socialName} onChange={(event) => updateOwnProfileField("socialName", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Data de nascimento</Label>
                      <Input type="date" value={ownProfileForm.birthDate} onChange={(event) => updateOwnProfileField("birthDate", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>CPF</Label>
                      <Input
                        value={ownProfileForm.cpf}
                        maxLength={14}
                        onChange={(event) => updateOwnProfileField("cpf", formatCpf(event.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefone</Label>
                      <Input
                        value={ownProfileForm.phone}
                        maxLength={15}
                        onChange={(event) => updateOwnProfileField("phone", formatPhone(event.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Conselho regional</Label>
                      <Input
                        value={ownProfileForm.professionalLicense}
                        onChange={(event) => updateOwnProfileField("professionalLicense", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Especialidade</Label>
                      <Input value={ownProfileForm.specialty} onChange={(event) => updateOwnProfileField("specialty", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Cargo</Label>
                      <Input value={ownProfileForm.jobTitle} onChange={(event) => updateOwnProfileField("jobTitle", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Horário de trabalho</Label>
                      <Input value={ownProfileForm.workingHours} onChange={(event) => updateOwnProfileField("workingHours", event.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Bio / apresentação</Label>
                    <Textarea value={ownProfileForm.bio} onChange={(event) => updateOwnProfileField("bio", event.target.value)} />
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-4">
                  <div>
                    <p className="font-medium">Endereço</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Estrutura objetiva para preencher rápido sem esconder campos importantes.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-2">
                      <Label>CEP</Label>
                      <Input
                        value={ownProfileForm.address.cep}
                        maxLength={9}
                        onChange={(event) => updateOwnProfileAddressField("cep", formatCep(event.target.value))}
                      />
                    </div>
                    <div className="space-y-2 xl:col-span-2">
                      <Label>Rua</Label>
                      <Input value={ownProfileForm.address.street} onChange={(event) => updateOwnProfileAddressField("street", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Número</Label>
                      <Input value={ownProfileForm.address.number} onChange={(event) => updateOwnProfileAddressField("number", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Complemento</Label>
                      <Input value={ownProfileForm.address.complement} onChange={(event) => updateOwnProfileAddressField("complement", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Bairro</Label>
                      <Input value={ownProfileForm.address.neighborhood} onChange={(event) => updateOwnProfileAddressField("neighborhood", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Cidade</Label>
                      <Input value={ownProfileForm.address.city} onChange={(event) => updateOwnProfileAddressField("city", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Estado</Label>
                      <Input value={ownProfileForm.address.state} onChange={(event) => updateOwnProfileAddressField("state", event.target.value)} />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => void handleSaveOwnProfile()}
                    disabled={savingOwnProfile || !ownProfileForm.fullName.trim() || !ownProfileForm.email.trim()}
                  >
                    {savingOwnProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar perfil
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "clinic" && clinic && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Perfil da clínica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome da clínica</Label>
                    <Input value={clinicName} onChange={(event) => setClinicName(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Razão social</Label>
                    <Input value={clinicLegalName} onChange={(event) => setClinicLegalName(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input value={clinic.cnpj} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Plano</Label>
                    <Input value={clinic.subscription_plan} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail institucional</Label>
                    <Input value={clinicEmail} onChange={(event) => setClinicEmail(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone institucional</Label>
                    <Input value={clinicPhone} onChange={(event) => setClinicPhone(event.target.value)} />
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                  Conta compradora: {accountRole === "account_owner" ? "você" : authClinic?.account_owner_user_id || "não identificado"}
                </div>
                <Button onClick={() => void handleSaveClinicProfile()} disabled={savingClinic || !clinicName.trim()}>
                  {savingClinic ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar perfil da clínica
                </Button>
              </CardContent>
            </Card>
          )}

          {activeSection === "team" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Colaboradores e acessos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {subscriptionPlan === "solo" ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    O plano `solo` não permite subcontas. Ao migrar para `clinic`, esta seção passa a permitir equipe e hierarquia simples.
                  </div>
                ) : (
                  <>
                    <div className="rounded-lg border p-4 text-sm">
                      <p className="font-medium">Limite atual de subcontas</p>
                      <p className="mt-1 text-muted-foreground">
                        {subaccountCapacity.occupied} de {subaccountCapacity.limit} subconta(s) em uso no plano clinic atual.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-lg border p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Assentos ocupados</p>
                        <p className="mt-2 text-2xl font-semibold">{subaccountCapacity.occupied}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Disponíveis</p>
                        <p className="mt-2 text-2xl font-semibold">{subaccountCapacity.available}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Conta principal</p>
                        <p className="mt-2 text-sm font-medium">{accountRole === "account_owner" ? "Você" : "Outro usuário da clínica"}</p>
                      </div>
                    </div>

                    {can("subaccounts.manage") && (
                      <div className="rounded-lg border p-4 space-y-4">
                        <div>
                          <p className="font-medium">Criar nova subconta</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Use esta área para criar acessos adicionais do plano clinic e já definir o papel operacional inicial.
                          </p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Nome completo</Label>
                            <Input value={newSubaccountName} onChange={(event) => setNewSubaccountName(event.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>E-mail</Label>
                            <Input
                              type="email"
                              value={newSubaccountEmail}
                              onChange={(event) => setNewSubaccountEmail(event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Senha inicial</Label>
                            <Input
                              type="text"
                              value={newSubaccountPassword}
                              onChange={(event) => setNewSubaccountPassword(event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Papel operacional</Label>
                            <Select
                              value={newSubaccountRole}
                              onValueChange={(value) => setNewSubaccountRole(value as SubaccountOperationalRole)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">admin</SelectItem>
                                <SelectItem value="professional">professional</SelectItem>
                                <SelectItem value="assistant">assistant</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Cargo</Label>
                            <Input value={newSubaccountJobTitle} onChange={(event) => setNewSubaccountJobTitle(event.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Especialidade</Label>
                            <Input value={newSubaccountSpecialty} onChange={(event) => setNewSubaccountSpecialty(event.target.value)} />
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <p className="text-sm text-muted-foreground">
                            A subconta já nasce ativa e ocupando um assento do plano.
                          </p>
                          <Button
                            onClick={() => void handleCreateSubaccount()}
                            disabled={
                              creatingSubaccount ||
                              subaccountCapacity.reached ||
                              !newSubaccountName.trim() ||
                              !newSubaccountEmail.trim() ||
                              newSubaccountPassword.trim().length < 6
                            }
                          >
                            {creatingSubaccount ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                            Criar subconta
                          </Button>
                        </div>
                      </div>
                    )}

                    {subaccountMemberships.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        Nenhuma subconta criada ainda. Use o bloco acima para criar a primeira subconta do plano clinic.
                      </div>
                    ) : (
                      subaccountMemberships.map((membershipRow) => {
                        const relatedProfile = profileMap.get(membershipRow.user_id);
                        const statusMeta = getMembershipStatusMeta(membershipRow.membership_status);
                        const isExpanded = expandedSubaccountIds.includes(membershipRow.id);
                        const isEditing = editingMembershipId === membershipRow.id && editingSubaccount !== null;

                        return (
                          <div key={membershipRow.id} className="rounded-lg border p-4 space-y-4">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div className="space-y-2">
                                <p className="font-medium">{relatedProfile?.full_name || relatedProfile?.email || membershipRow.user_id}</p>
                                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                  <span className="inline-flex items-center gap-2">
                                    <span className={`h-2.5 w-2.5 rounded-full ${statusMeta.className}`} />
                                    {statusMeta.label}
                                  </span>
                                  <span>{OPERATIONAL_ROLE_LABELS[membershipRow.operational_role]}</span>
                                  <span>{relatedProfile?.specialty || "Sem especialidade"}</span>
                                  <span>Último acesso: {formatLastSeenAt(relatedProfile?.last_seen_at ?? null)}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => toggleExpandedSubaccount(membershipRow.id)}>
                                  {isExpanded ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                                  Ver mais
                                </Button>
                                {can("subaccounts.manage") && (
                                  <Button variant="outline" size="sm" onClick={() => startEditingSubaccount(membershipRow)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Editar campos
                                  </Button>
                                )}
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                <div className="rounded-lg bg-muted/30 p-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">ID simbólico</p>
                                  <p className="mt-2 text-sm">{getProfilePublicCodeLabel(relatedProfile?.public_code ?? null)}</p>
                                </div>
                                <div className="rounded-lg bg-muted/30 p-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">E-mail</p>
                                  <p className="mt-2 text-sm">{relatedProfile?.email || "Não informado"}</p>
                                </div>
                                <div className="rounded-lg bg-muted/30 p-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Nome social</p>
                                  <p className="mt-2 text-sm">{relatedProfile?.social_name || "Não informado"}</p>
                                </div>
                                <div className="rounded-lg bg-muted/30 p-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Telefone</p>
                                  <p className="mt-2 text-sm">{relatedProfile?.phone || "Não informado"}</p>
                                </div>
                                <div className="rounded-lg bg-muted/30 p-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Nascimento</p>
                                  <p className="mt-2 text-sm">{relatedProfile?.birth_date ? new Date(relatedProfile.birth_date).toLocaleDateString("pt-BR") : "Não informado"}</p>
                                </div>
                                <div className="rounded-lg bg-muted/30 p-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">CPF</p>
                                  <p className="mt-2 text-sm">{relatedProfile?.cpf || "Não informado"}</p>
                                </div>
                                <div className="rounded-lg bg-muted/30 p-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Conselho regional</p>
                                  <p className="mt-2 text-sm">{relatedProfile?.professional_license || "Não informado"}</p>
                                </div>
                                <div className="rounded-lg bg-muted/30 p-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Cargo</p>
                                  <p className="mt-2 text-sm">{relatedProfile?.job_title || "Não informado"}</p>
                                </div>
                                <div className="rounded-lg bg-muted/30 p-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Horário de trabalho</p>
                                  <p className="mt-2 text-sm whitespace-pre-wrap">{relatedProfile?.working_hours || "Não informado"}</p>
                                </div>
                                <div className="rounded-lg bg-muted/30 p-3 xl:col-span-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Endereço</p>
                                  <p className="mt-2 text-sm whitespace-pre-wrap">
                                    {[
                                      readProfileAddress(relatedProfile?.address).street,
                                      readProfileAddress(relatedProfile?.address).number,
                                      readProfileAddress(relatedProfile?.address).complement,
                                      readProfileAddress(relatedProfile?.address).neighborhood,
                                      readProfileAddress(relatedProfile?.address).city,
                                      readProfileAddress(relatedProfile?.address).state,
                                      readProfileAddress(relatedProfile?.address).cep,
                                    ]
                                      .filter(Boolean)
                                      .join(" • ") || "Não informado"}
                                  </p>
                                </div>
                                <div className="rounded-lg bg-muted/30 p-3 xl:col-span-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Bio</p>
                                  <p className="mt-2 text-sm whitespace-pre-wrap">{relatedProfile?.bio || "Não informado"}</p>
                                </div>
                              </div>
                            )}

                            {isEditing && editingSubaccount && (
                              <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label>Nome</Label>
                                    <Input
                                      value={editingSubaccount.fullName}
                                      onChange={(event) => updateEditingSubaccountField("fullName", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Nome social</Label>
                                    <Input
                                      value={editingSubaccount.socialName}
                                      onChange={(event) => updateEditingSubaccountField("socialName", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>E-mail</Label>
                                    <Input
                                      type="email"
                                      value={editingSubaccount.email}
                                      onChange={(event) => updateEditingSubaccountField("email", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Data de nascimento</Label>
                                    <Input
                                      type="date"
                                      value={editingSubaccount.birthDate}
                                      onChange={(event) => updateEditingSubaccountField("birthDate", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>CPF</Label>
                                    <Input
                                      value={editingSubaccount.cpf}
                                      maxLength={14}
                                      onChange={(event) => updateEditingSubaccountField("cpf", formatCpf(event.target.value))}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Número do conselho regional</Label>
                                    <Input
                                      value={editingSubaccount.professionalLicense}
                                      onChange={(event) => updateEditingSubaccountField("professionalLicense", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Telefone de contato</Label>
                                    <Input
                                      value={editingSubaccount.phone}
                                      maxLength={15}
                                      onChange={(event) => updateEditingSubaccountField("phone", formatPhone(event.target.value))}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Especialidade</Label>
                                    <Input
                                      value={editingSubaccount.specialty}
                                      onChange={(event) => updateEditingSubaccountField("specialty", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Cargo</Label>
                                    <Input
                                      value={editingSubaccount.jobTitle}
                                      onChange={(event) => updateEditingSubaccountField("jobTitle", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Hierarquia na plataforma</Label>
                                    <Select
                                      value={editingSubaccount.operationalRole}
                                      onValueChange={(value) => updateEditingSubaccountField("operationalRole", value as SubaccountOperationalRole)}
                                      disabled={!can("subaccounts_roles.manage")}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="admin">admin</SelectItem>
                                        <SelectItem value="professional">professional</SelectItem>
                                        <SelectItem value="assistant">assistant</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Status de atividade</Label>
                                    <Select
                                      value={editingSubaccount.membershipStatus}
                                      onValueChange={(value) => updateEditingSubaccountField("membershipStatus", value as MembershipRow["membership_status"])}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="active">Ativo</SelectItem>
                                        <SelectItem value="inactive">Inativo</SelectItem>
                                        <SelectItem value="suspended">Suspenso</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Resetar senha</Label>
                                    <Input
                                      type="text"
                                      value={editingSubaccount.resetPassword}
                                      placeholder="Deixe em branco para manter"
                                      onChange={(event) => updateEditingSubaccountField("resetPassword", event.target.value)}
                                    />
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label>Horário de trabalho</Label>
                                  <Textarea
                                    value={editingSubaccount.workingHours}
                                    onChange={(event) => updateEditingSubaccountField("workingHours", event.target.value)}
                                    placeholder="Ex.: seg-sex 08h-18h; sábado 08h-12h"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Bio / apresentação</Label>
                                  <Textarea
                                    value={editingSubaccount.bio}
                                    onChange={(event) => updateEditingSubaccountField("bio", event.target.value)}
                                  />
                                </div>
                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                  <div className="space-y-2">
                                    <Label>CEP</Label>
                                    <Input
                                      value={editingSubaccount.address.cep}
                                      maxLength={9}
                                      onChange={(event) => updateEditingSubaccountAddressField("cep", formatCep(event.target.value))}
                                    />
                                  </div>
                                  <div className="space-y-2 xl:col-span-2">
                                    <Label>Rua</Label>
                                    <Input
                                      value={editingSubaccount.address.street}
                                      onChange={(event) => updateEditingSubaccountAddressField("street", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Número</Label>
                                    <Input
                                      value={editingSubaccount.address.number}
                                      onChange={(event) => updateEditingSubaccountAddressField("number", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Complemento</Label>
                                    <Input
                                      value={editingSubaccount.address.complement}
                                      onChange={(event) => updateEditingSubaccountAddressField("complement", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Bairro</Label>
                                    <Input
                                      value={editingSubaccount.address.neighborhood}
                                      onChange={(event) => updateEditingSubaccountAddressField("neighborhood", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Cidade</Label>
                                    <Input
                                      value={editingSubaccount.address.city}
                                      onChange={(event) => updateEditingSubaccountAddressField("city", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Estado</Label>
                                    <Input
                                      value={editingSubaccount.address.state}
                                      onChange={(event) => updateEditingSubaccountAddressField("state", event.target.value)}
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center justify-end gap-2">
                                  <Button variant="ghost" onClick={cancelEditingSubaccount}>
                                    Cancelar
                                  </Button>
                                  <Button
                                    onClick={() => void handleSaveSubaccount(membershipRow)}
                                    disabled={
                                      savingMembershipId === membershipRow.id ||
                                      !editingSubaccount.fullName.trim() ||
                                      !editingSubaccount.email.trim()
                                    }
                                  >
                                    {savingMembershipId === membershipRow.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                      <Save className="h-4 w-4 mr-2" />
                                    )}
                                    Salvar alterações
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {activeSection === "billing" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Assinatura e pagamentos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Plano atual</p>
                  <p className="mt-2 text-lg font-semibold">{subscriptionPlan || "Não identificado"}</p>
                </div>
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Esta área já está reservada para faturamento da assinatura. A capacidade está ligada ao `account_owner`.
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "treasury" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Tesouraria</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  A área de tesouraria já está protegida pela nova capacidade `treasury.manage`. O detalhamento financeiro pode entrar na próxima etapa.
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "analytics" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Desempenho da equipe</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Esta seção fica reservada para atividade e desempenho das subcontas. A capacidade já está separada em `subaccounts_analytics.read`.
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "security" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Segurança</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-4">
                  <p className="font-medium">Boas práticas atuais</p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc pl-5">
                    <li>Use um e-mail individual por colaborador.</li>
                    <li>Evite compartilhar a mesma conta entre profissionais.</li>
                    <li>Saia da conta ao usar computadores compartilhados.</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  A troca de senha, sessões ativas e regras adicionais de segurança podem entrar aqui na próxima etapa.
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "signout" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Sair da conta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Encerre a sessão atual neste dispositivo. Você precisará fazer login novamente para acessar a clínica.
                </p>
                <Button variant="destructive" onClick={() => void signOut()}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair agora
                </Button>
              </CardContent>
            </Card>
          )}

          {activeSection === "forms" && (
            <>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Gerenciar formulários</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Edite o bloco-base universal da anamnese e mantenha as fichas extras usadas nos atendimentos.
                  </p>
                </div>
                <Button onClick={() => navigate("/configuracoes/formularios/novo")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova ficha
                </Button>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle className="text-base">Bloco padrão universal</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Esta é a primeira parte obrigatória da anamnese, aplicada em todas as fichas da clínica.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate("/configuracoes/formularios/base")}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar bloco padrão
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Campos</p>
                    <p className="mt-2 text-2xl font-semibold">{countTemplateQuestionFields(baseSchema)}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Seções</p>
                    <p className="mt-2 text-2xl font-semibold">{countTemplateSections(baseSchema)}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Uso</p>
                    <p className="mt-2 text-sm font-medium">Sempre incluído antes da ficha extra</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Fichas extras
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {templates.length === 0 && (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      Nenhuma ficha criada ainda.
                    </div>
                  )}
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        selectedTemplate?.id === template.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                      }`}
                      onClick={() => setSelectedTemplateId(template.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">{template.name}</span>
                        <Badge variant="outline">{sessions.filter((session) => session.anamnesis_template_id === template.id).length} usos</Badge>
                      </div>
                      {template.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                      )}
                    </button>
                  ))}
                </CardContent>
              </Card>

              {selectedTemplate ? (
                <>
                  <Card>
                    <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                      <div>
                        <CardTitle className="text-xl">{selectedTemplate.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedTemplate.description || "Sem descrição cadastrada."}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/configuracoes/formularios/${selectedTemplate.id}`)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => void handleDeleteTemplate(selectedTemplate)}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-4">
                      <div className="rounded-lg border p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Usos</p>
                        <p className="mt-2 text-2xl font-semibold">{selectedStats.totalUses}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Campos</p>
                        <p className="mt-2 text-2xl font-semibold">{selectedStats.fieldCount}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Seções</p>
                        <p className="mt-2 text-2xl font-semibold">{selectedStats.sectionCount}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Último uso</p>
                        <p className="mt-2 text-sm font-medium">
                          {selectedStats.lastUsedAt ? new Date(selectedStats.lastUsedAt).toLocaleDateString("pt-BR") : "Ainda não usada"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Estrutura da ficha
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedSchema.map((field) => (
                        <div key={field.id} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-sm">{field.label}</p>
                              <p className="text-xs text-muted-foreground">
                                {ANAMNESIS_FIELD_LIBRARY.find((item) => item.type === field.type)?.label || field.type}
                              </p>
                            </div>
                            {field.sectionKey && <Badge variant="secondary">{field.sectionKey}</Badge>}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="p-8 text-center text-muted-foreground">
                  Nenhuma ficha disponível ainda. Use o botão acima para criar a primeira ficha.
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default Configuracoes;
