import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, CheckCircle2, Fingerprint, KeyRound, Loader2, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useAuth, type AccessibleClinic } from "@/hooks/useAuth";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { getClinicBrandName } from "@/lib/clinic-settings";

const roleLabel: Record<string, string> = {
  account_owner: "Dono da conta",
  admin: "Admin",
  assistant: "Assistente",
  estagiario: "Estagiário",
  owner: "Owner",
  professional: "Profissional",
};

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const getAccessLabel = (clinicOption: AccessibleClinic) =>
  clinicOption.membership.account_role === "account_owner"
    ? roleLabel.account_owner
    : roleLabel[clinicOption.membership.operational_role] ?? "Colaborador";

const formatLastSeen = (value: string | null | undefined) => {
  if (!value) {
    return "agora";
  }

  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));

  if (minutes <= 1) {
    return "agora";
  }

  return `${minutes} min`;
};

const SelecionarClinica = () => {
  const { accessibleClinics, isPlatformOwner, platformMfaVerified, profile, selectClinic, signOut, user } = useAuth();
  const navigate = useNavigate();
  const [selectingClinicId, setSelectingClinicId] = useState<string | null>(null);

  const displayName = profile?.full_name || profile?.email || user?.email || "Usuário";
  const initials = getInitials(displayName || "U");

  const handleSelectClinic = async (clinicId: string) => {
    setSelectingClinicId(clinicId);

    try {
      await selectClinic(clinicId);
      const selectedClinic = accessibleClinics.find((option) => option.clinic.id === clinicId);
      navigate(`/clinica/${selectedClinic?.clinic.route_key ?? clinicId}`, { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível entrar nesta clínica.";
      toast({
        title: "Acesso indisponível",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSelectingClinicId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Pluri-Health</p>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Espaço pessoal</h1>
          </div>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="hidden min-w-0 items-center gap-3 rounded-xl border bg-background/70 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 sm:flex"
              onClick={() => navigate("/configuracoes?secao=profile&origem=pessoal")}
              aria-label="Abrir configurações pessoais"
            >
              <Avatar className="h-9 w-9">
                {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={displayName} /> : null}
                <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="max-w-[180px] truncate text-sm font-medium text-foreground">{displayName}</p>
                <p className="max-w-[180px] truncate text-xs text-muted-foreground">{profile?.email || user?.email}</p>
              </div>
            </button>
            <button
              type="button"
              className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 sm:hidden"
              onClick={() => navigate("/configuracoes?secao=profile&origem=pessoal")}
              aria-label="Abrir configurações pessoais"
            >
              <Avatar className="h-10 w-10">
                {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={displayName} /> : null}
                <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">{initials}</AvatarFallback>
              </Avatar>
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="shrink-0">
                  <LogOut className="mr-0 h-4 w-4 sm:mr-2" />
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
                  <AlertDialogAction onClick={() => void signOut()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Sair da conta
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl justify-center px-3 py-4 sm:p-6">
        <div className="w-full max-w-2xl space-y-4">
        {isPlatformOwner && (
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            onClick={() => navigate("/platform")}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground">Painel administrativo global</p>
                <p className="truncate text-sm text-muted-foreground">Ferramentas internas da plataforma</p>
              </div>
            </div>
            <Badge variant="secondary">platform_owner</Badge>
          </button>
        )}
        {isPlatformOwner ? (
          <Card className="overflow-hidden">
            <CardHeader className="px-4 sm:px-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">Relatórios pessoais</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Resumo local da sua conta master e do contexto de suporte da plataforma.
                  </p>
                </div>
                <Badge variant="secondary" className="w-fit">suporte da plataforma</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 px-4 sm:grid-cols-3 sm:px-6">
              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Fingerprint className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identidade</p>
                <p className="mt-2 truncate text-sm font-medium text-foreground">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{profile?.email || user?.email || "E-mail não informado"}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <KeyRound className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Segurança</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {platformMfaVerified ? "2FA validado" : "2FA pendente"}
                </p>
                <p className="text-xs text-muted-foreground">Obrigatório para acessar o painel mestre.</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Escopo</p>
                <p className="mt-2 text-sm font-medium text-foreground">Acesso global via painel mestre</p>
                <p className="text-xs text-muted-foreground">Sem vínculo pessoal com clínicas específicas.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <CardHeader className="px-4 sm:px-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">Escolha a clínica</CardTitle>
                <Badge variant="secondary" className="w-fit">{accessibleClinics.length} acesso{accessibleClinics.length === 1 ? "" : "s"}</Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              {accessibleClinics.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <UserRound className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="font-medium text-foreground">Nenhuma clínica ativa encontrada</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Seu acesso ainda precisa ser liberado pelo administrador da clínica.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {accessibleClinics.map((clinicOption) => {
                    const clinicName = getClinicBrandName(clinicOption.clinic.name);
                    const isSelecting = selectingClinicId === clinicOption.clinic.id;

                    return (
                      <div
                        key={clinicOption.clinic.id}
                        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-lg border bg-card p-2 transition-colors hover:border-primary/50 hover:bg-accent/40 sm:gap-3"
                      >
                        <button
                          type="button"
                          className="flex min-w-0 items-center gap-3 rounded-md p-2 text-left disabled:cursor-wait disabled:opacity-70"
                          onClick={() => handleSelectClinic(clinicOption.clinic.id)}
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
                            <p className="truncate font-medium text-foreground">{clinicName}</p>
                            <p className="truncate text-sm text-muted-foreground">{getAccessLabel(clinicOption)}</p>
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
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
        </div>
      </main>
    </div>
  );
};

export default SelecionarClinica;
