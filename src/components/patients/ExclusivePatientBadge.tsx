import React, { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useClinicCollaboratorsQuery } from "@/hooks/queries/useClinicDataQueries";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Lock, ShieldCheck, UserCheck, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExclusivePatientBadgeProps {
  patient: {
    id: string;
    is_exclusive?: boolean | null;
    exclusive_user_ids?: string[] | null;
    clinic_id?: string | null;
  };
  className?: string;
}

const ExclusivePatientBadgeContent: React.FC<ExclusivePatientBadgeProps> = ({
  patient,
  className,
}) => {
  const { clinic, clinicId: authClinicId } = useAuth();
  const effectiveClinicId = patient.clinic_id || authClinicId;
  const ownerUserId = clinic?.account_owner_user_id;

  const isExclusive = Boolean(patient.is_exclusive);
  const exclusiveUserIds = useMemo(() => patient.exclusive_user_ids || [], [patient.exclusive_user_ids]);

  const { data: rawCollaborators = [], isLoading } = useClinicCollaboratorsQuery(
    effectiveClinicId,
    Boolean(effectiveClinicId && isExclusive)
  );

  const authorizedCollaborators = useMemo(() => {
    if (exclusiveUserIds.length === 0) return [];
    const idSet = new Set(exclusiveUserIds);
    return rawCollaborators.filter((collab) => idSet.has(collab.id));
  }, [rawCollaborators, exclusiveUserIds]);

  const ownerProfile = rawCollaborators.find(
    (collab) => collab.operational_role === "owner" || (ownerUserId && collab.id === ownerUserId)
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="exclusive-patient-badge"
          aria-label="Paciente Exclusivo. Clique para ver permissões de acesso."
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all cursor-pointer select-none",
            "border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/60",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 touch-manipulation",
            className
          )}
        >
          <Lock className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>Exclusivo</span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-80 max-w-[calc(100vw-2rem)] p-3.5 space-y-3 rounded-xl shadow-lg border border-amber-500/30 bg-popover text-popover-foreground z-50"
      >
        <div className="flex items-center gap-2 border-b border-border/60 pb-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
            <Lock className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-foreground tracking-tight">
              Prontuário Exclusivo
            </h4>
            <p className="text-[11px] text-muted-foreground truncate">
              Acesso restrito e protegido
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Acesso Nativo
          </p>
          <div className="flex items-center gap-2.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/25">
            <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate">
                {ownerProfile?.full_name || clinic?.name ? `Proprietário (${ownerProfile?.full_name || clinic?.name})` : "Proprietário da Clínica"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Acesso total e irrestrito garantido
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Colaboradores Autorizados</span>
            <span>{authorizedCollaborators.length}</span>
          </div>

          <div className="max-h-44 overflow-y-auto overscroll-contain space-y-1 rounded-lg border border-border/50 p-1 divide-y divide-border/30">
            {isLoading ? (
              <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>Carregando...</span>
              </div>
            ) : authorizedCollaborators.length === 0 ? (
              <div className="py-3 px-2 text-center text-xs text-muted-foreground space-y-0.5">
                <Users className="h-4 w-4 mx-auto text-muted-foreground/60 mb-1" />
                <p className="font-medium text-foreground">Nenhum outro colaborador</p>
                <p className="text-[11px]">Apenas o proprietário tem acesso a este paciente.</p>
              </div>
            ) : (
              authorizedCollaborators.map((collab) => (
                <div
                  key={collab.id}
                  className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-[10px] shrink-0 uppercase">
                    {collab.full_name?.charAt(0) || collab.email?.charAt(0) || "U"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">
                      {collab.full_name || collab.email || "Colaborador"}
                    </p>
                    {collab.job_title && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {collab.job_title}
                      </p>
                    )}
                  </div>
                  <UserCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-1 border-t border-border/40 text-[10px] text-muted-foreground text-center">
          Para alterar o acesso, edite o cadastro do paciente.
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const ExclusivePatientBadge: React.FC<ExclusivePatientBadgeProps> = (props) =>
  props.patient.is_exclusive ? <ExclusivePatientBadgeContent {...props} /> : null;
