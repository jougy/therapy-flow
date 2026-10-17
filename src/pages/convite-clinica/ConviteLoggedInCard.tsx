import { AlertCircle, CheckCircle2, Loader2, LogOut, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConviteLoggedInCardProps {
  isSameEmailLoggedIn: boolean;
  currentUserEmail: string;
  inviteEmail: string;
  submitting: boolean;
  onAccept: () => void;
  onSwitchAccount: () => void;
}

export const ConviteLoggedInCard = ({
  isSameEmailLoggedIn,
  currentUserEmail,
  inviteEmail,
  submitting,
  onAccept,
  onSwitchAccount,
}: ConviteLoggedInCardProps) => {
  if (isSameEmailLoggedIn) {
    return (
      <div className="space-y-4 pt-2">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
          <div className="flex items-start gap-3">
            <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-medium">Você já está conectado como {currentUserEmail}</p>
              <p className="mt-1 text-xs text-emerald-800">
                Clique no botão abaixo para aceitar o convite e vincular a clínica ao seu espaço pessoal.
              </p>
            </div>
          </div>
        </div>

        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 gap-2 h-11 text-base font-semibold"
          onClick={onAccept}
          disabled={submitting}
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
          Aceitar convite e entrar na clínica
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">Conta conectada diferente</p>
            <p className="mt-1 text-xs text-amber-800">
              Você está conectado como <strong>{currentUserEmail}</strong>, mas este convite foi enviado para <strong>{inviteEmail}</strong>.
            </p>
          </div>
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full gap-2 border-amber-300 text-amber-900 hover:bg-amber-100"
        onClick={onSwitchAccount}
      >
        <LogOut className="h-4 w-4" />
        Sair e entrar como {inviteEmail}
      </Button>
    </div>
  );
};
