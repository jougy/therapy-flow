import { Building2, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getClinicBrandName } from "@/lib/clinic-settings";
import type { ClinicInvitation } from "./selecionarClinicaTypes";
import { roleLabel } from "./selecionarClinicaUtils";

export interface ClinicInvitationsListProps {
  loadingInvitations: boolean;
  clinicInvitations: ClinicInvitation[];
  actingInvitationId: string | null;
  decliningInvitation: ClinicInvitation | null;
  setDecliningInvitation: (invitation: ClinicInvitation | null) => void;
  onAcceptInvitation: (invitationId: string) => void | Promise<void>;
  onDeclineInvitation: (invitationId: string) => void | Promise<void>;
}

export function ClinicInvitationsList({
  loadingInvitations,
  clinicInvitations,
  actingInvitationId,
  decliningInvitation,
  setDecliningInvitation,
  onAcceptInvitation,
  onDeclineInvitation,
}: ClinicInvitationsListProps) {
  if (!loadingInvitations && clinicInvitations.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-3">
        {loadingInvitations ? (
          <Card className="border-sky-200 bg-sky-50/50 p-4">
            <div className="flex items-center gap-2 text-sm text-sky-800">
              <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
              Buscando convites pendentes...
            </div>
          </Card>
        ) : (
          clinicInvitations.map((invitation) => {
            const isActing = actingInvitationId === invitation.invitation_id;
            const clinicName = getClinicBrandName(invitation.clinic_name);
            const roleName = roleLabel[invitation.operational_role] ?? invitation.operational_role;
            const positionText = [invitation.job_title, invitation.specialty].filter(Boolean).join(" · ") || roleName;

            return (
              <Card
                key={invitation.invitation_id}
                className="overflow-hidden border-2 border-emerald-500/40 bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-emerald-50/90 shadow-lg shadow-emerald-950/5 dark:from-emerald-950/30 dark:to-teal-950/20"
              >
                <div className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
                      {invitation.clinic_logo_url ? (
                        <img src={invitation.clinic_logo_url} alt="" className="h-10 w-10 rounded-lg object-contain" />
                      ) : (
                        <Building2 className="h-6 w-6" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">
                        Convite para nova clínica
                      </p>
                      <h3 className="mt-0.5 text-base font-bold text-foreground">
                        A clínica <span className="text-emerald-700 dark:text-emerald-400">{clinicName}</span> está te convidando para se juntar a ela como <span className="font-semibold text-foreground">{positionText}</span>.
                      </h3>
                      {invitation.invited_by_name && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Convidado por {invitation.invited_by_name}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row md:items-center">
                    <Button
                      className="bg-emerald-600 text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700"
                      onClick={() => void onAcceptInvitation(invitation.invitation_id)}
                      disabled={!!actingInvitationId}
                    >
                      {isActing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      Aceitar e entrar
                    </Button>
                    <Button
                      variant="outline"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDecliningInvitation(invitation)}
                      disabled={!!actingInvitationId}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Recusar
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <AlertDialog open={!!decliningInvitation} onOpenChange={(open) => !open && setDecliningInvitation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Recusar convite da clínica {decliningInvitation?.clinic_name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja recusar o convite para se juntar à clínica <strong>{decliningInvitation?.clinic_name}</strong>? Você não terá acesso à clínica a menos que um administrador envie um novo convite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (decliningInvitation) {
                  void onDeclineInvitation(decliningInvitation.invitation_id);
                  setDecliningInvitation(null);
                }
              }}
            >
              Sim, recusar convite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
