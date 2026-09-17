import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Award,
  Building2,
  CheckCircle2,
  Filter,
  Loader2,
  Search,
  ShieldCheck,
  Activity,
  UserCheck,
} from "lucide-react";
import type { ClinicalPortfolioItem } from "@/types/clinicalPortfolio";
import { calculatePortfolioMetrics, formatSessionDateTime } from "@/lib/clinical-portfolio";
import { fetchPersonalClinicalPortfolio } from "@/services/clinicalPortfolioService";
import { PortfolioCompactSessionCard } from "@/components/personal/PortfolioCompactSessionCard";
import type { AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";

interface PersonalClinicalPortfolioTabProps {
  userId?: string;
  initialItems?: ClinicalPortfolioItem[];
  baseSchema?: AnamnesisTemplateSchema;
}

export const PersonalClinicalPortfolioTab: React.FC<PersonalClinicalPortfolioTabProps> = ({
  userId,
  initialItems,
  baseSchema,
}) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<ClinicalPortfolioItem[]>(initialItems ?? []);
  const [loading, setLoading] = useState(!initialItems && !!userId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClinicId, setSelectedClinicId] = useState<string>("all");

  const handleOpenSession = React.useCallback(
    (session: ClinicalPortfolioItem) => {
      const clinicKey = session.clinic_route_key || session.clinic_id;
      const patientRef = session.patient_ref || session.patient_id;
      const targetUrl = `/clinica/${clinicKey}/pacientes/${patientRef}/sessao/${session.id}`;
      navigate(targetUrl, { state: { from: "/espacopessoal" } });
    },
    [navigate]
  );

  const loadData = React.useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchPersonalClinicalPortfolio(userId);
      setItems(data);
    } catch (err) {
      console.error("Erro ao carregar portfólio clínico:", err);
      setLoadError("Não foi possível carregar seu histórico clínico no momento.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (initialItems) {
      setItems(initialItems);
      return;
    }

    void loadData();
  }, [userId, initialItems, loadData]);

  // Unique clinics list for filtering
  const availableClinics = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (item.clinic_id && item.clinic_name) {
        map.set(item.clinic_id, item.clinic_name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  // Filter items
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return items.filter((item) => {
      // Clinic filter
      if (selectedClinicId !== "all" && item.clinic_id !== selectedClinicId) {
        return false;
      }

      // Keyword & date filter
      if (!query) return true;

      const inPseudonym = item.patient_pseudonym.toLowerCase().includes(query);
      const inClinic = item.clinic_name.toLowerCase().includes(query);
      const inNotes = (item.notes_sanitized || "").toLowerCase().includes(query);
      const inTreatment = (item.treatment_sanitized || "").toLowerCase().includes(query);
      const inDate = item.session_date.includes(query) || formatSessionDateTime(item.session_date).toLowerCase().includes(query);
      const inDemographics = item.patient_demographics.toLowerCase().includes(query);

      return inPseudonym || inClinic || inNotes || inTreatment || inDate || inDemographics;
    });
  }, [items, selectedClinicId, searchQuery]);

  // Aggregated metrics
  const metrics = useMemo(() => calculatePortfolioMetrics(items), [items]);

  const completedAttendancesCount = useMemo(() => {
    return items.filter(
      (item) => item.status.toLowerCase() === "concluído" || item.status.toLowerCase() === "concluido"
    ).length;
  }, [items]);

  return (
    <div className="w-full space-y-5" data-testid="personal-clinical-portfolio">
      {/* 1. Institutional Banner */}
      <div
        className="rounded-xl border border-sky-200/80 bg-gradient-to-r from-sky-50/90 via-sky-50/60 to-indigo-50/50 p-4 shadow-sm dark:border-sky-900/50 dark:from-sky-950/40 dark:via-sky-950/20 dark:to-indigo-950/20"
        role="region"
        aria-label="Acervo Técnico Profissional LGPD"
      >
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-600/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-1 text-sm">
            <h3 className="font-semibold text-sky-950 dark:text-sky-200">
              Acervo Técnico Profissional
            </h3>
            <p className="text-xs text-sky-900/80 dark:text-sky-300/80 leading-relaxed">
              Registro dos atendimentos e evoluções clínicas realizados sob sua responsabilidade técnica. Em conformidade com a LGPD e o Código de Ética Profissional, dados de contato e identificação civil de pacientes são pseudonimizados para resguardar a privacidade e a relação comercial dos estabelecimentos de saúde.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Aggregated Metrics Cards (Full Screen Mode: Total, Clinics, Completed) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-border/70 bg-card shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total de atendimentos</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-foreground" data-testid="metric-total-attendances">
                  {loading ? "..." : metrics.totalAttendances}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Activity className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Acervo técnico acumulado</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Clínicas de atuação</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-foreground" data-testid="metric-total-clinics">
                  {loading ? "..." : metrics.totalClinics}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Building2 className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Histórico de parcerias e unidades</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Atendimentos concluídos</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-foreground" data-testid="metric-completed-attendances">
                  {loading ? "..." : completedAttendancesCount}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Sessões finalizadas com conduta</p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Filters & Attendance List */}
      <Card className="overflow-hidden border-border/70">
        <CardHeader className="p-4 pb-3 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" />
                Histórico de Atendimentos & Evoluções
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Consulte condutas, prescrições e evoluções de atendimentos passados em modelo compacto.
              </p>
            </div>
            <Badge variant="secondary" className="w-fit">
              {filteredItems.length} {filteredItems.length === 1 ? "atendimento" : "atendimentos"}
            </Badge>
          </div>

          {/* Filter Bar */}
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por data, pseudônimo, conduta..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-sm h-9"
                data-testid="portfolio-search-input"
              />
            </div>

            <Select value={selectedClinicId} onValueChange={setSelectedClinicId}>
              <SelectTrigger className="h-9 text-sm" data-testid="clinic-filter-select">
                <div className="flex items-center gap-2 truncate">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Todas as clínicas" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as clínicas ({items.length})</SelectItem>
                {availableClinics.map((clinic) => (
                  <SelectItem key={clinic.id} value={clinic.id}>
                    {clinic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-3.5 pt-1 sm:p-6 sm:pt-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
              <p className="text-xs">Carregando acervo técnico seguro...</p>
            </div>
          ) : loadError && items.length === 0 ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center" data-testid="portfolio-error-state">
              <AlertCircle className="mx-auto mb-2.5 h-8 w-8 text-destructive/80" />
              <p className="text-sm font-medium text-foreground">Não foi possível carregar seu acervo técnico</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">{loadError}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 text-xs"
                onClick={() => void loadData()}
              >
                Tentar novamente
              </Button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center" data-testid="portfolio-empty-state">
              <UserCheck className="mx-auto mb-2.5 h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm font-medium text-foreground">
                {items.length === 0
                  ? "Nenhum atendimento encontrado no seu acervo"
                  : "Nenhum atendimento corresponde aos filtros aplicados"}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {items.length === 0
                  ? "Os atendimentos e evoluções clínicas realizados sob sua responsabilidade aparecerão automaticamente aqui."
                  : "Tente alterar os termos de busca ou remover o filtro de clínica."}
              </p>
              {items.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 text-xs"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedClinicId("all");
                  }}
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5" data-testid="portfolio-compact-list">
              {filteredItems.map((item) => (
                <PortfolioCompactSessionCard
                  key={item.id}
                  session={item}
                  baseSchema={baseSchema}
                  sessionGroups={item.tags}
                  onViewDetails={handleOpenSession}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
