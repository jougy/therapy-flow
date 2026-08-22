import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TUTORIAL_CHAPTERS,
} from "@/components/tutorial/tutorial-registry";
import { useTutorial } from "@/contexts/TutorialContext";
import {
  Sparkles,
  Play,
  CheckCircle2,
  Clock,
  RotateCcw,
  Compass,
  ArrowRight,
  Building2,
  Users,
  UserPlus,
  CreditCard,
  Calendar,
  ClipboardList,
  Stethoscope,
  Settings,
  Lock,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2,
  Users,
  UserPlus,
  CreditCard,
  Calendar,
  Clock,
  ClipboardList,
  Stethoscope,
  Settings,
};

export const TutorialChapterModal = () => {
  const {
    isChapterModalOpen,
    setIsChapterModalOpen,
    completedTutorials,
    startChapter,
    startMasterJourney,
    resetAllTutorials,
    completionPercentage,
    canPermission,
  } = useTutorial();

  const completedCount = TUTORIAL_CHAPTERS.filter((c) => completedTutorials[c.id]).length;

  return (
    <Dialog open={isChapterModalOpen} onOpenChange={setIsChapterModalOpen}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-4xl overflow-y-auto p-4 sm:p-6 rounded-2xl">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                Central de Treinamento & Tutoriais
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Aprenda a dominar 100% das ferramentas da plataforma em passos simples e guiados.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Master Journey Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/15 via-primary/5 to-accent/20 p-5 shadow-lg backdrop-blur-sm">
          <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 -bottom-10 h-44 w-44 rounded-full bg-emerald-500/20 blur-3xl" />

          <div className="relative z-10 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground font-semibold px-2.5 py-0.5">
                    🚀 Modo Jornada Completa
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    ~15 minutos no total
                  </span>
                </div>
                <h3 className="mt-1.5 text-base sm:text-lg font-bold text-foreground tracking-tight">
                  Jornada Linear Passo a Passo da Clínica
                </h3>
                <p className="text-xs text-muted-foreground max-w-xl">
                  Um guia contínuo que passa por todos os módulos: do cadastro de pacientes até o fluxo de atendimento, prescrição de tratamento e gestão financeira.
                </p>
              </div>

              <Button
                size="lg"
                onClick={() => startMasterJourney()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-md shadow-primary/30 gap-2 shrink-0 self-start sm:self-auto"
              >
                <Play className="h-4 w-4 fill-current" />
                Iniciar Jornada Completa
              </Button>
            </div>

            {/* Overall Progress Bar */}
            <div className="space-y-1.5 pt-2 border-t border-primary/20">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5 text-primary" />
                  Progresso dos Capítulos
                </span>
                <span className="font-bold text-primary">
                  {completedCount} de {TUTORIAL_CHAPTERS.length} concluídos ({completionPercentage}%)
                </span>
              </div>
              <Progress value={completionPercentage} className="h-2 rounded-full" />
            </div>
          </div>
        </div>

        {/* Chapters Grid */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Ou escolha um Capítulo Específico:
            </h4>
            {completedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetAllTutorials}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Reiniciar Progresso
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TUTORIAL_CHAPTERS.map((chapter) => {
              const isCompleted = Boolean(completedTutorials[chapter.id]);
              const isPermitted = canPermission(chapter.requiredPermission);
              const Icon = ICON_MAP[chapter.iconName] || ClipboardList;

              return (
                <div
                  key={chapter.id}
                  className={`group relative flex flex-col justify-between rounded-xl border p-4 transition-all duration-200 ${
                    !isPermitted
                      ? "opacity-60 border-border/40 bg-muted/20"
                      : isCompleted
                      ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50"
                      : "border-border/80 bg-card hover:border-primary/50 hover:shadow-md"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                            !isPermitted
                              ? "bg-muted text-muted-foreground"
                              : isCompleted
                              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          {chapter.badge}
                        </span>
                      </div>
                      {!isPermitted ? (
                        <Badge variant="outline" className="text-muted-foreground text-[10px] gap-1">
                          <Lock className="h-3 w-3" />
                          Restrito
                        </Badge>
                      ) : isCompleted ? (
                        <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[10px]">
                          <CheckCircle2 className="h-3 w-3" />
                          Concluído
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          ~{chapter.estimatedMinutes} min
                        </span>
                      )}
                    </div>

                    <div>
                      <h5 className="font-bold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {chapter.title}
                      </h5>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {chapter.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-border/40 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {chapter.steps.length} passos
                    </span>
                    <Button
                      size="sm"
                      disabled={!isPermitted}
                      variant={isCompleted ? "outline" : "default"}
                      className="h-8 text-xs font-semibold gap-1.5 shadow-sm"
                      onClick={() => startChapter(chapter.id)}
                    >
                      <span>{isCompleted ? "Rever" : "Iniciar"}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
