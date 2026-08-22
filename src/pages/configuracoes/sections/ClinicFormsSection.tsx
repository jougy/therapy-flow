import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BookOpen,
  Calendar,
  ClipboardList,
  Clock,
  Download,
  Edit,
  FileText,
  Globe,
  Layers,
  Loader2,
  Plus,
  Printer,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  ANAMNESIS_TEMPLATE_IMPORT_MAX_BYTES,
  buildAnamnesisTemplateExchangeFileName,
  buildAnamnesisTemplateExchangePayload,
  isAnamnesisTemplateSchema,
  parseAnamnesisTemplateExchangePayload,
  sanitizeAnamnesisTemplateSchema,
  type AnamnesisTemplateSchema,
} from "@/lib/anamnesis-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ClinicFormAnalyticsDashboard, type SessionDataForAnalytics } from "@/components/anamnesis/ClinicFormAnalyticsDashboard";
import { PrintBlankKitModal } from "@/components/PrintBlankKitModal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  schema: AnamnesisTemplateSchema;
  is_active: boolean;
  is_system_default: boolean;
  created_at: string;
  updated_at: string;
}

interface SessionKpi {
  id: string;
  patient_id: string;
  provider_id?: string | null;
  session_date: string;
  status: string;
  user_id: string;
  anamnesis?: unknown;
  anamnesis_form_response?: unknown;
  pain_score?: number | null;
  complexity_score?: number | null;
  anamnesis_template_id?: string | null;
}

interface FormKpis {
  totalSessions: number;
  uniquePatients: number;
  last30Days: number;
  lastUsedDate: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const countFields = (schema: AnamnesisTemplateSchema): number =>
  schema.filter(
    (f) => f.type !== "section" && f.type !== "horizontal_section" && f.type !== "section_selector"
  ).length;

// Estimated seconds per field type for fill time calculation
const FIELD_FILL_SECONDS: Record<string, number> = {
  short_text: 25,
  long_text: 50,
  number: 10,
  date: 10,
  select: 10,
  multiple_choice: 12,
  checklist: 18,
  slider: 8,
  table: 90,
  address_block: 60,
  // containers don't add fill time
  section: 0,
  horizontal_section: 0,
  section_selector: 5,
};

const estimateFillTime = (schema: AnamnesisTemplateSchema): string => {
  const totalSeconds = schema.reduce(
    (acc, f) => acc + (FIELD_FILL_SECONDS[f.type] ?? 15),
    0
  );
  if (totalSeconds === 0) return "—";
  if (totalSeconds < 60) return `~${totalSeconds}s`;
  const minutes = Math.round(totalSeconds / 60);
  return `~${minutes} min`;
};

const computeKpis = (sessions: SessionKpi[]): FormKpis => {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const uniquePatients = new Set(sessions.map((s) => s.patient_id)).size;
  const last30Days = sessions.filter((s) => new Date(s.session_date) >= cutoff).length;
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime()
  );
  return {
    totalSessions: sessions.length,
    uniquePatients,
    last30Days,
    lastUsedDate: sorted[0]?.session_date ?? null,
  };
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "Ainda não usada";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, icon }) => (
  <div className="rounded-xl border bg-card p-4 space-y-1.5">
    <div className="flex items-center gap-2 text-muted-foreground">
      {icon}
      <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
    </div>
    <p className="text-2xl font-bold text-foreground">{value}</p>
  </div>
);

// ---------------------------------------------------------------------------
// StructurePanel — lista campos e seções de um schema
// ---------------------------------------------------------------------------

interface StructurePanelProps {
  schema: AnamnesisTemplateSchema;
}

const StructurePanel: React.FC<StructurePanelProps> = ({ schema }) => {
  if (schema.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhum campo cadastrado neste formulário ainda.
      </div>
    );
  }

  const typeLabel: Record<string, string> = {
    short_text: "Texto curto",
    long_text: "Texto longo",
    number: "Número",
    date: "Data",
    select: "Droplist",
    multiple_choice: "Múltipla escolha",
    checklist: "Checklist",
    slider: "Slidebar",
    section: "Seção sanfona",
    horizontal_section: "Seção horizontal",
    section_selector: "Seletor de seções",
    table: "Tabela dinâmica",
    address_block: "Bloco de endereço",
  };

  return (
    <div className="space-y-2">
      {schema.map((field, i) => {
        const isContainer =
          field.type === "section" ||
          field.type === "horizontal_section" ||
          field.type === "section_selector";
        return (
          <div
            key={field.id}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${isContainer ? "bg-muted/30 font-medium" : "bg-background"}`}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">
              {i + 1}
            </span>
            <span className="flex-1 truncate text-sm text-foreground">{field.label || "(sem rótulo)"}</span>
            <Badge variant="outline" className="text-[10px] shrink-0">
              {typeLabel[field.type] ?? field.type}
            </Badge>
            {field.required && (
              <Badge variant="secondary" className="text-[10px] shrink-0">
                Obrigatório
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const ClinicFormsSection = () => {
  const { clinic, clinicId, user, can } = useAuth();
  const navigate = useNavigate();
  const canManage = can("forms.manage");

  const clinicKey = clinic?.route_key ?? "";
  const clinicBasePath = clinicKey ? `/clinica/${clinicKey}` : "";
  const editorBasePath = `${clinicBasePath}/configuracoes/formularios`;

  // ---- State ---------------------------------------------------------------

  const [loading, setLoading] = useState(true);
  const [baseSchema, setBaseSchema] = useState<AnamnesisTemplateSchema>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [baseSessions, setBaseSessions] = useState<SessionKpi[]>([]);
  const [templateSessions, setTemplateSessions] = useState<Record<string, SessionKpi[]>>({});
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [importingTemplate, setImportingTemplate] = useState(false);

  const templateImportRef = useRef<HTMLInputElement | null>(null);
  const baseImportRef = useRef<HTMLInputElement | null>(null);

  // ---- Data loading --------------------------------------------------------

  const loadData = useCallback(async () => {
    if (!clinicId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [clinicRes, templatesRes, sessionsRes] = await Promise.all([
        supabase.from("clinics").select("anamnesis_base_schema").eq("id", clinicId).single(),
        supabase
          .from("anamnesis_form_templates")
          .select("id, name, description, schema, is_active, is_system_default, created_at, updated_at")
          .eq("clinic_id", clinicId)
          .eq("is_active", true)
          .order("created_at", { ascending: true }),
        supabase
          .from("sessions")
          .select(
            "id, patient_id, provider_id, session_date, status, user_id, anamnesis, anamnesis_form_response, pain_score, complexity_score, anamnesis_template_id"
          )
          .eq("clinic_id", clinicId)
          .in("status", ["concluído", "rascunho"]),
      ]);

      const rawBase = clinicRes.data?.anamnesis_base_schema;
      setBaseSchema(
        isAnamnesisTemplateSchema(rawBase) ? sanitizeAnamnesisTemplateSchema(rawBase) : []
      );

      const rawTemplates = (templatesRes.data ?? []) as TemplateRow[];
      const parsedTemplates: TemplateRow[] = rawTemplates.map((t) => ({
        ...t,
        schema: isAnamnesisTemplateSchema(t.schema) ? sanitizeAnamnesisTemplateSchema(t.schema) : [],
      }));
      setTemplates(parsedTemplates);

      const allSessions = (sessionsRes.data ?? []) as SessionKpi[];

      // Sessions with no template → used the base block
      const baseOnly = allSessions.filter((s) => !s.anamnesis_template_id);
      setBaseSessions(baseOnly);

      // Group sessions by template_id
      const grouped: Record<string, SessionKpi[]> = {};
      for (const s of allSessions) {
        if (s.anamnesis_template_id) {
          if (!grouped[s.anamnesis_template_id]) {
            grouped[s.anamnesis_template_id] = [];
          }
          grouped[s.anamnesis_template_id].push(s);
        }
      }
      setTemplateSessions(grouped);

      // Auto-select first template if none selected
      if (!selectedTemplateId && parsedTemplates.length > 0) {
        setSelectedTemplateId(parsedTemplates[0].id);
      }
    } catch (err) {
      console.error("Erro ao carregar formulários:", err);
      toast({
        title: "Erro ao carregar formulários",
        description: "Não foi possível carregar os dados de formulários.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [clinicId, selectedTemplateId]);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  // ---- Selected template ---------------------------------------------------

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  const selectedTemplateSessionData: SessionDataForAnalytics[] = useMemo(
    () => (selectedTemplateId ? (templateSessions[selectedTemplateId] ?? []) : []),
    [selectedTemplateId, templateSessions]
  );

  const baseSessionData: SessionDataForAnalytics[] = useMemo(
    () => baseSessions,
    [baseSessions]
  );

  const baseKpis = useMemo(() => computeKpis(baseSessions), [baseSessions]);

  const selectedKpis = useMemo(
    () =>
      selectedTemplateId
        ? computeKpis(templateSessions[selectedTemplateId] ?? [])
        : { totalSessions: 0, uniquePatients: 0, last30Days: 0, lastUsedDate: null },
    [selectedTemplateId, templateSessions]
  );

  // ---- Export --------------------------------------------------------------

  const handleExport = useCallback(
    (schema: AnamnesisTemplateSchema, name: string, description: string | null, kind: "base" | "template") => {
      if (!schema || schema.length === 0) {
        toast({
          title: "Não foi possível exportar",
          description: "Este formulário não possui campos cadastrados.",
          variant: "destructive",
        });
        return;
      }
      const payload = buildAnamnesisTemplateExchangePayload({ description, kind, name, schema });
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

  // ---- Import template -----------------------------------------------------

  const handleImportTemplateFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !clinicId || !user?.id) return;

      if (file.size > ANAMNESIS_TEMPLATE_IMPORT_MAX_BYTES) {
        toast({ title: "Arquivo muito grande", description: "O arquivo de modelo é muito grande.", variant: "destructive" });
        return;
      }

      setImportingTemplate(true);
      try {
        const raw = await file.text();
        const imported = parseAnamnesisTemplateExchangePayload(raw);

        if (imported.kind === "base") {
          const { error } = await supabase
            .from("clinics")
            .update({ anamnesis_base_schema: imported.template.schema })
            .eq("id", clinicId);
          if (error) throw error;
          toast({
            title: "Bloco padrão importado",
            description: `A estrutura "${imported.template.name}" foi aplicada ao bloco padrão universal.`,
          });
        } else {
          const { data: inserted, error } = await supabase
            .from("anamnesis_form_templates")
            .insert({
              clinic_id: clinicId,
              description: imported.template.description?.trim() || null,
              is_active: true,
              is_system_default: false,
              name: imported.template.name.trim(),
              schema: imported.template.schema,
              user_id: user.id,
            })
            .select("id")
            .single();
          if (error) throw error;
          if (inserted?.id) setSelectedTemplateId(inserted.id);
          toast({
            title: "Modelo importado",
            description: `A ficha "${imported.template.name}" foi criada com sucesso.`,
          });
        }
        await loadData();
      } catch (err) {
        toast({
          title: "Erro ao importar modelo",
          description: err instanceof Error ? err.message : "Não foi possível importar este arquivo.",
          variant: "destructive",
        });
      } finally {
        setImportingTemplate(false);
      }
    },
    [clinicId, user?.id, loadData]
  );

  // ---- Delete --------------------------------------------------------------

  const confirmDelete = useCallback((templateId: string) => {
    setDeletingId(templateId);
    setDeleteDialogOpen(true);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("anamnesis_form_templates")
        .update({ is_active: false })
        .eq("id", deletingId);
      if (error) throw error;
      if (selectedTemplateId === deletingId) setSelectedTemplateId(null);
      toast({ title: "Ficha removida", description: "A ficha complementar foi desativada com sucesso." });
      await loadData();
    } catch (err) {
      toast({
        title: "Erro ao excluir ficha",
        description: err instanceof Error ? err.message : "Não foi possível remover esta ficha.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  }, [deletingId, selectedTemplateId, loadData]);

  // ---- Render loading ------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const deletingTemplateName = templates.find((t) => t.id === deletingId)?.name ?? "esta ficha";

  // ---- Render --------------------------------------------------------------

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={templateImportRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(e) => void handleImportTemplateFile(e)}
      />
      <input
        ref={baseImportRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(e) => void handleImportTemplateFile(e)}
      />

      {/* Print modal */}
      <PrintBlankKitModal
        open={printModalOpen}
        onOpenChange={setPrintModalOpen}
        defaultTemplateId={selectedTemplateId}
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ficha complementar?</AlertDialogTitle>
            <AlertDialogDescription>
              A ficha <strong>"{deletingTemplateName}"</strong> será desativada. Os atendimentos já realizados
              com ela serão preservados, mas ela não estará mais disponível para novos atendimentos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir ficha
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-6">
        {/* ====== Page Header ====== */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gerenciar formulários</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Edite o bloco-base universal da anamnese e mantenha as fichas extras usadas nos atendimentos.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-2 border-primary/40 text-primary hover:bg-primary/10"
            >
              <Link to={`${editorBasePath}/biblioteca`}>
                <BookOpen className="h-4 w-4" />
                <span>Biblioteca de Modelos</span>
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setPrintModalOpen(true)}
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Imprimir ficha em branco</span>
              <span className="sm:hidden">Imprimir</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={importingTemplate}
              onClick={() => templateImportRef.current?.click()}
            >
              {importingTemplate ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Importar arquivo
            </Button>
            {canManage && (
              <Button asChild size="sm" className="gap-2">
                <Link to={`${editorBasePath}/novo`}>
                  <Plus className="h-4 w-4" />
                  Nova ficha
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* ====== Main Tabs ====== */}
        <Tabs defaultValue="base" className="space-y-6">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="base" className="gap-2 flex-1 sm:flex-none">
              <Sparkles className="h-4 w-4" />
              Bloco Padrão Universal
            </TabsTrigger>
            <TabsTrigger value="extras" className="gap-2 flex-1 sm:flex-none">
              <ClipboardList className="h-4 w-4" />
              Fichas Complementares
              {templates.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">
                  {templates.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ==================== ABA: BLOCO PADRÃO ==================== */}
          <TabsContent value="base" className="space-y-6">
            {/* Description */}
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Bloco padrão universal</span> — Esta é a
                primeira parte obrigatória da anamnese, aplicada em{" "}
                <em>todas</em> as fichas da clínica antes de qualquer ficha complementar.
              </p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard
                label="Atendimentos"
                value={baseKpis.totalSessions}
                icon={<Activity className="h-4 w-4" />}
              />
              <KpiCard
                label="Pacientes únicos"
                value={baseKpis.uniquePatients}
                icon={<Users className="h-4 w-4" />}
              />
              <KpiCard
                label="Últimos 30 dias"
                value={baseKpis.last30Days}
                icon={<Calendar className="h-4 w-4" />}
              />
              <KpiCard
                label="Último uso"
                value={formatDate(baseKpis.lastUsedDate)}
                icon={<Clock className="h-4 w-4" />}
              />
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={baseSchema.length === 0}
                onClick={() =>
                  handleExport(baseSchema, "Bloco padrão universal", "Estrutura obrigatória aplicada antes das fichas extras.", "base")
                }
              >
                <Download className="h-4 w-4" />
                Exportar modelo
              </Button>
              {canManage && (
                <Button asChild variant="outline" size="sm" className="gap-2">
                  <Link to={`${editorBasePath}/base`}>
                    <Edit className="h-4 w-4" />
                    Editar bloco padrão
                  </Link>
                </Button>
              )}
            </div>

            {/* Inner tabs: Analytics | Structure */}
            <Tabs defaultValue="analytics">
              <TabsList>
                <TabsTrigger value="analytics" className="gap-2">
                  <Activity className="h-4 w-4" />
                  Resumo das Respostas
                </TabsTrigger>
                <TabsTrigger value="structure" className="gap-2">
                  <Layers className="h-4 w-4" />
                  Estrutura da ficha
                  <Badge variant="outline" className="ml-1 text-[10px] h-4 px-1">
                    {countFields(baseSchema)} campos
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="analytics" className="mt-4">
                <ClinicFormAnalyticsDashboard
                  templateName="Bloco padrão universal"
                  schema={baseSchema}
                  sessions={baseSessionData}
                />
              </TabsContent>

              <TabsContent value="structure" className="mt-4">
                <StructurePanel schema={baseSchema} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ==================== ABA: FICHAS COMPLEMENTARES ==================== */}
          <TabsContent value="extras" className="space-y-6">
            {templates.length === 0 ? (
              /* Empty state */
              <Card className="border-dashed border-2">
                <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
                  <div className="rounded-2xl bg-primary/10 p-4 text-primary">
                    <FileText className="h-8 w-8" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-foreground">
                      Nenhuma ficha complementar criada ainda
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Crie fichas extras personalizadas para diferentes tipos de atendimento ou especialidades
                      da sua equipe.
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap gap-2 justify-center">
                      <Button asChild className="gap-2">
                        <Link to={`${editorBasePath}/novo`}>
                          <Plus className="h-4 w-4" />
                          Nova ficha
                        </Link>
                      </Button>
                      <Button asChild variant="outline" className="gap-2 border-primary/30 text-primary">
                        <Link to={`${editorBasePath}/biblioteca`}>
                          <BookOpen className="h-4 w-4" />
                          Explorar Biblioteca
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => templateImportRef.current?.click()}
                      >
                        <Upload className="h-4 w-4" />
                        Importar arquivo
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Selector grid */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Fichas extras
                  </p>
                  <div className="space-y-2">
                    {templates.map((t) => {
                      const sessionCount = (templateSessions[t.id] ?? []).length;
                      const isSelected = t.id === selectedTemplateId;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTemplateId(t.id)}
                          className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors hover:bg-muted/40 ${
                            isSelected
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "bg-card"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">{t.name}</p>
                            {t.description && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{t.description}</p>
                            )}
                          </div>
                          <Badge variant={isSelected ? "default" : "outline"} className="shrink-0 ml-3">
                            {sessionCount} {sessionCount === 1 ? "uso" : "usos"}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected template detail */}
                {selectedTemplate && (
                  <Card>
                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <CardTitle className="text-lg">{selectedTemplate.name}</CardTitle>
                        {selectedTemplate.description && (
                          <CardDescription className="mt-1">
                            {selectedTemplate.description}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => setPrintModalOpen(true)}
                        >
                          <Printer className="h-4 w-4" />
                          Imprimir em branco
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={selectedTemplate.schema.length === 0}
                          onClick={() =>
                            handleExport(
                              selectedTemplate.schema,
                              selectedTemplate.name,
                              selectedTemplate.description,
                              "template"
                            )
                          }
                        >
                          <Download className="h-4 w-4" />
                          Exportar modelo
                        </Button>
                        {canManage && (
                          <>
                            <Button asChild variant="outline" size="sm" className="gap-2">
                              <Link to={`${editorBasePath}/${selectedTemplate.id}`}>
                                <Edit className="h-4 w-4" />
                                Editar
                              </Link>
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="gap-2"
                              onClick={() => confirmDelete(selectedTemplate.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Excluir
                            </Button>
                          </>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                      {/* Template KPIs */}
                      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <KpiCard
                          label="Usos"
                          value={selectedKpis.totalSessions}
                          icon={<Activity className="h-4 w-4" />}
                        />
                        <KpiCard
                          label="Pacientes únicos"
                          value={selectedKpis.uniquePatients}
                          icon={<Users className="h-4 w-4" />}
                        />
                        <KpiCard
                          label="Campos"
                          value={countFields(selectedTemplate.schema)}
                          icon={<FileText className="h-4 w-4" />}
                        />
                        <KpiCard
                          label="Tempo médio"
                          value={estimateFillTime(selectedTemplate.schema)}
                          icon={<Clock className="h-4 w-4" />}
                        />
                      </div>

                      {/* Inner tabs */}
                      <Tabs defaultValue="analytics">
                        <TabsList>
                          <TabsTrigger value="analytics" className="gap-2">
                            <Activity className="h-4 w-4" />
                            Resumo das Respostas
                          </TabsTrigger>
                          <TabsTrigger value="structure" className="gap-2">
                            <Layers className="h-4 w-4" />
                            Estrutura da ficha
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent value="analytics" className="mt-4">
                          <ClinicFormAnalyticsDashboard
                            templateName={selectedTemplate.name}
                            schema={selectedTemplate.schema}
                            sessions={selectedTemplateSessionData}
                          />
                        </TabsContent>
                        <TabsContent value="structure" className="mt-4">
                          <StructurePanel schema={selectedTemplate.schema} />
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};
