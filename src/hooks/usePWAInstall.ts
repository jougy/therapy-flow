import { useState, useEffect, useCallback } from "react";

export type DetectedOS = "windows" | "mac" | "linux" | "android" | "ios" | "unknown";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function isRunningInApp(): boolean {
  if (typeof window === "undefined") return false;

  // 1. PWA Standalone (Chrome, Edge, Brave, etc.)
  const isDisplayStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const isDisplayWindowControls = window.matchMedia("(display-mode: window-controls-overlay)").matches;
  const isDisplayFullscreen = window.matchMedia("(display-mode: fullscreen)").matches;
  const isDisplayMinimalUi = window.matchMedia("(display-mode: minimal-ui)").matches;

  // 2. iOS Safari Standalone
  const isIosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;

  // 3. Android WebAPK / TWA / Native referrer
  const isAndroidApp = typeof document !== "undefined" && document.referrer.includes("android-app://");

  // 4. Custom App environment / Tauri / Electron
  const isCustomApp =
    typeof window !== "undefined" &&
    ("__TAURI__" in window ||
      "__TAURI_INTERNALS__" in window ||
      (window as unknown as { isNativeApp?: boolean }).isNativeApp === true);

  return (
    isDisplayStandalone ||
    isDisplayWindowControls ||
    isDisplayFullscreen ||
    isDisplayMinimalUi ||
    isIosStandalone ||
    isAndroidApp ||
    isCustomApp
  );
}

export function detectUserOS(): DetectedOS {
  if (typeof window === "undefined" || !navigator) return "unknown";

  const userAgent = navigator.userAgent || navigator.vendor || (window as unknown as { opera?: string }).opera || "";
  const platform = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || "";

  if (/android/i.test(userAgent)) {
    return "android";
  }

  // iOS detection
  if (/iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
    return "ios";
  }

  if (/Win/i.test(platform) || /windows/i.test(userAgent)) {
    return "windows";
  }

  if (/Mac/i.test(platform) || /macintosh|mac os x/i.test(userAgent)) {
    return "mac";
  }

  if (/Linux/i.test(platform) || /linux/i.test(userAgent)) {
    return "linux";
  }

  return "unknown";
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [os, setOS] = useState<DetectedOS>("unknown");

  useEffect(() => {
    setOS(detectUserOS());

    const checkAppStatus = () => {
      setIsInstalled(isRunningInApp());
    };

    checkAppStatus();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Monitora mudanças de display-mode dinamicamente
    const mediaQueryList = window.matchMedia("(display-mode: standalone)");
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
      }
    };

    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener("change", handleMediaChange);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener("change", handleMediaChange);
      }
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch (err) {
      console.warn("[PWA] Erro ao disparar prompt de instalação:", err);
      return false;
    }
  }, [deferredPrompt]);

  return {
    os,
    isInstallable,
    isInstalled,
    isApp: isInstalled,
    promptInstall,
  };
}
