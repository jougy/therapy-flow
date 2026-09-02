import React, { useState } from "react";
import { Copy, Loader2, RotateCw, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { toast } from "@/hooks/use-toast";
import {
  OPERATIONAL_ROLE_LABELS,
  parseSpecialties,
  type PendingCollaboratorInvitation,
} from "../types";

export interface PendingInvitationsListProps {
  pendingInvitations: PendingCollaboratorInvitation[];
  resendingId: string | null;
  cancelingId: string | null;
  canInviteCollaborators: boolean;
  canDeleteCollaborators: boolean;
  lastGeneratedInviteUrl?: string;
  lastGeneratedInviteEmail?: string;
  onResendInvite: (invitation: PendingCollaboratorInvitation) => Promise<void>;
  onCancelInvite: (invitationId: string) => Promise<void>;
  onCopyLink?: (url: string, email: string) => Promise<void>;
  onGetInviteLinkOnly?: (invitation: PendingCollaboratorInvitation) => Promise<void>;
}

export const PendingInvitationsList: React.FC<PendingInvitationsListProps> = ({
  pendingInvitations,
  resendingId,
  cancelingId,
  canInviteCollaborators,
  canDeleteCollaborators,
  lastGeneratedInviteUrl,
  lastGeneratedInviteEmail,
  onResendInvite,
  onCancelInvite,
  onCopyLink,
  onGetInviteLinkOnly,
}) => {
  const [invitationToCancel, setInvitationToCancel] = useState<PendingCollaboratorInvitation | null>(null);

  if (pendingInvitations.length === 0) return null;

  const handleCopyInvitationLink = async (invitation: PendingCollaboratorInvitation) => {
    // Se temos a função handleGetInviteLinkOnly, usamos diretamente para não disparar e-mails
    if (onGetInviteLinkOnly) {
      await onGetInviteLinkOnly(invitation);
      return;
    }

    if (
      lastGeneratedInviteUrl &&
      lastGeneratedInviteEmail?.toLowerCase() === invitation.email.toLowerCase()
    ) {
      if (onCopyLink) {
        await onCopyLink(lastGeneratedInviteUrl, invitation.email);
      } else {
        await navigator.clipboard.writeText(lastGeneratedInviteUrl);
        toast({
          title: "Link copiado!",
          description: `Link de convite para ${invitation.email} copiado.`,
        });
      }
      return;
    }

    // Fallback se onGetInviteLinkOnly não estiver disponível
    await onResendInvite(invitation);
  };

  return (
    <Card
      data-tutorial="settings-team-pending-box"
      className="border-amber-200 bg-amber-50/20 dark:border-amber-900/40 dark:bg-amber-950/10"
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-bold text-amber-950 dark:text-amber-300">
              Pendências de Cadastro e Confirmação ({pendingInvitations.length})
            </CardTitle>
            <ComponentHelpButton helpId="settings-team-pending-block" size="sm" />
            <Badge
              variant="outline"
              className="border-amber-300 bg-amber-100 text-amber-900 text-xs dark:bg-amber-950 dark:text-amber-200"
            >
              Ação necessária
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingInvitations.map((invitation) => {
          const roleName = OPERATIONAL_ROLE_LABELS[invitation.operational_role] || invitation.operational_role;
          const isResending = resendingId === invitation.id;

          return (
            <div
              key={invitation.id}
              className="rounded-xl border border-amber-200 dark:border-amber-900/30 bg-background p-4 space-y-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-foreground text-sm">{invitation.email}</p>
                    <Badge variant="outline" className="text-xs">
                      {roleName}
                    </Badge>
                    {invitation.job_title && (
                      <span className="text-xs font-medium text-foreground">· {invitation.job_title}</span>
                    )}
                    {parseSpecialties(invitation.specialty).map((spec, sIdx) => (
                      <Badge
                        key={`${spec}-${sIdx}`}
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 font-normal bg-primary/10 text-primary border border-primary/20"
                      >
                        {spec}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-amber-800 dark:text-amber-400 mt-1">
                    {invitation.pending_reason}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void onResendInvite(invitation)}
                    disabled={isResending || !canInviteCollaborators}
                  >
                    {isResending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <RotateCw className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Reenviar convite
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleCopyInvitationLink(invitation)}
                    disabled={isResending || !canInviteCollaborators}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copiar link
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setInvitationToCancel(invitation)}
                    disabled={
                      cancelingId === invitation.id ||
                      (!canDeleteCollaborators && !canInviteCollaborators)
                    }
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>

      <AlertDialog
        open={invitationToCancel !== null}
        onOpenChange={(open) => !open && setInvitationToCancel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar convite de colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              O link de convite emitido para{" "}
              <strong>{invitationToCancel?.email}</strong> será invalidado
              imediatamente e o colaborador não conseguirá mais utilizá-lo para ingressar na clínica.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelingId !== null}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelingId !== null}
              onClick={async () => {
                if (!invitationToCancel) return;
                const id = invitationToCancel.id;
                setInvitationToCancel(null);
                await onCancelInvite(id);
              }}
            >
              Sim, cancelar convite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
