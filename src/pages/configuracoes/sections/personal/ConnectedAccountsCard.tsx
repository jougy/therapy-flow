import { useState } from "react";
import { CheckCircle2, Link2, Loader2, Unlink } from "lucide-react";
import type { UserIdentity } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { GoogleIcon } from "@/components/auth/GoogleAuthButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
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

interface ConnectedAccountsCardProps {
  identities?: UserIdentity[];
  onRefresh: () => Promise<void>;
  hasPassword?: boolean;
}

export const ConnectedAccountsCard = ({
  identities = [],
  onRefresh,
  hasPassword = true,
}: ConnectedAccountsCardProps) => {
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);

  const googleIdentity = identities.find((id) => id.provider === "google");
  const isGoogleConnected = Boolean(googleIdentity);
  const googleEmail =
    (googleIdentity?.identity_data?.email as string | undefined) ||
    (googleIdentity?.identity_data?.name as string | undefined);

  const handleConnectGoogle = async () => {
    try {
      setConnecting(true);
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: {
          redirectTo: typeof window !== "undefined" ? window.location.href : undefined,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (error) {
        toast({
          title: "Erro ao conectar conta Google",
          description: error.message,
          variant: "destructive",
        });
        setConnecting(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha na conexão com Google.";
      toast({
        title: "Erro inesperado",
        description: msg,
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  const handleConfirmDisconnect = async () => {
    if (!googleIdentity) return;

    if (!hasPassword && identities.length <= 1) {
      toast({
        title: "Não é possível desconectar",
        description:
          "Você não possui uma senha configurada. Crie uma senha de acesso antes de desconectar sua conta Google para não perder o acesso.",
        variant: "destructive",
      });
      setDisconnectDialogOpen(false);
      return;
    }

    try {
      setDisconnecting(true);
      const { error } = await supabase.auth.unlinkIdentity(googleIdentity);

      if (error) {
        toast({
          title: "Erro ao desconectar Google",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Conta Google desconectada",
        description: "O login pelo Google foi desvinculado do seu perfil com sucesso.",
      });

      await onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha ao desconectar.";
      toast({
        title: "Erro ao desconectar",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
      setDisconnectDialogOpen(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border p-5 bg-card space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              <p className="font-semibold text-sm text-foreground">
                Contas Conectadas e Login Social
              </p>
              {isGoogleConnected ? (
                <Badge
                  variant="outline"
                  className="text-emerald-600 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-[11px] gap-1"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Google Conectado
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-muted-foreground border-muted-foreground/40 text-[11px]"
                >
                  Não conectado
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
              Vincule sua conta Google para entrar com apenas 1 clique usando o botão{" "}
              <strong>"Continuar com o Google"</strong> na tela de login.
            </p>
          </div>

          <div className="shrink-0 self-start sm:self-auto">
            {isGoogleConnected ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDisconnectDialogOpen(true)}
                disabled={disconnecting}
                className="gap-2 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {disconnecting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Unlink className="h-3.5 w-3.5" />
                )}
                Desconectar Google
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleConnectGoogle}
                disabled={connecting}
                className="gap-2 text-xs border-border/80 hover:bg-accent/60 text-foreground"
              >
                {connecting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <GoogleIcon className="w-3.5 h-3.5" />
                )}
                Conectar Conta Google
              </Button>
            )}
          </div>
        </div>

        {isGoogleConnected && googleEmail && (
          <div className="rounded-lg border bg-muted/20 p-3 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GoogleIcon className="w-4 h-4 shrink-0" />
              <span className="text-muted-foreground">E-mail associado no Google:</span>
              <strong className="text-foreground">{googleEmail}</strong>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Unlink className="h-5 w-5" />
              Desconectar conta Google?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              <span>
                Ao desconectar, você não poderá mais usar o botão "Continuar com o Google" para acessar esta conta, sendo necessário entrar com seu e-mail e senha.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDisconnect}
              disabled={disconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Desconectando...
                </>
              ) : (
                "Sim, desconectar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
