import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, PlusCircle, RefreshCw, Trash2 } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logRuntimeError } from "@/lib/runtime-debug";
import { cn } from "@/lib/utils";

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
  }
> = {
  fixed: {
    icon: CheckCircle2,
    label: "Reparado",
    tone: "text-emerald-700",
  },
  added: {
    icon: PlusCircle,
    label: "Adicionado",
    tone: "text-sky-700",
  },
  changed: {
    icon: RefreshCw,
    label: "Alterado",
    tone: "text-amber-700",
  },
  removed: {
    icon: Trash2,
    label: "Removido",
    tone: "text-rose-700",
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
  const [acknowledging, setAcknowledging] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ReleaseNoteCategory>("added");
  const [payload, setPayload] = useState<PendingReleasePayload | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setOpen(false);
      setPayload(null);
      return;
    }

    let cancelled = false;

    const fetchPendingReleaseNotes = async () => {
      setLoading(true);

      const { data, error } = await supabase.rpc("get_current_user_pending_release_notes");

      if (cancelled) {
        return;
      }

      setLoading(false);

      if (error) {
        logRuntimeError("release_notes.fetch_pending", error, { userId: user.id });
        return;
      }

      const nextPayload = parsePendingReleasePayload(data);
      setPayload(nextPayload);

      const firstCategoryWithItems =
        CATEGORY_ORDER.find((category) =>
          nextPayload.releases?.some((release) => release.items.some((item) => item.category === category))
        ) ?? "added";

      setActiveCategory(firstCategoryWithItems);
      setOpen(nextPayload.should_show === true && (nextPayload.releases?.length ?? 0) > 0);
    };

    void fetchPendingReleaseNotes();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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

  const acknowledge = async () => {
    if (!payload?.latest_release_id) {
      setOpen(false);
      return;
    }

    setAcknowledging(true);

    const { error } = await supabase.rpc("acknowledge_current_user_release_notes", {
      _release_id: payload.latest_release_id,
    });

    setAcknowledging(false);

    if (error) {
      logRuntimeError("release_notes.acknowledge", error, {
        releaseId: payload.latest_release_id,
        userId: user?.id,
      });
      return;
    }

    setOpen(false);
  };

  if (!payload || loading) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) {
        void acknowledge();
        return;
      }

      setOpen(nextOpen);
    }}>
      <DialogContent className="max-h-[86vh] max-w-4xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div className="space-y-2">
              <DialogTitle>Novidades da plataforma</DialogTitle>
              <DialogDescription>
                {releaseCount > 1
                  ? `Resumo das ultimas ${releaseCount} atualizacoes que voce ainda nao tinha visto.`
                  : "Veja o que mudou desde seu ultimo acesso."}
              </DialogDescription>
            </div>
            {latestVersion && <Badge variant="outline">{latestVersion}</Badge>}
          </div>
        </DialogHeader>

        <div className="grid min-h-0 md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="border-b bg-muted/30 p-4 md:border-b-0 md:border-r">
            <nav className="grid gap-2">
              {CATEGORY_ORDER.map((category) => {
                const Icon = CATEGORY_CONFIG[category].icon;
                const count = itemsByCategory[category].length;

                return (
                  <button
                    key={category}
                    type="button"
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition",
                      activeCategory === category
                        ? "border-primary bg-background text-foreground shadow-sm"
                        : "border-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground"
                    )}
                    onClick={() => setActiveCategory(category)}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon className={cn("h-4 w-4 shrink-0", CATEGORY_CONFIG[category].tone)} />
                      <span className="truncate">{CATEGORY_CONFIG[category].label}</span>
                    </span>
                    <Badge variant={count > 0 ? "secondary" : "outline"}>{count}</Badge>
                  </button>
                );
              })}
            </nav>
          </aside>

          <ScrollArea className="max-h-[56vh] min-h-[360px]">
            <div className="space-y-4 p-5">
              {itemsByCategory[activeCategory].length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  Nenhum item marcado como {CATEGORY_CONFIG[activeCategory].label.toLowerCase()} nesta atualizacao.
                </div>
              ) : (
                itemsByCategory[activeCategory].map((item) => (
                  <article key={item.id} className="rounded-lg border bg-background p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-medium leading-snug">{item.title}</h3>
                        {item.body && <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>}
                      </div>
                      <Badge variant="outline" className="shrink-0">{item.release.version}</Badge>
                    </div>
                  </article>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" onClick={() => void acknowledge()} disabled={acknowledging}>
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReleaseNotesDialog;
