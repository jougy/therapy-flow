import { useMemo, useState } from "react";
import { Check, Copy, Eye, Loader2, Search, Share2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  getShareRecipientLabel,
  shareSessionsWithCollaborators,
  type SessionShareCollaborator,
  type SessionShareRecipient,
} from "@/lib/session-sharing";

type SessionShareDialogProps = {
  collaborators: SessionShareCollaborator[];
  currentUserId: string | null | undefined;
  existingRecipients?: SessionShareRecipient[];
  onOpenChange: (open: boolean) => void;
  onShared: () => void;
  open: boolean;
  sessionCount: number;
  sessionIds: string[];
};

const normalize = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  professional: "Profissional",
  assistant: "Assistente",
  estagiario: "Estagiário",
};

export const SessionShareDialog = ({
  collaborators,
  currentUserId,
  existingRecipients = [],
  onOpenChange,
  onShared,
  open,
  sessionCount,
  sessionIds,
}: SessionShareDialogProps) => {
  const [query, setQuery] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [accessLevel, setAccessLevel] = useState<"read_only" | "can_evolve">("read_only");
  const [sharing, setSharing] = useState(false);

  const existingRecipientMap = useMemo(
    () => new Map(existingRecipients.map((recipient) => [recipient.id, recipient])),
    [existingRecipients]
  );

  const visibleCollaborators = useMemo(() => {
    const normalizedQuery = normalize(query);

    return collaborators.filter((collaborator) => {
      if (collaborator.id === currentUserId) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return normalize(
        [
          collaborator.full_name,
          collaborator.email,
          collaborator.job_title,
          collaborator.operational_role,
        ].filter(Boolean).join(" ")
      ).includes(normalizedQuery);
    });
  }, [collaborators, currentUserId, query]);

  const toggleUser = (userId: string) => {
    if (existingRecipientMap.has(userId)) {
      return;
    }

    setSelectedUserIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  };

  const handleShare = async () => {
    if (sessionIds.length === 0 || selectedUserIds.length === 0) {
      return;
    }

    setSharing(true);

    try {
      await shareSessionsWithCollaborators(sessionIds, selectedUserIds, accessLevel);
      toast({
        title: "Atendimentos compartilhados",
        description: `${sessionCount} atendimento(s) compartilhado(s) com ${selectedUserIds.length} colaborador(es).`,
      });
      setSelectedUserIds([]);
      setQuery("");
      onShared();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Não foi possível compartilhar",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Compartilhar com colaboradores
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{sessionCount} atendimento(s)</Badge>
            <span>Selecione os colaboradores e o nível de acesso permitido.</span>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Permissão concedida no compartilhamento
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border p-2.5 text-left text-xs transition-colors",
                  accessLevel === "read_only"
                    ? "border-primary bg-primary/10 text-foreground font-medium shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/60"
                )}
                onClick={() => setAccessLevel("read_only")}
              >
                <Eye className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Apenas visualizar</p>
                  <p className="mt-0.5 text-[0.72rem] text-muted-foreground leading-tight">
                    O colaborador poderá apenas ler os detalhes do atendimento.
                  </p>
                </div>
              </button>

              <button
                type="button"
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border p-2.5 text-left text-xs transition-colors",
                  accessLevel === "can_evolve"
                    ? "border-primary bg-primary/10 text-foreground font-medium shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/60"
                )}
                onClick={() => setAccessLevel("can_evolve")}
              >
                <Copy className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Visualizar e iniciar novo</p>
                  <p className="mt-0.5 text-[0.72rem] text-muted-foreground leading-tight">
                    Permite visualizar e iniciar um novo atendimento a partir deste.
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome, email, função ou cargo"
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[280px] rounded-lg border">
            <div className="divide-y">
              {visibleCollaborators.map((collaborator) => {
                const existingRecipient = existingRecipientMap.get(collaborator.id);
                const alreadyShared = Boolean(existingRecipient);
                const selected = selectedUserIds.includes(collaborator.id);

                return (
                  <button
                    key={collaborator.id}
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-70"
                    onClick={() => toggleUser(collaborator.id)}
                    disabled={alreadyShared}
                  >
                    <Checkbox checked={alreadyShared || selected} aria-label={`Selecionar ${getShareRecipientLabel(collaborator)}`} />
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {getShareRecipientLabel(collaborator).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{getShareRecipientLabel(collaborator)}</p>
                      <p className="truncate text-xs text-muted-foreground">{collaborator.email || "Sem email"}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {collaborator.operational_role ? (
                        <Badge variant="outline" className="hidden sm:inline-flex">
                          {roleLabels[collaborator.operational_role] ?? collaborator.operational_role}
                        </Badge>
                      ) : null}
                      {alreadyShared ? (
                        <Badge variant="secondary" className="gap-1">
                          <Check className="h-3 w-3" />
                          {existingRecipient?.access_level === "can_evolve" ? "Pode iniciar novo" : "Visualização"}
                        </Badge>
                      ) : null}
                    </div>
                  </button>
                );
              })}
              {visibleCollaborators.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
                  <Users className="h-5 w-5" />
                  Nenhum colaborador encontrado.
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sharing}>
            Cancelar
          </Button>
          <Button onClick={() => void handleShare()} disabled={sharing || selectedUserIds.length === 0}>
            {sharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
            Compartilhar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
