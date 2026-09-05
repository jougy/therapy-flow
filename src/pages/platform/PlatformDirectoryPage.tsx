import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Clock3,
  Filter,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Tag,
  UsersRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { CreateClinicDialog } from "@/components/platform/CreateClinicDialog";
import { CreateAccountDialog } from "@/components/platform/CreateAccountDialog";
import { ResetRegistrationDialog } from "@/components/platform/ResetRegistrationDialog";
import { PlatformAuditList } from "@/components/platform/PlatformAuditList";
import type { DirectoryKind, DirectoryStatusFilter, PlatformAuditEvent, PlatformDirectoryItem, PlatformTagItem } from "@/components/platform/types";
import {
  callRpc,
  clinicMaskedRouteKey,
  compactDocument,
  directoryKindLabels,
  directoryStatusLabels,
  getErrorMessage,
  itemLabels,
  metadataNumber,
  PLATFORM_CLINIC_DETAIL_ROUTE,
  storePlatformClinicKey,
  toRoute,
} from "@/components/platform/platform-api";
import { supabase } from "@/integrations/supabase/client";

interface EntityTheme {
  iconBg: string;
  iconText: string;
  badgeClass: string;
  cardBorderHover: string;
  cardBg?: string;
  pillBorder?: string;
}

const getEntityTheme = (
  itemType: PlatformDirectoryItem["item_type"],
  isOwner?: boolean,
  isPending?: boolean
): EntityTheme => {
  if (isPending) {
    return {
      iconBg: "bg-amber-500/15",
      iconText: "text-amber-700 dark:text-amber-300",
      badgeClass: "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-400/40",
      cardBorderHover: "hover:border-amber-400/60",
      cardBg: "border-amber-400/40 bg-amber-500/[0.03] dark:border-amber-500/30",
      pillBorder: "border-amber-500/30",
    };
  }

  if (itemType === "clinic") {
    return {
      iconBg: "bg-sky-500/15",
      iconText: "text-sky-700 dark:text-sky-300",
      badgeClass: "bg-sky-500/15 text-sky-800 dark:text-sky-200 border-sky-400/40",
      cardBorderHover: "hover:border-sky-400/60",
      pillBorder: "border-sky-500/30",
    };
  }

  if (itemType === "account" && isOwner) {
    return {
      iconBg: "bg-purple-500/15",
      iconText: "text-purple-700 dark:text-purple-300",
      badgeClass: "bg-purple-500/15 text-purple-800 dark:text-purple-200 border-purple-400/40",
      cardBorderHover: "hover:border-purple-400/60",
      pillBorder: "border-purple-500/30",
    };
  }

  if (itemType === "account") {
    return {
      iconBg: "bg-indigo-500/15",
      iconText: "text-indigo-700 dark:text-indigo-300",
      badgeClass: "bg-indigo-500/15 text-indigo-800 dark:text-indigo-200 border-indigo-400/40",
      cardBorderHover: "hover:border-indigo-400/60",
      pillBorder: "border-indigo-500/30",
    };
  }

  // Pacientes (patient)
  return {
    iconBg: "bg-emerald-500/15",
    iconText: "text-emerald-700 dark:text-emerald-300",
    badgeClass: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-400/40",
    cardBorderHover: "hover:border-emerald-400/60",
    pillBorder: "border-emerald-500/30",
  };
};

const DirectoryPill = ({
  icon: Icon,
  label,
  value,
  colorClass = "bg-primary/10 text-primary",
}: {
  icon: typeof Building2;
  label: string;
  value: number;
  colorClass?: string;
}) => (
  <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorClass}`}>
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
  const isOwner = Boolean(item.metadata?.is_owner);
  const Icon = item.item_type === "clinic" ? Building2 : item.item_type === "account" ? (isPending ? Clock3 : UsersRound) : Stethoscope;
  const theme = getEntityTheme(item.item_type, isOwner, isPending);

  const renderStatusBadge = () => {
    if (isPending) {
      if (item.status === "unconfirmed_email") return <Badge variant="destructive">E-mail não verificado</Badge>;
      if (item.status === "pending_login") return <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">Aguardando login</Badge>;
      return <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">Convite pendente</Badge>;
    }
    if (item.status === "expiring_soon") return <Badge className="bg-amber-500/15 text-amber-800 border-amber-400/40">Vence em breve</Badge>;
    if (item.status === "expired") return <Badge variant="destructive">Vencido / Expirado</Badge>;
    if (item.status === "banned") return <Badge variant="destructive">Bloqueado</Badge>;
    if (item.status === "paused") return <Badge variant="secondary">Pausado</Badge>;
    if (item.status === "personal") return <Badge variant="outline" className="border-blue-500/40 text-blue-600">Conta Pessoal</Badge>;
    return item.status ? <Badge variant="outline">{item.status}</Badge> : null;
  };

  return (
    <button
      type="button"
      className={`grid w-full gap-3 rounded-xl border p-4 text-left shadow-sm transition-colors ${theme.cardBorderHover} hover:bg-accent/40 md:grid-cols-[auto_minmax(0,1fr)_auto] ${
        theme.cardBg ?? "bg-card"
      }`}
      onClick={onClick}
    >
      <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${theme.iconBg} ${theme.iconText}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-base font-semibold text-foreground">{item.title}</p>
          <Badge className={`border font-medium ${theme.badgeClass}`}>
            {isPending ? "Pendente" : isOwner ? "Owner" : itemLabels[item.item_type]}
          </Badge>
          {renderStatusBadge()}
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
          {item.item_type === "account" && metadataNumber(item.metadata, "clinics_count") > 1 ? (
            <Badge variant="outline" className="border-purple-500/40 text-purple-600 dark:text-purple-300 font-normal">
              {metadataNumber(item.metadata, "clinics_count")} clínicas associadas
            </Badge>
          ) : (
            item.clinic_name && item.item_type !== "clinic" && <span>{item.clinic_name}</span>
          )}
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
  const [statusFilter, setStatusFilter] = useState<DirectoryStatusFilter>("all");
  const [selectedTagId, setSelectedTagId] = useState<string>("all");
  const [tags, setTags] = useState<PlatformTagItem[]>([]);
  
  const [hasSearched, setHasSearched] = useState(false);
  const [directory, setDirectory] = useState<PlatformDirectoryItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<PlatformAuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [createClinicOpen, setCreateClinicOpen] = useState(false);
  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const navigate = useNavigate();

  // Carregar tags disponíveis
  useEffect(() => {
    const loadTags = async () => {
      const { data } = await supabase.from("clinic_tags").select("id, name, color").order("name");
      if (data) setTags(data);
    };
    void loadTags();
  }, []);

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

  const loadDirectory = useCallback(async (
    targetKind: DirectoryKind = kind,
    targetStatus: DirectoryStatusFilter = statusFilter,
    targetTag: string = selectedTagId,
    targetQuery: string = query
  ) => {
    setLoading(true);
    setHasSearched(true);
    try {
      // Tentar chamar com os 5 novos parâmetros (nova migration)
      let { data, error } = await callRpc("list_platform_directory", {
        _kind: targetKind,
        _limit: 120,
        _query: targetQuery.trim() || null,
        _status: targetStatus,
        _tag_id: targetTag !== "all" ? targetTag : null,
      }, { silentError: true });

      // Fallback gracioso: caso a migration ainda não tenha sido executada no banco (versão com 3 parâmetros)
      if (error && (error.message?.includes("Could not find the function") || error.message?.includes("schema cache"))) {
        const fallbackResult = await callRpc("list_platform_directory", {
          _kind: targetKind === "owner" ? "account" : targetKind,
          _limit: 120,
          _query: targetQuery.trim() || null,
        });
        data = fallbackResult.data;
        error = fallbackResult.error;
      }

      if (error) throw error;
      const rawList = (data ?? []) as PlatformDirectoryItem[];

      // Agrupa no cliente caso a migration nova ainda não tenha sido aplicada no banco
      // (evita que o mesmo usuário apareça N vezes se pertencer a N clínicas)
      const consolidatedMap = new Map<string, PlatformDirectoryItem>();
      for (const item of rawList) {
        // Se for clínica ou paciente, ou pendente sem item_id repetido, adiciona normalmente
        if (item.item_type !== "account") {
          consolidatedMap.set(`${item.item_type}:${item.item_id}`, item);
          continue;
        }

        const existing = consolidatedMap.get(`account:${item.item_id}`);
        if (!existing) {
          const isItemOwner = item.metadata?.is_owner ?? (item.metadata?.account_role === "account_owner");
          consolidatedMap.set(`account:${item.item_id}`, {
            ...item,
            metadata: {
              ...item.metadata,
              is_owner: isItemOwner,
              clinics_count: item.metadata?.clinics_count ?? (item.clinic_name ? 1 : 0),
            },
          });
        } else {
          // Já existe um registro para esta pessoa: consolida clínicas
          const prevCount = (existing.metadata?.clinics_count as number) || 1;
          const isItemOwner = (existing.metadata?.is_owner as boolean) || (item.metadata?.is_owner as boolean) || (item.metadata?.account_role === "account_owner");
          consolidatedMap.set(`account:${item.item_id}`, {
            ...existing,
            metadata: {
              ...existing.metadata,
              is_owner: isItemOwner,
              clinics_count: prevCount + 1,
            },
          });
        }
      }

      let finalDirectory = Array.from(consolidatedMap.values());

      // Se o filtro selecionado for especificamente 'owner', filtra apenas os owners consolidados
      if (targetKind === "owner") {
        finalDirectory = finalDirectory.filter(
          (item) => item.item_type === "account" && Boolean(item.metadata?.is_owner)
        );
      } else if (targetKind === "account") {
        finalDirectory = finalDirectory.filter(
          (item) => item.item_type === "account" && !item.metadata?.is_owner
        );
      }

      setDirectory(finalDirectory);
    } catch (error) {
      toast({
        title: "Erro ao carregar diretório",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [kind, statusFilter, selectedTagId, query]);

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

  const handleQuickList = (selectedKind: DirectoryKind) => {
    setKind(selectedKind);
    void loadDirectory(selectedKind, statusFilter, selectedTagId, query);
  };

  const handleClearFilters = () => {
    setQuery("");
    setKind("all");
    setStatusFilter("all");
    setSelectedTagId("all");
    setHasSearched(false);
    setDirectory([]);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void loadDirectory();
  };

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
      {/* Barra de Filtros em 3 Menus + Busca */}
      <section className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          {/* Busca textual */}
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 pl-9"
              placeholder="Buscar por clínica, nome, e-mail, CPF, CNPJ, telefone..."
            />
          </div>

          {/* Menu 1: Categoria / Tipo */}
          <div className="w-full sm:w-auto min-w-[180px]">
            <Select value={kind} onValueChange={(value) => setKind(value as DirectoryKind)}>
              <SelectTrigger className="h-10">
                <UsersRound className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Tipo de registro" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(directoryKindLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Menu 2: Status */}
          <div className="w-full sm:w-auto min-w-[190px]">
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as DirectoryStatusFilter)}>
              <SelectTrigger className="h-10">
                <Clock3 className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(directoryStatusLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Menu 3: Tags */}
          <div className="w-full sm:w-auto min-w-[160px]">
            <Select value={selectedTagId} onValueChange={setSelectedTagId}>
              <SelectTrigger className="h-10">
                <Tag className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as tags</SelectItem>
                {tags.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color || "#8b5cf6" }} />
                      <span>{t.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Botões de Ação Principal */}
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={loading} className="h-10 gap-1.5 shadow-sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
              Filtrar / Carregar
            </Button>
            {hasSearched && (
              <Button type="button" variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground" onClick={handleClearFilters} title="Limpar busca">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>

        {/* Linha de Ações Auxiliares: Botões de Criação e Reset */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium mr-1">Atalhos rápidos:</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-sky-500/30 text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/40"
              onClick={() => handleQuickList("clinic")}
            >
              Listar Clínicas
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-purple-500/30 text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-950/40"
              onClick={() => handleQuickList("owner")}
            >
              Listar Owners
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-indigo-500/30 text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
              onClick={() => handleQuickList("account")}
            >
              Listar Usuários
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
              onClick={() => handleQuickList("patient")}
            >
              Listar Pacientes
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-amber-500/30 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
              onClick={() => handleQuickList("pending_account")}
            >
              Listar Pendências
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 border-amber-500/50 text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950"
              onClick={() => setResetDialogOpen(true)}
            >
              <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
              Resetar cadastro
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setCreateClinicOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Nova clínica
            </Button>
            <Button size="sm" className="h-8 gap-1" onClick={() => setCreateAccountOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Nova conta
            </Button>
          </div>
        </div>
      </section>

      {/* Contadores da Busca Atual */}
      {hasSearched && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <DirectoryPill icon={Building2} label="Clínicas na busca" value={counters.clinic} colorClass="bg-sky-500/15 text-sky-700 dark:text-sky-300" />
          <DirectoryPill icon={UsersRound} label="Contas / Owners" value={counters.account} colorClass="bg-purple-500/15 text-purple-700 dark:text-purple-300" />
          <DirectoryPill icon={Clock3} label="Pendências na busca" value={counters.pending} colorClass="bg-amber-500/15 text-amber-700 dark:text-amber-300" />
          <DirectoryPill icon={Stethoscope} label="Pacientes na busca" value={counters.patient} colorClass="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" />
          <DirectoryPill icon={ShieldCheck} label="Resultados retornados" value={directory.length} colorClass="bg-primary/10 text-primary" />
        </section>
      )}

      {/* Painel do Diretório ou Boas-vindas Sob Demanda */}
      {!hasSearched ? (
        <Card className="border-dashed bg-card/60">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold">Busca do Diretório Sob Demanda</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Para otimizar o consumo de dados e o tempo de carregamento, escolha os filtros acima ou utilize um dos atalhos rápidos para listar registros específicos.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleQuickList("clinic")}>
                Listar Clínicas
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleQuickList("owner")}>
                Listar Owners
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleQuickList("account")}>
                Listar Usuários
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleQuickList("patient")}>
                Listar Pacientes
              </Button>
              <Button variant="default" size="sm" onClick={() => handleQuickList("all")}>
                Listar Todos
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
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
                Nenhum resultado encontrado para os filtros selecionados.
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
      )}

      {/* Eventos de Auditoria */}
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

      {/* Dialogs */}
      <ResetRegistrationDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        onSuccess={() => {
          if (hasSearched) void loadDirectory();
          void loadAuditEvents();
        }}
      />
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

