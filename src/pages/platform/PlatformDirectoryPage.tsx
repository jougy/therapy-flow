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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { CreateClinicDialog } from "@/components/platform/CreateClinicDialog";
import { CreateAccountDialog } from "@/components/platform/CreateAccountDialog";
import { ResetRegistrationDialog } from "@/components/platform/ResetRegistrationDialog";
import { PlatformAuditList } from "@/components/platform/PlatformAuditList";
import { DirectoryCard, DirectoryPill } from "@/components/platform/DirectoryCard";
import { consolidateDirectoryItems } from "@/components/platform/directory-utils";
import type {
  DetailKind,
  DirectoryKind,
  DirectoryStatusFilter,
  PlatformAuditEvent,
  PlatformDirectoryItem,
  PlatformTagItem,
} from "@/components/platform/types";
import {
  callRpc,
  clinicMaskedRouteKey,
  directoryKindLabels,
  directoryStatusLabels,
  getErrorMessage,
  PLATFORM_CLINIC_DETAIL_ROUTE,
  storePlatformClinicKey,
  toRoute,
} from "@/components/platform/platform-api";
import { supabase } from "@/integrations/supabase/client";

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
      // Tentar chamar com os parâmetros enriquecidos
      let { data, error } = await callRpc("list_platform_directory", {
        _kind: targetKind,
        _limit: 120,
        _query: targetQuery.trim() || null,
        _status: targetStatus,
        _tag_id: targetTag !== "all" ? targetTag : null,
      }, { silentError: true });

      // Fallback gracioso caso a migration ainda não tenha sido executada no banco
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

      // Agrupa no cliente com unificação de status multi-clínicas
      let finalDirectory = consolidateDirectoryItems(rawList);

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
