import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Download,
  Filter,
  Globe,
  Layers,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useClinicPlanQuota } from "@/hooks/useClinicPlanQuota";
import { supabase } from "@/integrations/supabase/client";
import {
  COMMUNITY_FORM_CATEGORIES,
  type CommunityFormCategory,
  type CommunityFormTemplate,
  fetchCommunityFormTemplates,
  importCommunityTemplateToClinic,
  deleteCommunityTemplate,
} from "@/lib/community-forms";
import {
  isAnamnesisTemplateSchema,
  sanitizeAnamnesisTemplateSchema,
  type AnamnesisTemplateSchema,
} from "@/lib/anamnesis-forms";
import { CommunityFormCard } from "@/components/community-forms/CommunityFormCard";
import { FormLibraryPreviewModal } from "@/components/community-forms/FormLibraryPreviewModal";
import {
  PublishFormTemplateModal,
  type AvailableClinicTemplateOption,
} from "@/components/community-forms/PublishFormTemplateModal";

export const BibliotecaFormularios = () => {
  const { clinic, clinicId, user, can } = useAuth();
  const quota = useClinicPlanQuota(clinicId);
  const navigate = useNavigate();
  const canManage = can("forms.manage");

  const clinicKey = clinic?.route_key ?? "";
  const clinicBasePath = clinicKey ? `/clinica/${clinicKey}` : "";
  const formsManagerPath = `${clinicBasePath}/configuracoes/formularios`;

  // State
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<CommunityFormTemplate[]>([]);
  const [myTemplates, setMyTemplates] = useState<CommunityFormTemplate[]>([]);
  const [availableClinicTemplates, setAvailableClinicTemplates] = useState<AvailableClinicTemplateOption[]>([]);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todas");
  const [sortBy, setSortBy] = useState<"popular" | "imports" | "recent">("popular");
  const [activeTab, setActiveTab] = useState<"community" | "my-templates">("community");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Modals
  const [previewTemplate, setPreviewTemplate] = useState<CommunityFormTemplate | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);

  // Import Dialog
  const [importingTemplate, setImportingTemplate] = useState<CommunityFormTemplate | null>(null);
  const [importCustomTitle, setImportCustomTitle] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccessId, setImportSuccessId] = useState<string | null>(null);

  // Delete Dialog (for author deleting published template)
  const [deletingTemplate, setDeletingTemplate] = useState<CommunityFormTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load clinic templates (to enable publishing)
  const loadClinicTemplates = useCallback(async () => {
    if (!clinicId) return;

    try {
      const [clinicRes, templatesRes] = await Promise.all([
        supabase.from("clinics").select("anamnesis_base_schema").eq("id", clinicId).single(),
        supabase
          .from("anamnesis_form_templates")
          .select("id, name, description, schema")
          .eq("clinic_id", clinicId)
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ]);

      const list: AvailableClinicTemplateOption[] = [];

      const rawBase = clinicRes.data?.anamnesis_base_schema;
      if (isAnamnesisTemplateSchema(rawBase) && rawBase.length > 0) {
        list.push({
          id: "base_universal",
          name: "Bloco Padrão Universal",
          description: "Estrutura obrigatória aplicada em todas as anamneses.",
          schema: sanitizeAnamnesisTemplateSchema(rawBase),
          kind: "base",
        });
      }

      const rows = (templatesRes.data ?? []) as Array<{
        id: string;
        name: string;
        description: string | null;
        schema: unknown;
      }>;

      rows.forEach((row) => {
        if (isAnamnesisTemplateSchema(row.schema) && row.schema.length > 0) {
          list.push({
            id: row.id,
            name: row.name,
            description: row.description,
            schema: sanitizeAnamnesisTemplateSchema(row.schema),
            kind: "template",
          });
        }
      });

      setAvailableClinicTemplates(list);
    } catch (err) {
      console.warn("Erro ao carregar formulários locais da clínica:", err);
    }
  }, [clinicId]);

  // Load Community Templates
  const loadCommunityData = useCallback(async () => {
    setLoading(true);
    try {
      const communityData = await fetchCommunityFormTemplates({
        currentAuthUserId: user?.id,
      });
      setTemplates(communityData);

      if (user?.id) {
        // Instant in-memory derivation (0 duplicate network requests)
        const myData = communityData.filter((t) => t.user_id === user.id);
        setMyTemplates(myData);
      }
    } catch (err) {
      console.error("Erro ao carregar biblioteca comunitária:", err);
      toast({
        title: "Erro ao carregar biblioteca",
        description: "Não foi possível carregar os modelos da comunidade.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadCommunityData();
    void loadClinicTemplates();
  }, [loadCommunityData, loadClinicTemplates]);

  // Filtered and sorted community templates
  const filteredTemplates = useMemo(() => {
    let result = [...templates];

    if (selectedCategory && selectedCategory !== "Todas") {
      result = result.filter((t) => t.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          t.author_name.toLowerCase().includes(q) ||
          (t.clinic_name && t.clinic_name.toLowerCase().includes(q)) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      if (sortBy === "popular") {
        return b.likes_count - a.likes_count || b.imports_count - a.imports_count;
      }
      if (sortBy === "imports") {
        return b.imports_count - a.imports_count;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [templates, selectedCategory, searchQuery, sortBy]);

  // Actions
  const handleOpenPreview = (template: CommunityFormTemplate) => {
    setPreviewTemplate(template);
    setPreviewOpen(true);
  };

  const handleStartImport = (template: CommunityFormTemplate) => {
    if (quota.isFreeTrial && quota.forms.isLimitReached) {
      toast({
        title: "Limite de Formulários Atingido",
        description: `O plano de teste grátis permite até ${quota.forms.max} modelo de formulário personalizado ativo. Faça o upgrade para criar modelos ilimitados.`,
        variant: "destructive",
      });
      return;
    }
    setImportingTemplate(template);
    setImportCustomTitle(template.title);
    setImportSuccessId(null);
  };

  const handleConfirmImport = async () => {
    if (!importingTemplate || !clinicId || !user?.id) return;

    setIsImporting(true);
    try {
      const res = await importCommunityTemplateToClinic({
        communityTemplate: importingTemplate,
        targetClinicId: clinicId,
        userId: user.id,
        customTitle: importCustomTitle,
      });

      if (!res.success) {
        throw new Error(res.error || "Erro ao importar modelo.");
      }

      setImportSuccessId(res.newTemplateId || "base");

      // Update local import count in list
      setTemplates((prev) =>
        prev.map((t) => (t.id === importingTemplate.id ? { ...t, imports_count: t.imports_count + 1 } : t))
      );

      toast({
        title: "Modelo importado com sucesso!",
        description: `O formulário "${importCustomTitle || importingTemplate.title}" foi adicionado à sua clínica.`,
      });

      // Reload local templates
      void loadClinicTemplates();
    } catch (err) {
      toast({
        title: "Erro ao importar",
        description: err instanceof Error ? err.message : "Não foi possível importar o formulário.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTemplate) return;
    setIsDeleting(true);
    try {
      const success = await deleteCommunityTemplate(deletingTemplate.id);
      if (!success) throw new Error("Erro ao excluir publicação.");

      setTemplates((prev) => prev.filter((t) => t.id !== deletingTemplate.id));
      setMyTemplates((prev) => prev.filter((t) => t.id !== deletingTemplate.id));

      toast({
        title: "Publicação removida",
        description: "O modelo foi removido da biblioteca pública da comunidade.",
      });
    } catch (err) {
      toast({
        title: "Erro ao excluir",
        description: err instanceof Error ? err.message : "Não foi possível excluir o modelo.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeletingTemplate(null);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* ====== Top Navigation Bar ====== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div className="space-y-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="gap-2 text-xs text-muted-foreground hover:text-foreground pl-0 -ml-2 mb-1"
          >
            <Link to={formsManagerPath}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar ao Gerenciador de Formulários
            </Link>
          </Button>

          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Biblioteca de Modelos de Formulários
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Explore modelos criados pela comunidade, compartilhe suas fichas e importe com 1 clique para sua clínica.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canManage && (
            <Button
              onClick={() => setPublishModalOpen(true)}
              size="sm"
              className="gap-2 shadow-xs bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Publicar Modelo
            </Button>
          )}
        </div>
      </div>

      {/* ====== Modals ====== */}
      <FormLibraryPreviewModal
        template={previewTemplate}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onImport={handleStartImport}
      />

      <PublishFormTemplateModal
        open={publishModalOpen}
        onOpenChange={setPublishModalOpen}
        availableTemplates={availableClinicTemplates}
        onSuccess={(created) => {
          setTemplates((prev) => [created, ...prev]);
          setMyTemplates((prev) => [created, ...prev]);
        }}
      />

      {/* Import Confirmation Dialog */}
      <Dialog open={!!importingTemplate} onOpenChange={(open) => !open && setImportingTemplate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Importar Modelo para sua Clínica
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {importingTemplate?.kind === "base"
                ? "Este modelo é um Bloco Padrão Universal e atualizará o bloco base universal da clínica."
                : "Uma cópia completa deste formulário será criada nas fichas complementares da sua clínica."}
            </DialogDescription>
          </DialogHeader>

          {importSuccessId ? (
            <div className="py-6 text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-foreground">Importação concluída!</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  O formulário está pronto para ser usado ou customizado no seu editor.
                </p>
              </div>

              <div className="flex justify-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setImportingTemplate(null)}
                >
                  Continuar Explorando
                </Button>
                {importSuccessId !== "base" ? (
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground"
                    asChild
                  >
                    <Link to={`${clinicBasePath}/configuracoes/formularios/${importSuccessId}`}>
                      Abrir no Editor
                    </Link>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground"
                    asChild
                  >
                    <Link to={`${clinicBasePath}/configuracoes/formularios/base`}>
                      Ver Bloco Universal
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border bg-muted/30 p-3 text-xs space-y-1">
                <p className="font-semibold text-foreground">{importingTemplate?.title}</p>
                <p className="text-muted-foreground">
                  Categoria: <strong>{importingTemplate?.category}</strong> • Autor: {importingTemplate?.author_name}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Nome da ficha na sua clínica
                </label>
                <Input
                  value={importCustomTitle}
                  onChange={(e) => setImportCustomTitle(e.target.value)}
                  placeholder="Nome do formulário..."
                  maxLength={100}
                />
              </div>

              <DialogFooter className="pt-2 flex flex-row items-center justify-between sm:justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setImportingTemplate(null)}
                  disabled={isImporting}
                >
                  Cancelar
                </Button>

                <Button
                  size="sm"
                  onClick={handleConfirmImport}
                  disabled={isImporting || !importCustomTitle.trim()}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Confirmar Importação
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingTemplate} onOpenChange={(open) => !open && setDeletingTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover da Biblioteca Pública?</AlertDialogTitle>
            <AlertDialogDescription>
              O modelo <strong>"{deletingTemplate?.title}"</strong> será despublicado da comunidade.
              Clínicas que já importaram uma cópia continuarão com suas fichas intactas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmDelete()}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remover da Comunidade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ====== Main Content with Tabs ====== */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "community" | "my-templates")}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="community" className="gap-2 flex-1 sm:flex-none">
              <Globe className="h-4 w-4" />
              Explorar Comunidade
              {templates.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">
                  {templates.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="my-templates" className="gap-2 flex-1 sm:flex-none">
              <UserCheck className="h-4 w-4" />
              Meus Modelos Publicados
              {myTemplates.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">
                  {myTemplates.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Search & Sort Controls (shown on community tab) */}
          {activeTab === "community" && (
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por título, tag..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-xs h-9"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0 bg-muted/60 p-1 rounded-lg border">
                <button
                  type="button"
                  onClick={() => setSortBy("popular")}
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                    sortBy === "popular" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground"
                  }`}
                >
                  Populares
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy("imports")}
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                    sortBy === "imports" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground"
                  }`}
                >
                  Importados
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy("recent")}
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                    sortBy === "recent" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground"
                  }`}
                >
                  Recentes
                </button>
              </div>

              {/* View Mode Toggle: Grid vs List */}
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === "grid" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Visão em Matriz (Cards com Wireframe)"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === "list" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Visão em Lista Detalhada"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ================= ABA 1: EXPLORAR COMUNIDADE ================= */}
        <TabsContent value="community" className="space-y-6 mt-0">
          {/* Category Chips Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            <button
              type="button"
              onClick={() => setSelectedCategory("Todas")}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all ${
                selectedCategory === "Todas"
                  ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              Todas as Áreas
            </button>
            {COMMUNITY_FORM_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all ${
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid or List of Templates */}
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-12 text-center space-y-3 bg-muted/10">
              <BookOpen className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">
                  Nenhum modelo encontrado
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Tente alterar os termos de busca ou selecione outra categoria de especialidade.
                </p>
              </div>
              {(searchQuery || selectedCategory !== "Todas") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("Todas");
                  }}
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTemplates.map((template) => (
                <CommunityFormCard
                  key={template.id}
                  template={template}
                  onPreview={handleOpenPreview}
                  onOpenDetail={() => navigate(`${clinicBasePath}/configuracoes/formularios/biblioteca/${template.id}`)}
                  onImport={handleStartImport}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                    <th className="py-3 px-4">Modelo & Categoria</th>
                    <th className="py-3 px-4">Autor & Origem</th>
                    <th className="py-3 px-4 text-center">Campos</th>
                    <th className="py-3 px-4 text-center">Usos</th>
                    <th className="py-3 px-4 text-center">Curtidas</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTemplates.map((template) => {
                    const count = template.fields_count || template.schema?.length || 0;

                    return (
                      <tr
                        key={template.id}
                        onClick={() => navigate(`${clinicBasePath}/configuracoes/formularios/biblioteca/${template.id}`)}
                        className="hover:bg-muted/20 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4 max-w-[280px]">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary/30 text-primary">
                              {template.category}
                            </Badge>
                            {template.is_featured && (
                              <Badge className="bg-amber-500 text-[9px] py-0 px-1 text-white gap-0.5">
                                <Sparkles className="h-2.5 w-2.5" /> Destaque
                              </Badge>
                            )}
                          </div>
                          <p className="font-semibold text-sm text-foreground truncate">{template.title}</p>
                          {template.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                              {template.description}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground">
                          <p className="font-medium text-foreground">{template.author_name}</p>
                          {template.clinic_name && <p className="text-[11px]">{template.clinic_name}</p>}
                        </td>
                        <td className="py-3.5 px-4 text-center font-medium">{count}</td>
                        <td className="py-3.5 px-4 text-center font-medium">{template.imports_count}</td>
                        <td className="py-3.5 px-4 text-center font-semibold text-rose-500">{template.likes_count}</td>
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              asChild
                            >
                              <Link to={`${clinicBasePath}/configuracoes/formularios/biblioteca/${template.id}`}>
                                Ver Detalhes
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              className="h-8 text-xs gap-1 bg-primary text-primary-foreground"
                              onClick={() => handleStartImport(template)}
                            >
                              <Download className="h-3.5 w-3.5" />
                              Importar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ================= ABA 2: MEUS MODELOS PUBLICADOS ================= */}
        <TabsContent value="my-templates" className="space-y-6 mt-0">
          {myTemplates.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-12 text-center space-y-4 bg-muted/10">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                <Globe className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">
                  Você ainda não publicou nenhum modelo
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Compartilhe suas fichas clínicas com a comunidade. Seus modelos ficarão disponíveis para outros profissionais importarem.
                </p>
              </div>
              {canManage && (
                <Button
                  onClick={() => setPublishModalOpen(true)}
                  size="sm"
                  className="gap-2 bg-primary text-primary-foreground"
                >
                  <Plus className="h-4 w-4" />
                  Publicar meu primeiro modelo
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {myTemplates.map((template) => (
                <CommunityFormCard
                  key={template.id}
                  template={template}
                  isOwner={true}
                  onPreview={handleOpenPreview}
                  onImport={handleStartImport}
                  onDelete={(t) => setDeletingTemplate(t)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BibliotecaFormularios;
