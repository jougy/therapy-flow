import React, { useState, useEffect, useCallback } from "react";
import { Star, MessageSquareHeart, Send, Loader2, Sparkles, AlertCircle, CheckCircle2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FEEDBACK_QUESTIONS_POOL, pickRandomFeedbackQuestions, type FeedbackQuestion } from "@/lib/feedback-questions";
import { cn } from "@/lib/utils";

interface UserFeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerSource?: string;
}

export const UserFeedbackModal: React.FC<UserFeedbackModalProps> = ({
  open,
  onOpenChange,
  triggerSource = "manual",
}) => {
  const { clinic, user } = useAuth();
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [hoveredRatings, setHoveredRatings] = useState<Record<string, number>>({});
  const [problemReport, setProblemReport] = useState("");
  const [opinion, setOpinion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Sorteia 5 novas perguntas sempre que o modal abre
  useEffect(() => {
    if (open) {
      const selected = pickRandomFeedbackQuestions(5);
      setQuestions(selected);
      // Inicializa ratings
      const initial: Record<string, number> = {};
      selected.forEach((q) => {
        initial[q.id] = 0;
      });
      setRatings(initial);
      setHoveredRatings({});
      setProblemReport("");
      setOpinion("");
      setSubmitted(false);
    }
  }, [open]);

  const handleRating = (questionId: string, rating: number) => {
    setRatings((prev) => ({ ...prev, [questionId]: rating }));
  };

  const handleHover = (questionId: string, rating: number) => {
    setHoveredRatings((prev) => ({ ...prev, [questionId]: rating }));
  };

  const handleMouseLeave = (questionId: string) => {
    setHoveredRatings((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  };

  const ratedCount = Object.values(ratings).filter((r) => r > 0).length;
  const hasAnyInput = ratedCount > 0 || problemReport.trim().length > 0 || opinion.trim().length > 0;

  const contextInfo = (() => {
    switch (triggerSource) {
      case "session_completed":
        return {
          badge: "🎉 Atendimento Concluído",
          title: "Como foi sua experiência no atendimento?",
          description: "Aproveitando a finalização do seu atendimento, avalie em poucos segundos como foi registrar os dados na plataforma.",
        };
      case "time_connected":
        return {
          badge: "⏱️ Sessão Ativa",
          title: "Como está sendo sua experiência hoje?",
          description: "Você já está navegando há algum tempo. Avalie com estrelas para nos ajudar a evoluir a plataforma.",
        };
      default:
        return {
          badge: "Sua Opinião Importa",
          title: "Como está sendo sua experiência na plataforma?",
          description: "Avalie com estrelas as questões abaixo e conte-nos como podemos facilitar ainda mais o seu trabalho.",
        };
    }
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      toast({
        title: "Acesso necessário",
        description: "Você precisa estar conectado para enviar uma avaliação.",
        variant: "destructive",
      });
      return;
    }

    if (!hasAnyInput) {
      toast({
        title: "Avaliação em branco",
        description: "Por favor, selecione as estrelas para pelo menos uma pergunta ou escreva sua opinião.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const ratingsPayload = questions.map((q) => ({
        question_id: q.id,
        question_text: q.text,
        short_label: q.shortLabel,
        category: q.category,
        rating: ratings[q.id] || null,
      })).filter((item) => item.rating !== null);

      const currentUrl = typeof window !== "undefined" ? window.location.href : "";
      const pageUrlWithSource = currentUrl
        ? currentUrl.includes("?")
          ? `${currentUrl}&feedback_trigger=${triggerSource}`
          : `${currentUrl}?feedback_trigger=${triggerSource}`
        : null;

      const { error } = await supabase.rpc("submit_user_platform_feedback", {
        _clinic_id: clinic?.id ?? null,
        _ratings: ratingsPayload,
        _problem_report: problemReport.trim() || null,
        _opinion: opinion.trim() || null,
        _page_url: pageUrlWithSource,
        _user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      });

      if (error) {
        throw error;
      }

      setSubmitted(true);
      // Registra timestamp do último feedback enviado no navegador
      try {
        if (typeof window !== "undefined" && typeof window.localStorage?.setItem === "function") {
          window.localStorage.setItem("pluri_last_feedback_timestamp", String(Date.now()));
        }
      } catch {
        // ignore storage errors
      }

      toast({
        title: "Feedback enviado com sucesso!",
        description: "Agradecemos muito por nos ajudar a evoluir a plataforma!",
      });

      setTimeout(() => {
        onOpenChange(false);
      }, 1800);
    } catch (err: any) {
      console.error("[Feedback] Error submitting feedback:", err);
      toast({
        title: "Erro ao enviar feedback",
        description: err?.message || "Não foi possível registrar seu feedback. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] flex flex-col p-0 overflow-hidden border-border bg-background shadow-2xl">
        {/* Header Fixo */}
        <div className="p-5 pb-4 border-b border-border bg-gradient-to-r from-primary/5 via-primary/10 to-transparent shrink-0">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                <MessageSquareHeart className="w-4 h-4" />
              </div>
              <Badge variant="secondary" className="text-xs font-normal bg-primary/10 text-primary border-primary/20">
                {contextInfo.badge}
              </Badge>
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
              {contextInfo.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {contextInfo.description}
            </DialogDescription>
          </DialogHeader>
        </div>

        {submitted ? (
          /* Estado de Sucesso */
          <div className="p-10 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1 max-w-md">
              <h3 className="text-lg font-semibold text-foreground">Muito obrigado pelo seu feedback!</h3>
              <p className="text-sm text-muted-foreground">
                Suas respostas foram registradas e nossa equipe de desenvolvimento as analisa continuamente para tornar a sua rotina mais simples e rápida.
              </p>
            </div>
          </div>
        ) : (
          /* Formulário Rolável */
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Bloco 1: Perguntas com 5 Estrelas */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-border/60">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Perguntas Rápidas ({ratedCount}/{questions.length} respondidas)
                </span>
                <span className="text-[11px] text-muted-foreground">Classifique de 1 a 5 estrelas</span>
              </div>

              <div className="space-y-3.5">
                {questions.map((question, index) => {
                  const currentRating = ratings[question.id] || 0;
                  const currentHover = hoveredRatings[question.id] || 0;
                  const activeStar = currentHover || currentRating;

                  return (
                    <div
                      key={question.id}
                      className="p-3.5 rounded-xl border border-border/70 bg-card/60 hover:bg-card transition-colors space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-bold text-primary/80 mt-0.5">{index + 1}.</span>
                          <p className="text-sm font-medium leading-snug text-foreground">
                            {question.text}
                          </p>
                        </div>
                      </div>

                      {/* Estrelas Interativas */}
                      <div className="flex items-center justify-between pt-1">
                        <div
                          className="flex items-center gap-1.5"
                          onMouseLeave={() => handleMouseLeave(question.id)}
                        >
                          {[1, 2, 3, 4, 5].map((starValue) => {
                            const isFilled = starValue <= activeStar;
                            return (
                              <button
                                key={starValue}
                                type="button"
                                onClick={() => handleRating(question.id, starValue)}
                                onMouseEnter={() => handleHover(question.id, starValue)}
                                className="p-1 rounded-md text-muted-foreground/40 hover:text-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all transform hover:scale-110 active:scale-95"
                                aria-label={`${starValue} de 5 estrelas`}
                              >
                                <Star
                                  className={cn(
                                    "w-6 h-6 transition-colors",
                                    isFilled
                                      ? "fill-amber-400 text-amber-400 drop-shadow-sm"
                                      : "text-neutral-300 dark:text-neutral-700"
                                  )}
                                />
                              </button>
                            );
                          })}
                        </div>

                        {/* Rótulo de Feedback da Nota */}
                        <span className="text-xs font-medium text-muted-foreground min-w-[70px] text-right">
                          {activeStar === 5 && "⭐ Excelente"}
                          {activeStar === 4 && "⭐ Muito Bom"}
                          {activeStar === 3 && "⭐ Regular"}
                          {activeStar === 2 && "⭐ Precisa Melhorar"}
                          {activeStar === 1 && "⭐ Insatisfeito"}
                          {activeStar === 0 && <span className="text-neutral-400 dark:text-neutral-600">Não avaliado</span>}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bloco 2: Relato de Problemas */}
            <div className="space-y-2 pt-1 border-t border-border/60">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                <span>Relatar Problemas ou Dificuldades</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Encontrou alguma lentidão, bug, botão com problema ou tela confusa? Conte para nós os detalhes.
              </p>
              <Textarea
                value={problemReport}
                onChange={(e) => setProblemReport(e.target.value)}
                placeholder="Exemplo: Ao salvar a ficha de anamnese senti um atraso de alguns segundos, ou tive dificuldade para..."
                rows={3}
                className="resize-none text-sm bg-background border-border/80 focus-visible:ring-amber-500/40"
              />
            </div>

            {/* Bloco 3: Opinião Geral e Sugestões */}
            <div className="space-y-2 pt-1 border-t border-border/60">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>Sua Opinião & Sugestões de Melhoria</span>
              </div>
              <p className="text-xs text-muted-foreground">
                O que você mais gosta na plataforma ou o que gostaria de ver adicionado nas próximas atualizações?
              </p>
              <Textarea
                value={opinion}
                onChange={(e) => setOpinion(e.target.value)}
                placeholder="Exemplo: Adoro a organização visual das fichas! Seria incrível se pudéssemos também..."
                rows={3}
                className="resize-none text-sm bg-background border-border/80 focus-visible:ring-primary/40"
              />
            </div>

            {/* Footer Fixo com Ação de Envio */}
            <div className="pt-3 border-t border-border flex items-center justify-between gap-3 sticky bottom-0 bg-background/95 backdrop-blur-sm -mx-5 -mb-5 p-5">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="text-muted-foreground hover:text-foreground"
              >
                Agora não
              </Button>

              <Button
                type="submit"
                disabled={submitting || !hasAnyInput}
                className="gap-2 px-6 shadow-md"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Enviar Avaliação</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
