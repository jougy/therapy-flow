import React, { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useClinicCollaboratorsQuery } from "@/hooks/queries/useClinicDataQueries";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Lock, Users, Search, ShieldCheck, UserCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExclusivePatientSelectorProps {
  isExclusive: boolean;
  onChangeIsExclusive: (val: boolean) => void;
  exclusiveUserIds: string[];
  onChangeExclusiveUserIds: (ids: string[]) => void;
  clinicId?: string;
  disabled?: boolean;
  className?: string;
}

export const ExclusivePatientSelector: React.FC<ExclusivePatientSelectorProps> = ({
  isExclusive,
  onChangeIsExclusive,
  exclusiveUserIds,
  onChangeExclusiveUserIds,
  clinicId,
  disabled = false,
  className,
}) => {
  const { clinic, clinicId: authClinicId } = useAuth();
  const effectiveClinicId = clinicId || authClinicId;
  const ownerUserId = clinic?.account_owner_user_id;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: rawCollaborators = [], isLoading } = useClinicCollaboratorsQuery(
    effectiveClinicId,
    Boolean(effectiveClinicId)
  );
  const eligibleCollaborators = useMemo(() => {
    return rawCollaborators.filter((collab) => {
      const isOwnerRole = collab.operational_role === "owner";
      const isOwnerId = Boolean(ownerUserId && collab.id === ownerUserId);
      return !isOwnerRole && !isOwnerId;
    });
  }, [rawCollaborators, ownerUserId]);

  const filteredCollaborators = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return eligibleCollaborators;
    return eligibleCollaborators.filter((collab) => {
      const name = (collab.full_name || "").toLowerCase();
      const email = (collab.email || "").toLowerCase();
      const job = (collab.job_title || "").toLowerCase();
      return name.includes(term) || email.includes(term) || job.includes(term);
    });
  }, [eligibleCollaborators, search]);

  const handleToggleCollab = (userId: string, shouldInclude: boolean) => {
    if (disabled) return;
    if (shouldInclude) {
      if (!exclusiveUserIds.includes(userId)) {
        onChangeExclusiveUserIds([...exclusiveUserIds, userId]);
      }
    } else {
      onChangeExclusiveUserIds(exclusiveUserIds.filter((id) => id !== userId));
    }
  };

  const handleSelectAllVisible = () => {
    if (disabled) return;
    const visibleIds = filteredCollaborators.map((c) => c.id);
    const merged = Array.from(new Set([...exclusiveUserIds, ...visibleIds]));
    onChangeExclusiveUserIds(merged);
  };

  const handleClearAll = () => {
    if (disabled) return;
    onChangeExclusiveUserIds([]);
  };

  const handleSwitchChange = (checked: boolean) => {
    if (disabled) return;
    onChangeIsExclusive(checked);
  };

  return (
    <div
      data-testid="exclusive-patient-selector"
      className={cn(
        "w-full max-w-full min-w-0 overflow-x-hidden rounded-xl border border-border/80 bg-muted/20 p-3.5 sm:p-4 transition-colors",
        isExclusive && "border-amber-500/30 bg-amber-500/[0.03]",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors mt-0.5",
              isExclusive
                ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "border-border bg-background text-muted-foreground"
            )}
          >
            <Lock className="h-4 w-4" />
          </div>

          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="exclusive-patient-switch"
                className="text-sm font-semibold tracking-tight text-foreground cursor-pointer select-none"
              >
                Paciente exclusivo
              </label>
              {isExclusive && (
                <Badge
                  variant="outline"
                  className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] font-medium px-2 py-0"
                >
                  {exclusiveUserIds.length === 0
                    ? "Somente proprietário"
                    : `${exclusiveUserIds.length} colaborador${exclusiveUserIds.length > 1 ? "es" : ""}`}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed break-words">
              Apenas o proprietário e os colaboradores selecionados terão acesso a este prontuário.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pl-12 sm:pl-0">
          {isExclusive && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDialogOpen(true)}
              disabled={disabled}
              className="gap-1.5 min-h-[40px] sm:min-h-0 sm:h-8 px-2.5 text-xs font-medium border-amber-500/30 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10"
              aria-label="Editar colaboradores com acesso"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Editar</span>
            </Button>
          )}

          <div className="flex items-center min-h-[44px]">
            <Switch
              id="exclusive-patient-switch"
              checked={isExclusive}
              onCheckedChange={handleSwitchChange}
              disabled={disabled}
              aria-label="Ativar exclusividade de paciente"
            />
          </div>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          className="w-full max-w-lg max-h-[88dvh] flex flex-col p-4 sm:p-6 overflow-hidden rounded-2xl"
          aria-describedby="exclusive-patient-dialog-description"
        >
          <DialogHeader className="space-y-1.5 pb-2 text-left">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <Lock className="h-4 w-4" />
              </div>
              <DialogTitle className="text-base sm:text-lg font-bold">
                Colaboradores com acesso
              </DialogTitle>
            </div>
            <DialogDescription
              id="exclusive-patient-dialog-description"
              className="text-xs sm:text-sm text-muted-foreground"
            >
              Selecione quais colaboradores podem visualizar e atender este paciente. O proprietário da clínica possui acesso nativo garantido.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
            <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="leading-snug">
              <strong>Proprietário da Clínica:</strong> Acesso irrestrito garantido por padrão (não listado abaixo).
            </span>
          </div>
          <div className="relative my-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Buscar colaborador por nome, cargo ou e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs sm:text-sm h-9"
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
            <span>
              {exclusiveUserIds.length} selecionado{exclusiveUserIds.length === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllVisible}
                disabled={filteredCollaborators.length === 0}
                className="text-xs font-medium text-primary hover:underline disabled:opacity-50 min-h-[32px] px-1"
              >
                Selecionar visíveis
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={handleClearAll}
                disabled={exclusiveUserIds.length === 0}
                className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 min-h-[32px] px-1"
              >
                Limpar
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain max-h-60 rounded-xl border border-border/60 divide-y divide-border/40 p-1">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-xs">Carregando colaboradores...</span>
              </div>
            ) : filteredCollaborators.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Nenhum colaborador encontrado</p>
                <p>
                  {search
                    ? "Tente buscar com outro termo."
                    : "Não há outros membros cadastrados nesta clínica além do proprietário."}
                </p>
              </div>
            ) : (
              filteredCollaborators.map((collab) => {
                const isChecked = exclusiveUserIds.includes(collab.id);
                return (
                  <label
                    key={collab.id}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/60 cursor-pointer min-h-[44px] transition-colors select-none",
                      isChecked && "bg-muted/40"
                    )}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(checked) => handleToggleCollab(collab.id, Boolean(checked))}
                      className="shrink-0"
                    />

                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-semibold text-xs shrink-0 uppercase">
                      {collab.full_name?.charAt(0) || collab.email?.charAt(0) || "U"}
                    </div>

                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-sm font-medium text-foreground truncate max-w-[200px] sm:max-w-[260px]">
                          {collab.full_name || "Sem nome cadastrado"}
                        </span>
                        {collab.job_title && (
                          <span className="text-[10px] text-muted-foreground rounded bg-muted px-1.5 py-0.2">
                            {collab.job_title}
                          </span>
                        )}
                      </div>
                      {collab.email && (
                        <p className="text-[11px] text-muted-foreground truncate max-w-[240px]">
                          {collab.email}
                        </p>
                      )}
                    </div>

                    {isChecked && (
                      <UserCheck className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </label>
                );
              })
            )}
          </div>

          <DialogFooter className="pt-3 gap-2 sm:justify-end border-t border-border/40 mt-2">
            <Button
              type="button"
              className="w-full sm:w-auto font-medium"
              onClick={() => setIsDialogOpen(false)}
            >
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
