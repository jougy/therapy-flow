import { Loader2 } from "lucide-react";

interface AuthFeedbackOverlayProps {
  isSigningOut: boolean;
  isLeavingClinic: boolean;
}

export const AuthFeedbackOverlay = ({
  isSigningOut,
  isLeavingClinic,
}: AuthFeedbackOverlayProps) => {
  if (!isSigningOut && !isLeavingClinic) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-3 bg-background/95 backdrop-blur-sm"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <div className="text-center space-y-1">
        <p className="text-base font-semibold text-foreground">
          {isSigningOut ? "Saindo da conta..." : "Saindo da clínica..."}
        </p>
        <p className="text-sm text-muted-foreground">
          {isSigningOut
            ? "Encerrando sua sessão com segurança."
            : "Liberando seu acesso e voltando ao painel pessoal."}
        </p>
      </div>
    </div>
  );
};
