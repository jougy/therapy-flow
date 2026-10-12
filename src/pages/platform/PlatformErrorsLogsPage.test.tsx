import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import {
  PlatformErrorsLogsPage,
  isWhatsAppBugReport,
  formatWhatsAppPhone,
  getWhatsAppDeepLink,
} from "./PlatformErrorsLogsPage";
import {
  clearDebugEvents,
  logRuntimeError,
  logRuntimeInfo,
  type RuntimeDebugEvent,
} from "@/lib/runtime-debug";

describe("PlatformErrorsLogsPage & WhatsApp Bug Report Features", () => {
  beforeEach(() => {
    clearDebugEvents();
    vi.clearAllMocks();
  });

  describe("Helper Functions", () => {
    it("detects WhatsApp bug reports accurately via source or scope", () => {
      const waReport1: RuntimeDebugEvent = {
        id: "1",
        timestamp: Date.now(),
        timeString: "10:00:00",
        type: "error",
        scope: "ui.button",
        message: "Erro no botão salvar",
        context: {
          source: "whatsapp_bug_report",
          phone: "11988887777",
        },
      };

      const waReport2: RuntimeDebugEvent = {
        id: "2",
        timestamp: Date.now(),
        timeString: "10:01:00",
        type: "error",
        scope: "whatsapp_bug_report",
        message: "Falha reportada",
      };

      const appError: RuntimeDebugEvent = {
        id: "3",
        timestamp: Date.now(),
        timeString: "10:02:00",
        type: "error",
        scope: "auth.session",
        message: "Token expired",
      };

      expect(isWhatsAppBugReport(waReport1)).toBe(true);
      expect(isWhatsAppBugReport(waReport2)).toBe(true);
      expect(isWhatsAppBugReport(appError)).toBe(false);
    });

    it("formats WhatsApp phone numbers for Brazilian standards", () => {
      expect(formatWhatsAppPhone("11987654321")).toBe("(11) 98765-4321");
      expect(formatWhatsAppPhone("1133334444")).toBe("(11) 3333-4444");
      expect(formatWhatsAppPhone("5511987654321")).toBe("+55 (11) 98765-4321");
      expect(formatWhatsAppPhone("")).toBe("Telefone não informado");
      expect(formatWhatsAppPhone(undefined)).toBe("Telefone não informado");
    });

    it("generates WhatsApp wa.me deep links with friendly pre-filled text", () => {
      const link = getWhatsAppDeepLink("11987654321", "Dra. Paula");
      expect(link).toContain("https://wa.me/5511987654321");
      expect(link).toContain(encodeURIComponent("Dra. Paula"));
      expect(link).toContain(encodeURIComponent("Pluri-Health"));

      // Number already starting with 55
      const linkWith55 = getWhatsAppDeepLink("5511987654321");
      expect(linkWith55).toContain("https://wa.me/5511987654321");

      // Empty fallback
      expect(getWhatsAppDeepLink("")).toBe("#");
      expect(getWhatsAppDeepLink(undefined)).toBe("#");
    });
  });

  describe("PlatformErrorsLogsPage Component", () => {
    it("renders page header and metric cards including WhatsApp counter", () => {
      render(<PlatformErrorsLogsPage />);

      expect(screen.getByText("Erros & Logs de Diagnóstico")).toBeInTheDocument();
      expect(screen.getByText("Relatos WhatsApp")).toBeInTheDocument();
      expect(screen.getByText("Erros Críticos")).toBeInTheDocument();
      expect(screen.getByText("Total de Eventos")).toBeInTheDocument();
    });

    it("renders quick filter buttons for Todos, Erros de Aplicação and Relatos WhatsApp", () => {
      render(<PlatformErrorsLogsPage />);

      expect(screen.getByRole("button", { name: /^Todos/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Erros de Aplicação/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Relatos de Clientes \(WhatsApp\)/ })).toBeInTheDocument();
    });

    it("renders special card for WhatsApp bug reports with badge, lead info, message and action button", () => {
      // Registrar log com contexto do WhatsApp
      logRuntimeError(
        "whatsapp.client_report",
        new Error("Problema ao emitir recibo"),
        {
          source: "whatsapp_bug_report",
          leadName: "Dra. Marcela",
          clinicName: "Clínica Saúde Plena",
          phone: "11999998888",
          message: "O botão de salvar recibo está travado",
          imageUrl: "https://example.com/print-erro.png",
        }
      );

      render(<PlatformErrorsLogsPage />);

      // Badge WhatsApp
      expect(screen.getByText("Relato de Bug (WhatsApp)")).toBeInTheDocument();

      // Lead identification
      expect(screen.getByText("Dra. Marcela")).toBeInTheDocument();
      expect(screen.getByText("Clínica Saúde Plena")).toBeInTheDocument();
      expect(screen.getByText("(11) 99999-8888")).toBeInTheDocument();

      // Message
      expect(screen.getByText("O botão de salvar recibo está travado")).toBeInTheDocument();

      // Direct WhatsApp link
      const waButton = screen.getByRole("link", { name: /Chamar no WhatsApp/ });
      expect(waButton).toBeInTheDocument();
      expect(waButton.getAttribute("href")).toContain("wa.me/5511999998888");

      // Image preview
      const previewImg = screen.getByRole("img", { name: /Print anexado por Dra. Marcela/ });
      expect(previewImg).toBeInTheDocument();
      expect(previewImg.getAttribute("src")).toBe("https://example.com/print-erro.png");
    });

    it("filters correctly when switching between App Errors and WhatsApp reports", () => {
      // 1. WhatsApp bug report
      logRuntimeError(
        "whatsapp.client_report",
        new Error("Bug no WhatsApp"),
        {
          source: "whatsapp_bug_report",
          leadName: "Dr. Roberto",
          phone: "21988887777",
          message: "Falha crítica no WhatsApp",
        }
      );

      // 2. Regular application crash
      logRuntimeError(
        "app.crash",
        new Error("TypeError: Cannot read properties of undefined in TableGrid"),
        {
          source: "table_component",
        }
      );

      render(<PlatformErrorsLogsPage />);

      // Inicialmente "Todos": exibe ambos
      expect(screen.getByText("Falha crítica no WhatsApp")).toBeInTheDocument();
      expect(screen.getByText("TypeError: Cannot read properties of undefined in TableGrid")).toBeInTheDocument();

      // Clicar em "Erros de Aplicação (JS/Crash)"
      const appFilterBtn = screen.getByRole("button", { name: /Erros de Aplicação/ });
      fireEvent.click(appFilterBtn);

      // Apenas erro de aplicação visível
      expect(screen.queryByText("Falha crítica no WhatsApp")).not.toBeInTheDocument();
      expect(screen.getByText("TypeError: Cannot read properties of undefined in TableGrid")).toBeInTheDocument();

      // Clicar em "Relatos de Clientes (WhatsApp)"
      const waFilterBtn = screen.getByRole("button", { name: /Relatos de Clientes \(WhatsApp\)/ });
      fireEvent.click(waFilterBtn);

      // Apenas WhatsApp visível
      expect(screen.getByText("Falha crítica no WhatsApp")).toBeInTheDocument();
      expect(screen.queryByText("TypeError: Cannot read properties of undefined in TableGrid")).not.toBeInTheDocument();
    });

    it("opens image zoom dialog when clicking attached image preview", async () => {
      logRuntimeError(
        "whatsapp.client_report",
        new Error("Erro de layout"),
        {
          source: "whatsapp_bug_report",
          leadName: "Dra. Camila",
          phone: "31977776666",
          message: "Tela cortada",
          imageUrl: "https://example.com/screenshot.jpg",
        }
      );

      render(<PlatformErrorsLogsPage />);

      const imgTrigger = screen.getByRole("img", { name: /Print anexado por Dra. Camila/ });
      fireEvent.click(imgTrigger);

      // Modal/Dialog opens
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    });

    it("filters events by search term (lead name, message or phone)", () => {
      logRuntimeError(
        "whatsapp.client_report",
        new Error("Relato 1"),
        {
          source: "whatsapp_bug_report",
          leadName: "Dra. Sabrina",
          phone: "11988881234",
          message: "Problema com agenda",
        }
      );

      logRuntimeError(
        "whatsapp.client_report",
        new Error("Relato 2"),
        {
          source: "whatsapp_bug_report",
          leadName: "Dr. Fernando",
          phone: "11977775678",
          message: "Problema no financeiro",
        }
      );

      render(<PlatformErrorsLogsPage />);

      const searchInput = screen.getByPlaceholderText(/Filtrar por mensagem, escopo/);
      fireEvent.change(searchInput, { target: { value: "Sabrina" } });

      expect(screen.getByText("Dra. Sabrina")).toBeInTheDocument();
      expect(screen.queryByText("Dr. Fernando")).not.toBeInTheDocument();
    });
  });
});
