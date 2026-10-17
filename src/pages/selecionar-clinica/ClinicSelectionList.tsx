import { Building2, CheckCircle2, Clock, Loader2, Plus, Sparkles, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { EmptyClinicsCallout } from "@/components/personal/EmptyClinicsCallout";
import { getClinicBrandName } from "@/lib/clinic-settings";
import { evaluateClinicTrialStatus } from "@/lib/trial";
import type { AccessibleClinic } from "@/hooks/useAuth";
import type { ClinicSubscriptionSummary } from "./selecionarClinicaTypes";
import { formatLastSeen, getAccessLabel } from "./selecionarClinicaUtils";

export interface ClinicSelectionListProps {
  authLoading: boolean;
  accessibleClinics: AccessibleClinic[];
  sortedAccessibleClinics: AccessibleClinic[];
  clinicSubscriptions: Record<string, ClinicSubscriptionSummary>;
  hasEnterpriseAccess: boolean;
  userEmail?: string;
  selectingClinicId: string | null;
  leavingClinicId: string | null;
  onSelectClinic: (clinicId: string) => void | Promise<void>;
  onLeaveClinic: (clinicOption: AccessibleClinic) => void | Promise<void>;
  onCreateClinic: () => void;
}

export function ClinicSelectionList({
  authLoading,
  accessibleClinics,
  sortedAccessibleClinics,
  clinicSubscriptions,
  hasEnterpriseAccess,
  userEmail,
  selectingClinicId,
  leavingClinicId,
  onSelectClinic,
  onLeaveClinic,
  onCreateClinic,
}: ClinicSelectionListProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="px-4 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Escolha a clínica</CardTitle>
            <ComponentHelpButton helpId="personal-clinics-block" size="xs" />
            {!authLoading && (
              <Badge variant="secondary" className="w-fit">{accessibleClinics.length} acesso{accessibleClinics.length === 1 ? "" : "s"}</Badge>
            )}
          </div>
          {hasEnterpriseAccess && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs font-medium"
              data-testid="enterprise-create-clinic-btn"
              onClick={onCreateClinic}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Novo espaço</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        {authLoading ? (
          <div data-testid="clinics-loading-skeleton" className="space-y-3 py-1">
            {[1, 2].map((slot) => (
              <div
                key={slot}
                className="flex w-full items-center gap-3 rounded-lg border bg-card/50 p-3 animate-pulse"
              >
                <div className="h-10 w-10 shrink-0 rounded-md bg-muted/60" />
                <div className="flex-1 space-y-2 py-0.5">
                  <div className="h-4 w-40 rounded bg-muted/70" />
                  <div className="h-3 w-24 rounded bg-muted/50" />
                </div>
                <div className="h-6 w-12 rounded-full bg-muted/40" />
              </div>
            ))}
          </div>
        ) : accessibleClinics.length === 0 ? (
          hasEnterpriseAccess ? (
            <EmptyClinicsCallout
              userEmail={userEmail}
              onCreateClinic={onCreateClinic}
            />
          ) : null
        ) : (
          <div className="grid gap-3">
            {sortedAccessibleClinics.map((clinicOption, index) => {
              const clinicName = getClinicBrandName(clinicOption.clinic.name);
              const isSelecting = selectingClinicId === clinicOption.clinic.id;
              const canLeaveClinic = clinicOption.membership.account_role !== "account_owner" && clinicOption.membership.operational_role !== "owner";
              const isLeavingClinic = leavingClinicId === clinicOption.clinic.id;

              const subInfo = clinicSubscriptions[clinicOption.clinic.id];
              const trialEvaluation = evaluateClinicTrialStatus({
                status: subInfo?.status || clinicOption.clinic.subscription_status,
                isFreeTrial: subInfo?.is_free_trial,
                trialEndsAt: subInfo?.trial_ends_at || clinicOption.clinic.trial_ends_at,
                expiresAt: subInfo?.expires_at,
                currentPeriodEnd: subInfo?.current_period_end,
              });

              return (
                <div
                  key={clinicOption.clinic.id}
                  {...(index === 0 ? { "data-tutorial": "clinic-card-primary" } : {})}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-lg border bg-card p-2 transition-colors hover:border-primary/50 hover:bg-accent/40 sm:gap-3"
                >
                  <button
                    type="button"
                    className="flex min-w-0 items-center gap-3 rounded-md p-2 text-left disabled:cursor-wait disabled:opacity-70"
                    onClick={() => void onSelectClinic(clinicOption.clinic.id)}
                    disabled={!!selectingClinicId}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      {clinicOption.clinic.logo_url ? (
                        <img src={clinicOption.clinic.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
                      ) : (
                        <Building2 className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="truncate font-medium text-foreground">{clinicName}</p>
                        {trialEvaluation.hasTrial && (
                          <Badge
                            variant="outline"
                            data-testid="clinic-trial-badge"
                            className={`text-[10px] px-1.5 py-0 font-medium ${trialEvaluation.badgeVariantClass}`}
                          >
                            <Sparkles className="w-2.5 h-2.5 mr-1 inline" />
                            {trialEvaluation.badgeLabel}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <p className="truncate text-sm text-muted-foreground">{getAccessLabel(clinicOption)}</p>
                        {trialEvaluation.hasTrial && (
                          <span
                            data-testid="clinic-trial-notice"
                            className={`text-xs inline-flex items-center gap-1 ${trialEvaluation.noticeVariantClass}`}
                          >
                            <Clock className="w-3 h-3 shrink-0" />
                            {trialEvaluation.noticeText}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  <div className="flex min-w-0 shrink-0 items-center gap-1 pr-1 sm:gap-2 sm:pr-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="rounded-full border bg-background px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground sm:px-2.5"
                          aria-label={`Ver acessos online da clínica ${clinicName}`}
                        >
                          {clinicOption.activeAccessCount}/{clinicOption.clinic.concurrent_access_limit}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-72">
                        <div className="space-y-3">
                          <div>
                            <p className="font-medium text-foreground">Acessos online</p>
                            <p className="text-sm text-muted-foreground">
                              {clinicOption.activeAccessCount} de {clinicOption.clinic.concurrent_access_limit} em uso.
                            </p>
                          </div>
                          {clinicOption.activeAccessUsers.length > 0 ? (
                            <div className="space-y-2">
                              {clinicOption.activeAccessUsers.map((activeUser) => (
                                <div key={`${clinicOption.clinic.id}-${activeUser.user_id}`} className="rounded-md border p-2 text-sm">
                                  <p className="truncate font-medium text-foreground">
                                    {activeUser.full_name || activeUser.email || "Usuário online"}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {activeUser.device_label || "Dispositivo"} • {formatLastSeen(activeUser.last_seen_at)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">Nenhum acesso online agora.</p>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                    {isSelecting ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                    )}
                    {canLeaveClinic && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            disabled={!!selectingClinicId || !!leavingClinicId}
                            aria-label={`Sair da clínica ${clinicName}`}
                          >
                            {isLeavingClinic ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Sair de {clinicName}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Você deixará de acessar pacientes, atendimentos, agenda e configurações desta clínica.
                              Seu espaço pessoal e seus dados próprios continuam existindo. Para voltar, a clínica precisará enviar um novo convite.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => void onLeaveClinic(clinicOption)}
                              disabled={!!leavingClinicId}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Sair da clínica
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
