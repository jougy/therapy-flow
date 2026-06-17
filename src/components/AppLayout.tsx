import { LogOut, ShieldCheck, Settings } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ReleaseNotesDialog from "@/components/ReleaseNotesDialog";
import { getClinicBrandName } from "@/lib/clinic-settings";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { clinic, endPlatformClinicAccess, leaveClinic, platformAccess, profile, setPlatformSupportRole, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isPersonalOriginSettings =
    location.pathname === "/configuracoes" && new URLSearchParams(location.search).get("origem") === "pessoal";

  const displayName = profile?.full_name || profile?.email || "Usuário";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const clinicBrandName = getClinicBrandName(clinic?.name);
  const clinicHomePath = clinic?.route_key ? `/clinica/${clinic.route_key}` : "/espacopessoal";
  const isPlatformSupportMode = Boolean(platformAccess);
  const platformRoleLabels = {
    admin: "Administrador",
    assistant: "Assistente",
    estagiario: "Estagiário",
    owner: "Owner",
    professional: "Profissional",
  };

  return (
    <div className="min-h-screen flex flex-col w-full">
      <header className="h-14 flex items-center justify-between border-b bg-card px-4 sm:px-6 shrink-0">
        <button
          type="button"
          className="flex items-center gap-3 text-left"
          onClick={() => navigate(isPersonalOriginSettings ? "/espacopessoal" : clinicHomePath)}
          aria-label={isPersonalOriginSettings ? "Ir para o espaço pessoal" : `Ir para a página inicial da clínica ${clinicBrandName}`}
        >
          {clinic?.logo_url ? (
            <img src={clinic.logo_url} alt={`Logo da ${clinicBrandName}`} className="h-9 max-w-[140px] object-contain" />
          ) : (
            <span className="text-lg font-semibold text-foreground tracking-tight">{clinicBrandName}</span>
          )}
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-3 rounded-md px-2 py-1 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => navigate(
              isPersonalOriginSettings
                ? "/configuracoes?secao=profile&origem=pessoal"
                : `${clinicHomePath}/configuracoes?secao=profile`
            )}
            aria-label="Abrir configurações pessoais"
          >
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium leading-none">{displayName}</span>
              <span className="text-xs text-muted-foreground leading-tight mt-0.5">
                {clinicBrandName}
              </span>
            </div>
            <Avatar className="h-8 w-8">
              {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={displayName} /> : null}
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
          {!isPersonalOriginSettings && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => navigate(`${clinicHomePath}/configuracoes?secao=clinic`)}
              aria-label="Configurações da clínica"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
          {isPersonalOriginSettings ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={signOut}
              aria-label="Sair da conta"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label="Voltar ao painel pessoal"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Voltar ao painel pessoal?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Você encerrará seu acesso ativo à clínica {clinicBrandName} e voltará para a seleção de clínicas.
                    Isso libera a vaga de acesso simultâneo desta clínica, mas mantém seu login aberto no painel pessoal.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Continuar na clínica</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      const exitAccess = isPlatformSupportMode && endPlatformClinicAccess
                        ? endPlatformClinicAccess
                        : leaveClinic;
                      void exitAccess().finally(() => navigate(isPlatformSupportMode ? "/platform" : "/espacopessoal"));
                    }}
                  >
                    {isPlatformSupportMode ? "Voltar ao painel global" : "Voltar e liberar acesso"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </header>
      {isPlatformSupportMode && (
        <div className="flex flex-col gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950 lg:flex-row lg:items-center lg:justify-between sm:px-6">
          <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center">
            <div className="flex min-w-0 items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span className="truncate font-medium">Modo plataforma/suporte ativo em {clinicBrandName}</span>
              <span className="hidden truncate text-amber-800 xl:inline">Motivo: {platformAccess?.reason}</span>
            </div>
            <div className="flex items-center gap-2 md:ml-2">
              <span className="text-xs font-medium uppercase tracking-wide text-amber-800">Visão</span>
              <Select
                value={platformAccess?.simulatedRole ?? "owner"}
                onValueChange={(value) => {
                  void setPlatformSupportRole?.(value as keyof typeof platformRoleLabels);
                }}
              >
                <SelectTrigger className="h-9 w-full min-w-[180px] border-amber-300 bg-white text-amber-950 md:w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">{platformRoleLabels.owner}</SelectItem>
                  <SelectItem value="admin">{platformRoleLabels.admin}</SelectItem>
                  <SelectItem value="professional">{platformRoleLabels.professional}</SelectItem>
                  <SelectItem value="assistant">{platformRoleLabels.assistant}</SelectItem>
                  <SelectItem value="estagiario">{platformRoleLabels.estagiario}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
            onClick={() => {
              void endPlatformClinicAccess?.().finally(() => navigate("/platform"));
            }}
          >
            Voltar ao painel global
          </Button>
        </div>
      )}
      <main className="min-w-0 flex-1 p-4 sm:p-6">
        {children}
      </main>
      <ReleaseNotesDialog />
    </div>
  );
};

export default AppLayout;
