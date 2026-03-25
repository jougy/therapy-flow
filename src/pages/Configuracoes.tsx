import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BarChart3,
  ClipboardList,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Settings,
  Shield,
  Trash2,
  UserRound,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

type TemplateRow = Database["public"]["Tables"]["anamnesis_form_templates"]["Row"];
type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type ClinicRow = Database["public"]["Tables"]["clinics"]["Row"];

type SettingsSection = "profile" | "security" | "forms" | "signout";

const Configuracoes = () => {
  const navigate = useNavigate();
  const { clinicId, profile, signOut, user } = useAuth();
  const [clinic, setClinic] = useState<ClinicRow | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [sessions, setSessions] = useState<Pick<SessionRow, "anamnesis_template_id" | "session_date">[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection>("forms");

  const fetchData = useCallback(async () => {
    if (!clinicId) return;

    setLoading(true);
    const [clinicRes, templatesRes, sessionsRes] = await Promise.all([
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
    ]);

    if (templatesRes.error) {
      toast({ title: "Erro ao carregar formulários", description: templatesRes.error.message, variant: "destructive" });
    }

    setClinic(clinicRes.data ?? null);
    setTemplates(templatesRes.data ?? []);
    setSessions(sessionsRes.data ?? []);
    setSelectedTemplateId((current) => current ?? templatesRes.data?.[0]?.id ?? null);
    setLoading(false);
  }, [clinicId]);

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
            {[
              {
                description: "Veja os dados básicos da sua conta dentro da clínica.",
                icon: UserRound,
                id: "profile" as const,
                title: "Editar perfil",
              },
              {
                description: "Ajustes de acesso e orientações de proteção da conta.",
                icon: Shield,
                id: "security" as const,
                title: "Segurança",
              },
              {
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
            ].map((item) => (
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
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Nome</p>
                    <p className="mt-2 font-medium">{profile?.full_name || "Não informado"}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">E-mail</p>
                    <p className="mt-2 font-medium">{profile?.email || user?.email || "Não informado"}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Esta seção vai receber em seguida a edição completa do perfil do colaborador. Por enquanto ela serve
                  como ponto de entrada e organização da conta.
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
