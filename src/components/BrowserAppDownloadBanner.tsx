import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, X, Sparkles, Monitor, Smartphone, Apple, Laptop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";

interface BrowserAppDownloadBannerProps {
  /** Posição fixa no topo ou embutido */
  variant?: "top" | "inline";
  className?: string;
}

export function BrowserAppDownloadBanner({ variant = "top", className = "" }: BrowserAppDownloadBannerProps) {
  const { isApp, os, isInstallable, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("pluri_hide_app_banner") === "true";
    }
    return false;
  });

  // Se já estiver rodando dentro do aplicativo ou se o usuário fechou temporariamente, não renderiza NADA
  if (isApp || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("pluri_hide_app_banner", "true");
    }
  };

  const handleAction = async () => {
    if (isInstallable) {
      await promptInstall();
    }
  };

  const osLabel =
    os === "windows"
      ? "Windows"
      : os === "mac"
      ? "Mac"
      : os === "linux"
      ? "Linux"
      : os === "android"
      ? "Celular Android"
      : os === "ios"
      ? "iPhone"
      : "Computador ou Celular";

  if (variant === "inline") {
    return (
      <div className={`p-4 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-left shadow-xs ${className}`}>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center text-primary shrink-0">
            {os === "mac" ? <Apple className="h-5 w-5" /> : os === "windows" ? <Monitor className="h-5 w-5" /> : os === "linux" ? <Laptop className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
          </div>
          <div>
            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary inline" />
              Instale o aplicativo no seu {osLabel}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Acesse mais rápido, direto da sua tela inicial e sem precisar abrir o navegador.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <Link to="/download" className="w-full sm:w-auto">
            <Button size="sm" className="w-full sm:w-auto gap-1.5 h-8 text-xs font-semibold bg-primary text-primary-foreground shadow-xs">
              <Download className="h-3.5 w-3.5" />
              Baixar Aplicativo
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Variant "top" (faixa chamativa no topo da tela quando acessado pelo navegador)
  return (
    <div className={`w-full bg-gradient-to-r from-primary via-primary/95 to-sky-600 text-primary-foreground px-3 py-2 text-xs shadow-md flex items-center justify-between gap-3 sticky top-0 z-50 animate-in fade-in slide-in-from-top-2 duration-300 ${className}`}>
      <div className="container mx-auto flex items-center justify-between gap-2 max-w-6xl">
        <div className="flex items-center gap-2 sm:gap-2.5 overflow-hidden">
          <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Download className="h-3.5 w-3.5 text-white" />
          </div>
          <p className="truncate font-medium text-white/95 text-xs sm:text-[13px]">
            <strong className="font-semibold text-white">Você está usando pelo navegador.</strong> Deseja ter o aplicativo oficial instalado no seu {osLabel}?
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Link to="/download">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 px-3 text-xs font-bold text-primary bg-white hover:bg-white/90 shadow-xs"
            >
              Baixar Aplicativo
            </Button>
          </Link>
          <button
            onClick={handleDismiss}
            aria-label="Fechar aviso"
            className="h-7 w-7 rounded-md text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
