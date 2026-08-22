import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Download,
  Edit,
  Eye,
  EyeOff,
  Filter,
  Heart,
  Layers,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  COMMUNITY_FORM_CATEGORIES,
  type CommunityFormCategory,
  type CommunityFormTemplate,
  fetchAdminCommunityFormTemplates,
  updateCommunityTemplateByAdmin,
  adminCreateOfficialTemplate,
  deleteCommunityTemplate,
} from "@/lib/community-forms";
import { FormLibraryPreviewModal } from "@/components/community-forms/FormLibraryPreviewModal";
import { CommunityFormCard } from "@/components/community-forms/CommunityFormCard";

const ARCHETYPE_SCHEMAS: Record<string, AnamnesisTemplateSchema> = {
  Psicologia: [
    { id: "sec_motivo", label: "1. Motivo da Consulta e Queixa Atual", type: "section" },
    { id: "campo_queixa", label: "Descrição da queixa principal", type: "long_text", required: true, groupKey: "sec_motivo" },
    { id: "campo_gatilhos", label: "Gatilhos emocionais e sintomas", type: "long_text", groupKey: "sec_motivo" },
    { id: "campo_ansiedade", label: "Nível de ansiedade (0 a 10)", type: "slider", min: 0, max: 10, groupKey: "sec_motivo" },
    { id: "sec_metas", label: "2. Objetivos e Metas Terapêuticas", type: "section" },
    { id: "campo_metas", label: "Expectativas com o processo", type: "long_text", groupKey: "sec_metas" },
  ],
  Fisioterapia: [
    { id: "sec_dor", label: "1. Avaliação da Dor e Queixa Ortopédica", type: "section" },
    { id: "campo_local", label: "Localização anatômica da dor", type: "short_text", required: true, groupKey: "sec_dor" },
    { id: "campo_eva", label: "Escala EVA de Dor (0 a 10)", type: "slider", min: 0, max: 10, groupKey: "sec_dor" },
    { id: "sec_exame", label: "2. Exame Físico e Amplitude de Movimento", type: "section" },
    { id: "campo_palpacao", label: "Achados palpatórios e musculares", type: "long_text", groupKey: "sec_exame" },
  ],
  Fonoaudiologia: [
    { id: "sec_fala", label: "1. Desenvolvimento da Fala e Linguagem", type: "section" },
    { id: "campo_marcos", label: "Marcos do desenvolvimento comunicativo", type: "long_text", groupKey: "sec_fala" },
    { id: "campo_habitos", label: "Hábitos orais deletérios", type: "checklist", groupKey: "sec_fala", options: [{ id: "opt1", label: "Chupeta" }, { id: "opt2", label: "Mamadeira" }, { id: "opt3", label: "Respiração Oral" }] },
  ],
  "Terapia Ocupacional": [
    { id: "sec_avd", label: "1. Atividades de Vida Diária (AVDs)", type: "section" },
    { id: "campo_independencia", label: "Grau de independência funcional", type: "select", groupKey: "sec_avd", options: [{ id: "indep", label: "Totalmente Independente" }, { id: "parcial", label: "Ajuda Parcial" }, { id: "depend", label: "Totalmente Dependente" }] },
    { id: "campo_rotina", label: "Estrutura da rotina diária", type: "long_text", groupKey: "sec_avd" },
  ],
  Nutrição: [
    { id: "sec_nutri", label: "1. Hábitos Alimentares e Recordatório", type: "section" },
    { id: "campo_agua", label: "Ingestão média diária de água (L)", type: "number", groupKey: "sec_nutri" },
    { id: "campo_alergias", label: "Alergias ou intolerâncias", type: "long_text", groupKey: "sec_nutri" },
    { id: "campo_meta", label: "Objetivo nutricional principal", type: "short_text", required: true, groupKey: "sec_nutri" },
  ],
  Geral: [
    { id: "sec_geral", label: "1. Identificação e Queixa Clínica", type: "section" },
    { id: "campo_queixa_geral", label: "Queixa principal do paciente", type: "long_text", required: true, groupKey: "sec_geral" },
    { id: "campo_historico", label: "Histórico de saúde e comorbidades", type: "long_text", groupKey: "sec_geral" },
  ],
};

export const PlatformFormLibraryManager = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<CommunityFormTemplate[]>([]);

  // Search and Filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("Todas");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "unpublished" | "featured">("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Modals & Actions
  const [previewTemplate, setPreviewTemplate] = useState<CommunityFormTemplate | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Edit / Create Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState<CommunityFormCategory>("Geral");
  const [formAuthor, setFormAuthor] = useState("Equipe Pluri-Health");
  const [formClinic, setFormClinic] = useState("Comunidade Oficial");
  const [formTags, setFormTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [formIsFeatured, setFormIsFeatured] = useState(false);
  const [formIsPublished, setFormIsPublished] = useState(true);
  const [schemaSource, setSchemaSource] = useState<"archetype" | "json">("archetype");
  const [customJsonInput, setCustomJsonInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Delete State
  const [deletingTemplate, setDeletingTemplate] = useState<CommunityFormTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load Admin Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminCommunityFormTemplates();
      setTemplates(data);
    } catch (err) {
      console.error("Erro ao carregar formulários no backoffice:", err);
      toast({
        title: "Erro ao carregar biblioteca",
        description: "Não foi possível carregar os modelos administrativos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (category !== "Todas" && t.category !== category) return false;

      if (statusFilter === "published" && !t.is_published) return false;
      if (statusFilter === "unpublished" && t.is_published) return false;
      if (statusFilter === "featured" && !t.is_featured) return false;

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q) ?? false;
        const matchAuthor = t.author_name.toLowerCase().includes(q);
        const matchClinic = t.clinic_name?.toLowerCase().includes(q) ?? false;
        const matchTags = t.tags.some((tag) => tag.toLowerCase().includes(q));
        if (!matchTitle && !matchDesc && !matchAuthor && !matchClinic && !matchTags) {
          return false;
        }
      }

      return true;
    });
  }, [templates, category, statusFilter, search]);

  // KPIs
  const kpis = useMemo(() => {
    const total = templates.length;
    const totalImports = templates.reduce((acc, t) => acc + (t.imports_count || 0), 0);
    const totalLikes = templates.reduce((acc, t) => acc + (t.likes_count || 0), 0);
    const totalFeatured = templates.filter((t) => t.is_featured).length;
    const totalPublished = templates.filter((t) => t.is_published).length;

    return { total, totalImports, totalLikes, totalFeatured, totalPublished };
  }, [templates]);

  // Quick Action: Toggle Featured
  const handleToggleFeatured = async (template: CommunityFormTemplate) => {
    const nextValue = !template.is_featured;
    try {
      const res = await updateCommunityTemplateByAdmin(template.id, { is_featured: nextValue });
      if (!res.success) throw new Error(res.error);

      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, is_featured: nextValue } : t))
      );

      toast({
        title: nextValue ? "Modelo adicionado aos destaques" : "Modelo removido dos destaques",
        description: `O modelo "${template.title}" foi ${nextValue ? "fixado como destaque" : "desafixado"}.`,
      });
    } catch (err) {
      toast({
        title: "Erro ao alternar destaque",
        description: err instanceof Error ? err.message : "Falha na atualização.",
        variant: "destructive",
      });
    }
  };

  // Quick Action: Toggle Published / Moderation
  const handleTogglePublished = async (template: CommunityFormTemplate) => {
    const nextValue = !template.is_published;
    try {
      const res = await updateCommunityTemplateByAdmin(template.id, { is_published: nextValue });
      if (!res.success) throw new Error(res.error);

      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, is_published: nextValue } : t))
      );

      toast({
        title: nextValue ? "Modelo republicado" : "Modelo ocultado pela moderação",
        description: `Visibilidade de "${template.title}" alterada com sucesso.`,
      });
    } catch (err) {
      toast({
        title: "Erro ao moderar modelo",
        description: err instanceof Error ? err.message : "Falha na atualização.",
        variant: "destructive",
      });
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (template: CommunityFormTemplate) => {
    setIsEditingExisting(true);
    setEditingTemplateId(template.id);
    setFormTitle(template.title);
    setFormDescription(template.description || "");
    setFormCategory(template.category);
    setFormAuthor(template.author_name);
    setFormClinic(template.clinic_name || "");
    setFormTags(template.tags || []);
    setFormIsFeatured(template.is_featured);
    setFormIsPublished(template.is_published);
    setEditModalOpen(true);
  };

  // Open Create Official Modal
  const handleOpenCreateOfficial = () => {
    setIsEditingExisting(false);
    setEditingTemplateId(null);
    setFormTitle("");
    setFormDescription("");
    setFormCategory("Psicologia");
    setFormAuthor("Equipe Pluri-Health");
    setFormClinic("Comunidade Oficial");
    setFormTags(["oficial", "padrao"]);
    setFormIsFeatured(true);
    setFormIsPublished(true);
    setEditModalOpen(true);
  };

  const handleAddTag = () => {
    const clean = tagInput.trim().toLowerCase().replace(/^#/, "");
    if (!clean) return;
    if (formTags.includes(clean)) {
      setTagInput("");
      return;
    }
    setFormTags([...formTags, clean]);
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormTags(formTags.filter((t) => t !== tagToRemove));
  };

  // Save Edit / Create Official
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast({ title: "Título obrigatório", description: "Informe um título para o modelo.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      if (isEditingExisting && editingTemplateId) {
        // Update existing template
        const res = await updateCommunityTemplateByAdmin(editingTemplateId, {
          title: formTitle,
          description: formDescription || null,
          category: formCategory,
          author_name: formAuthor,
          clinic_name: formClinic || null,
          tags: formTags,
          is_featured: formIsFeatured,
          is_published: formIsPublished,
        });

        if (!res.success || !res.data) {
          throw new Error(res.error || "Erro ao salvar alterações.");
        }

        setTemplates((prev) =>
          prev.map((t) => (t.id === editingTemplateId ? { ...t, ...res.data } : t))
        );

        toast({ title: "Modelo atualizado", description: "As informações foram atualizadas com sucesso." });
      } else {
        // Determine Schema
        let templateSchema: AnamnesisTemplateSchema = [];
        if (schemaSource === "json" && customJsonInput.trim()) {
          try {
            const parsed = JSON.parse(customJsonInput.trim());
            const candidate = Array.isArray(parsed) ? parsed : parsed.schema || [];
            templateSchema = sanitizeAnamnesisTemplateSchema(candidate);
          } catch {
            toast({ title: "JSON inválido", description: "Verifique a formatação do JSON fornecido.", variant: "destructive" });
            setIsSaving(false);
            return;
          }
        } else {
          templateSchema = ARCHETYPE_SCHEMAS[formCategory] || ARCHETYPE_SCHEMAS.Geral;
        }

        const res = await adminCreateOfficialTemplate({
          title: formTitle,
          description: formDescription || null,
          category: formCategory,
          author_name: formAuthor,
          clinic_name: formClinic || null,
          tags: formTags,
          is_featured: formIsFeatured,
          schema: templateSchema,
          kind: "template",
          user_id: user.id,
        });

        if (!res.success || !res.data) {
          throw new Error(res.error || "Erro ao criar modelo oficial.");
        }

        setTemplates((prev) => [res.data!, ...prev]);
        toast({ title: "Modelo oficial criado", description: "O novo modelo oficial foi adicionado com destaque à biblioteca." });
      }

      setEditModalOpen(false);
    } catch (err) {
      toast({
        title: "Erro ao salvar",
        description: err instanceof Error ? err.message : "Não foi possível concluir a operação.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Action
  const handleConfirmDelete = async () => {
    if (!deletingTemplate) return;
    setIsDeleting(true);
    try {
      const success = await deleteCommunityTemplate(deletingTemplate.id);
      if (!success) throw new Error("Falha ao remover modelo.");

      setTemplates((prev) => prev.filter((t) => t.id !== deletingTemplate.id));
      toast({ title: "Modelo excluído", description: "O modelo foi removido permanentemente da plataforma." });
    } catch (err) {
      toast({
        title: "Erro ao excluir",
        description: err instanceof Error ? err.message : "Falha na exclusão.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeletingTemplate(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ====== Top Metrics Cards ====== */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 bg-card">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wide">Total de Modelos</span>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{kpis.total}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{kpis.totalPublished} publicados no ar</p>
        </Card>

        <Card className="p-4 bg-card">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wide">Importações Totais</span>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{kpis.totalImports}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Clones realizados por clínicas</p>
        </Card>

        <Card className="p-4 bg-card">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Heart className="h-4 w-4 text-rose-500" />
            <span className="text-xs font-semibold uppercase tracking-wide">Curtidas Comunitárias</span>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{kpis.totalLikes}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Favoritos acumulados</p>
        </Card>

        <Card className="p-4 bg-card">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Star className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-semibold uppercase tracking-wide">Destaques Editoriais</span>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{kpis.totalFeatured}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Fixados no topo da vitrine</p>
        </Card>
      </div>

      {/* ====== Filter & Search Bar ====== */}
      <Card className="p-4 bg-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-1 flex-col sm:flex-row items-center gap-2.5">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, autor, tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs h-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Category selector */}
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full sm:w-44 text-xs h-9">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas">Todas as Áreas</SelectItem>
                {COMMUNITY_FORM_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status selector */}
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-full sm:w-44 text-xs h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="published">Apenas Publicados</SelectItem>
                <SelectItem value="unpublished">Ocultos / Moderação</SelectItem>
                <SelectItem value="featured">Apenas Destaques</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === "list" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Visão em Lista / Tabela"
              >
                <List className="h-4 w-4" />
              </button>
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
            </div>

            <Button
              onClick={handleOpenCreateOfficial}
              size="sm"
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-9 text-xs"
            >
              <Plus className="h-4 w-4" />
              Criar Modelo Oficial
            </Button>
          </div>
        </div>
      </Card>

      {/* ====== Management View (Grid vs List) ====== */}
      {viewMode === "grid" ? (
        loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground text-xs">
            Nenhum modelo encontrado.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTemplates.map((template) => (
              <CommunityFormCard
                key={template.id}
                template={template}
                isOwner={true}
                onOpenDetail={() => navigate(`/platform/formularios/${template.id}`)}
                onPreview={() => {
                  setPreviewTemplate(template);
                  setPreviewOpen(true);
                }}
                onImport={() => navigate(`/platform/formularios/${template.id}`)}
                onDelete={() => setDeletingTemplate(template)}
              />
            ))}
          </div>
        )
      ) : (
        <Card className="overflow-hidden border">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                  <th className="py-3 px-4">Modelo & Categoria</th>
                  <th className="py-3 px-4">Autor & Origem</th>
                  <th className="py-3 px-4 text-center">Estrutura</th>
                  <th className="py-3 px-4 text-center">Importações</th>
                  <th className="py-3 px-4 text-center">Curtidas</th>
                  <th className="py-3 px-4 text-center">Status / Destaque</th>
                  <th className="py-3 px-4 text-right">Ações de Moderação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                      <p className="text-xs text-muted-foreground mt-2">Carregando modelos comunitários...</p>
                    </td>
                  </tr>
                ) : filteredTemplates.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-muted-foreground">
                      Nenhum modelo encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredTemplates.map((template) => {
                    const fieldsCount = template.schema.filter(
                      (f) => f.type !== "section" && f.type !== "horizontal_section" && f.type !== "section_selector"
                    ).length;

                    return (
                      <tr
                        key={template.id}
                        onClick={() => navigate(`/platform/formularios/${template.id}`)}
                        className="hover:bg-muted/20 transition-colors cursor-pointer"
                      >
                        {/* Title & Category */}
                        <td className="py-3.5 px-4 max-w-[280px]">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary/30 text-primary font-medium">
                              {template.category}
                            </Badge>
                            {template.is_featured && (
                              <Badge className="bg-amber-500 hover:bg-amber-600 text-[9px] py-0 px-1 text-white gap-0.5">
                                <Star className="h-2.5 w-2.5 fill-white" /> Destaque
                              </Badge>
                            )}
                            {template.kind === "base" && (
                              <Badge variant="secondary" className="text-[9px] py-0 px-1">
                                Bloco Base
                              </Badge>
                            )}
                          </div>
                          <p className="font-semibold text-sm text-foreground truncate" title={template.title}>
                            {template.title}
                          </p>
                          {template.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                              {template.description}
                            </p>
                          )}
                          {template.tags && template.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {template.tags.slice(0, 3).map((tag, idx) => (
                                <span key={idx} className="text-[10px] bg-muted px-1.5 py-0.2 rounded text-muted-foreground">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Author & Clinic */}
                        <td className="py-3.5 px-4 max-w-[180px]">
                          <div className="flex items-center gap-1.5 text-foreground font-medium truncate">
                            <User className="h-3.5 w-3.5 shrink-0 opacity-70" />
                            <span className="truncate">{template.author_name}</span>
                          </div>
                          {template.clinic_name && (
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {template.clinic_name}
                            </p>
                          )}
                        </td>

                        {/* Structure */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-semibold text-foreground">{fieldsCount}</span>
                          <span className="text-[10px] text-muted-foreground block">campos</span>
                        </td>

                        {/* Imports */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-semibold text-foreground">{template.imports_count}</span>
                          <span className="text-[10px] text-muted-foreground block">usos</span>
                        </td>

                        {/* Likes */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-semibold text-rose-500">{template.likes_count}</span>
                          <span className="text-[10px] text-muted-foreground block">curtidas</span>
                        </td>

                        {/* Status / Visibility */}
                        <td className="py-3.5 px-4 text-center">
                          {template.is_published ? (
                            <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200">
                              Publicado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-rose-700 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200">
                              Oculto / Moderação
                            </Badge>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {/* Toggle Featured */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-8 w-8 p-0 ${
                                template.is_featured ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground hover:text-amber-500"
                              }`}
                              onClick={() => handleToggleFeatured(template)}
                              title={template.is_featured ? "Remover dos destaques" : "Promover a destaque"}
                            >
                              <Star className={`h-4 w-4 ${template.is_featured ? "fill-amber-500" : ""}`} />
                            </Button>

                            {/* Toggle Published / Moderation */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-8 w-8 p-0 ${
                                template.is_published ? "text-muted-foreground hover:text-rose-500" : "text-rose-500 hover:text-emerald-500"
                              }`}
                              onClick={() => handleTogglePublished(template)}
                              title={template.is_published ? "Ocultar / Moderar" : "Reativar publicação"}
                            >
                              {template.is_published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            </Button>

                            {/* Preview Schema */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setPreviewTemplate(template);
                                setPreviewOpen(true);
                              }}
                              title="Inspecionar estrutura"
                            >
                              <Layers className="h-4 w-4" />
                            </Button>

                            {/* Edit Details */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => handleOpenEdit(template)}
                              title="Editar metadados"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>

                            {/* Delete */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                              onClick={() => setDeletingTemplate(template)}
                              title="Excluir permanentemente"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ====== Modals ====== */}

      {/* Preview Modal */}
      <FormLibraryPreviewModal
        template={previewTemplate}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onImport={() => {
          toast({ title: "Modo Administrativo", description: "Para importar para uma clínica específica, use a visão da clínica." });
        }}
      />

      {/* Edit / Create Official Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b bg-muted/20 shrink-0">
            <DialogTitle className="text-lg font-bold">
              {isEditingExisting ? "Editar Metadados do Modelo" : "Criar Modelo Oficial da Plataforma"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {isEditingExisting
                ? "Gerencie a visibilidade, categoria, tags e informações públicas deste modelo comunitário."
                : "Publique um modelo de referência oficial com destaque editorial para toda a base de clientes."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveModal} className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="adminTitle" className="text-xs font-semibold">
                Título do Modelo *
              </Label>
              <Input
                id="adminTitle"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Título do formulário..."
                maxLength={120}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="adminCategory" className="text-xs font-semibold">
                  Área / Categoria *
                </Label>
                <Select
                  value={formCategory}
                  onValueChange={(val) => setFormCategory(val as CommunityFormCategory)}
                >
                  <SelectTrigger id="adminCategory">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMUNITY_FORM_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adminAuthor" className="text-xs font-semibold">
                  Nome do Autor Exibido *
                </Label>
                <Input
                  id="adminAuthor"
                  value={formAuthor}
                  onChange={(e) => setFormAuthor(e.target.value)}
                  placeholder="Nome do autor..."
                  maxLength={80}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adminClinic" className="text-xs font-semibold">
                Nome da Clínica / Organização (opcional)
              </Label>
              <Input
                id="adminClinic"
                value={formClinic}
                onChange={(e) => setFormClinic(e.target.value)}
                placeholder="Ex: Comunidade Oficial ou Clínica XYZ"
                maxLength={100}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adminDescription" className="text-xs font-semibold">
                Descrição Detalhada
              </Label>
              <Textarea
                id="adminDescription"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Explique os objetivos clínicos deste formulário..."
                rows={3}
                maxLength={600}
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Tags de Busca</Label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Adicionar tag..."
                  maxLength={30}
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddTag}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {formTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {formTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded"
                    >
                      <Tag className="h-3 w-3" />
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-muted-foreground hover:text-foreground ml-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Schema Archetype or JSON Selector (for new official models) */}
            {!isEditingExisting && (
              <div className="space-y-2.5 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Estrutura do Formulário (Schema)</Label>
                  <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md">
                    <button
                      type="button"
                      onClick={() => setSchemaSource("archetype")}
                      className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                        schemaSource === "archetype"
                          ? "bg-background text-foreground font-semibold shadow-xs"
                          : "text-muted-foreground"
                      }`}
                    >
                      Arquétipo da Área
                    </button>
                    <button
                      type="button"
                      onClick={() => setSchemaSource("json")}
                      className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                        schemaSource === "json"
                          ? "bg-background text-foreground font-semibold shadow-xs"
                          : "text-muted-foreground"
                      }`}
                    >
                      Colar JSON
                    </button>
                  </div>
                </div>

                {schemaSource === "archetype" ? (
                  <div className="p-3 rounded-lg border bg-primary/5 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground mb-1">
                      Arquétipo Clínico Padrão: {formCategory}
                    </p>
                    <p className="text-[11px]">
                      A estrutura será gerada automaticamente com as melhores práticas de perguntas, seções e escalas clínicas para a especialidade {formCategory}.
                    </p>
                  </div>
                ) : (
                  <Textarea
                    value={customJsonInput}
                    onChange={(e) => setCustomJsonInput(e.target.value)}
                    placeholder='Cole aqui o JSON da ficha (ex: [{"id": "f1", "label": "Nome", "type": "short_text"}])'
                    rows={4}
                    className="font-mono text-[11px]"
                  />
                )}
              </div>
            )}

            {/* Switches */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="flex items-center justify-between rounded-xl border p-3.5 bg-muted/20">
                <div className="space-y-0.5">
                  <Label htmlFor="featuredSwitch" className="text-xs font-semibold">
                    Destaque Editorial
                  </Label>
                  <p className="text-[11px] text-muted-foreground">Fixar com selo no topo da vitrine</p>
                </div>
                <Switch
                  id="featuredSwitch"
                  checked={formIsFeatured}
                  onCheckedChange={setFormIsFeatured}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border p-3.5 bg-muted/20">
                <div className="space-y-0.5">
                  <Label htmlFor="publishedSwitch" className="text-xs font-semibold">
                    Publicação no Ar
                  </Label>
                  <p className="text-[11px] text-muted-foreground">Visível para os usuários da plataforma</p>
                </div>
                <Switch
                  id="publishedSwitch"
                  checked={formIsPublished}
                  onCheckedChange={setFormIsPublished}
                />
              </div>
            </div>
          </form>

          <DialogFooter className="p-4 px-6 border-t bg-muted/20 flex flex-row items-center justify-between sm:justify-between shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditModalOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleSaveModal}
              disabled={isSaving || !formTitle.trim()}
              className="gap-2 bg-primary text-primary-foreground"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEditingExisting ? "Salvar Alterações" : "Publicar Modelo Oficial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deletingTemplate} onOpenChange={(open) => !open && setDeletingTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Modelo da Comunidade?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir o modelo <strong>"{deletingTemplate?.title}"</strong> como administrador master.
              Esta ação é permanente e removerá o modelo de toda a biblioteca comunitária.
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
              Excluir Definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PlatformFormLibraryManager;
