import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  Heart,
  Layers,
  Loader2,
  MessageSquare,
  Send,
  Share2,
  ShieldCheck,
  Sliders,
  Sparkles,
  Star,
  Tag,
  Trash2,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  type CommunityFormTemplate,
  type CommunityFormTemplateComment,
  fetchCommunityFormTemplateById,
  fetchTemplateComments,
  createTemplateComment,
  deleteTemplateComment,
  importCommunityTemplateToClinic,
  toggleLikeCommunityTemplate,
} from "@/lib/community-forms";
import {
  buildAnamnesisTemplateExchangeFileName,
  buildAnamnesisTemplateExchangePayload,
} from "@/lib/anamnesis-forms";
import { InteractiveFormLivePreview } from "@/components/community-forms/InteractiveFormLivePreview";

export const FormTemplateDetailPage = () => {
  const { templateId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { clinic, clinicId, user, isPlatformOwner } = useAuth();

  const isBackoffice = location.pathname.startsWith("/platform");
  const clinicKey = clinic?.route_key ?? "";
  const clinicBasePath = clinicKey ? `/clinica/${clinicKey}` : "";
  const backPath = isBackoffice
    ? "/platform/formularios"
    : `${clinicBasePath}/configuracoes/formularios/biblioteca`;

  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<CommunityFormTemplate | null>(null);
  const [comments, setComments] = useState<CommunityFormTemplateComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  // Likes state
  const [likesCount, setLikesCount] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);

  // New Comment state
  const [newCommentContent, setNewCommentContent] = useState("");
  const [newRating, setNewRating] = useState<number>(5);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Import Dialog
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importCustomTitle, setImportCustomTitle] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccessId, setImportSuccessId] = useState<string | null>(null);

  const loadTemplate = useCallback(async () => {
    if (!templateId) return;
    setLoading(true);
    try {
      const data = await fetchCommunityFormTemplateById(templateId, user?.id);
      if (!data) {
        toast({ title: "Modelo não encontrado", description: "Este modelo de formulário não existe ou foi removido.", variant: "destructive" });
        navigate(backPath, { replace: true });
        return;
      }
      setTemplate(data);
      setLikesCount(data.likes_count || 0);
      setHasLiked(data.has_liked ?? false);
      setImportCustomTitle(data.title);

      // Load comments
      setLoadingComments(true);
      const commentsData = await fetchTemplateComments(templateId);
      setComments(commentsData);
    } catch (err) {
      console.error("Erro ao carregar detalhes do modelo:", err);
      toast({ title: "Erro ao carregar", description: "Não foi possível abrir os detalhes do modelo.", variant: "destructive" });
    } finally {
      setLoading(false);
      setLoadingComments(false);
    }
  }, [templateId, user?.id, navigate, backPath]);

  useEffect(() => {
    void loadTemplate();
  }, [loadTemplate]);

  // Handle Like
  const handleToggleLike = async () => {
    if (!template) return;
    const res = await toggleLikeCommunityTemplate(template.id);
    setHasLiked(res.liked);
    setLikesCount(res.likes_count);
  };

  // Handle Share / Copy Link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link copiado!",
      description: "O link direto para este modelo foi copiado para sua área de transferência.",
    });
  };

  // Handle Export JSON
  const handleExportJSON = () => {
    if (!template) return;
    const payload = buildAnamnesisTemplateExchangePayload({
      name: template.title,
      description: template.description,
      schema: template.schema,
      kind: template.kind,
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildAnamnesisTemplateExchangeFileName(template.kind, template.title);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast({ title: "Arquivo exportado", description: "O JSON do modelo foi baixado com sucesso." });
  };

  // Handle Confirm Import
  const handleConfirmImport = async () => {
    if (!template || !clinicId || !user?.id) {
      if (!clinicId) {
        toast({ title: "Selecione uma clínica", description: "Para importar o modelo, você precisa estar no contexto de uma clínica." });
      }
      return;
    }

    setIsImporting(true);
    try {
      const res = await importCommunityTemplateToClinic({
        communityTemplate: template,
        targetClinicId: clinicId,
        userId: user.id,
        customTitle: importCustomTitle,
      });

      if (!res.success) throw new Error(res.error || "Erro ao importar.");

      setImportSuccessId(res.newTemplateId || "base");
      setTemplate((prev) => (prev ? { ...prev, imports_count: prev.imports_count + 1 } : null));

      toast({
        title: "Modelo importado com sucesso!",
        description: `O formulário "${importCustomTitle || template.title}" foi copiado para a sua clínica.`,
      });
    } catch (err) {
      toast({
        title: "Erro ao importar",
        description: err instanceof Error ? err.message : "Não foi possível importar o modelo.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Handle Post Comment
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template || !user?.id || !newCommentContent.trim()) return;

    setIsSubmittingComment(true);
    try {
      const authorName =
        user?.user_metadata?.full_name ||
        user?.email?.split("@")[0] ||
        "Profissional Pluri-Health";

      const res = await createTemplateComment({
        template_id: template.id,
        user_id: user.id,
        author_name: authorName,
        clinic_name: clinic?.name || null,
        content: newCommentContent.trim(),
        rating: newRating,
      });

      if (!res.success || !res.data) throw new Error(res.error || "Erro ao comentar.");

      setComments((prev) => [res.data!, ...prev]);
      setNewCommentContent("");
      toast({ title: "Comentário publicado", description: "Obrigado pelo seu feedback sobre este modelo!" });
    } catch (err) {
      toast({
        title: "Erro ao publicar comentário",
        description: err instanceof Error ? err.message : "Não foi possível enviar.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Handle Delete Comment
  const handleDeleteComment = async (commentId: string) => {
    const success = await deleteTemplateComment(commentId);
    if (success) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast({ title: "Comentário removido" });
    }
  };

  if (loading || !template) {
    return (
      <div className="flex flex-col items-center justify-center py-28 space-y-3">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Carregando detalhes do modelo...</p>
      </div>
    );
  }

  const fieldsCount = template.schema.filter(
    (f) => f.type !== "section" && f.type !== "horizontal_section" && f.type !== "section_selector"
  ).length;

  const averageRating =
    comments.length > 0
      ? (
          comments.reduce((acc, c) => acc + (c.rating || 5), 0) / comments.length
        ).toFixed(1)
      : "5.0";

  return (
    <div className="space-y-8 pb-16 max-w-6xl mx-auto">
      {/* Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="gap-2 text-xs text-muted-foreground hover:text-foreground pl-0"
        >
          <Link to={backPath}>
            <ArrowLeft className="h-4 w-4" />
            {isBackoffice ? "Voltar ao Gerenciador Master" : "Voltar à Biblioteca de Formulários"}
          </Link>
        </Button>
      </div>

      {/* Main Product Header Card */}
      <Card className="overflow-hidden border bg-card">
        <div className="p-6 md:p-8 space-y-6">
          {/* Top metadata tags */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 border-primary/40 text-primary">
                {template.category}
              </Badge>
              {template.is_featured && (
                <Badge className="bg-amber-500 hover:bg-amber-600 text-xs py-0.5 px-2 text-white gap-1 shadow-xs">
                  <Sparkles className="h-3 w-3" /> Modelo em Destaque
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs py-0.5 px-2">
                {template.kind === "base" ? "Bloco Padrão Universal" : "Ficha Complementar"}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={handleCopyLink}
              >
                <Share2 className="h-3.5 w-3.5" />
                Compartilhar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={handleExportJSON}
              >
                <Download className="h-3.5 w-3.5" />
                JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={`h-8 text-xs gap-1.5 ${hasLiked ? "text-rose-500 font-semibold" : ""}`}
                onClick={handleToggleLike}
              >
                <Heart className={`h-3.5 w-3.5 ${hasLiked ? "fill-rose-500" : ""}`} />
                {likesCount} Curtidas
              </Button>
            </div>
          </div>

          {/* Title & Description */}
          <div className="space-y-3">
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
              {template.title}
            </h1>
            {template.description && (
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-4xl">
                {template.description}
              </p>
            )}
          </div>

          {/* Author info & stats row */}
          <div className="pt-4 border-t flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Author Profile */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                {template.author_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-foreground">{template.author_name}</p>
                  <ShieldCheck className="h-4 w-4 text-primary" title="Profissional Verificado" />
                </div>
                <p className="text-xs text-muted-foreground">
                  {template.clinic_name || "Comunidade Pluri-Health"} • Publicado em{" "}
                  {new Date(template.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            {/* Quick Metrics & Main CTA */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-4 text-xs text-muted-foreground mr-2">
                <div className="text-center">
                  <p className="font-bold text-foreground text-sm">{fieldsCount}</p>
                  <p className="text-[10px]">Campos</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-foreground text-sm">{template.imports_count}</p>
                  <p className="text-[10px]">Importações</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-foreground text-sm flex items-center justify-center gap-0.5">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                    {averageRating}
                  </p>
                  <p className="text-[10px]">{comments.length} avaliações</p>
                </div>
              </div>

              {!isBackoffice && (
                <Button
                  size="lg"
                  onClick={() => setImportModalOpen(true)}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-md"
                >
                  <Download className="h-4 w-4" />
                  Importar para Minha Clínica
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Main Content Tabs: Live Preview vs Detailed Structure vs Comments */}
      <Tabs defaultValue="preview" className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="preview" className="gap-2 flex-1 sm:flex-none">
            <Eye className="h-4 w-4" />
            Live Preview Interativo
          </TabsTrigger>
          <TabsTrigger value="structure" className="gap-2 flex-1 sm:flex-none">
            <Layers className="h-4 w-4" />
            Estrutura & Metadados
            <Badge variant="outline" className="ml-1 text-[10px] h-4 px-1">
              {template.schema.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="reviews" className="gap-2 flex-1 sm:flex-none">
            <MessageSquare className="h-4 w-4" />
            Comentários & Dicas da Comunidade
            {comments.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">
                {comments.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ================= TAB 1: LIVE INTERACTIVE PREVIEW ================= */}
        <TabsContent value="preview" className="space-y-4">
          <InteractiveFormLivePreview schema={template.schema} title={template.title} />
        </TabsContent>

        {/* ================= TAB 2: STRUCTURE & METADATA ================= */}
        <TabsContent value="structure" className="space-y-6">
          {/* Tags */}
          {template.tags && template.tags.length > 0 && (
            <Card className="p-5">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wide mb-2">
                Palavras-chave e Tags Clínicas
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {template.tags.map((t, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-xs bg-muted px-2.5 py-1 rounded-md text-foreground"
                  >
                    <Tag className="h-3 w-3 opacity-60" />
                    {t}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* List of schema fields */}
          <Card className="p-5 space-y-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">
              Anatomia e Campos do Modelo ({template.schema.length} elementos)
            </h4>
            <div className="space-y-2">
              {template.schema.map((field, i) => {
                const isContainer =
                  field.type === "section" ||
                  field.type === "horizontal_section" ||
                  field.type === "section_selector";
                return (
                  <div
                    key={field.id || i}
                    className={`flex items-center justify-between p-3 rounded-lg border text-xs ${
                      isContainer ? "bg-primary/5 font-semibold border-primary/20" : "bg-card"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                        {i + 1}
                      </span>
                      <span className="truncate">{field.label || "(Sem rótulo)"}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {field.required && (
                        <Badge variant="secondary" className="text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                          Obrigatório
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {field.type}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        {/* ================= TAB 3: REVIEWS & COMMUNITY COMMENTS ================= */}
        <TabsContent value="reviews" className="space-y-6">
          {/* Post New Comment Box */}
          <Card className="p-6 bg-card">
            <form onSubmit={handlePostComment} className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground">
                  Deixe seu comentário ou avaliação sobre este formulário
                </h4>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground mr-1">Avaliação:</span>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewRating(star)}
                      className="text-amber-400 hover:text-amber-500 transition-colors"
                    >
                      <Star
                        className={`h-4 w-4 ${star <= newRating ? "fill-amber-400" : "text-muted/60"}`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <Textarea
                value={newCommentContent}
                onChange={(e) => setNewCommentContent(e.target.value)}
                placeholder="Compartilhe como você utiliza este modelo na sua prática clínica, sugestões ou dicas para outros profissionais..."
                rows={3}
                className="text-xs"
                maxLength={800}
                required
              />

              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingComment || !newCommentContent.trim()}
                  className="gap-2 bg-primary text-primary-foreground"
                >
                  {isSubmittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Publicar Comentário
                </Button>
              </div>
            </form>
          </Card>

          {/* Comments List */}
          <div className="space-y-3">
            {loadingComments ? (
              <div className="text-center py-10 text-muted-foreground text-xs">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                Carregando avaliações...
              </div>
            ) : comments.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <MessageSquare className="h-8 w-8 text-muted-foreground opacity-50 mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground">Nenhum comentário ainda</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Seja o primeiro profissional a avaliar ou comentar sobre este modelo de formulário!
                </p>
              </Card>
            ) : (
              comments.map((comment) => (
                <Card key={comment.id} className="p-4 bg-card hover:bg-muted/10 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        {comment.author_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-foreground">{comment.author_name}</span>
                          {comment.clinic_name && (
                            <span className="text-[11px] text-muted-foreground">• {comment.clinic_name}</span>
                          )}
                          {comment.rating && (
                            <div className="flex items-center gap-0.5 ml-1">
                              {[...Array(comment.rating)].map((_, idx) => (
                                <Star key={idx} className="h-3 w-3 fill-amber-400 text-amber-500" />
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{comment.content}</p>
                        <p className="text-[10px] text-muted-foreground pt-1">
                          {new Date(comment.created_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>

                    {(comment.user_id === user?.id || isPlatformOwner) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteComment(comment.id)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                        title="Remover comentário"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Import Confirmation Dialog */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Importar para Minha Clínica</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Uma cópia completa da estrutura deste formulário será criada nas fichas da sua clínica.
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
                  O formulário está pronto para ser utilizado ou customizado.
                </p>
              </div>

              <div className="flex justify-center gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setImportModalOpen(false)}>
                  Fechar
                </Button>
                {importSuccessId !== "base" ? (
                  <Button size="sm" className="bg-primary text-primary-foreground" asChild>
                    <Link to={`${clinicBasePath}/configuracoes/formularios/${importSuccessId}`}>
                      Abrir no Editor
                    </Link>
                  </Button>
                ) : (
                  <Button size="sm" className="bg-primary text-primary-foreground" asChild>
                    <Link to={`${clinicBasePath}/configuracoes/formularios/base`}>
                      Ver Bloco Universal
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="importTitle" className="text-xs font-semibold">
                  Nome da ficha na sua clínica
                </Label>
                <Input
                  id="importTitle"
                  value={importCustomTitle}
                  onChange={(e) => setImportCustomTitle(e.target.value)}
                  maxLength={100}
                />
              </div>

              <DialogFooter className="pt-2 flex flex-row items-center justify-between sm:justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setImportModalOpen(false)}
                  disabled={isImporting}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirmImport}
                  disabled={isImporting || !importCustomTitle.trim()}
                  className="gap-2 bg-primary text-primary-foreground"
                >
                  {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Confirmar Cópia
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FormTemplateDetailPage;
