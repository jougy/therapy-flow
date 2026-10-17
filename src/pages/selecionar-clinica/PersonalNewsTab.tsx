import { Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlatformReleaseNotesManager } from "@/components/PlatformReleaseNotesManager";
import { cn } from "@/lib/utils";
import type { ReleaseNote, ReleaseNoteCategory, ReleaseNoteItem } from "./selecionarClinicaTypes";
import { categoryOrder, categoryIcons, categoryLabels } from "./selecionarClinicaUtils";

export interface PersonalNewsTabProps {
  isPlatformOwner: boolean;
  loadingReleaseNotes: boolean;
  releaseNotes: ReleaseNote[];
  releaseItemsByCategory: Record<ReleaseNoteCategory, Array<ReleaseNoteItem & { release: ReleaseNote }>>;
  activeReleaseCategory: ReleaseNoteCategory;
  setActiveReleaseCategory: (category: ReleaseNoteCategory) => void;
  isReleaseEditorOpen: boolean;
  setIsReleaseEditorOpen: (open: boolean) => void;
  onRefreshReleaseNotes: () => void | Promise<void>;
}

export function PersonalNewsTab({
  isPlatformOwner,
  loadingReleaseNotes,
  releaseNotes,
  releaseItemsByCategory,
  activeReleaseCategory,
  setActiveReleaseCategory,
  isReleaseEditorOpen,
  setIsReleaseEditorOpen,
  onRefreshReleaseNotes,
}: PersonalNewsTabProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">Novidades</CardTitle>
          <p className="text-sm text-muted-foreground">Histórico de notas de atualização publicadas na plataforma.</p>
        </div>
        {isPlatformOwner && (
          <Button variant="outline" size="sm" onClick={() => setIsReleaseEditorOpen(true)}>
            <Pencil className="mr-2 h-4 w-4 text-primary" />
            Editar Novidades
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loadingReleaseNotes ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : releaseNotes.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma nota de atualização publicada ainda.
          </div>
        ) : (
          <div className="min-w-0 space-y-4">
            <nav className="flex w-full min-w-0 max-w-full gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {categoryOrder.map((category) => {
                const Icon = categoryIcons[category];
                const count = releaseItemsByCategory[category].length;
                const isActive = activeReleaseCategory === category;

                return (
                  <button
                    key={category}
                    type="button"
                    className={cn(
                      "flex h-10 shrink-0 items-center justify-between gap-2 rounded-md border px-3 text-sm transition sm:min-w-40",
                      isActive ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setActiveReleaseCategory(category)}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {categoryLabels[category]}
                    </span>
                    <Badge variant="secondary">{count}</Badge>
                  </button>
                );
              })}
            </nav>

            <div className="min-w-0 space-y-3">
              {releaseItemsByCategory[activeReleaseCategory].length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  Nenhum tópico marcado como {categoryLabels[activeReleaseCategory].toLowerCase()}.
                </div>
              ) : (
                releaseItemsByCategory[activeReleaseCategory].map((item) => (
                  <article key={item.id} className="rounded-lg border bg-background p-4">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                      <div className="min-w-0 sm:pr-3">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium leading-snug">{item.title}</h3>
                          {isPlatformOwner && (
                            <button
                              type="button"
                              onClick={() => setIsReleaseEditorOpen(true)}
                              className="text-xs text-muted-foreground hover:text-primary"
                              title="Editar via acesso master"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        {item.body && <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>}
                      </div>
                      <Badge variant="outline" className="w-fit shrink-0 justify-self-start sm:justify-self-end">{item.release.version}</Badge>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        )}
      </CardContent>

      {isPlatformOwner && (
        <Dialog open={isReleaseEditorOpen} onOpenChange={setIsReleaseEditorOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Gerenciador de Novidades (Acesso Mestre)</DialogTitle>
              <DialogDescription>
                Crie, edite e remova versões e tópicos de novidades do sistema.
              </DialogDescription>
            </DialogHeader>
            <PlatformReleaseNotesManager
              onNotesUpdated={onRefreshReleaseNotes}
            />
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
