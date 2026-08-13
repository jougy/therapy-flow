import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
};

type CategoryType = "added" | "changed" | "fixed" | "removed";

interface ReleaseItem {
  id: string;
  release_id: string;
  category: CategoryType;
  title: string;
  body: string | null;
  sort_order: number;
}

interface ReleaseVersion {
  id: string;
  version: string;
  version_order: number;
  title: string;
  summary: string | null;
  published_at: string;
  is_active: boolean;
}

const CATEGORY_OPTIONS: { value: CategoryType; label: string; badgeVariant: "default" | "secondary" | "outline" | "destructive" }[] = [
  { value: "added", label: "Adicionado", badgeVariant: "default" },
  { value: "changed", label: "Alterado", badgeVariant: "secondary" },
  { value: "fixed", label: "Reparado", badgeVariant: "outline" },
  { value: "removed", label: "Removido", badgeVariant: "destructive" },
];

interface PlatformReleaseNotesManagerProps {
  onNotesUpdated?: () => void;
  standalone?: boolean;
}

export function PlatformReleaseNotesManager({ onNotesUpdated, standalone = false }: PlatformReleaseNotesManagerProps) {
  const [loading, setLoading] = useState(true);
  const [releases, setReleases] = useState<ReleaseVersion[]>([]);
  const [items, setItems] = useState<ReleaseItem[]>([]);
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);

  // Modals state
  const [isReleaseDialogOpen, setIsReleaseDialogOpen] = useState(false);
  const [editingRelease, setEditingRelease] = useState<ReleaseVersion | null>(null);
  const [releaseVersion, setReleaseVersion] = useState("");
  const [releaseTitle, setReleaseTitle] = useState("");
  const [releaseSummary, setReleaseSummary] = useState("");
  const [releaseIsActive, setReleaseIsActive] = useState(true);
  const [submittingRelease, setSubmittingRelease] = useState(false);

  // Item form modal
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReleaseItem | null>(null);
  const [itemCategory, setItemCategory] = useState<CategoryType>("added");
  const [itemTitle, setItemTitle] = useState("");
  const [itemBody, setItemBody] = useState("");
  const [itemSortOrder, setItemSortOrder] = useState<number>(10);
  const [submittingItem, setSubmittingItem] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: releasesData, error: releasesErr }, { data: itemsData, error: itemsErr }] = await Promise.all([
        supabase
          .from("platform_releases")
          .select("*")
          .order("version_order", { ascending: false }),
        supabase
          .from("platform_release_note_items")
          .select("*")
          .order("sort_order", { ascending: true }),
      ]);

      if (releasesErr) throw releasesErr;
      if (itemsErr) throw itemsErr;

      const loadedReleases = (releasesData as ReleaseVersion[]) || [];
      const loadedItems = (itemsData as ReleaseItem[]) || [];

      setReleases(loadedReleases);
      setItems(loadedItems);

      if (loadedReleases.length > 0) {
        setSelectedReleaseId((prev) => (prev && loadedReleases.some((r) => r.id === prev) ? prev : loadedReleases[0].id));
      }
    } catch (err: unknown) {
      toast({
        title: "Erro ao carregar novidades",
        description: getErrorMessage(err) || "Não foi possível carregar a lista de lançamentos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedRelease = releases.find((r) => r.id === selectedReleaseId);
  const currentReleaseItems = items.filter((i) => i.release_id === selectedReleaseId);

  // Open Release Dialog
  const handleOpenReleaseDialog = (release?: ReleaseVersion) => {
    if (release) {
      setEditingRelease(release);
      setReleaseVersion(release.version);
      setReleaseTitle(release.title);
      setReleaseSummary(release.summary || "");
      setReleaseIsActive(release.is_active);
    } else {
      setEditingRelease(null);
      const today = new Date();
      const year = today.getFullYear().toString().slice(-2);
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      setReleaseVersion(`alfa-${year}.${month}.${day}-01`);
      setReleaseTitle("");
      setReleaseSummary("");
      setReleaseIsActive(true);
    }
    setIsReleaseDialogOpen(true);
  };

  // Save Release
  const handleSaveRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!releaseVersion.trim() || !releaseTitle.trim()) {
      toast({ title: "Preencha os campos obrigatórios", description: "Versão e título são obrigatórios.", variant: "destructive" });
      return;
    }

    setSubmittingRelease(true);
    try {
      const digits = releaseVersion.replace(/\D/g, "");
      const versionOrder = digits.length >= 8 ? parseInt(digits.slice(0, 10), 10) : Date.now();

      if (releaseIsActive && editingRelease) {
        await supabase
          .from("platform_releases")
          .update({ is_active: false })
          .neq("id", editingRelease.id);
      } else if (releaseIsActive && !editingRelease) {
        await supabase
          .from("platform_releases")
          .update({ is_active: false })
          .eq("is_active", true);
      }

      if (editingRelease) {
        const { error } = await supabase
          .from("platform_releases")
          .update({
            version: releaseVersion.trim(),
            version_order: versionOrder,
            title: releaseTitle.trim(),
            summary: releaseSummary.trim() || null,
            is_active: releaseIsActive,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingRelease.id);

        if (error) throw error;
        toast({ title: "Versão atualizada", description: `Versão ${releaseVersion} atualizada com sucesso.` });
      } else {
        const { data, error } = await supabase
          .from("platform_releases")
          .insert({
            version: releaseVersion.trim(),
            version_order: versionOrder,
            title: releaseTitle.trim(),
            summary: releaseSummary.trim() || null,
            is_active: releaseIsActive,
            published_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;
        if (data) setSelectedReleaseId(data.id);
        toast({ title: "Nova versão criada", description: `Versão ${releaseVersion} adicionada.` });
      }

      setIsReleaseDialogOpen(false);
      await loadData();
      onNotesUpdated?.();
    } catch (err: unknown) {
      toast({
        title: "Erro ao salvar versão",
        description: getErrorMessage(err) || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmittingRelease(false);
    }
  };

  // Delete Release
  const handleDeleteRelease = async (releaseId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta versão e todos os seus tópicos?")) return;
    try {
      const { error } = await supabase.from("platform_releases").delete().eq("id", releaseId);
      if (error) throw error;
      toast({ title: "Versão removida", description: "Lançamento excluído com sucesso." });
      await loadData();
      onNotesUpdated?.();
    } catch (err: unknown) {
      toast({ title: "Erro ao excluir versão", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  // Open Item Dialog
  const handleOpenItemDialog = (item?: ReleaseItem) => {
    if (!selectedReleaseId) {
      toast({ title: "Selecione uma versão", description: "Crie ou selecione uma versão antes de adicionar tópicos.", variant: "destructive" });
      return;
    }

    if (item) {
      setEditingItem(item);
      setItemCategory(item.category);
      setItemTitle(item.title);
      setItemBody(item.body || "");
      setItemSortOrder(item.sort_order);
    } else {
      setEditingItem(null);
      setItemCategory("added");
      setItemTitle("");
      setItemBody("");
      setItemSortOrder((currentReleaseItems.length + 1) * 10);
    }
    setIsItemDialogOpen(true);
  };

  // Save Item
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitle.trim() || !selectedReleaseId) {
      toast({ title: "Título obrigatório", description: "Informe um título para o tópico.", variant: "destructive" });
      return;
    }

    setSubmittingItem(true);
    try {
      if (editingItem) {
        const { error } = await supabase
          .from("platform_release_note_items")
          .update({
            category: itemCategory,
            title: itemTitle.trim(),
            body: itemBody.trim() || null,
            sort_order: itemSortOrder,
          })
          .eq("id", editingItem.id);

        if (error) throw error;
        toast({ title: "Tópico atualizado", description: "Alterações salvas com sucesso." });
      } else {
        const { error } = await supabase
          .from("platform_release_note_items")
          .insert({
            release_id: selectedReleaseId,
            category: itemCategory,
            title: itemTitle.trim(),
            body: itemBody.trim() || null,
            sort_order: itemSortOrder,
          });

        if (error) throw error;
        toast({ title: "Tópico adicionado", description: "Novo tópico adicionado às novidades." });
      }

      setIsItemDialogOpen(false);
      await loadData();
      onNotesUpdated?.();
    } catch (err: unknown) {
      toast({ title: "Erro ao salvar tópico", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setSubmittingItem(false);
    }
  };

  // Delete Item
  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Excluir este tópico de novidades?")) return;
    try {
      const { error } = await supabase.from("platform_release_note_items").delete().eq("id", itemId);
      if (error) throw error;
      toast({ title: "Tópico removido", description: "Tópico excluído." });
      await loadData();
      onNotesUpdated?.();
    } catch (err: unknown) {
      toast({ title: "Erro ao excluir tópico", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  return (
    <div className={cn("space-y-6", standalone && "rounded-lg border bg-card p-6 shadow-sm")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Megaphone className="h-5 w-5 text-primary" />
            Editor de Novidades da Plataforma (Acesso Mestre)
          </h2>
          <p className="text-sm text-muted-foreground">
            Gerencie as notas de atualização visíveis aos usuários das clínicas. NUNCA publique dados confidenciais do Backoffice.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => handleOpenReleaseDialog()}>
            <Plus className="h-4 w-4 mr-1" />
            Nova Versão
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : releases.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma versão cadastrada ainda. Clique em "Nova Versão" para começar.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          {/* Release version list sidebar */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Versões Publicadas ({releases.length})
            </div>
            <div className="space-y-1.5">
              {releases.map((rel) => (
                <div
                  key={rel.id}
                  onClick={() => setSelectedReleaseId(rel.id)}
                  className={cn(
                    "group flex cursor-pointer items-center justify-between rounded-lg border p-3 text-sm transition hover:border-primary/50",
                    selectedReleaseId === rel.id ? "border-primary bg-primary/5 font-medium text-foreground" : "bg-background text-muted-foreground"
                  )}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-xs">{rel.version}</span>
                      {rel.is_active && (
                        <Badge variant="default" className="px-1.5 py-0 text-[10px]">
                          Ativa
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs font-normal text-muted-foreground">{rel.title}</div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenReleaseDialog(rel);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDeleteRelease(rel.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Release detail & items editor */}
          {selectedRelease ? (
            <div className="space-y-4 rounded-lg border bg-background p-4 sm:p-6">
              <div className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">{selectedRelease.version}</Badge>
                    {selectedRelease.is_active ? (
                      <Badge variant="default">Exibida em Destaque</Badge>
                    ) : (
                      <Badge variant="secondary">Inativa</Badge>
                    )}
                  </div>
                  <h3 className="mt-2 text-base font-semibold">{selectedRelease.title}</h3>
                  {selectedRelease.summary && (
                    <p className="mt-1 text-sm text-muted-foreground">{selectedRelease.summary}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                  <Button variant="outline" size="sm" onClick={() => handleOpenReleaseDialog(selectedRelease)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Editar Lançamento
                  </Button>
                  <Button size="sm" onClick={() => handleOpenItemDialog()}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Novo Tópico
                  </Button>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Tópicos de Novidades ({currentReleaseItems.length})</span>
                  <span>Categoria / Ações</span>
                </div>

                {currentReleaseItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Nenhum tópico cadastrado nesta versão. Clique em "Novo Tópico" para adicionar.
                  </div>
                ) : (
                  currentReleaseItems.map((item) => {
                    const categoryOption = CATEGORY_OPTIONS.find((c) => c.value === item.category);
                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-sm transition hover:border-border sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={categoryOption?.badgeVariant || "outline"} className="text-xs">
                              {categoryOption?.label || item.category}
                            </Badge>
                            <span className="font-medium text-foreground">{item.title}</span>
                          </div>
                          {item.body && <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{item.body}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleOpenItemDialog(item)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => void handleDeleteItem(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-lg border border-dashed py-12 text-sm text-muted-foreground">
              Selecione uma versão na lista ao lado.
            </div>
          )}
        </div>
      )}

      {/* Release Dialog Modal */}
      <Dialog open={isReleaseDialogOpen} onOpenChange={setIsReleaseDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingRelease ? "Editar Lançamento" : "Nova Versão de Novidades"}</DialogTitle>
            <DialogDescription>
              Cadastre ou altere as informações gerais do lançamento de versão.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveRelease} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="rel-version">Identificador da Versão *</Label>
              <Input
                id="rel-version"
                placeholder="Ex: alfa-26.07.29-01"
                value={releaseVersion}
                onChange={(e) => setReleaseVersion(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rel-title">Título Principal *</Label>
              <Input
                id="rel-title"
                placeholder="Ex: Bloco de endereço inteligente e kit de anamnese offline"
                value={releaseTitle}
                onChange={(e) => setReleaseTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rel-summary">Resumo Explicativo</Label>
              <Textarea
                id="rel-summary"
                rows={3}
                placeholder="Resumo em uma linha destacado aos clientes das clínicas..."
                value={releaseSummary}
                onChange={(e) => setReleaseSummary(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="rel-active" className="cursor-pointer font-medium">
                  Versão Ativa em Destaque
                </Label>
                <p className="text-xs text-muted-foreground">Quando ativa, esta versão substitui a destaque no painel de novidades.</p>
              </div>
              <Switch id="rel-active" checked={releaseIsActive} onCheckedChange={setReleaseIsActive} />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsReleaseDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submittingRelease}>
                {submittingRelease && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Versão
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Item Dialog Modal */}
      <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Tópico" : "Novo Tópico de Novidade"}</DialogTitle>
            <DialogDescription>
              Adicione um item no histórico de novidades da versão {selectedRelease?.version}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveItem} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="item-category">Categoria *</Label>
              <Select value={itemCategory} onValueChange={(val) => setItemCategory(val as CategoryType)}>
                <SelectTrigger id="item-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-title">Título do Tópico *</Label>
              <Input
                id="item-title"
                placeholder="Ex: Bloco de endereço completo com busca de CEP"
                value={itemTitle}
                onChange={(e) => setItemTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-body">Descrição Detalhada</Label>
              <Textarea
                id="item-body"
                rows={3}
                placeholder="Explique o que mudou e o benefício direto para os usuários..."
                value={itemBody}
                onChange={(e) => setItemBody(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-sort">Ordem de Exibição (Numérica)</Label>
              <Input
                id="item-sort"
                type="number"
                value={itemSortOrder}
                onChange={(e) => setItemSortOrder(parseInt(e.target.value, 10) || 10)}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsItemDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submittingItem}>
                {submittingItem && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Tópico
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
