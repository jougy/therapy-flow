import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  ClipboardList,
  FileText,
  Gauge,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
  UserCog,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

type DirectoryKind = "all" | "clinic" | "account" | "patient";
type DetailKind = "clinic" | "account" | "patient";
type SupportRole = "owner" | "admin" | "professional" | "assistant" | "estagiario";

type PlatformDirectoryItem = {
  clinic_id: string | null;
  clinic_name: string | null;
  item_id: string;
  item_type: DetailKind;
  metadata: Record<string, unknown> | null;
  primary_document: string | null;
  secondary_document: string | null;
  status: string | null;
  subtitle: string | null;
  title: string;
  updated_at: string | null;
};

type PlatformAuditEvent = {
  actor_email?: string | null;
  actor_name?: string | null;
  clinic_id?: string | null;
  clinic_name?: string | null;
  created_at: string;
  event_type: string;
  id: string;
  metadata?: Record<string, unknown> | null;
  reason?: string | null;
};

type PlatformClinicDetail = {
  clinic?: Record<string, unknown>;
  counts?: Record<string, number>;
  memberships?: Array<Record<string, unknown>>;
  owner?: Record<string, unknown> | null;
};

type PlatformClinicFormsSummary = {
  base?: {
    field_count?: number;
    section_count?: number;
    updated_at?: string | null;
  };
  templates?: Array<{
    description?: string | null;
    field_count?: number;
    id: string;
    name: string;
    section_count?: number;
    updated_at?: string | null;
    usage_count?: number;
  }>;
};

type FeatureFlag = {
  clinic_id: string | null;
  clinic_name: string | null;
  description: string | null;
  expires_at: string | null;
  id: string;
  is_active_now: boolean;
  key: string;
  reason: string | null;
  scope: "global" | "clinic";
  starts_at: string | null;
  updated_at: string;
  value: unknown;
};

type PersonDetail = {
  clinic?: Record<string, unknown>;
  counts?: Record<string, number>;
  memberships?: Array<Record<string, unknown>>;
  patient?: Record<string, unknown>;
  profile?: Record<string, unknown>;
  recent_sessions?: Array<Record<string, unknown>>;
  type?: "account" | "patient";
};

const callRpc = (fn: string, args?: Record<string, unknown>) =>
  supabase.rpc(fn as never, args as never) as Promise<{ data: unknown; error: { message?: string } | null }>;

const callPlatformAccountAdmin = async (action: string, payload: Record<string, unknown>, reason: string) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sessão master indisponível.");

  const { data, error } = await supabase.functions.invoke("platform-account-admin", {
    body: { action, payload, reason },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) throw error;
  const result = (data ?? {}) as { data?: unknown; error?: string };
  if (result.error) throw new Error(result.error);
  return result.data;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
};

const compactDocument = (value: string | null | undefined) => value || "Sem documento";

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return "Operação indisponível.";
};

const itemLabels: Record<DetailKind, string> = {
  account: "Conta",
  clinic: "Clínica",
  patient: "Paciente",
};

const eventLabel: Record<string, string> = {
  feature_flag_upserted: "Feature flag alterada",
  platform_clinic_access_ended: "Saiu da clínica",
  platform_clinic_access_started: "Acessou clínica",
  platform_clinic_created: "Criou clínica",
  platform_dashboard_opened: "Abriu painel global",
  platform_directory_detail_read: "Leu detalhe mestre",
};

const metadataNumber = (metadata: Record<string, unknown> | null | undefined, key: string) => {
  const value = metadata?.[key];
  return typeof value === "number" ? value : 0;
};

const metadataString = (metadata: Record<string, unknown> | null | undefined, key: string) => {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
};

const PLATFORM_SELECTED_CLINIC_KEY = "pluri-health.platform.selectedClinicKey";
const PLATFORM_CLINIC_DETAIL_ROUTE = "/platform/clinicas/detalhes";

const storePlatformClinicKey = (clinicKey: string) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PLATFORM_SELECTED_CLINIC_KEY, clinicKey);
};

const readStoredPlatformClinicKey = () => {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(PLATFORM_SELECTED_CLINIC_KEY) ?? "";
};

const clinicMaskedRouteKey = (item: Pick<PlatformDirectoryItem, "item_id" | "item_type" | "metadata">) =>
  metadataString(item.metadata, "route_key");

const toRoute = (item: Pick<PlatformDirectoryItem, "item_id" | "item_type" | "metadata">) => {
  if (item.item_type === "clinic") {
    const routeKey = clinicMaskedRouteKey(item);
    return routeKey ? PLATFORM_CLINIC_DETAIL_ROUTE : "/platform";
  }
  if (item.item_type === "account") return `/platform/usuarios/${item.item_id}`;
  return `/platform/pacientes/${item.item_id}`;
};

const PlatformAdmin = () => {
  const params = useParams();
  const location = useLocation();
  const detailKind = useMemo<DetailKind | null>(() => {
    if (params["*"]?.startsWith("clinicas/")) return "clinic";
    if (params["*"]?.startsWith("usuarios/")) return "account";
    if (params["*"]?.startsWith("pacientes/")) return "patient";
    return null;
  }, [params]);
  const detailId = params["*"]?.split("/")[1] ?? null;

  if (detailKind && detailId) {
    if (detailKind === "clinic") {
      const locationState = location.state as { clinicKey?: string } | null;
      const clinicKey = detailId === "detalhes"
        ? locationState?.clinicKey || readStoredPlatformClinicKey()
        : detailId;

      if (!clinicKey) return <PlatformDirectoryPage />;

      return <PlatformClinicDetailPage clinicKey={clinicKey} shouldMaskUrl={detailId !== "detalhes"} />;
    }
    return <PlatformPersonDetailPage itemType={detailKind} itemId={detailId} />;
  }

  return <PlatformDirectoryPage />;
};

const PlatformShell = ({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Pluri-Health</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">platform_owner</Badge>
            <Button variant="outline" onClick={() => navigate("/platform")}>Painel mestre</Button>
            <Button variant="outline" onClick={() => navigate("/clinicas")}>Espaço pessoal</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">{children}</main>
    </div>
  );
};

const PlatformDirectoryPage = () => {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<DirectoryKind>("all");
  const [directory, setDirectory] = useState<PlatformDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createClinicOpen, setCreateClinicOpen] = useState(false);
  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const navigate = useNavigate();

  const openDirectoryItem = useCallback((item: PlatformDirectoryItem) => {
    if (item.item_type === "clinic") {
      const clinicKey = clinicMaskedRouteKey(item);
      if (!clinicKey) {
        toast({
          title: "Rota mascarada indisponível",
          description: "Esta clínica ainda não possui uma rota segura para abrir no painel master.",
          variant: "destructive",
        });
        return;
      }

      storePlatformClinicKey(clinicKey);
      navigate(PLATFORM_CLINIC_DETAIL_ROUTE, { state: { clinicKey } });
      return;
    }

    navigate(toRoute(item));
  }, [navigate]);

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await callRpc("list_platform_directory", {
        _kind: kind,
        _limit: 100,
        _query: query,
      });
      if (error) throw error;
      setDirectory((data ?? []) as PlatformDirectoryItem[]);
    } catch (error) {
      toast({
        title: "Diretório mestre indisponível",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [kind, query]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadDirectory();
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [loadDirectory]);

  const counters = useMemo(() => {
    return directory.reduce(
      (acc, item) => {
        acc[item.item_type] += 1;
        return acc;
      },
      { account: 0, clinic: 0, patient: 0 } as Record<DetailKind, number>
    );
  }, [directory]);

  return (
    <PlatformShell
      title="Painel administrativo global"
      subtitle="Busque clínicas, contas e pacientes; os detalhes, logs e ferramentas ficam em páginas dedicadas."
    >
      <section className="rounded-xl border bg-card p-3 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto_auto] lg:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 pl-9"
              placeholder="Buscar clínica, usuário, paciente, idade, CPF, RG, telefone..."
            />
          </div>
          <Select value={kind} onValueChange={(value) => setKind(value as DirectoryKind)}>
            <SelectTrigger className="h-11">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="clinic">Clínicas</SelectItem>
              <SelectItem value="account">Contas</SelectItem>
              <SelectItem value="patient">Pacientes</SelectItem>
            </SelectContent>
          </Select>
          <Button className="h-11" onClick={() => setCreateClinicOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova clínica
          </Button>
          <Button className="h-11" variant="outline" onClick={() => setCreateAccountOpen(true)}>
            <UserCog className="mr-2 h-4 w-4" />
            Nova conta
          </Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <DirectoryPill icon={Building2} label="Clínicas na busca" value={counters.clinic} />
        <DirectoryPill icon={UsersRound} label="Contas na busca" value={counters.account} />
        <DirectoryPill icon={Stethoscope} label="Pacientes na busca" value={counters.patient} />
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Diretório mestre</CardTitle>
          <p className="text-sm text-muted-foreground">{directory.length} resultado(s)</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : directory.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhum resultado encontrado para esta busca.
            </div>
          ) : (
            <div className="space-y-2">
              {directory.map((item) => (
                <DirectoryCard
                  key={`${item.item_type}-${item.item_id}`}
                  item={item}
                  onClick={() => openDirectoryItem(item)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateClinicDialog
        open={createClinicOpen}
        onOpenChange={setCreateClinicOpen}
        onCreated={(clinicRouteKey) => {
          setCreateClinicOpen(false);
          storePlatformClinicKey(clinicRouteKey);
          navigate(PLATFORM_CLINIC_DETAIL_ROUTE, { state: { clinicKey: clinicRouteKey } });
        }}
      />
      <CreateAccountDialog
        open={createAccountOpen}
        onOpenChange={setCreateAccountOpen}
        onCreated={() => {
          setCreateAccountOpen(false);
          void loadDirectory();
        }}
      />
    </PlatformShell>
  );
};

const PlatformClinicDetailPage = ({ clinicKey, shouldMaskUrl = false }: { clinicKey: string; shouldMaskUrl?: boolean }) => {
  const navigate = useNavigate();
  const { startPlatformClinicAccess } = useAuth();
  const [detail, setDetail] = useState<PlatformClinicDetail | null>(null);
  const [auditEvents, setAuditEvents] = useState<PlatformAuditEvent[]>([]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [formsSummary, setFormsSummary] = useState<PlatformClinicFormsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [supportReason, setSupportReason] = useState("");
  const [supportRole, setSupportRole] = useState<SupportRole>("owner");
  const [startingSupport, setStartingSupport] = useState(false);
  const [flagKey, setFlagKey] = useState("");
  const [flagDescription, setFlagDescription] = useState("");
  const [flagValue, setFlagValue] = useState("true");
  const [flagReason, setFlagReason] = useState("");
  const [savingFlag, setSavingFlag] = useState(false);

  const clinic = detail?.clinic ?? null;
  const clinicName = String(clinic?.name ?? "Clínica");
  const routeKey = String(clinic?.route_key ?? "");
  const resolvedClinicId = String(clinic?.id ?? "");

  useEffect(() => {
    storePlatformClinicKey(clinicKey);
    if (shouldMaskUrl) {
      navigate(PLATFORM_CLINIC_DETAIL_ROUTE, { replace: true, state: { clinicKey } });
    }
  }, [clinicKey, navigate, shouldMaskUrl]);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const detailRes = await callRpc("get_platform_clinic_detail_by_route_key", { _route_key: clinicKey });
      if (detailRes.error) throw detailRes.error;

      const loadedDetail = (detailRes.data ?? null) as PlatformClinicDetail | null;
      const loadedClinicId = String(loadedDetail?.clinic?.id ?? "");
      if (!loadedClinicId) throw new Error("Clínica não encontrada para esta rota mascarada.");

      const [auditRes, flagsRes, formsRes] = await Promise.all([
        callRpc("list_platform_audit_events", { _clinic_id: loadedClinicId, _limit: 80 }),
        callRpc("list_feature_flags", { _clinic_id: loadedClinicId }),
        callRpc("get_platform_clinic_forms_summary_by_route_key", { _route_key: clinicKey }),
      ]);

      if (auditRes.error) throw auditRes.error;
      if (flagsRes.error) throw flagsRes.error;
      if (formsRes.error) throw formsRes.error;

      setDetail(loadedDetail);
      setAuditEvents((auditRes.data ?? []) as PlatformAuditEvent[]);
      setFeatureFlags((flagsRes.data ?? []) as FeatureFlag[]);
      setFormsSummary((formsRes.data ?? null) as PlatformClinicFormsSummary | null);
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

  const handleSaveFlag = async () => {
    setSavingFlag(true);
    try {
      let parsedValue: unknown = flagValue.trim();
      if (flagValue.trim() === "true" || flagValue.trim() === "false") {
        parsedValue = flagValue.trim() === "true";
      } else {
        try {
          parsedValue = JSON.parse(flagValue);
        } catch {
          parsedValue = flagValue.trim();
        }
      }

      const { error } = await callRpc("upsert_feature_flag", {
        _clinic_id: resolvedClinicId,
        _description: flagDescription,
        _key: flagKey,
        _reason: flagReason,
        _scope: "clinic",
        _value: parsedValue,
      });

      if (error) throw error;

      setFlagKey("");
      setFlagDescription("");
      setFlagValue("true");
      setFlagReason("");
      await loadDetail();
      toast({ title: "Feature flag salva", description: "A alteração foi auditada no painel mestre." });
    } catch (error) {
      toast({
        title: "Erro ao salvar flag",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSavingFlag(false);
    }
  };

  return (
    <PlatformShell title={clinicName} subtitle="Administração master da clínica">
      <Button variant="ghost" className="w-fit" onClick={() => navigate("/platform")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar ao diretório
      </Button>

      {loading ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex h-auto w-full justify-start overflow-x-auto p-1 lg:grid lg:grid-cols-7">
            <TabsTrigger className="shrink-0" value="overview">Visão geral</TabsTrigger>
            <TabsTrigger className="shrink-0" value="accounts">Contas</TabsTrigger>
            <TabsTrigger className="shrink-0" value="forms">Formulários</TabsTrigger>
            <TabsTrigger className="shrink-0" value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger className="shrink-0" value="flags">Flags</TabsTrigger>
            <TabsTrigger className="shrink-0" value="support">Suporte</TabsTrigger>
            <TabsTrigger className="shrink-0" value="audit">Auditoria master</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <Card>
                <CardHeader><CardTitle>Resumo cadastral</CardTitle></CardHeader>
                <CardContent>
                  <InfoGrid
                    items={[
                      ["Nome", String(clinic?.name ?? "-")],
                      ["CNPJ", String(clinic?.cnpj ?? "-")],
                      ["Plano", String(clinic?.subscription_plan ?? "-")],
                      ["Rota", routeKey || "-"],
                      ["E-mail", String(clinic?.email ?? "-")],
                      ["Telefone", String(clinic?.phone ?? "-")],
                    ]}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Limites e operação</CardTitle></CardHeader>
                <CardContent>
                  <InfoGrid
                    items={[
                      ["Equipe", String(detail?.counts?.collaborators ?? 0)],
                      ["Pacientes", String(detail?.counts?.patients ?? 0)],
                      ["Atendimentos", String(detail?.counts?.sessions ?? 0)],
                      ["Subcontas", String(clinic?.subaccount_limit ?? 0)],
                    ]}
                  />
                </CardContent>
              </Card>
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
                  clinicId={resolvedClinicId}
                  compact
                  onDone={() => void loadDetail()}
                  title="Ações do gerenciamento de contas"
                />
                {(detail?.memberships ?? []).map((member) => (
                  <div key={String(member.id)} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{String(member.full_name ?? member.email ?? "Usuário")}</p>
                      <p className="text-sm text-muted-foreground">{String(member.email ?? "Sem e-mail")}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{String(member.account_role ?? "user")}</Badge>
                      <Badge variant="outline">{String(member.operational_role ?? "-")}</Badge>
                      <Badge>{String(member.membership_status ?? "-")}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="forms">
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
                          <Button
                            disabled={startingSupport || !routeKey || !resolvedClinicId || supportReason.trim().length < 8}
                            variant="outline"
                            onClick={() => void handleOpenClinicTool(`/configuracoes/formularios/${template.id}`)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dashboard">
            <div className="grid gap-4 lg:grid-cols-2">
              <PlatformReportCard
                title="Resumo operacional"
                value={`${detail?.counts?.sessions ?? 0} atendimentos`}
                description={`${detail?.counts?.patients ?? 0} pacientes cadastrados e ${detail?.counts?.collaborators ?? 0} contas na equipe.`}
              />
              <PlatformReportCard
                title="Resumo por extenso"
                value="Relatório narrativo"
                description="Espaço reservado para gerar relatórios recursivos: operação, financeiro, equipe, formulários e dados clínicos por período."
              />
            </div>
          </TabsContent>

          <TabsContent value="flags">
            <Card>
              <CardHeader><CardTitle>Feature flags da clínica</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <FeatureFlagForm
                  description={flagDescription}
                  keyValue={flagKey}
                  onDescriptionChange={setFlagDescription}
                  onKeyChange={setFlagKey}
                  onReasonChange={setFlagReason}
                  onSave={handleSaveFlag}
                  onValueChange={setFlagValue}
                  reason={flagReason}
                  saving={savingFlag}
                  value={flagValue}
                />
                <FlagList flags={featureFlags} />
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
                <Button disabled={startingSupport || !resolvedClinicId || supportReason.trim().length < 8} onClick={() => void handleStartSupport()}>
                  {startingSupport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Entrar na clínica com super menu
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardHeader><CardTitle>Auditoria master da clínica</CardTitle></CardHeader>
              <CardContent><AuditList events={auditEvents} /></CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      )}
    </PlatformShell>
  );
};

const PlatformPersonDetailPage = ({ itemType, itemId }: { itemType: "account" | "patient"; itemId: string }) => {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const openClinicDetail = useCallback((clinicRouteKey: unknown) => {
    if (typeof clinicRouteKey !== "string" || !clinicRouteKey.trim()) {
      toast({
        title: "Rota mascarada indisponível",
        description: "Não foi possível abrir esta clínica pelo painel master.",
        variant: "destructive",
      });
      return;
    }

    storePlatformClinicKey(clinicRouteKey);
    navigate(PLATFORM_CLINIC_DETAIL_ROUTE, { state: { clinicKey: clinicRouteKey } });
  }, [navigate]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await callRpc("get_platform_person_detail", {
          _item_id: itemId,
          _item_type: itemType,
        });
        if (error) throw error;
        setDetail((data ?? null) as PersonDetail | null);
      } catch (error) {
        toast({
          title: "Detalhe indisponível",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [itemId, itemType, reloadKey]);

  const entity = itemType === "account" ? detail?.profile : detail?.patient;
  const title = String(entity?.full_name ?? entity?.name ?? itemLabels[itemType]);
  const memberships = detail?.memberships ?? [];

  return (
    <PlatformShell title={title} subtitle={`Detalhe master de ${itemLabels[itemType].toLowerCase()}`}>
      <Button variant="ghost" className="w-fit" onClick={() => navigate("/platform")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar ao diretório
      </Button>
      {loading ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardHeader><CardTitle>Dados principais</CardTitle></CardHeader>
            <CardContent>
              <InfoGrid
                items={[
                  ["Nome", title],
                  ["E-mail", String(entity?.email ?? "-")],
                  ["Telefone", String(entity?.phone ?? "-")],
                  ["CPF", String(entity?.cpf ?? "-")],
                  ["RG", String(entity?.rg ?? "-")],
                  ["Status", String(entity?.status ?? "-")],
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Contexto</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {itemType === "patient" ? (
                <>
                  <InfoGrid
                    items={[
                      ["Clínica", String(detail?.clinic?.name ?? "-")],
                      ["Atendimentos", String(detail?.counts?.sessions ?? 0)],
                      ["Concluídos", String(detail?.counts?.completed ?? 0)],
                      ["Rascunhos", String(detail?.counts?.drafts ?? 0)],
                    ]}
                  />
                  {detail?.clinic?.route_key && (
                    <Button className="w-full" onClick={() => openClinicDetail(detail.clinic?.route_key)}>
                      Abrir clínica
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{memberships.length} vínculo(s) com clínica.</p>
                  {memberships.map((membership) => (
                    <button
                      key={String(membership.membership_id)}
                      type="button"
                      className="w-full rounded-lg border p-3 text-left hover:border-primary/50 hover:bg-accent/40"
                      onClick={() => openClinicDetail(membership.clinic_route_key)}
                      disabled={!membership.clinic_route_key}
                    >
                      <p className="font-medium">{String(membership.clinic_name ?? "Clínica")}</p>
                      <p className="text-sm text-muted-foreground">
                        {String(membership.account_role ?? "user")} • {String(membership.operational_role ?? "-")}
                      </p>
                    </button>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
          <div className="lg:col-span-2">
            <PlatformAccountOperations
              clinicId={String(detail?.clinic?.id ?? entity?.clinic_id ?? memberships[0]?.clinic_id ?? "") || undefined}
              compact
              onDone={() => setReloadKey((value) => value + 1)}
              title={itemType === "account" ? "Operações master desta conta" : "Operações master deste paciente"}
            />
          </div>
        </div>
      )}
    </PlatformShell>
  );
};

const DirectoryPill = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
}) => (
  <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold text-foreground">{value}</p>
    </div>
  </div>
);

const DirectoryCard = ({ item, onClick }: { item: PlatformDirectoryItem; onClick: () => void }) => {
  const Icon = item.item_type === "clinic" ? Building2 : item.item_type === "account" ? UsersRound : Stethoscope;
  return (
    <button
      type="button"
      className="grid w-full gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/40 md:grid-cols-[auto_minmax(0,1fr)_auto]"
      onClick={onClick}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-base font-semibold text-foreground">{item.title}</p>
          <Badge variant="secondary">{itemLabels[item.item_type]}</Badge>
          {item.status && <Badge variant="outline">{item.status}</Badge>}
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">{item.subtitle ?? item.clinic_name ?? "Sem subtítulo"}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{compactDocument(item.primary_document)}</span>
          {item.secondary_document && <span>{item.secondary_document}</span>}
          {item.clinic_name && item.item_type !== "clinic" && <span>{item.clinic_name}</span>}
          {typeof item.metadata?.age === "number" && <span>{item.metadata.age} anos</span>}
        </div>
      </div>
      {item.item_type === "clinic" && (
        <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground md:min-w-48">
          <span><strong className="block text-sm text-foreground">{metadataNumber(item.metadata, "team_count")}</strong>equipe</span>
          <span><strong className="block text-sm text-foreground">{metadataNumber(item.metadata, "patients_count")}</strong>pacientes</span>
          <span><strong className="block text-sm text-foreground">{metadataNumber(item.metadata, "sessions_count")}</strong>atend.</span>
        </div>
      )}
    </button>
  );
};

const CreateClinicDialog = ({
  onCreated,
  onOpenChange,
  open,
}: {
  onCreated: (clinicRouteKey: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const { data, error } = await callRpc("platform_create_clinic", {
        _cnpj: cnpj,
        _name: name,
        _reason: reason,
        _subaccount_limit: 4,
        _subscription_plan: "clinic",
      });
      if (error) throw error;
      const result = (data ?? {}) as { clinic_id?: string; route_key?: string };
      if (!result.route_key) throw new Error("A clínica foi criada, mas o retorno não trouxe rota mascarada.");
      toast({ title: "Clínica criada", description: "A criação foi registrada na auditoria master." });
      onCreated(result.route_key);
      setName("");
      setCnpj("");
      setReason("");
    } catch (error) {
      toast({
        title: "Erro ao criar clínica",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova clínica</DialogTitle>
          <DialogDescription>Crie uma clínica inicial local. O vínculo de owner pode ser feito depois pelo fluxo de contas.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nome da clínica</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} />
          </div>
          <div className="space-y-1">
            <Label>CPF/CNPJ administrativo</Label>
            <Input value={cnpj} onChange={(event) => setCnpj(event.target.value)} maxLength={18} />
          </div>
          <div className="space-y-1">
            <Label>Motivo</Label>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={saving || name.trim().length < 3 || cnpj.trim().length < 11} onClick={() => void handleCreate()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar clínica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const CreateAccountDialog = ({
  onCreated,
  onOpenChange,
  open,
}: {
  onCreated: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const [plan, setPlan] = useState("clinic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [document, setDocument] = useState("");
  const [fullName, setFullName] = useState("");
  const [status, setStatus] = useState("active");
  const [concurrentLimit, setConcurrentLimit] = useState("4");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await callPlatformAccountAdmin(
        "create_owner_account",
        {
          cnpj: document,
          concurrentAccessLimit: Number(concurrentLimit),
          email,
          fullName,
          password,
          plan,
          status,
        },
        reason
      );
      toast({ title: "Conta criada", description: "O owner foi criado e a ação foi auditada no painel master." });
      setEmail("");
      setPassword("");
      setDocument("");
      setFullName("");
      setReason("");
      onCreated();
    } catch (error) {
      toast({
        title: "Erro ao criar conta",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nova conta master-gerenciada</DialogTitle>
            <DialogDescription>
              Crie uma conta owner com senha inicial pelo backend administrativo. A service role fica apenas na função segura do Supabase.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Tipo de conta</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="clinic">Clínica com equipe</SelectItem>
                  <SelectItem value="solo">Solo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status administrativo</Label>
              <AccountStatusSelect value={status} onValueChange={setStatus} />
            </div>
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" maxLength={160} required />
            </div>
            <div className="space-y-1">
              <Label>Senha inicial</Label>
              <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={6} maxLength={128} required />
            </div>
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1">
              <Label>CPF/CNPJ</Label>
              <Input value={document} onChange={(event) => setDocument(event.target.value)} maxLength={18} required />
            </div>
            <div className="space-y-1">
              <Label>Acessos simultâneos</Label>
              <Input
                value={concurrentLimit}
                onChange={(event) => setConcurrentLimit(event.target.value)}
                disabled={plan === "solo"}
                inputMode="numeric"
                maxLength={3}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Motivo auditável</Label>
              <Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} required />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button disabled={saving || reason.trim().length < 8} type="submit">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar conta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

type AccountOperation =
  | "create_subaccount"
  | "update_owner_access"
  | "update_subaccount_access"
  | "delete_subaccount"
  | "delete_clinic_package"
  | "create_patient"
  | "update_patient"
  | "delete_patient";

const accountOperationLabels: Record<AccountOperation, string> = {
  create_patient: "Criar paciente",
  create_subaccount: "Criar subconta",
  delete_clinic_package: "Excluir pacote da clínica",
  delete_patient: "Excluir paciente",
  delete_subaccount: "Excluir subconta",
  update_owner_access: "Editar acesso do owner",
  update_patient: "Editar paciente",
  update_subaccount_access: "Editar acesso da subconta",
};

const destructiveOperations = new Set<AccountOperation>(["delete_clinic_package", "delete_patient", "delete_subaccount"]);

const PlatformAccountOperations = ({
  clinicId,
  compact = false,
  onDone,
  title,
}: {
  clinicId?: string;
  compact?: boolean;
  onDone: () => void;
  title: string;
}) => {
  const [operation, setOperation] = useState<AccountOperation>("create_subaccount");
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [form, setForm] = useState<Record<string, string>>({
    clinicId: clinicId ?? "",
    concurrentAccessLimit: "4",
    cpf: "",
    dateOfBirth: "",
    email: "",
    fullName: "",
    identifier: "",
    name: "",
    newEmail: "",
    password: "",
    patientId: "",
    phone: "",
    role: "professional",
    status: "active",
  });

  const updateField = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const effectiveClinicId = form.clinicId || clinicId || "";
  const isDestructive = destructiveOperations.has(operation);

  const buildPayload = () => {
    const base = { clinicId: effectiveClinicId };
    if (operation === "create_subaccount") {
      return { ...base, email: form.email, fullName: form.fullName, password: form.password, role: form.role, status: form.status };
    }
    if (operation === "update_owner_access") {
      return {
        concurrentAccessLimit: form.concurrentAccessLimit,
        cnpj: form.cpf,
        identifier: form.identifier,
        newEmail: form.newEmail,
        password: form.password,
        status: form.status,
      };
    }
    if (operation === "update_subaccount_access") {
      return { identifier: form.identifier, newEmail: form.newEmail, password: form.password, role: form.role, status: form.status };
    }
    if (operation === "delete_subaccount") return { identifier: form.identifier };
    if (operation === "delete_clinic_package") return { clinicId: effectiveClinicId };
    if (operation === "create_patient") {
      return { ...base, cpf: form.cpf, dateOfBirth: form.dateOfBirth, email: form.email, name: form.name, phone: form.phone, status: form.status };
    }
    if (operation === "update_patient") {
      return { cpf: form.cpf, dateOfBirth: form.dateOfBirth, email: form.email, name: form.name, patientId: form.patientId, phone: form.phone, status: form.status };
    }
    return { patientId: form.patientId };
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await callPlatformAccountAdmin(operation, buildPayload(), reason);
      toast({ title: "Operação concluída", description: `${accountOperationLabels[operation]} foi registrada na auditoria master.` });
      setConfirmation("");
      onDone();
    } catch (error) {
      toast({
        title: "Operação administrativa falhou",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">Espelha o Gerenciamento de Contas do script operacional, com MFA, backend seguro e motivo obrigatório.</p>
      </div>
      <div className={`grid gap-3 ${compact ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
        <div className="space-y-1">
          <Label>Ação</Label>
          <Select value={operation} onValueChange={(value) => setOperation(value as AccountOperation)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(accountOperationLabels) as AccountOperation[]).map((key) => (
                <SelectItem key={key} value={key}>{accountOperationLabels[key]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!clinicId && (
          <div className="space-y-1">
            <Label>ID/CNPJ da clínica</Label>
            <Input value={form.clinicId} onChange={(event) => updateField("clinicId", event.target.value)} maxLength={60} />
          </div>
        )}
        {(operation.includes("subaccount") || operation === "update_owner_access") && operation !== "create_subaccount" && (
          <div className="space-y-1">
            <Label>E-mail ou ID da conta</Label>
            <Input value={form.identifier} onChange={(event) => updateField("identifier", event.target.value)} maxLength={160} />
          </div>
        )}
        {operation.includes("patient") && operation !== "create_patient" && (
          <div className="space-y-1">
            <Label>ID do paciente</Label>
            <Input value={form.patientId} onChange={(event) => updateField("patientId", event.target.value)} maxLength={60} />
          </div>
        )}
        {(operation === "create_subaccount" || operation === "create_patient") && (
          <div className="space-y-1">
            <Label>{operation === "create_patient" ? "Nome do paciente" : "Nome da conta"}</Label>
            <Input value={operation === "create_patient" ? form.name : form.fullName} onChange={(event) => updateField(operation === "create_patient" ? "name" : "fullName", event.target.value)} maxLength={120} />
          </div>
        )}
        {(operation === "create_subaccount" || operation === "create_patient") && (
          <div className="space-y-1">
            <Label>E-mail</Label>
            <Input value={form.email} onChange={(event) => updateField("email", event.target.value)} maxLength={160} />
          </div>
        )}
        {(operation === "update_owner_access" || operation === "update_subaccount_access") && (
          <div className="space-y-1">
            <Label>Novo e-mail</Label>
            <Input value={form.newEmail} onChange={(event) => updateField("newEmail", event.target.value)} maxLength={160} />
          </div>
        )}
        {(operation === "create_subaccount" || operation === "update_owner_access" || operation === "update_subaccount_access") && (
          <div className="space-y-1">
            <Label>{operation === "create_subaccount" ? "Senha inicial" : "Nova senha"}</Label>
            <Input value={form.password} onChange={(event) => updateField("password", event.target.value)} type="password" maxLength={128} />
          </div>
        )}
        {(operation === "create_subaccount" || operation === "update_subaccount_access") && (
          <div className="space-y-1">
            <Label>Papel operacional</Label>
            <OperationalRoleSelect value={form.role} onValueChange={(value) => updateField("role", value)} />
          </div>
        )}
        {(operation === "create_subaccount" || operation.startsWith("update_") || operation === "create_patient") && (
          <div className="space-y-1">
            <Label>Status</Label>
            {operation === "create_patient" || operation === "update_patient" ? (
              <Input value={form.status} onChange={(event) => updateField("status", event.target.value)} maxLength={50} />
            ) : (
              <AccountStatusSelect value={form.status} onValueChange={(value) => updateField("status", value)} />
            )}
          </div>
        )}
        {(operation === "create_patient" || operation === "update_patient" || operation === "update_owner_access") && (
          <div className="space-y-1">
            <Label>{operation === "update_owner_access" ? "CPF/CNPJ" : "CPF"}</Label>
            <Input value={form.cpf} onChange={(event) => updateField("cpf", event.target.value)} maxLength={18} />
          </div>
        )}
        {(operation === "create_patient" || operation === "update_patient") && (
          <>
            <div className="space-y-1">
              <Label>Nascimento</Label>
              <Input value={form.dateOfBirth} onChange={(event) => updateField("dateOfBirth", event.target.value)} placeholder="AAAA-MM-DD" maxLength={10} />
            </div>
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(event) => updateField("phone", event.target.value)} maxLength={20} />
            </div>
          </>
        )}
        {operation === "update_owner_access" && (
          <div className="space-y-1">
            <Label>Acessos simultâneos</Label>
            <Input value={form.concurrentAccessLimit} onChange={(event) => updateField("concurrentAccessLimit", event.target.value)} inputMode="numeric" maxLength={3} />
          </div>
        )}
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-1">
          <Label>Motivo auditável</Label>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} />
        </div>
        {isDestructive && (
          <div className="space-y-1">
            <Label>Confirmação</Label>
            <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Digite EXCLUIR" />
            <p className="text-xs text-destructive">Ação destrutiva auditada e sem atalho visual.</p>
          </div>
        )}
      </div>
      <Button
        disabled={saving || reason.trim().length < 8 || (isDestructive && confirmation !== "EXCLUIR")}
        onClick={() => void handleSubmit()}
      >
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Executar ação administrativa
      </Button>
    </div>
  );
};

const AccountStatusSelect = ({ onValueChange, value }: { onValueChange: (value: string) => void; value: string }) => (
  <Select value={value} onValueChange={onValueChange}>
    <SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="active">Ativa</SelectItem>
      <SelectItem value="payment_pending">Pagamento pendente</SelectItem>
      <SelectItem value="temporarily_paused">Pausada temporariamente</SelectItem>
      <SelectItem value="banned">Bloqueada</SelectItem>
    </SelectContent>
  </Select>
);

const OperationalRoleSelect = ({ onValueChange, value }: { onValueChange: (value: string) => void; value: string }) => (
  <Select value={value} onValueChange={onValueChange}>
    <SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="admin">Administrador</SelectItem>
      <SelectItem value="professional">Profissional</SelectItem>
      <SelectItem value="assistant">Assistente</SelectItem>
      <SelectItem value="estagiario">Estagiário</SelectItem>
    </SelectContent>
  </Select>
);

const InfoGrid = ({ items }: { items: Array<[string, string]> }) => (
  <div className="grid gap-2 sm:grid-cols-2">
    {items.map(([label, value]) => (
      <div key={label} className="rounded-lg border bg-muted/20 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 break-words text-sm font-medium text-foreground">{value}</p>
      </div>
    ))}
  </div>
);

const PlatformReportCard = ({ description, title, value }: { description: string; title: string; value: string }) => (
  <Card>
    <CardContent className="space-y-2 p-4">
      <div className="flex items-center gap-2 text-primary">
        <Gauge className="h-4 w-4" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em]">{title}</p>
      </div>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
);

const FeatureFlagForm = ({
  description,
  keyValue,
  onDescriptionChange,
  onKeyChange,
  onReasonChange,
  onSave,
  onValueChange,
  reason,
  saving,
  value,
}: {
  description: string;
  keyValue: string;
  onDescriptionChange: (value: string) => void;
  onKeyChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onSave: () => void;
  onValueChange: (value: string) => void;
  reason: string;
  saving: boolean;
  value: string;
}) => (
  <div className="space-y-3 rounded-lg border p-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label>Chave</Label>
        <Input value={keyValue} onChange={(event) => onKeyChange(event.target.value)} placeholder="nova_funcionalidade" maxLength={120} />
      </div>
      <div className="space-y-1">
        <Label>Valor</Label>
        <Input value={value} onChange={(event) => onValueChange(event.target.value)} placeholder="true, false ou JSON" maxLength={500} />
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label>Descrição</Label>
        <Input value={description} onChange={(event) => onDescriptionChange(event.target.value)} placeholder="Para que serve esta flag" maxLength={500} />
      </div>
      <div className="space-y-1">
        <Label>Motivo da alteração</Label>
        <Input value={reason} onChange={(event) => onReasonChange(event.target.value)} maxLength={1000} />
      </div>
    </div>
    <Button disabled={saving || keyValue.trim().length < 2 || reason.trim().length < 8} onClick={onSave}>
      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Salvar flag auditada
    </Button>
  </div>
);

const FlagList = ({ flags }: { flags: FeatureFlag[] }) => (
  <div className="space-y-2">
    {flags.length === 0 ? (
      <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Nenhuma flag cadastrada.</p>
    ) : flags.map((flag) => (
      <div key={flag.id} className="rounded-lg border p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-foreground">{flag.key}</p>
          <Badge variant={flag.is_active_now ? "default" : "secondary"}>{flag.is_active_now ? "ativa" : "inativa"}</Badge>
          <Badge variant="outline">{flag.scope === "global" ? "global" : flag.clinic_name ?? "clínica"}</Badge>
        </div>
        <p className="mt-1 text-muted-foreground">{flag.description ?? "Sem descrição"}</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{JSON.stringify(flag.value)}</p>
      </div>
    ))}
  </div>
);

const AuditList = ({ events }: { events: PlatformAuditEvent[] }) => (
  <div className="space-y-2">
    {events.length === 0 ? (
      <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Nenhum evento encontrado.</p>
    ) : events.map((event) => (
      <div key={event.id} className="rounded-lg border p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium text-foreground">{eventLabel[event.event_type] ?? event.event_type}</p>
          <span className="text-xs text-muted-foreground">{formatDateTime(event.created_at)}</span>
        </div>
        <p className="mt-1 text-muted-foreground">
          {event.clinic_name ? `${event.clinic_name} • ` : ""}
          {event.actor_name ?? event.actor_email ?? "Sistema"}
        </p>
        {event.reason && <p className="mt-1 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{event.reason}</p>}
      </div>
    ))}
  </div>
);

export default PlatformAdmin;
