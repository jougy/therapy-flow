import { LogOut, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getClinicBrandName } from "@/lib/clinic-settings";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { clinic, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const displayName = profile?.full_name || profile?.email || "Usuário";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const clinicBrandName = getClinicBrandName(clinic?.name);

  return (
    <div className="min-h-screen flex flex-col w-full">
      <header className="h-14 flex items-center justify-between border-b bg-card px-4 sm:px-6 shrink-0">
        <button
          type="button"
          className="flex items-center gap-3 text-left"
          onClick={() => navigate("/")}
          aria-label={`Ir para a página inicial da clínica ${clinicBrandName}`}
        >
          {clinic?.logo_url ? (
            <img src={clinic.logo_url} alt={`Logo da ${clinicBrandName}`} className="h-9 max-w-[140px] object-contain" />
          ) : (
            <span className="text-lg font-semibold text-foreground tracking-tight">{clinicBrandName}</span>
          )}
        </button>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end mr-1">
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
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/configuracoes")}
            aria-label="Configurações"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={signOut}
            aria-label="Sair da conta"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
