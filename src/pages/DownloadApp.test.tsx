import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DownloadApp from "@/pages/DownloadApp";
import {
  LOCAL_DOWNLOAD_PATHS,
  resolveDownloadUrlsFromRelease,
} from "@/pages/download-app";
import type { DetectedOS } from "@/hooks/usePWAInstall";

const pwaState = vi.hoisted(() => ({
  os: "mac" as DetectedOS,
  isInstallable: false,
  isInstalled: false,
  isApp: false,
  promptInstall: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/hooks/usePWAInstall", () => ({
  usePWAInstall: () => pwaState,
}));

const toastMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-toast", () => ({
  toast: toastMock,
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (val: string) => void;
    children: React.ReactNode;
  }) => (
    <div data-testid="mock-tabs" data-value={value}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return null;
        return React.cloneElement(child, {
          activeValue: value,
          onValueChange,
        } as Record<string, unknown>);
      })}
    </div>
  ),
  TabsList: ({
    children,
    activeValue,
    onValueChange,
  }: {
    children: React.ReactNode;
    activeValue?: string;
    onValueChange?: (val: string) => void;
  }) => (
    <div role="tablist">
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return null;
        return React.cloneElement(child, {
          activeValue,
          onValueChange,
        } as Record<string, unknown>);
      })}
    </div>
  ),
  TabsTrigger: ({
    value,
    activeValue,
    onValueChange,
    children,
    ...props
  }: {
    value: string;
    activeValue?: string;
    onValueChange?: (val: string) => void;
    children: React.ReactNode;
  }) => {
    const rest = { ...props } as Record<string, unknown>;
    delete rest.activeValue;
    delete rest.onValueChange;
    return (
      <button
        role="tab"
        type="button"
        aria-selected={value === activeValue}
        onClick={() => onValueChange?.(value)}
        {...rest}
      >
        {children}
      </button>
    );
  },
  TabsContent: ({
    value,
    activeValue,
    children,
  }: {
    value: string;
    activeValue?: string;
    children: React.ReactNode;
  }) => (value === activeValue ? <div role="tabpanel">{children}</div> : null),
}));

function renderDownloadApp() {
  return render(
    <MemoryRouter initialEntries={["/download"]}>
      <Routes>
        <Route path="/download" element={<DownloadApp />} />
        <Route path="/auth" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("resolveDownloadUrlsFromRelease", () => {
  it("mantém fallback local quando não há assets publicados", () => {
    expect(resolveDownloadUrlsFromRelease(undefined)).toEqual(LOCAL_DOWNLOAD_PATHS);
    expect(resolveDownloadUrlsFromRelease([])).toEqual(LOCAL_DOWNLOAD_PATHS);
  });

  it("atualiza apenas os assets válidos retornados pela release", () => {
    const resolved = resolveDownloadUrlsFromRelease([
      {
        name: "Pluri-Health-Mac.dmg",
        browser_download_url: "https://github.com/jougy/therapy-flow/releases/download/v1.0.0/Pluri-Health-Mac.dmg",
      },
      {
        name: "Pluri-Health-Windows.exe",
        browser_download_url: "http://insecure.example.com/file.exe",
      },
    ]);

    expect(resolved.macDmg).toBe(
      "https://github.com/jougy/therapy-flow/releases/download/v1.0.0/Pluri-Health-Mac.dmg"
    );
    expect(resolved.windowsExe).toBe(LOCAL_DOWNLOAD_PATHS.windowsExe);
  });
});

describe("DownloadApp page", () => {
  const originalLocation = window.location;
  const originalFetch = global.fetch;

  beforeEach(() => {
    pwaState.os = "mac";
    pwaState.isInstallable = false;
    pwaState.isInstalled = false;
    pwaState.isApp = false;
    pwaState.promptInstall.mockReset();
    toastMock.mockReset();
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      configurable: true,
      writable: true,
    });
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("redireciona para /auth quando já está em execução como aplicativo", () => {
    pwaState.isApp = true;
    renderDownloadApp();
    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("exibe detecção por SO e aponta para instaladores locais quando não há release publicada", async () => {
    Object.defineProperty(window, "location", {
      value: new URL("https://app.plurifisio.com.br/download"),
      configurable: true,
      writable: true,
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: "Not Found" }),
    } as Response);

    pwaState.os = "mac";
    renderDownloadApp();

    expect(screen.getByText("Computador Mac (Apple)")).toBeInTheDocument();
    const macHeroLink = screen.getByRole("link", { name: /Baixar para Mac$/i });
    expect(macHeroLink).toHaveAttribute("href", "/downloads/Pluri-Health-Mac.dmg");

    const macTabLink = screen.getByRole("link", { name: /Baixar para Mac \(\.dmg\)/i });
    expect(macTabLink).toHaveAttribute("href", "/downloads/Pluri-Health-Mac.dmg");

    // Troca para aba Windows
    fireEvent.click(screen.getByRole("tab", { name: /Windows/i }));
    expect(screen.getByRole("link", { name: /Baixar Instalador \(\.exe\)/i })).toHaveAttribute(
      "href",
      "/downloads/Pluri-Health-Windows.exe"
    );
    expect(screen.getByRole("link", { name: /Pacote \(\.msi\)/i })).toHaveAttribute(
      "href",
      "/downloads/Pluri-Health.msi"
    );

    // Troca para aba Linux
    fireEvent.click(screen.getByRole("tab", { name: /Linux/i }));
    expect(screen.getByRole("link", { name: /Baixar \(\.deb\)/i })).toHaveAttribute(
      "href",
      "/downloads/pluri-health_amd64.deb"
    );
    expect(screen.getByRole("link", { name: /Baixar \(\.rpm\)/i })).toHaveAttribute(
      "href",
      "/downloads/pluri-health.rpm"
    );
    expect(screen.getByRole("link", { name: /Baixar \(\.AppImage\)/i })).toHaveAttribute(
      "href",
      "/downloads/Pluri-Health-Linux.AppImage"
    );
  });

  it("atualiza os links automaticamente quando o GitHub retorna uma release publicada", async () => {
    Object.defineProperty(window, "location", {
      value: new URL("https://app.plurifisio.com.br/download"),
      configurable: true,
      writable: true,
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        assets: [
          {
            name: "Pluri-Health-Mac.dmg",
            browser_download_url:
              "https://github.com/jougy/therapy-flow/releases/download/v1.0.0/Pluri-Health-Mac.dmg",
          },
          {
            name: "Pluri-Health-Windows.exe",
            browser_download_url:
              "https://github.com/jougy/therapy-flow/releases/download/v1.0.0/Pluri-Health-Windows.exe",
          },
        ],
      }),
    } as Response);

    pwaState.os = "mac";
    renderDownloadApp();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Baixar para Mac$/i })).toHaveAttribute(
        "href",
        "https://github.com/jougy/therapy-flow/releases/download/v1.0.0/Pluri-Health-Mac.dmg"
      );
    });
  });

  it("detecta Windows, Linux, Android e iOS e orienta instalação pelo navegador quando não há prompt PWA", () => {
    pwaState.os = "windows";
    const { unmount } = renderDownloadApp();
    expect(screen.getByText("Computador Windows")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Baixar para Windows \(\.exe\)/i })).toHaveAttribute(
      "href",
      "/downloads/Pluri-Health-Windows.exe"
    );
    unmount();

    pwaState.os = "linux";
    const linuxRender = renderDownloadApp();
    expect(screen.getByText("Computador Linux")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Baixar para Linux/i })).toHaveAttribute(
      "href",
      "/downloads/pluri-health_amd64.deb"
    );
    linuxRender.unmount();

    pwaState.os = "android";
    const androidRender = renderDownloadApp();
    expect(screen.getByText("Celular Android")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Instalar no Celular Agora/i }));
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Como instalar pelo navegador" })
    );
    androidRender.unmount();

    pwaState.os = "ios";
    renderDownloadApp();
    expect(screen.getByText("iPhone / iPad")).toBeInTheDocument();
    expect(screen.getByText(/3 passos simples no seu iPhone/i)).toBeInTheDocument();
  });
});
