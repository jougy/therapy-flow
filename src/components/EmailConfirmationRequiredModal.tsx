import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ShieldAlert, MailCheck, LogOut } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const PUBLIC_AUTH_PATHS = [
  "/auth",
  "/auth/cadastro",
  "/auth/criar-conta",
  "/auth/cadastrousuario",
  "/auth/cadastro-usuario",
  "/auth/confirmado",
  "/auth/redefinir-senha",
  "/cadastro",
  "/cadastro/conta-alfa",
  "/download",
  "/baixar",
  "/app",
  "/convite",
];

export const EmailConfirmationRequiredModal = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isPublicAuthRoute = useMemo(() => {
    const currentPath = location.pathname.toLowerCase();
    return PUBLIC_AUTH_PATHS.some((path) => currentPath === path || currentPath.startsWith(`${path}/`));
  }, [location.pathname]);

  const emailConfirmed = Boolean(user?.email_confirmed_at);
  const isOpen = Boolean(user && !emailConfirmed && !isPublicAuthRoute);

  if (!isOpen || !user) {
    return null;
  }

  const userEmail = user.email || "";

  const handleConfirmRedirect = () => {
    navigate(`/auth/confirmado?email=${encodeURIComponent(userEmail)}&aguardando=true`, {
      state: { email: userEmail },
    });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md p-6 sm:rounded-2xl border bg-background shadow-2xl [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-3 text-center sm:text-left">
          <div className="mx-auto sm:mx-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800 shadow-sm">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
              Atualizamos nossas medidas de segurança
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Para garantir a conformidade com as normas de saúde e segurança de dados dos prontuários, é indispensável confirmar a titularidade do e-mail cadastrado antes de acessar a plataforma.
            </DialogDescription>
          </div>
        </DialogHeader>

        {userEmail && (
          <div className="rounded-xl border border-sky-200/80 bg-sky-50/70 p-3.5 text-xs text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200">
            <p className="font-semibold text-sky-900 dark:text-sky-100">E-mail associado à conta:</p>
            <p className="mt-0.5 break-all font-mono font-medium">{userEmail}</p>
          </div>
        )}

        <DialogFooter className="mt-4 flex flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            className="w-full gap-2 shadow-md shadow-sky-500/10"
            onClick={handleConfirmRedirect}
          >
            <MailCheck className="h-4 w-4" />
            Confirmar meu e-mail
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => void handleSignOut()}
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
