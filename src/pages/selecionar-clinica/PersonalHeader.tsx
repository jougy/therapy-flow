import { Award, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import PersonalNotificationsButton from "@/components/PersonalNotificationsButton";
import ProfileAccountButton from "@/components/ProfileAccountButton";
import { TutorialTriggerButton } from "@/components/tutorial/TutorialTriggerButton";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";

export interface PersonalHeaderProps {
  isPortfolioEnabled: boolean;
  displayName: string;
  subtitle: string;
  avatarUrl?: string | null;
  initials: string;
  onOpenPortfolio: () => void;
  onOpenProfile: () => void;
  onSignOut: () => void | Promise<void>;
}

export function PersonalHeader({
  isPortfolioEnabled,
  displayName,
  subtitle,
  avatarUrl,
  initials,
  onOpenPortfolio,
  onOpenProfile,
  onSignOut,
}: PersonalHeaderProps) {
  return (
    <header className="border-b bg-card px-4 py-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
        <div data-tutorial="personal-welcome" className="flex items-center gap-2 sm:gap-3 min-w-0">
          <img
            src="/branding/logo/pluri_health_icon_gradient.svg"
            alt="Pluri-Health"
            className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 drop-shadow-xs"
          />
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">Pluri-Health</p>
            <h1 className="text-base sm:text-xl font-semibold tracking-tight text-foreground whitespace-nowrap">Espaço pessoal</h1>
          </div>
          <div className="hidden xs:block">
            <ComponentHelpButton helpId="personal-welcome-block" size="sm" />
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {isPortfolioEnabled && (
            <Button
              variant="outline"
              size="sm"
              data-testid="header-portfolio-btn"
              className="hidden md:inline-flex items-center gap-1.5 border-primary/30 text-xs font-medium hover:border-primary hover:bg-primary/5"
              onClick={onOpenPortfolio}
            >
              <Award className="h-4 w-4 text-primary" />
              <span>Meu Portfólio</span>
            </Button>
          )}
          <div className="hidden sm:block">
            <TutorialTriggerButton />
          </div>
          <PersonalNotificationsButton />
          <div data-tutorial="personal-account-btn">
            <ProfileAccountButton
              displayName={displayName}
              subtitle={subtitle}
              avatarUrl={avatarUrl}
              initials={initials}
              onClick={onOpenProfile}
            />
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 sm:w-auto sm:px-3">
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sair da sua conta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Você será desconectado deste navegador e voltará para a tela inicial de login. Para acessar
                  novamente, será necessário informar seu e-mail e senha.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => void onSignOut()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Sair da conta
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </header>
  );
}
