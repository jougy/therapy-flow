import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Star,
  MessageSquareHeart,
  AlertTriangle,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Archive,
  RefreshCw,
  Building2,
  Mail,
  User,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  HelpCircle,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export interface PlatformFeedbackItem {
  id: string;
  user_id: string | null;
  clinic_id: string | null;
  user_email: string | null;
  user_name: string | null;
  clinic_name: string | null;
  ratings: Array<{
    question_id: string;
    question_text: string;
    short_label?: string;
    category?: string;
    rating: number;
  }>;
  average_rating: number | null;
  problem_report: string | null;
  opinion: string | null;
  page_url: string | null;
  user_agent: string | null;
  status: "pending" | "reviewed" | "archived";
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export const PlatformFeedbacksManager: React.FC = () => {
  const [feedbacks, setFeedbacks] = useState<PlatformFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [adminNotesDraft, setAdminNotesDraft] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("platform_feedbacks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setFeedbacks((data || []) as PlatformFeedbackItem[]);
    } catch (err: any) {
      console.error("[PlatformFeedbacks] Error loading feedbacks:", err);
      toast({
        title: "Erro ao carregar feedbacks",
        description: err?.message || "Não foi possível carregar os feedbacks dos usuários.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFeedbacks();
  }, [fetchFeedbacks]);

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleUpdateStatus = async (id: string, newStatus: "pending" | "reviewed" | "archived") => {
    setUpdatingId(id);
    try {
      const notes = adminNotesDraft[id];
      const updatePayload: Record<string, any> = { status: newStatus };
      if (notes !== undefined) {
        updatePayload.admin_notes = notes.trim() || null;
      }

      const { error } = await supabase
        .from("platform_feedbacks")
        .update(updatePayload)
        .eq("id", id);

      if (error) throw error;

      setFeedbacks((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: newStatus, admin_notes: updatePayload.admin_notes ?? item.admin_notes } : item
        )
      );

      toast({
        title: "Status atualizado",
        description: `Feedback marcado como ${newStatus === "reviewed" ? "analisado" : newStatus === "archived" ? "arquivado" : "pendente"}.`,
      });
    } catch (err: any) {
      console.error("[PlatformFeedbacks] Error updating status:", err);
      toast({
        title: "Erro ao atualizar status",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveNotes = async (id: string) => {
    setUpdatingId(id);
    try {
      const notes = adminNotesDraft[id] ?? "";
      const { error } = await supabase
        .from("platform_feedbacks")
        .update({ admin_notes: notes.trim() || null })
        .eq("id", id);

      if (error) throw error;

      setFeedbacks((prev) =>
        prev.map((item) => (item.id === id ? { ...item, admin_notes: notes.trim() || null } : item))
      );

      toast({
        title: "Anotação salva",
        description: "Anotação interna do administrador atualizada com sucesso.",
      });
    } catch (err: any) {
      toast({
        title: "Erro ao salvar anotação",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  // Métricas Globais
  const stats = useMemo(() => {
    const total = feedbacks.length;
    const withProblems = feedbacks.filter((f) => Boolean(f.problem_report && f.problem_report.trim().length > 0)).length;
    const pendingReview = feedbacks.filter((f) => f.status === "pending").length;

    let ratingSum = 0;
    let ratingCount = 0;
    feedbacks.forEach((f) => {
      if (f.average_rating && f.average_rating > 0) {
        ratingSum += Number(f.average_rating);
        ratingCount += 1;
      }
    });

    const globalAvg = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(2) : "0.00";

    return {
      total,
      withProblems,
      pendingReview,
      globalAvg,
    };
  }, [feedbacks]);

  // Filtros aplicados
  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((item) => {
      // Filtro de status
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      // Filtro de estrelas
      if (ratingFilter !== "all") {
        const ratingNum = parseInt(ratingFilter, 10);
        const itemAvg = Math.round(Number(item.average_rating || 0));
        if (itemAvg !== ratingNum) {
          return false;
        }
      }

      // Filtro apenas com problemas
      if (onlyProblems && (!item.problem_report || item.problem_report.trim().length === 0)) {
        return false;
      }

      // Busca textual
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchesUser = item.user_name?.toLowerCase().includes(q) || item.user_email?.toLowerCase().includes(q);
        const matchesClinic = item.clinic_name?.toLowerCase().includes(q);
        const matchesProblem = item.problem_report?.toLowerCase().includes(q);
        const matchesOpinion = item.opinion?.toLowerCase().includes(q);
        if (!matchesUser && !matchesClinic && !matchesProblem && !matchesOpinion) {
          return false;
        }
      }

      return true;
    });
  }, [feedbacks, statusFilter, ratingFilter, onlyProblems, searchQuery]);

  const handleExportCSV = () => {
    if (feedbacks.length === 0) return;

    const headers = [
      "ID",
      "Data",
      "Usuário",
      "Email",
      "Clínica",
      "Média Estrelas",
      "Relato de Problema",
      "Opinião e Sugestões",
      "Status",
      "Notas Admin",
    ];

    const rows = feedbacks.map((f) => [
      `"${f.id}"`,
      `"${new Date(f.created_at).toLocaleString("pt-BR")}"`,
      `"${(f.user_name || "").replace(/"/g, '""')}"`,
      `"${(f.user_email || "").replace(/"/g, '""')}"`,
      `"${(f.clinic_name || "").replace(/"/g, '""')}"`,
      `"${f.average_rating || 0}"`,
      `"${(f.problem_report || "").replace(/"/g, '""')}"`,
      `"${(f.opinion || "").replace(/"/g, '""')}"`,
      `"${f.status}"`,
      `"${(f.admin_notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `feedbacks_pluri_health_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header e Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <MessageSquareHeart className="w-6 h-6 text-primary" />
            Central de Feedbacks & Avaliações
          </h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe o que os profissionais e clínicas acham da plataforma, relatos de bugs e sugestões de melhoria.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchFeedbacks}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Atualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={feedbacks.length === 0}
            className="gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Média Geral de Satisfação
            </CardTitle>
            <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground flex items-baseline gap-1.5">
              {stats.globalAvg}
              <span className="text-xs font-normal text-muted-foreground">/ 5.00</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Classificação média agregada</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total de Avaliações
            </CardTitle>
            <MessageSquareHeart className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Respostas de usuários recebidas</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Problemas Relatados
            </CardTitle>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.withProblems}</div>
            <p className="text-xs text-muted-foreground mt-1">Usuários que descreveram dificuldades</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pendentes de Análise
            </CardTitle>
            <Clock className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.pendingReview}</div>
            <p className="text-xs text-muted-foreground mt-1">Aguardando revisão interna</p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <Card className="border-border/80 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Input de Busca */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por usuário, email, clínica ou texto do relato..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>

            {/* Filtro de Status */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[170px] bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="reviewed">Analisados</SelectItem>
                <SelectItem value="archived">Arquivados</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro de Nota */}
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-full md:w-[160px] bg-background">
                <SelectValue placeholder="Classificação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Notas</SelectItem>
                <SelectItem value="5">⭐⭐⭐⭐⭐ (5 Estrelas)</SelectItem>
                <SelectItem value="4">⭐⭐⭐⭐ (4 Estrelas)</SelectItem>
                <SelectItem value="3">⭐⭐⭐ (3 Estrelas)</SelectItem>
                <SelectItem value="2">⭐⭐ (2 Estrelas)</SelectItem>
                <SelectItem value="1">⭐ (1 Estrela)</SelectItem>
              </SelectContent>
            </Select>

            {/* Toggle de Apenas Problemas */}
            <Button
              type="button"
              variant={onlyProblems ? "secondary" : "outline"}
              onClick={() => setOnlyProblems(!onlyProblems)}
              className={cn(
                "shrink-0 gap-1.5",
                onlyProblems && "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              )}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Com Problemas
            </Button>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <span>
              Exibindo <strong>{filteredFeedbacks.length}</strong> de {feedbacks.length} avaliações
            </span>
            {(statusFilter !== "all" || ratingFilter !== "all" || onlyProblems || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter("all");
                  setRatingFilter("all");
                  setOnlyProblems(false);
                  setSearchQuery("");
                }}
                className="h-6 text-xs text-primary hover:text-primary/80"
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de Feedbacks */}
      <div className="space-y-4">
        {loading && feedbacks.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground rounded-xl border border-dashed border-border flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm">Carregando avaliações dos usuários...</p>
          </div>
        ) : filteredFeedbacks.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground rounded-xl border border-dashed border-border space-y-2">
            <MessageSquareHeart className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <h4 className="text-base font-semibold text-foreground">Nenhuma avaliação encontrada</h4>
            <p className="text-xs max-w-sm mx-auto">
              Nenhum feedback corresponde aos filtros selecionados no momento.
            </p>
          </div>
        ) : (
          filteredFeedbacks.map((item) => {
            const isExpanded = expandedCards[item.id] ?? false;
            const avgRating = Number(item.average_rating || 0);

            return (
              <Card
                key={item.id}
                className={cn(
                  "border-border/80 transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md",
                  item.status === "pending" && "border-l-4 border-l-primary",
                  item.status === "reviewed" && "border-l-4 border-l-emerald-500",
                  item.status === "archived" && "border-l-4 border-l-neutral-400 opacity-80"
                )}
              >
                <CardHeader className="p-4 sm:p-5 pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Dados do Usuário & Clínica */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-base text-foreground flex items-center gap-1.5">
                          <User className="w-4 h-4 text-muted-foreground" />
                          {item.user_name || "Usuário não identificado"}
                        </span>
                        {item.clinic_name && (
                          <Badge variant="outline" className="text-xs bg-muted/50 gap-1 font-normal">
                            <Building2 className="w-3 h-3" />
                            {item.clinic_name}
                          </Badge>
                        )}
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] uppercase font-bold",
                            item.status === "pending" && "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200",
                            item.status === "reviewed" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200",
                            item.status === "archived" && "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400"
                          )}
                        >
                          {item.status === "pending" && "Pendente"}
                          {item.status === "reviewed" && "Analisado"}
                          {item.status === "archived" && "Arquivado"}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {item.user_email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {item.user_email}
                          </span>
                        )}
                        <span>•</span>
                        <span>{new Date(item.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                    </div>

                    {/* Média de Estrelas */}
                    <div className="flex items-center gap-3 self-start sm:self-center">
                      <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg">
                        <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                        <span className="text-base font-bold text-amber-700 dark:text-amber-300">
                          {avgRating > 0 ? avgRating.toFixed(1) : "—"}
                        </span>
                        <span className="text-xs text-muted-foreground">/ 5.0</span>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(item.id)}
                        className="h-8 px-2 text-muted-foreground"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 pt-0 space-y-4">
                  {/* Bloco de Problemas Relatados (se houver) */}
                  {item.problem_report && (
                    <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Problema / Dificuldade Relatada:</span>
                      </div>
                      <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                        {item.problem_report}
                      </p>
                    </div>
                  )}

                  {/* Bloco de Opinião & Sugestões (se houver) */}
                  {item.opinion && (
                    <div className="p-3.5 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Opinião & Sugestões:</span>
                      </div>
                      <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                        {item.opinion}
                      </p>
                    </div>
                  )}

                  {/* Detalhe Expandido: Perguntas Individuais */}
                  {isExpanded && (
                    <div className="space-y-3 pt-3 border-t border-border/80 animate-in fade-in duration-200">
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Respostas às Perguntas ({item.ratings?.length || 0})
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {(item.ratings || []).map((r, i) => (
                          <div
                            key={i}
                            className="p-2.5 rounded-lg bg-card border border-border/60 flex items-center justify-between gap-2"
                          >
                            <span className="text-xs text-foreground font-medium leading-snug">
                              {r.question_text || r.short_label}
                            </span>
                            <div className="flex items-center gap-0.5 shrink-0">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={cn(
                                    "w-3.5 h-3.5",
                                    star <= r.rating
                                      ? "fill-amber-400 text-amber-400"
                                      : "text-neutral-300 dark:text-neutral-700"
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Anotações Internas do Admin */}
                      <div className="pt-3 space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground">
                          Anotações Internas da Administração
                        </Label>
                        <div className="flex gap-2">
                          <Textarea
                            placeholder="Adicione observações sobre a análise deste feedback ou tratativa com a clínica..."
                            defaultValue={item.admin_notes || ""}
                            onChange={(e) =>
                              setAdminNotesDraft((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            rows={2}
                            className="text-xs bg-background resize-none"
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleSaveNotes(item.id)}
                            disabled={updatingId === item.id}
                            className="self-end"
                          >
                            Salvar Nota
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Ações de Status */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs">
                    <span className="text-muted-foreground">
                      {item.page_url && `Página: ${new URL(item.page_url).pathname}`}
                    </span>

                    <div className="flex items-center gap-2">
                      {item.status !== "reviewed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateStatus(item.id, "reviewed")}
                          disabled={updatingId === item.id}
                          className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Marcar como Analisado
                        </Button>
                      )}

                      {item.status === "reviewed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateStatus(item.id, "pending")}
                          disabled={updatingId === item.id}
                          className="h-7 text-xs gap-1 text-blue-600 hover:text-blue-700"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Reabrir Análise
                        </Button>
                      )}

                      {item.status !== "archived" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUpdateStatus(item.id, "archived")}
                          disabled={updatingId === item.id}
                          className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          Arquivar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
