import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Clock3,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { CreateClinicDialog } from "@/components/platform/CreateClinicDialog";
import { CreateAccountDialog } from "@/components/platform/CreateAccountDialog";
import { PlatformAuditList } from "@/components/platform/PlatformAuditList";
import type { DirectoryKind, PlatformAuditEvent, PlatformDirectoryItem } from "@/components/platform/types";
import {
  callRpc,
  clinicMaskedRouteKey,
  compactDocument,
  getErrorMessage,
  itemLabels,
  metadataNumber,
  PLATFORM_CLINIC_DETAIL_ROUTE,
  storePlatformClinicKey,
  toRoute,
} from "@/components/platform/platform-api";

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
  const isPending = Boolean(item.metadata?.is_pending_registration);
  const Icon = item.item_type === "clinic" ? Building2 : item.item_type === "account" ? (isPending ? Clock3 : UsersRound) : Stethoscope;
  return (
    <button
      type="button"
      className={`grid w-full gap-3 rounded-xl border p-4 text-left shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/40 md:grid-cols-[auto_minmax(0,1fr)_auto] ${
        isPending ? "border-amber-400/40 bg-amber-500/[0.03] dark:border-amber-500/30" : "bg-card"
      }`}
      onClick={onClick}
    >
      <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${isPending ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-primary/10 text-primary"}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-base font-semibold text-foreground">{item.title}</p>
          <Badge variant="secondary">{itemLabels[item.item_type]}</Badge>
          {isPending ? (
            item.status === "unconfirmed_email" ? (
              <Badge variant="destructive">E-mail não verificado</Badge>
            ) : item.status === "pending_login" ? (
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">Aguardando login</Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">Convite pendente</Badge>
            )
          ) : (
            item.status && <Badge variant="outline">{item.status}</Badge>
          )}
          {isPending && (
            <Badge className="bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-400/30 text-[10px]">
              Pendência de cadastro
            </Badge>
          )}
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {item.metadata?.pending_reason ? String(item.metadata.pending_reason) : (item.subtitle ?? item.clinic_name ?? "Sem subtítulo")}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{compactDocument(item.primary_document)}</span>
          {item.secondary_document && <span>{item.secondary_document}</span>}
          {item.clinic_name && item.item_type !== "clinic" && <span>{item.clinic_name}</span>}
          {typeof item.metadata?.age === "number" && <span>{item.metadata.age} anos</span>}
          {item.created_at && (
            <span className="font-mono text-neutral-500">
              {isPending ? "Convidado em: " : "Cadastrado: "}
              {new Date(item.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
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

export const PlatformDirectoryPage = () => {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<DirectoryKind>("all");
  const [directory, setDirectory] = useState<PlatformDirectoryItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<PlatformAuditEvent[]>([]);
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
        title: "Erro ao carregar diretório",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [kind, query]);

  const loadAuditEvents = useCallback(async () => {
    try {
      const { data, error } = await callRpc("list_platform_audit_events", { _limit: 30 });
      if (error) throw error;
      setAuditEvents((data ?? []) as PlatformAuditEvent[]);
    } catch {
      // Falha silenciosa de auditoria não impede uso do diretório
    }
  }, []);

  useEffect(() => {
    void loadAuditEvents();
  }, [loadAuditEvents]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadDirectory();
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [loadDirectory]);

  const counters = useMemo(() => {
    return directory.reduce(
      (acc, item) => {
        if (item.metadata?.is_pending_registration) {
          acc.pending += 1;
        }
        acc[item.item_type] += 1;
        return acc;
      },
      { account: 0, clinic: 0, patient: 0, pending: 0 } as Record<DetailKind | "pending", number>
    );
  }, [directory]);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border bg-card p-3 shadow-sm overflow-hidden">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_auto_auto] lg:items-center">
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
              <SelectItem value="pending_account">Pendências de cadastro</SelectItem>
              <SelectItem value="patient">Pacientes</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="h-11" onClick={() => setCreateClinicOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova clínica
          </Button>
          <Button className="h-11" onClick={() => setCreateAccountOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova conta
          </Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <DirectoryPill icon={Building2} label="Clínicas na busca" value={counters.clinic} />
        <DirectoryPill icon={UsersRound} label="Contas na busca" value={counters.account} />
        <DirectoryPill icon={Clock3} label="Pendências na busca" value={counters.pending} />
        <DirectoryPill icon={Stethoscope} label="Pacientes na busca" value={counters.patient} />
        <DirectoryPill icon={ShieldCheck} label="Resultados retornados" value={directory.length} />
      </section>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>Diretório mestre unificado</CardTitle>
          <span className="text-sm text-muted-foreground">{directory.length} registro(s) encontrado(s)</span>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center">
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

      {auditEvents.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle>Últimos eventos de auditoria global</CardTitle>
            <span className="text-sm text-muted-foreground">{auditEvents.length} eventos recentes</span>
          </CardHeader>
          <CardContent>
            <PlatformAuditList events={auditEvents} />
          </CardContent>
        </Card>
      )}

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
          void loadAuditEvents();
        }}
      />
    </div>
  );
};
