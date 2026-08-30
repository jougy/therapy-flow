import { useEffect, useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
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
  HelpCircle,
  Laptop,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { usePWAInstall, type DetectedOS } from "@/hooks/usePWAInstall";
import { toast } from "@/hooks/use-toast";

export default function DownloadApp() {
  const navigate = useNavigate();
  const { os, isInstallable, isInstalled, isApp, promptInstall } = usePWAInstall();
  const [selectedTab, setSelectedTab] = useState<string>(
    os === "unknown" ? "windows" : os
  );

  // Se o usuário já estiver dentro do aplicativo instalado, redireciona para o login / início
  if (isApp) {
    return <Navigate to="/auth" replace />;
  }

  const handleBrowserInstall = async () => {
    if (isInstallable) {
      const installed = await promptInstall();
      if (installed) {
        toast({
          title: "Aplicativo instalado com sucesso!",
          description: "O ícone do Pluri-Health já está disponível no seu dispositivo.",
        });
      }
    } else {
      toast({
        title: "Dica de instalação rápida",
        description:
          "Você também pode clicar no botão de download abaixo para baixar o instalador direto para o seu computador.",
      });
    }
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
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      {/* Barra Superior Simples */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/90 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-5xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/80 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </button>
            <div className="flex items-center gap-2.5">
              <img
                src="/branding/logo/pluri_health_icon_gradient.svg"
                alt="Pluri-Health"
                className="h-8 w-8 object-contain drop-shadow-xs"
              />
              <span className="text-base font-bold tracking-tight text-foreground">
                Pluri-Health
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="outline" size="sm" className="h-9 font-medium">
                Já tenho conta
              </Button>
            </Link>
            <Link to="/auth/cadastro">
              <Button size="sm" className="h-9 gap-1.5 font-medium shadow-xs">
                Criar Conta
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
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
            Use o Pluri-Health como aplicativo no seu computador ou celular
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
                <a href="/downloads/Pluri-Health-Mac.dmg" download="Pluri-Health-Mac.dmg" className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto gap-2 bg-primary text-primary-foreground shadow-sm h-10 px-5">
                    <Download className="h-4 w-4" />
                    Baixar para Mac
                  </Button>
                </a>
              ) : os === "windows" ? (
                <a href="/downloads/Pluri-Health-Setup.exe" download="Pluri-Health-Setup.exe" className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto gap-2 bg-primary text-primary-foreground shadow-sm h-10 px-5">
                    <Download className="h-4 w-4" />
                    Baixar para Windows (.exe)
                  </Button>
                </a>
              ) : os === "android" ? (
                <Button onClick={handleBrowserInstall} className="w-full sm:w-auto gap-2 bg-primary text-primary-foreground shadow-sm h-10 px-5">
                  <Download className="h-4 w-4" />
                  Instalar no Celular
                </Button>
              ) : os === "linux" ? (
                <a href="/downloads/pluri-health_amd64.deb" download="pluri-health_amd64.deb" className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto gap-2 bg-primary text-primary-foreground shadow-sm h-10 px-5">
                    <Download className="h-4 w-4" />
                    Baixar para Linux
                  </Button>
                </a>
              ) : (
                <Button onClick={handleBrowserInstall} className="w-full sm:w-auto gap-2 bg-primary text-primary-foreground shadow-sm h-10 px-5">
                  <Download className="h-4 w-4" />
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

          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
            <TabsList className="grid grid-cols-5 w-full max-w-xl mx-auto h-auto p-1 bg-muted/70 rounded-xl">
              <TabsTrigger value="windows" className="py-2 text-xs font-semibold flex flex-col sm:flex-row items-center gap-1.5">
                <Monitor className="h-4 w-4" />
                <span>Windows</span>
              </TabsTrigger>
              <TabsTrigger value="mac" className="py-2 text-xs font-semibold flex flex-col sm:flex-row items-center gap-1.5">
                <Apple className="h-4 w-4" />
                <span>Mac (Apple)</span>
              </TabsTrigger>
              <TabsTrigger value="linux" className="py-2 text-xs font-semibold flex flex-col sm:flex-row items-center gap-1.5">
                <Laptop className="h-4 w-4" />
                <span>Linux</span>
              </TabsTrigger>
              <TabsTrigger value="android" className="py-2 text-xs font-semibold flex flex-col sm:flex-row items-center gap-1.5">
                <Smartphone className="h-4 w-4" />
                <span>Android</span>
              </TabsTrigger>
              <TabsTrigger value="ios" className="py-2 text-xs font-semibold flex flex-col sm:flex-row items-center gap-1.5">
                <Smartphone className="h-4 w-4" />
                <span>iPhone/iPad</span>
              </TabsTrigger>
            </TabsList>

            {/* ABA: WINDOWS */}
            <TabsContent value="windows" className="mt-5">
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <Monitor className="h-5 w-5 text-blue-500" />
                    Como instalar no Computador Windows
                  </CardTitle>
                  <CardDescription>
                    Compatível com qualquer computador ou notebook com Windows 10 ou 11.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Opção 1: Download .EXE / .MSI */}
                    <div className="p-4 rounded-xl border bg-card flex flex-col justify-between">
                      <div>
                        <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                          <Download className="h-4 w-4 text-primary" />
                          Opção 1: Baixar Instalador Oficial (.exe)
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          Baixa o executável oficial para instalar e fixar o ícone do Pluri-Health na sua Área de Trabalho e Menu Iniciar.
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 mt-4">
                        <a href="/downloads/Pluri-Health-Setup.exe" download="Pluri-Health-Setup.exe" className="flex-1">
                          <Button className="w-full gap-2 font-medium" variant="default">
                            <Download className="h-4 w-4" />
                            Baixar Instalador (.exe)
                          </Button>
                        </a>
                        <a href="/downloads/Pluri-Health.msi" download="Pluri-Health.msi">
                          <Button className="w-full sm:w-auto font-medium" variant="outline" title="Baixar instalador MSI">
                            Pacote (.msi)
                          </Button>
                        </a>
                      </div>
                    </div>

                    {/* Opção 2: Instalação no Navegador */}
                    <div className="p-4 rounded-xl border bg-card flex flex-col justify-between">
                      <div>
                        <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                          <Zap className="h-4 w-4 text-amber-500" />
                          Opção 2: Instalar direto pelo Navegador
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          Se você usa Google Chrome ou Microsoft Edge, pode colocar o ícone na sua barra de tarefas agora.
                        </p>
                      </div>
                      <Button onClick={handleBrowserInstall} className="mt-4 w-full gap-2 font-medium" variant="outline">
                        <CheckCircle2 className="h-4 w-4" />
                        Instalar pelo Navegador
                      </Button>
                    </div>
                  </div>

                  {/* Passo a Passo Simples */}
                  <div className="rounded-xl bg-muted/40 p-4 border border-border/50">
                    <div className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      Passo a passo simples:
                    </div>
                    <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                      <li>Clique no botão azul <strong>"Baixar Instalador (.exe)"</strong> acima.</li>
                      <li>Abra o arquivo baixado no seu computador.</li>
                      <li>Pronto! O aplicativo será aberto e o ícone oficial aparecerá na sua Área de Trabalho para você usar sempre que quiser.</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ABA: MAC */}
            <TabsContent value="mac" className="mt-5">
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <Apple className="h-5 w-5" />
                    Como instalar no Computador Mac (Apple)
                  </CardTitle>
                  <CardDescription>
                    Compatível com MacBook, iMac, Mac Mini e Mac Studio.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Opção 1: Download DMG */}
                    <div className="p-4 rounded-xl border bg-card flex flex-col justify-between">
                      <div>
                        <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                          <Download className="h-4 w-4 text-primary" />
                          Opção 1: Baixar Aplicativo para Mac
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          Baixa o instalador oficial do Pluri-Health para colocar na sua pasta de Aplicativos.
                        </p>
                      </div>
                      <a href="/downloads/Pluri-Health-Mac.dmg" download="Pluri-Health-Mac.dmg" className="mt-4">
                        <Button className="w-full gap-2 font-medium" variant="default">
                          <Download className="h-4 w-4" />
                          Baixar para Mac (.dmg)
                        </Button>
                      </a>
                    </div>

                    {/* Opção 2: Pelo Safari */}
                    <div className="p-4 rounded-xl border bg-card flex flex-col justify-between">
                      <div>
                        <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                          <Apple className="h-4 w-4" />
                          Opção 2: Pelo Navegador Safari
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          No Safari, clique no menu superior <strong>Arquivo &gt; Adicionar ao Dock</strong>.
                        </p>
                      </div>
                      <Button onClick={handleBrowserInstall} className="mt-4 w-full gap-2 font-medium" variant="outline">
                        <CheckCircle2 className="h-4 w-4" />
                        Instalar pelo Navegador
                      </Button>
                    </div>
                  </div>

                  {/* Passo a Passo Simples & Dica do Gatekeeper */}
                  <div className="rounded-xl bg-muted/40 p-4 border border-border/50 space-y-3">
                    <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      Como usar no Mac pela primeira vez:
                    </div>
                    <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                      <li>Abra o arquivo <strong>Pluri-Health-Mac.dmg</strong> baixado e arraste o ícone para <strong>Aplicativos</strong>.</li>
                      <li>
                        <strong>Se o Mac mostrar um aviso de segurança:</strong> basta clicar no ícone do Pluri-Health com o <strong>botão direito do mouse</strong> (ou segurar a tecla <strong>Control</strong> e clicar) e escolher <strong>"Abrir"</strong>.
                      </li>
                      <li>Confirme em <strong>"Abrir"</strong> na janelinha. Pronto! Ele abrirá normalmente e não perguntará de novo.</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ABA: LINUX */}
            <TabsContent value="linux" className="mt-5">
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <Laptop className="h-5 w-5 text-amber-500" />
                    Como instalar no Computador Linux
                  </CardTitle>
                  <CardDescription>
                    Escolha a versão correspondente ao seu sistema (Ubuntu, Debian, Fedora ou outros).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl border bg-card text-center flex flex-col justify-between">
                      <div>
                        <div className="font-bold text-xs text-foreground">Ubuntu / Debian / Mint</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">Pacote de instalação fácil</div>
                      </div>
                      <a href="/downloads/pluri-health_amd64.deb" download="pluri-health_amd64.deb" className="mt-3">
                        <Button size="sm" className="w-full text-xs h-8">
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Baixar (.deb)
                        </Button>
                      </a>
                    </div>

                    <div className="p-3.5 rounded-xl border bg-card text-center flex flex-col justify-between">
                      <div>
                        <div className="font-bold text-xs text-foreground">Fedora / RedHat</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">Pacote de instalação fácil</div>
                      </div>
                      <a href="/downloads/pluri-health.rpm" download="pluri-health.rpm" className="mt-3">
                        <Button size="sm" className="w-full text-xs h-8">
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Baixar (.rpm)
                        </Button>
                      </a>
                    </div>

                    <div className="p-3.5 rounded-xl border bg-card text-center flex flex-col justify-between">
                      <div>
                        <div className="font-bold text-xs text-foreground">Outras Versões (Universal)</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">Executar direto</div>
                      </div>
                      <a href="/downloads/Pluri-Health-Linux.AppImage" download="Pluri-Health-Linux.AppImage" className="mt-3">
                        <Button size="sm" className="w-full text-xs h-8" variant="outline">
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Baixar (.AppImage)
                        </Button>
                      </a>
                    </div>
                  </div>

                  <div className="rounded-xl bg-muted/40 p-3.5 border border-border/50 text-xs text-muted-foreground">
                    💡 <strong>Dica:</strong> Se preferir não baixar arquivos, você também pode simplesmente clicar em <strong>"Instalar aplicativo"</strong> na barra de endereços do seu navegador Chrome, Brave ou Edge.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ABA: ANDROID */}
            <TabsContent value="android" className="mt-5">
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-emerald-500" />
                    Como colocar no seu Celular Android
                  </CardTitle>
                  <CardDescription>
                    Funciona em celulares Samsung, Motorola, Xiaomi e outros.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-sm text-foreground">Instalação com 1 Toque</div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Coloca o ícone do Pluri-Health direto na tela do seu celular, sem ocupar espaço da memória.
                      </p>
                    </div>
                    <Button onClick={handleBrowserInstall} className="w-full sm:w-auto shrink-0 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                      <Download className="h-4 w-4" />
                      Instalar no Celular Agora
                    </Button>
                  </div>

                  <div className="rounded-xl bg-muted/40 p-4 border border-border/50">
                    <div className="text-xs font-bold text-foreground mb-2">
                      Ou faça pelo menu do seu navegador (Google Chrome):
                    </div>
                    <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                      <li>No topo direito da tela do celular, toque nos <strong>três pontinhos (⋮)</strong>.</li>
                      <li>Toque na opção <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.</li>
                      <li>Toque em <strong>"Instalar"</strong>. Pronto! O ícone aparecerá na tela do seu celular.</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ABA: IOS */}
            <TabsContent value="ios" className="mt-5">
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    Como colocar no seu iPhone ou iPad
                  </CardTitle>
                  <CardDescription>
                    Siga o passo a passo fácil pelo navegador Safari do seu aparelho Apple.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <div className="text-xs font-bold text-foreground mb-3 text-center sm:text-left">
                      3 passos simples no seu iPhone:
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3.5 rounded-xl bg-background border border-border/70 text-center flex flex-col items-center">
                        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center mb-2">
                          1
                        </div>
                        <div className="text-xs font-bold text-foreground">Botão Compartilhar</div>
                        <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                          Na parte de baixo do Safari, toque no ícone do <strong>quadradinho com uma seta para cima</strong>.
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-background border border-border/70 text-center flex flex-col items-center">
                        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center mb-2">
                          2
                        </div>
                        <div className="text-xs font-bold text-foreground">Tela de Início</div>
                        <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                          Role o menu para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>.
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-background border border-border/70 text-center flex flex-col items-center">
                        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center mb-2">
                          3
                        </div>
                        <div className="text-xs font-bold text-foreground">Confirmar</div>
                        <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                          Toque em <strong>"Adicionar"</strong> no canto superior direito da tela.
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
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
                Não, o aplicativo é totalmente gratuito para todos os usuários cadastrados no Pluri-Health.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Rodapé Simples */}
      <footer className="border-t bg-muted/20 py-6 text-center text-xs text-muted-foreground mt-10">
        <div className="container mx-auto px-4">
          <p>© {new Date().getFullYear()} Pluri-Health. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
