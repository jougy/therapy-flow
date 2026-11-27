import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, PlusCircle, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logRuntimeError } from "@/lib/runtime-debug";
import { cn } from "@/lib/utils";
import { readLocalReleaseAck, writeLocalReleaseAck } from "./release-notes/releaseNotesStorage";

type ReleaseNoteCategory = "fixed" | "added" | "changed" | "removed";

interface ReleaseNoteItem {
  body?: string | null;
  category: ReleaseNoteCategory;
  id: string;
  sort_order?: number;
  title: string;
}

interface PendingRelease {
  id: string;
  items: ReleaseNoteItem[];
  published_at: string;
  summary?: string | null;
  title: string;
  version: string;
  version_order: number;
}

interface PendingReleasePayload {
  categories?: Array<{ category: ReleaseNoteCategory; count: number }>;
  latest_release_id?: string;
  latest_version?: string;
  reason?: string;
  releases?: PendingRelease[];
  should_show?: boolean;
}

const CATEGORY_CONFIG: Record<
  ReleaseNoteCategory,
  {
    icon: typeof CheckCircle2;
    label: string;
    tone: string;
    pillActive: string;
  }
> = {
  added: {
    icon: PlusCircle,
    label: "Adicionado",
    tone: "text-sky-600 dark:text-sky-400",
    pillActive: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  changed: {
    icon: RefreshCw,
    label: "Alterado",
    tone: "text-amber-600 dark:text-amber-400",
    pillActive: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  fixed: {
    icon: CheckCircle2,
    label: "Reparado",
    tone: "text-emerald-600 dark:text-emerald-400",
    pillActive: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  removed: {
    icon: Trash2,
    label: "Removido",
    tone: "text-rose-600 dark:text-rose-400",
    pillActive: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
};

const CATEGORY_ORDER: ReleaseNoteCategory[] = ["added", "changed", "fixed", "removed"];

const isReleaseNoteCategory = (value: unknown): value is ReleaseNoteCategory =>
  value === "fixed" || value === "added" || value === "changed" || value === "removed";

const parsePendingReleasePayload = (value: unknown): PendingReleasePayload => {
  if (!value || typeof value !== "object") {
    return { should_show: false };
  }

  const payload = value as PendingReleasePayload;
  const releases = Array.isArray(payload.releases)
    ? payload.releases.map((release) => ({
        ...release,
        items: Array.isArray(release.items)
          ? release.items.filter((item) => isReleaseNoteCategory(item.category))
          : [],
      }))
    : [];

  return {
    ...payload,
    releases,
    should_show: payload.should_show === true,
  };
};

const ReleaseNotesDialog = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ReleaseNoteCategory>("added");
  const [payload, setPayload] = useState<PendingReleasePayload | null>(null);
  const acknowledgingRef = useRef(false);

  const syncAcknowledgeInBackground = useCallback(
    async (userId: string, releaseId: string, versionOrder: number) => {
      if (acknowledgingRef.current) return;
      acknowledgingRef.current = true;
      try {
        const { error } = await supabase.rpc("acknowledge_current_user_release_notes", {
          _release_id: releaseId,
        });

        if (error) {
          logRuntimeError("release_notes.acknowledge", error, {
            releaseId,
            userId,
          });
          return;
        }

        writeLocalReleaseAck(userId, { releaseId, versionOrder, synced: true });
      } catch (err) {
        logRuntimeError("release_notes.acknowledge", err, {
          releaseId,
          userId,
        });
      } finally {
        acknowledgingRef.current = false;
      }
    },
    []
  );

  useEffect(() => {
    if (!user?.id) {
      setOpen(false);
      setPayload(null);
      return;
    }

    let cancelled = false;

    const fetchPendingReleaseNotes = async () => {
      setLoading(true);

      try {
        const { data, error } = await supabase.rpc("get_current_user_pending_release_notes");

        if (cancelled) return;
        setLoading(false);

        if (error) {
          logRuntimeError("release_notes.fetch_pending", error, { userId: user.id });
          return;
        }

        const nextPayload = parsePendingReleasePayload(data);
        const releases = nextPayload.releases ?? [];
        const maxVersionOrder = releases.reduce((max, r) => Math.max(max, r.version_order ?? 0), 0);
        const localAck = readLocalReleaseAck(user.id);

        // Se o usuário já dispensou esta versão localmente (ex.: falha prévia de rede/RLS),
        // nunca reabre o modal bloqueando o sistema; apenas reconcilia em background.
        if (
          nextPayload.should_show &&
          localAck &&
          maxVersionOrder > 0 &&
          localAck.versionOrder >= maxVersionOrder
        ) {
          setPayload(nextPayload);
          setOpen(false);
          if (!localAck.synced && nextPayload.latest_release_id) {
            void syncAcknowledgeInBackground(user.id, nextPayload.latest_release_id, maxVersionOrder);
          }
          return;
        }

        setPayload(nextPayload);

        const firstCategoryWithItems =
          CATEGORY_ORDER.find((category) =>
            releases.some((release) => release.items.some((item) => item.category === category))
          ) ?? "added";

        setActiveCategory(firstCategoryWithItems);
        setOpen(nextPayload.should_show === true && releases.length > 0);
      } catch (err) {
        if (!cancelled) {
          setLoading(false);
          logRuntimeError("release_notes.fetch_pending", err, { userId: user.id });
        }
      }
    };

    void fetchPendingReleaseNotes();

    return () => {
      cancelled = true;
    };
  }, [user?.id, syncAcknowledgeInBackground]);

  const itemsByCategory = useMemo(() => {
    const grouped = Object.fromEntries(CATEGORY_ORDER.map((category) => [category, []])) as Record<
      ReleaseNoteCategory,
      Array<ReleaseNoteItem & { release: PendingRelease }>
    >;

    for (const release of payload?.releases ?? []) {
      for (const item of release.items) {
        grouped[item.category].push({ ...item, release });
      }
    }

    return grouped;
  }, [payload?.releases]);

  const releaseCount = payload?.releases?.length ?? 0;
  const latestVersion = payload?.latest_version;
  const latestVersionOrder = useMemo(
    () => (payload?.releases ?? []).reduce((max, r) => Math.max(max, r.version_order ?? 0), 0),
    [payload?.releases]
  );

  // Dismiss otimista: fecha o modal imediatamente e persiste localmente,
  // garantindo que o usuário jamais fique preso por falha de rede ou RLS.
  const dismissAndAcknowledge = useCallback(() => {
    setOpen(false);

    if (!user?.id || !payload?.latest_release_id) {
      return;
    }

    writeLocalReleaseAck(user.id, {
      releaseId: payload.latest_release_id,
      versionOrder: latestVersionOrder,
      synced: false,
    });

    void syncAcknowledgeInBackground(user.id, payload.latest_release_id, latestVersionOrder);
  }, [user?.id, payload?.latest_release_id, latestVersionOrder, syncAcknowledgeInBackground]);

  if (!payload || loading) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          dismissAndAcknowledge();
          return;
        }
        setOpen(nextOpen);
      }}
    >
      <DialogContent className="flex flex-col max-h-[88dvh] w-[calc(100vw-1.5rem)] max-w-3xl gap-0 overflow-hidden p-0 rounded-2xl border border-border/80 shadow-2xl">
        <DialogHeader className="shrink-0 border-b border-border/70 bg-muted/20 px-4 sm:px-6 py-4 text-left">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-10">
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="space-y-1 min-w-0">
                <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight">
                  Novidades da plataforma
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
                  {releaseCount > 1
                    ? `Resumo das últimas ${releaseCount} atualizações que você ainda não tinha visto.`
                    : "Veja o que mudou desde seu último acesso."}
                </DialogDescription>
              </div>
            </div>
            {latestVersion && (
              <Badge variant="secondary" className="shrink-0 font-mono text-[11px]">
                {latestVersion}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 flex-col md:flex-row">
          {/* Mobile: barra horizontal compacta de categorias | Desktop: rail lateral */}
          <aside className="shrink-0 border-b border-border/70 bg-muted/15 p-2.5 sm:p-3 md:w-[210px] md:border-b-0 md:border-r">
            <nav
              aria-label="Categorias de novidades"
              className="flex gap-1.5 overflow-x-auto pb-0.5 md:flex-col md:overflow-x-visible md:pb-0"
            >
              {CATEGORY_ORDER.map((category) => {
                const Icon = CATEGORY_CONFIG[category].icon;
                const count = itemsByCategory[category].length;
                const isActive = activeCategory === category;

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={cn(
                      "flex min-h-[44px] shrink-0 items-center justify-between gap-2.5 rounded-xl border px-3 py-2 text-left text-xs sm:text-sm font-medium transition-colors",
                      isActive
                        ? cn("shadow-sm", CATEGORY_CONFIG[category].pillActive)
                        : "border-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground"
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon className={cn("h-4 w-4 shrink-0", CATEGORY_CONFIG[category].tone)} />
                      <span className="truncate">{CATEGORY_CONFIG[category].label}</span>
                    </span>
                    <Badge
                      variant={count > 0 ? "secondary" : "outline"}
                      className="h-5 min-w-[22px] justify-center px-1.5 text-[11px] tabular-nums"
                    >
                      {count}
                    </Badge>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Corpo com scroll independente */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5">
            <div className="space-y-3">
              {itemsByCategory[activeCategory].length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
                  Nenhum item marcado como {CATEGORY_CONFIG[activeCategory].label.toLowerCase()} nesta atualização.
                </div>
              ) : (
                itemsByCategory[activeCategory].map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-colors hover:border-border"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold leading-snug text-foreground">
                          {item.title}
                        </h3>
                        {item.body && (
                          <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-muted-foreground">
                            {item.body}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                        {item.release.version}
                      </Badge>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 sticky bottom-0 pb-safe z-10 border-t border-border/70 bg-background/95 backdrop-blur px-4 sm:px-6 py-3.5 flex-row items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {itemsByCategory[activeCategory].length}{" "}
            {itemsByCategory[activeCategory].length === 1 ? "item" : "itens"} em{" "}
            {CATEGORY_CONFIG[activeCategory].label}
          </span>
          <Button
            type="button"
            onClick={dismissAndAcknowledge}
            className="min-h-[44px] w-full sm:w-auto px-6 font-medium"
          >
            Entendi, continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReleaseNotesDialog;
