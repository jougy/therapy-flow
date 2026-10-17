import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import type { EvolutionGroupMetadata } from "@/lib/patient-sessions-view";
import type { Session } from "./pacienteDetalheTypes";

export interface LinkSessionEvolutionGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: Session | null;
  evolutionGroupsMetadata: EvolutionGroupMetadata[];
  evolutionGroupsView?: Array<{
    id: string;
    tagGroups: Array<{ name: string }>;
    sessionCount: number;
  }>;
  onLinkGroup: (session: Session, groupId: string) => void;
}

export const LinkSessionEvolutionGroupDialog: React.FC<LinkSessionEvolutionGroupDialogProps> = ({
  open,
  onOpenChange,
  session,
  evolutionGroupsMetadata,
  evolutionGroupsView,
  onLinkGroup,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular a Grupo de Evolução</DialogTitle>
          <DialogDescription>
            Selecione o ciclo de evolução para o atendimento de {session ? new Date(session.session_date).toLocaleDateString("pt-BR") : ""}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2.5 py-2">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start text-left h-auto py-2.5 px-3 rounded-xl border-dashed hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30 transition-colors"
            onClick={() => {
              if (session) onLinkGroup(session, "none");
            }}
          >
            <div>
              <p className="font-semibold text-xs">Tornar Atendimento Avulso</p>
              <p className="text-[11px] text-muted-foreground">Desvincula este atendimento de qualquer grupo de evolução.</p>
            </div>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full justify-start text-left h-auto py-2.5 px-3 rounded-xl border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors"
            onClick={() => {
              if (session) onLinkGroup(session, "__new__");
            }}
          >
            <div>
              <p className="font-semibold text-xs text-primary">+ Criar Novo Grupo de Evolução</p>
              <p className="text-[11px] text-muted-foreground">Inicia um novo ciclo de evolução a partir deste atendimento.</p>
            </div>
          </Button>

          {evolutionGroupsMetadata.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Grupos Existentes</p>
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {evolutionGroupsMetadata.map((group) => {
                  const matchedGroupView = evolutionGroupsView?.find((g) => g.id === group.id);
                  const label = group.custom_name || (matchedGroupView?.tagGroups.map((g) => g.name).join(" · ")) || `Ciclo (${String(group?.id || "").slice(0, 6)})`;
                  const count = matchedGroupView?.sessionCount ?? 0;
                  const isCurrent = session?.evolution_group_id === group.id;

                  return (
                    <Button
                      key={group.id}
                      type="button"
                      variant={isCurrent ? "secondary" : "outline"}
                      className={`w-full justify-between text-left h-auto py-2.5 px-3 rounded-xl ${isCurrent ? "ring-1 ring-primary/40" : ""}`}
                      onClick={() => {
                        if (session) onLinkGroup(session, group.id);
                      }}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-medium text-xs truncate">{label}</p>
                        <p className="text-[10px] text-muted-foreground">{count} {count === 1 ? "atendimento" : "atendimentos"}</p>
                      </div>
                      {isCurrent ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> : null}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
