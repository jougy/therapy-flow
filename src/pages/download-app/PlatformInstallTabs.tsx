import {
  Download,
  Smartphone,
  Monitor,
  Apple,
  CheckCircle2,
  Zap,
  HelpCircle,
  Laptop,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DOWNLOAD_FILENAMES, type DownloadAssetKey } from "./downloadSources";

interface PlatformInstallTabsProps {
  selectedTab: string;
  onSelectedTabChange: (tab: string) => void;
  downloadUrls: Record<DownloadAssetKey, string>;
  onBrowserInstall: () => void;
}

export function PlatformInstallTabs({
  selectedTab,
  onSelectedTabChange,
  downloadUrls,
  onBrowserInstall,
}: PlatformInstallTabsProps) {
  return (
    <Tabs value={selectedTab} onValueChange={onSelectedTabChange} className="w-full">
      <TabsList className="grid grid-cols-5 gap-2 w-full max-w-xl mx-auto h-auto p-1.5 bg-muted/70 rounded-xl">
        <TabsTrigger
          value="windows"
          className="min-h-[44px] min-w-[44px] py-2 px-1 sm:px-3 text-[10px] sm:text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1.5 whitespace-normal text-center leading-tight"
        >
          <Monitor className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Windows</span>
        </TabsTrigger>
        <TabsTrigger
          value="mac"
          className="min-h-[44px] min-w-[44px] py-2 px-1 sm:px-3 text-[10px] sm:text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1.5 whitespace-normal text-center leading-tight"
        >
          <Apple className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Mac (Apple)</span>
        </TabsTrigger>
        <TabsTrigger
          value="linux"
          className="min-h-[44px] min-w-[44px] py-2 px-1 sm:px-3 text-[10px] sm:text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1.5 whitespace-normal text-center leading-tight"
        >
          <Laptop className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Linux</span>
        </TabsTrigger>
        <TabsTrigger
          value="android"
          className="min-h-[44px] min-w-[44px] py-2 px-1 sm:px-3 text-[10px] sm:text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1.5 whitespace-normal text-center leading-tight"
        >
          <Smartphone className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Android</span>
        </TabsTrigger>
        <TabsTrigger
          value="ios"
          className="min-h-[44px] min-w-[44px] py-2 px-1 sm:px-3 text-[10px] sm:text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1.5 whitespace-normal text-center leading-tight"
        >
          <Smartphone className="h-4 w-4 shrink-0" aria-hidden="true" />
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
                    Baixa o executável oficial para instalar e fixar o ícone do Pluri Health na sua Área de Trabalho e Menu Iniciar.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                  <Button asChild className="flex-1 min-h-[44px] min-w-[44px] gap-2 font-medium" variant="default">
                    <a href={downloadUrls.windowsExe} download="Pluri-Health-Setup.exe">
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Baixar Instalador (.exe)
                    </a>
                  </Button>
                  <Button asChild className="w-full sm:w-auto min-h-[44px] min-w-[44px] font-medium" variant="outline" title="Baixar instalador MSI">
                    <a href={downloadUrls.windowsMsi} download={DOWNLOAD_FILENAMES.windowsMsi}>
                      Pacote (.msi)
                    </a>
                  </Button>
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
                <Button onClick={onBrowserInstall} className="mt-4 w-full min-h-[44px] min-w-[44px] gap-2 font-medium" variant="outline">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
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
                    Baixa o instalador oficial do Pluri Health para colocar na sua pasta de Aplicativos.
                  </p>
                </div>
                <Button asChild className="mt-4 w-full min-h-[44px] min-w-[44px] gap-2 font-medium" variant="default">
                  <a href={downloadUrls.macDmg} download={DOWNLOAD_FILENAMES.macDmg}>
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Baixar para Mac (.dmg)
                  </a>
                </Button>
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
                <Button onClick={onBrowserInstall} className="mt-4 w-full min-h-[44px] min-w-[44px] gap-2 font-medium" variant="outline">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
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
                  <strong>Se o Mac mostrar um aviso de segurança:</strong> basta clicar no ícone do Pluri Health com o <strong>botão direito do mouse</strong> (ou segurar a tecla <strong>Control</strong> e clicar) e escolher <strong>"Abrir"</strong>.
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
                <Button asChild size="sm" className="mt-3 w-full min-h-[44px] min-w-[44px] text-xs gap-1">
                  <a href={downloadUrls.linuxDeb} download={DOWNLOAD_FILENAMES.linuxDeb}>
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    Baixar (.deb)
                  </a>
                </Button>
              </div>

              <div className="p-3.5 rounded-xl border bg-card text-center flex flex-col justify-between">
                <div>
                  <div className="font-bold text-xs text-foreground">Fedora / RedHat</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Pacote de instalação fácil</div>
                </div>
                <Button asChild size="sm" className="mt-3 w-full min-h-[44px] min-w-[44px] text-xs gap-1">
                  <a href={downloadUrls.linuxRpm} download={DOWNLOAD_FILENAMES.linuxRpm}>
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    Baixar (.rpm)
                  </a>
                </Button>
              </div>

              <div className="p-3.5 rounded-xl border bg-card text-center flex flex-col justify-between">
                <div>
                  <div className="font-bold text-xs text-foreground">Outras Versões (Universal)</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Executar direto</div>
                </div>
                <Button asChild size="sm" className="mt-3 w-full min-h-[44px] min-w-[44px] text-xs gap-1" variant="outline">
                  <a href={downloadUrls.linuxAppImage} download={DOWNLOAD_FILENAMES.linuxAppImage}>
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    Baixar (.AppImage)
                  </a>
                </Button>
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
                  Coloca o ícone do Pluri Health direto na tela do seu celular, sem ocupar espaço da memória.
                </p>
              </div>
              <Button onClick={onBrowserInstall} className="w-full sm:w-auto min-h-[44px] min-w-[44px] shrink-0 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                <Download className="h-4 w-4" aria-hidden="true" />
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
  );
}
