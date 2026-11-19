import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import {
  Download,
  Smartphone,
  Monitor,
  Apple,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
  ArrowLeft,
  Laptop,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePWAInstall, type DetectedOS } from "@/hooks/usePWAInstall";
import { useActiveBrand } from "@/hooks/useActiveBrand";
import { toast } from "@/hooks/use-toast";
import {
  DOWNLOAD_FILENAMES,
  PlatformInstallTabs,
  useDownloadUrls,
} from "./download-app";

export default function DownloadApp() {
  const navigate = useNavigate();
  const brand = useActiveBrand();
  const { os, isInstallable, isInstalled, isApp, promptInstall } = usePWAInstall();
  const downloadUrls = useDownloadUrls();
  const [selectedTab, setSelectedTab] = useState<string | null>(null);

  // Se o usuário já estiver dentro do aplicativo instalado, redireciona para o login / início
  if (isApp) {
    return <Navigate to="/auth" replace />;
  }

  const activeTab = selectedTab ?? (os === "unknown" ? "windows" : os);

  const handleBrowserInstall = async () => {
    if (isInstallable) {
      const installed = await promptInstall();
      if (installed) {
        toast({
          title: "Aplicativo instalado com sucesso!",
          description: `O ícone do ${brand.name} já está disponível no seu dispositivo.`,
        });
      }
      return;
    }

    if (os === "mac") {
      toast({
        title: "Como instalar pelo navegador no Mac",
        description:
          "No Safari, clique no menu Arquivo > Adicionar ao Dock. No Chrome, Brave ou Edge, clique no ícone de instalação na barra de endereços ou baixe o instalador (.dmg).",
      });
      return;
    }

    toast({
      title: "Como instalar pelo navegador",
      description:
        "Abra o menu do navegador (⋮) e selecione \"Instalar aplicativo\" ou \"Adicionar à tela inicial\". Você também pode usar o botão de download direto.",
    });
  };

  const osFriendlyNames: Record<DetectedOS, string> = {
    windows: "Computador Windows",
    mac: "Computador Mac (Apple)",
    linux: "Computador Linux",
    android: "Celular Android",
    ios: "iPhone / iPad",
    unknown: "Seu Dispositivo",
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      {/* Barra Superior Simples */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/90 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between gap-2 px-4 sm:px-6 max-w-5xl">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Voltar"
              className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-card/80 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Voltar
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <img
                src="/branding/logo/pluri_health_icon_gradient.svg"
                alt={brand.name}
                className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 object-contain drop-shadow-xs"
              />
              <span className="text-sm sm:text-base font-bold tracking-tight text-foreground truncate">
                {brand.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button asChild variant="outline" size="sm" className="min-h-[44px] min-w-[44px] text-xs sm:text-sm px-2.5 sm:px-3 font-medium">
              <Link to="/auth">
                <span className="hidden sm:inline">Já tenho conta</span>
                <span className="sm:hidden">Entrar</span>
              </Link>
            </Button>
            <Button asChild size="sm" className="min-h-[44px] min-w-[44px] text-xs sm:text-sm px-2.5 sm:px-3 gap-1.5 font-medium shadow-xs">
              <Link to="/auth/cadastro">
                <span>Criar Conta</span>
                <ArrowRight className="h-3.5 w-3.5 hidden sm:inline" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="container mx-auto px-4 py-8 sm:py-12 max-w-4xl">
        {/* Título e Apresentação */}
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
          <Badge
            variant="secondary"
            className="mb-3 px-3 py-1 text-xs font-semibold bg-primary/10 text-primary border-primary/20"
          >
            Baixar Aplicativo Oficial
          </Badge>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
            Use o {brand.name} como aplicativo no seu computador ou celular
          </h1>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
            Tenha um atalho direto na sua tela para abrir seus atendimentos e prontuários rapidamente, sem precisar digitar o endereço no navegador toda vez.
          </p>

          {/* Destaque do Dispositivo Atual */}
          <div className="mt-6 p-4 sm:p-5 rounded-2xl border border-primary/20 bg-primary/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-left shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                {os === "windows" && <Monitor className="h-6 w-6" />}
                {os === "mac" && <Apple className="h-6 w-6" />}
                {os === "linux" && <Laptop className="h-6 w-6" />}
                {os === "android" && <Smartphone className="h-6 w-6" />}
                {os === "ios" && <Smartphone className="h-6 w-6" />}
                {os === "unknown" && <Download className="h-6 w-6" />}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Identificamos o seu aparelho:</div>
                <div className="text-base font-bold text-foreground flex items-center gap-2">
                  {osFriendlyNames[os]}
                  {isInstalled && (
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                      Já Instalado
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {os === "mac" ? (
                <Button asChild className="w-full sm:w-auto min-h-[44px] min-w-[44px] gap-2 bg-primary text-primary-foreground shadow-sm px-5">
                  <a href={downloadUrls.macDmg} download={DOWNLOAD_FILENAMES.macDmg}>
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Baixar para Mac
                  </a>
                </Button>
              ) : os === "windows" ? (
                <Button asChild className="w-full sm:w-auto min-h-[44px] min-w-[44px] gap-2 bg-primary text-primary-foreground shadow-sm px-5">
                  <a href={downloadUrls.windowsExe} download="Pluri-Health-Setup.exe">
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Baixar para Windows (.exe)
                  </a>
                </Button>
              ) : os === "android" ? (
                <Button onClick={handleBrowserInstall} className="w-full sm:w-auto min-h-[44px] min-w-[44px] gap-2 bg-primary text-primary-foreground shadow-sm px-5">
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Instalar no Celular
                </Button>
              ) : os === "linux" ? (
                <Button asChild className="w-full sm:w-auto min-h-[44px] min-w-[44px] gap-2 bg-primary text-primary-foreground shadow-sm px-5">
                  <a href={downloadUrls.linuxDeb} download={DOWNLOAD_FILENAMES.linuxDeb}>
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Baixar para Linux
                  </a>
                </Button>
              ) : (
                <Button onClick={handleBrowserInstall} className="w-full sm:w-auto min-h-[44px] min-w-[44px] gap-2 bg-primary text-primary-foreground shadow-sm px-5">
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Instalar Aplicativo
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Vantagens Simples */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-10">
          <div className="p-4 rounded-xl border bg-card/60 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Abre em 1 Clique</div>
              <div className="text-xs text-muted-foreground mt-0.5">Sem precisar abrir navegador nem digitar link.</div>
            </div>
          </div>

          <div className="p-4 rounded-xl border bg-card/60 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Sempre Atualizado</div>
              <div className="text-xs text-muted-foreground mt-0.5">Recebe novidades e melhorias de forma automática.</div>
            </div>
          </div>

          <div className="p-4 rounded-xl border bg-card/60 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 shrink-0">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Seguro e Leve</div>
              <div className="text-xs text-muted-foreground mt-0.5">Não pesa no seu aparelho e protege seus dados.</div>
            </div>
          </div>
        </div>

        {/* Seletor de Aparelhos / Abas */}
        <div className="mb-10">
          <div className="text-center mb-5">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              Escolha seu aparelho
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Clique no tipo de computador ou celular que você usa:
            </p>
          </div>

          <PlatformInstallTabs
            selectedTab={activeTab}
            onSelectedTabChange={setSelectedTab}
            downloadUrls={downloadUrls}
            onBrowserInstall={handleBrowserInstall}
          />
        </div>

        {/* Dúvidas Frequentes Simples */}
        <div className="border-t pt-8">
          <div className="text-center max-w-xl mx-auto mb-6">
            <h3 className="text-base sm:text-lg font-bold text-foreground">Dúvidas Frequentes</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-xl border bg-card/40">
              <div className="text-xs font-bold text-foreground">Meus pacientes e fichas aparecem no aplicativo?</div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Sim! Tudo o que você fizer no computador ou no celular fica salvo na sua conta automaticamente.
              </p>
            </div>

            <div className="p-4 rounded-xl border bg-card/40">
              <div className="text-xs font-bold text-foreground">Preciso pagar para instalar?</div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Não, o aplicativo é totalmente gratuito para todos os usuários cadastrados no {brand.name}.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Rodapé Simples */}
      <footer className="border-t bg-muted/20 py-6 text-center text-xs text-muted-foreground mt-10">
        <div className="container mx-auto px-4">
          <p>© {new Date().getFullYear()} {brand.name}. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
