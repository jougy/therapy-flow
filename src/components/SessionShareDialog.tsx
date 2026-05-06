import { useMemo, useState } from "react";
import { Check, Loader2, Search, Share2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
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
  const [sharing, setSharing] = useState(false);

  const existingRecipientIds = useMemo(
    () => new Set(existingRecipients.map((recipient) => recipient.id)),
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
    if (existingRecipientIds.has(userId)) {
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
      await shareSessionsWithCollaborators(sessionIds, selectedUserIds);
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
            <span>Selecione um ou mais colaboradores ativos da clínica.</span>
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

          <ScrollArea className="h-[340px] rounded-lg border">
            <div className="divide-y">
              {visibleCollaborators.map((collaborator) => {
                const alreadyShared = existingRecipientIds.has(collaborator.id);
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
                          Já possui acesso
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
