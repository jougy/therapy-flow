import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  Download,
  FileText,
  FlaskConical,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Stethoscope,
  Upload,
  UserCog,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlatformClinicStatistics } from "@/components/PlatformClinicStatistics";
import { PlatformFeatureFlags } from "@/components/PlatformFeatureFlags";
import { PlatformInfoGrid } from "@/components/platform/PlatformInfoGrid";
import { PlatformAuditList } from "@/components/platform/PlatformAuditList";
import { PlatformAccountOperations } from "@/components/platform/PlatformAccountOperations";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  ANAMNESIS_TEMPLATE_IMPORT_MAX_BYTES,
  type AnamnesisTemplateExchangeKind,
  type AnamnesisTemplateSchema,
  buildAnamnesisTemplateExchangeFileName,
  buildAnamnesisTemplateExchangePayload,
  parseAnamnesisTemplateExchangePayload,
} from "@/lib/anamnesis-forms";
import type {
  FeatureFlag,
  PlatformAuditEvent,
  PlatformClinicDetail,
  PlatformClinicFormsSummary,
  SupportRole,
} from "@/components/platform/types";
import {
  callRpc,
  formatClinicAccessStatus,
  getErrorMessage,
} from "@/components/platform/platform-api";

export const PlatformClinicDetailPage = ({
  clinicKey,
  shouldMaskUrl = false,
}: {
  clinicKey: string;
  shouldMaskUrl?: boolean;
}) => {
  const navigate = useNavigate();
  const { user, startPlatformClinicAccess, startPlatformClinicSimulation } = useAuth();
  const templateImportInputRef = useRef<HTMLInputElement>(null);
  const [detail, setDetail] = useState<PlatformClinicDetail | null>(null);
  const [auditEvents, setAuditEvents] = useState<PlatformAuditEvent[]>([]);
  const [, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [clinicTags, setClinicTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [clinicSubscription, setClinicSubscription] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [supportReason, setSupportReason] = useState("");
  const [supportRole, setSupportRole] = useState<SupportRole>("owner");
  const [startingSupport, setStartingSupport] = useState(false);

  const clinic = detail?.clinic ?? null;
  const clinicName = String(clinic?.name ?? "Clínica");
  const routeKey = String(clinic?.route_key ?? "");
  const resolvedClinicId = String(clinic?.id ?? "");
  const patients = detail?.patients ?? [];

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const detailRes = await callRpc("get_platform_clinic_detail_by_route_key", { _route_key: clinicKey });
      if (detailRes.error) throw detailRes.error;

      const loadedDetail = (detailRes.data ?? null) as PlatformClinicDetail | null;
      const loadedClinicId = String(loadedDetail?.clinic?.id ?? "");
      if (!loadedClinicId) throw new Error("Clínica não encontrada para esta rota mascarada.");

      const [auditRes, flagsRes, formsRes, tagsRes, subRes] = await Promise.all([
        callRpc("list_platform_audit_events", { _clinic_id: loadedClinicId, _limit: 80 }),
        callRpc("list_feature_flags", { _clinic_id: loadedClinicId }),
        callRpc("get_platform_clinic_forms_summary_by_route_key", { _route_key: clinicKey }),
        supabase.from("clinic_tag_relations").select("clinic_tags(id, name, color)").eq("clinic_id", loadedClinicId),
        supabase.from("clinic_subscriptions").select("*").eq("clinic_id", loadedClinicId).maybeSingle(),
      ]);

      if (auditRes.error) throw auditRes.error;
      if (flagsRes.error) throw flagsRes.error;
      if (formsRes.error) throw formsRes.error;

      setDetail(loadedDetail);
      setClinicSubscription(subRes.data ?? null);
      setAuditEvents((auditRes.data ?? []) as PlatformAuditEvent[]);
      setFeatureFlags((flagsRes.data ?? []) as FeatureFlag[]);
      setFormsSummary((formsRes.data ?? null) as PlatformClinicFormsSummary | null);

      if (tagsRes.data) {
        setClinicTags(tagsRes.data.map((r: { clinic_tags: unknown }) => r.clinic_tags).filter(Boolean) as { id: string; name: string; color: string }[]);
      }
    } catch (error) {
      toast({
        title: "Detalhe da clínica indisponível",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [clinicKey]);

  const handleExportTemplateModel = useCallback(
    ({
      description,
      kind,
      name,
      schema,
    }: {
      description?: string | null;
      kind: AnamnesisTemplateExchangeKind;
      name: string;
      schema: AnamnesisTemplateSchema;
    }) => {
      if (!schema || schema.length === 0) {
        toast({
          title: "Não foi possível exportar",
          description: "Este formulário não possui campos cadastrados.",
          variant: "destructive",
        });
        return;
      }

      const payload = buildAnamnesisTemplateExchangePayload({
        description,
        kind,
        name,
        schema,
      });

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = buildAnamnesisTemplateExchangeFileName(kind, name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);

      toast({
        title: kind === "base" ? "Bloco padrão exportado" : "Modelo exportado",
        description: "O arquivo JSON foi baixado com a estrutura completa do formulário.",
      });
    },
    []
  );

  const handleImportTemplateFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file || !resolvedClinicId || !user?.id) {
        return;
      }

      if (supportReason.trim().length < 8) {
        toast({
          title: "Motivo do suporte necessário",
          description: "Informe o motivo do suporte com pelo menos 8 caracteres para importar formulários.",
          variant: "destructive",
        });
        return;
      }

      setStartingSupport(true);
      try {
        if (file.size > ANAMNESIS_TEMPLATE_IMPORT_MAX_BYTES) {
          throw new Error("Arquivo de modelo muito grande");
        }

        const raw = await file.text();
        const imported = parseAnamnesisTemplateExchangePayload(raw);

        if (startPlatformClinicAccess) {
          await startPlatformClinicAccess(resolvedClinicId, supportReason.trim(), supportRole);
        }

        if (imported.kind === "base") {
          const { error } = await supabase
            .from("clinics")
            .update({ anamnesis_base_schema: imported.template.schema })
            .eq("id", resolvedClinicId);

          if (error) throw error;

          await loadDetail();
          toast({
            title: "Bloco padrão importado",
            description: `A estrutura "${imported.template.name}" foi aplicada ao bloco padrão universal.`,
          });
        } else {
          const { error } = await supabase
            .from("anamnesis_form_templates")
            .insert({
              clinic_id: resolvedClinicId,
              description: imported.template.description.trim() || null,
              is_active: true,
              is_system_default: false,
              name: imported.template.name.trim(),
              schema: imported.template.schema,
              user_id: user.id,
            });

          if (error) throw error;

          await loadDetail();
          toast({
            title: "Modelo importado",
            description: `A ficha "${imported.template.name}" foi criada com a mesma estrutura do arquivo.`,
          });
        }
      } catch (error) {
        toast({
          title: "Erro ao importar modelo",
          description: error instanceof Error ? error.message : "Não foi possível importar este arquivo.",
          variant: "destructive",
        });
      } finally {
        setStartingSupport(false);
      }
    },
    [resolvedClinicId, user?.id, supportReason, startPlatformClinicAccess, supportRole, loadDetail]
  );

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleStartSupport = async () => {
    if (!startPlatformClinicAccess) return;
    if (!resolvedClinicId) return;

    setStartingSupport(true);
    try {
      const access = await startPlatformClinicAccess(resolvedClinicId, supportReason.trim(), supportRole);
      navigate(`/clinica/${access.clinic.route_key}`);
    } catch (error) {
      toast({
        title: "Não foi possível acessar a clínica",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setStartingSupport(false);
    }
  };

  const handleStartSimulationForClinic = async () => {
    if (!startPlatformClinicSimulation || !resolvedClinicId) return;
    setStartingSupport(true);
    try {
      const access = await startPlatformClinicSimulation(resolvedClinicId);
      navigate(`/clinica/${access.clinic.route_key}`);
    } catch (error) {
      toast({
        title: "Não foi possível iniciar a simulação",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setStartingSupport(false);
    }
  };

  const handleOpenClinicTool = async (path: string) => {
    if (!startPlatformClinicAccess || !resolvedClinicId || !routeKey) return;

    setStartingSupport(true);
    try {
      await startPlatformClinicAccess(resolvedClinicId, supportReason.trim(), supportRole);
      navigate(`/clinica/${routeKey}${path}`);
    } catch (error) {
      toast({
        title: "Não foi possível abrir a ferramenta",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setStartingSupport(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" className="w-fit" onClick={() => navigate("/platform/diretorio")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar ao diretório
      </Button>

      {loading ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex h-auto w-full justify-start overflow-x-auto p-1 lg:grid lg:grid-cols-8">
            <TabsTrigger className="shrink-0" value="overview">Visão geral</TabsTrigger>
            <TabsTrigger className="shrink-0" value="accounts">Contas</TabsTrigger>
            <TabsTrigger className="shrink-0" value="patients">Pacientes</TabsTrigger>
            <TabsTrigger className="shrink-0" value="forms">Formulários</TabsTrigger>
            <TabsTrigger className="shrink-0" value="dashboard">Estatísticas</TabsTrigger>
            <TabsTrigger className="shrink-0" value="flags">Flags</TabsTrigger>
            <TabsTrigger className="shrink-0" value="support">Suporte</TabsTrigger>
            <TabsTrigger className="shrink-0" value="audit">Auditoria master</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <Card>
                <CardHeader><CardTitle>Resumo cadastral</CardTitle></CardHeader>
                <CardContent>
                  <PlatformInfoGrid
                    items={[
                      ["Nome", String(clinic?.name ?? "-")],
                      ["CNPJ", String(clinic?.cnpj ?? "-")],
                      ["Plano", String(clinic?.subscription_plan ?? "-")],
                      ["Status", formatClinicAccessStatus(String(clinic?.access_status ?? "active"))],
                      ["Data de cadastro", clinic?.created_at ? new Date(clinic.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"],
                      ["Rota", routeKey || "-"],
                      ["E-mail", String(clinic?.email ?? "-")],
                      ["Telefone", String(clinic?.phone ?? "-")],
                    ]}
                  />
                </CardContent>
              </Card>
              <div className="flex flex-col gap-4">
                <Card>
                  <CardHeader><CardTitle>Assinatura e ciclo de membro</CardTitle></CardHeader>
                  <CardContent>
                    {clinicSubscription ? (
                      <PlatformInfoGrid
                        items={[
                          ["Ciclo contratado", clinicSubscription.billing_cycle === "ANNUAL" ? "Anual (365 dias)" : clinicSubscription.billing_cycle === "QUARTERLY" ? "Trimestral (90 dias)" : "Mensal (30 dias)"],
                          ["Status faturamento", clinicSubscription.status || "Ativo (Beta)"],
                          ["Renovação automática", clinicSubscription.auto_renew !== false ? "Ativada" : "Desligada"],
                          [
                            "Vencimento / Expiração",
                            clinicSubscription.expires_at
                              ? new Date(clinicSubscription.expires_at).toLocaleDateString("pt-BR")
                              : clinicSubscription.current_period_end
                              ? new Date(clinicSubscription.current_period_end).toLocaleDateString("pt-BR")
                              : "Período Beta Contínuo",
                          ],
                          [
                            "Dias restantes",
                            clinicSubscription.expires_at || clinicSubscription.current_period_end
                              ? `${Math.max(
                                  0,
                                  Math.ceil(
                                    (new Date(clinicSubscription.expires_at || clinicSubscription.current_period_end).getTime() - Date.now()) /
                                      (1000 * 60 * 60 * 24)
                                  )
                                )} dia(s)`
                              : "Ilimitado (Beta)",
                          ],
                          [
                            "Permissão da clínica",
                            (clinicSubscription.expires_at && new Date(clinicSubscription.expires_at) < new Date()) && !["BETA", "TRIAL"].includes(clinicSubscription.status)
                              ? "⚠️ Somente Leitura (Expirada)"
                              : "✅ Leitura e Escrita (Total)",
                          ],
                        ]}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">Isenção Beta / Sem assinatura Asaas vinculada.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Limites e operação</CardTitle></CardHeader>
                  <CardContent>
                    <PlatformInfoGrid
                      items={[
                        ["Equipe", String(detail?.counts?.collaborators ?? 0)],
                        ["Pacientes", String(detail?.counts?.patients ?? 0)],
                        ["Atendimentos", String(detail?.counts?.sessions ?? 0)],
                        ["Subcontas", String(clinic?.subaccount_limit ?? 0)],
                      ]}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Tags ativas</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {clinicTags.length > 0 ? clinicTags.map(tag => (
                        <Badge key={tag.id} style={{ backgroundColor: tag.color, color: "#fff" }} className="hover:opacity-90 border-transparent shadow-sm">
                          {tag.name}
                        </Badge>
                      )) : <span className="text-sm text-muted-foreground">Nenhuma tag atribuída.</span>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            <div className="mt-4">
              <PlatformAccountOperations
                allowedOperations={["update_clinic_access"]}
                clinicId={resolvedClinicId}
                clinicAccessStatus={String(clinic?.access_status ?? "active")}
                concurrentAccessLimit={String(clinic?.concurrent_access_limit ?? clinic?.subaccount_limit ?? 4)}
                compact
                onDone={() => void loadDetail()}
                subaccountLimit={String(clinic?.subaccount_limit ?? 4)}
                title="Acesso da clínica"
              />
            </div>
          </TabsContent>

          <TabsContent value="accounts">
            <Card>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Gerenciamento de contas</CardTitle>
                <Badge variant="secondary">
                  <UserCog className="mr-2 h-4 w-4" />
                  {detail?.memberships?.length ?? 0} conta(s)
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                <PlatformAccountOperations
                  allowedOperations={["create_subaccount", "update_owner_access", "update_subaccount_access", "delete_subaccount"]}
                  clinicId={resolvedClinicId}
                  clinicAccessStatus={String(clinic?.access_status ?? "active")}
                  concurrentAccessLimit={String(clinic?.concurrent_access_limit ?? clinic?.subaccount_limit ?? 4)}
                  compact
                  onDone={() => void loadDetail()}
                  subaccountLimit={String(clinic?.subaccount_limit ?? 4)}
                  title="Ações do gerenciamento de contas"
                />
                {(detail?.memberships ?? []).map((member) => (
                  <button
                    key={String(member.id)}
                    type="button"
                    className="grid w-full gap-2 rounded-lg border p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                    onClick={() => navigate(`/platform/usuarios/${String(member.user_id)}`)}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{String(member.full_name ?? member.email ?? "Usuário")}</p>
                      <p className="text-sm text-muted-foreground">{String(member.email ?? "Sem e-mail")}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{String(member.account_role ?? "user")}</Badge>
                      <Badge variant="outline">{String(member.operational_role ?? "-")}</Badge>
                      <Badge>{String(member.membership_status ?? "-")}</Badge>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patients">
            <Card>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Pacientes da clínica</CardTitle>
                <Badge variant="secondary">
                  <Stethoscope className="mr-2 h-4 w-4" />
                  {patients.length} paciente(s)
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <PlatformAccountOperations
                  allowedOperations={["create_patient"]}
                  clinicId={resolvedClinicId}
                  compact
                  onDone={() => void loadDetail()}
                  title="Criar paciente"
                />
                {patients.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <Stethoscope className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                    <p className="font-medium text-foreground">Nenhum paciente cadastrado</p>
                    <p className="mt-1 text-sm text-muted-foreground">Crie um paciente pela ação acima ou acesse um paciente pelo diretório master.</p>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {patients.map((patient) => (
                      <button
                        key={String(patient.id)}
                        type="button"
                        className="grid w-full gap-2 rounded-lg border p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                        onClick={() => navigate(`/platform/pacientes/${String(patient.id)}`)}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{String(patient.name ?? "Paciente")}</p>
                          <p className="truncate text-sm text-muted-foreground">{String(patient.email ?? patient.phone ?? "Sem contato")}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={patient.registration_complete ? "secondary" : "outline"}>
                            {patient.registration_complete ? "completo" : "pendente"}
                          </Badge>
                          <Badge>{String(patient.status ?? "-")}</Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="forms">
            <input
              type="file"
              ref={templateImportInputRef}
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportTemplateFile}
            />
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Gerenciamento de formulários</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Revise modelos, abra edições e ajude a clínica a montar fichas de anamnese.
                  </p>
                </div>
                <div className="grid gap-2 sm:flex sm:items-center">
                  <Button
                    disabled={startingSupport || !routeKey || !resolvedClinicId || supportReason.trim().length < 8}
                    variant="outline"
                    onClick={() => void handleOpenClinicTool("/configuracoes?secao=forms")}
                  >
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Gerenciar na clínica
                  </Button>
                  <Button
                    disabled={startingSupport || !routeKey || !resolvedClinicId || supportReason.trim().length < 8}
                    variant="outline"
                    onClick={() => templateImportInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Importar modelo
                  </Button>
                  <Button
                    disabled={startingSupport || !routeKey || !resolvedClinicId || supportReason.trim().length < 8}
                    onClick={() => void handleOpenClinicTool("/configuracoes/formularios/novo")}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Nova ficha
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <Label htmlFor="forms-support-reason" className="text-amber-950">Motivo do suporte</Label>
                  <Textarea
                    id="forms-support-reason"
                    className="mt-2 bg-background text-foreground"
                    value={supportReason}
                    onChange={(event) => setSupportReason(event.target.value)}
                    maxLength={1000}
                    placeholder="Ex: owner solicitou ajuda para montar ficha de avaliação ortopédica"
                  />
                  <p className="mt-2 text-xs">
                    Para editar formulários como suporte, o acesso entra no modo plataforma e fica registrado na auditoria master.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Bloco padrão</p>
                    <p className="mt-2 text-2xl font-semibold">{formsSummary?.base?.field_count ?? 0}</p>
                    <p className="text-sm text-muted-foreground">campos cadastrados</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Seções do bloco</p>
                    <p className="mt-2 text-2xl font-semibold">{formsSummary?.base?.section_count ?? 0}</p>
                    <p className="text-sm text-muted-foreground">agrupamentos</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Fichas extras</p>
                    <p className="mt-2 text-2xl font-semibold">{formsSummary?.templates?.length ?? 0}</p>
                    <p className="text-sm text-muted-foreground">modelos disponíveis</p>
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div>
                      <p className="font-medium text-foreground">Bloco padrão universal</p>
                      <p className="text-sm text-muted-foreground">
                        Estrutura obrigatória aplicada antes das fichas extras em todos os atendimentos.
                      </p>
                    </div>
                    <div className="grid gap-2 sm:flex sm:items-center">
                      <Button
                        variant="outline"
                        disabled={!formsSummary?.base?.schema || formsSummary.base.schema.length === 0}
                        onClick={() =>
                          handleExportTemplateModel({
                            description: "Estrutura obrigatória aplicada antes das fichas extras em todos os atendimentos.",
                            kind: "base",
                            name: "Bloco padrão universal",
                            schema: formsSummary?.base?.schema ?? [],
                          })
                        }
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Exportar modelo
                      </Button>
                      <Button
                        disabled={startingSupport || !routeKey || !resolvedClinicId || supportReason.trim().length < 8}
                        variant="outline"
                        onClick={() => void handleOpenClinicTool("/configuracoes/formularios/base")}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar bloco
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium text-foreground">Fichas extras</p>
                  </div>
                  {(formsSummary?.templates ?? []).length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      Nenhuma ficha extra criada nesta clínica.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(formsSummary?.templates ?? []).map((template) => (
                        <div
                          key={template.id}
                          className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-medium text-foreground">{template.name}</p>
                              <Badge variant="outline">{template.usage_count ?? 0} uso(s)</Badge>
                            </div>
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                              {template.description || "Sem descrição cadastrada."}
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {template.field_count ?? 0} campo(s) • {template.section_count ?? 0} seção(ões)
                            </p>
                          </div>
                          <div className="grid gap-2 sm:flex sm:items-center">
                            <Button
                              variant="outline"
                              disabled={!template.schema || template.schema.length === 0}
                              onClick={() =>
                                handleExportTemplateModel({
                                  description: template.description,
                                  kind: "template",
                                  name: template.name,
                                  schema: template.schema ?? [],
                                })
                              }
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Exportar
                            </Button>
                            <Button
                              disabled={startingSupport || !routeKey || !resolvedClinicId || supportReason.trim().length < 8}
                              variant="outline"
                              onClick={() => void handleOpenClinicTool(`/configuracoes/formularios/${template.id}`)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dashboard">
            <PlatformClinicStatistics clinicId={resolvedClinicId} counts={detail?.counts} />
          </TabsContent>

          <TabsContent value="flags">
            <Card>
              <CardContent className="pt-6">
                <PlatformFeatureFlags clinicId={resolvedClinicId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="support">
            <Card>
              <CardHeader><CardTitle>Navegar em modo suporte</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  Este acesso não entra nos logs visíveis da clínica. Ele fica registrado apenas na auditoria master com ator, clínica, motivo e sessão.
                </div>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="space-y-2">
                    <Label htmlFor="support-reason">Motivo do acesso</Label>
                    <Textarea
                      id="support-reason"
                      value={supportReason}
                      onChange={(event) => setSupportReason(event.target.value)}
                      maxLength={1000}
                      placeholder="Ex: suporte solicitado pelo owner para revisar agenda"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Visão simulada</Label>
                    <Select value={supportRole} onValueChange={(value) => setSupportRole(value as SupportRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="professional">Profissional</SelectItem>
                        <SelectItem value="assistant">Assistente</SelectItem>
                        <SelectItem value="estagiario">Estagiário</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Simulação visual planejada. A identidade real continua sendo a conta master.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <Button disabled={startingSupport || !resolvedClinicId || supportReason.trim().length < 8} onClick={() => void handleStartSupport()}>
                    {startingSupport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                    Entrar na clínica com super menu
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200"
                    disabled={startingSupport || !resolvedClinicId}
                    onClick={() => void handleStartSimulationForClinic()}
                  >
                    <FlaskConical className="mr-2 h-4 w-4 text-amber-600" />
                    Simular Clínica (Preview)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardHeader><CardTitle>Auditoria master da clínica</CardTitle></CardHeader>
              <CardContent><PlatformAuditList events={auditEvents} /></CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};
