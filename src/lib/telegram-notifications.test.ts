import { describe, it, expect } from "vitest";
import {
  sanitizePhoneNumber,
  generateWhatsAppUrl,
  buildSignupWelcomeMessage,
  buildPlanPurchaseMessage,
  formatSignupTelegramText,
  escapeTelegramHtml,
} from "./telegram-notifications";

describe("telegram-notifications utilitários", () => {
  describe("escapeTelegramHtml", () => {
    it("deve escapar tags HTML e caracteres especiais para evitar HTML Injection", () => {
      expect(escapeTelegramHtml("<script>alert('xss')</script>")).toBe(
        "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"
      );
      expect(escapeTelegramHtml('João & Maria "Admin"')).toBe(
        "João &amp; Maria &quot;Admin&quot;"
      );
    });

    it("deve retornar string vazia para valores nulos ou indefinidos", () => {
      expect(escapeTelegramHtml(null)).toBe("");
      expect(escapeTelegramHtml(undefined)).toBe("");
    });
  });

  describe("sanitizePhoneNumber", () => {
    it("deve retornar string vazia para valores nulos, vazios ou indefinidos", () => {
      expect(sanitizePhoneNumber(null)).toBe("");
      expect(sanitizePhoneNumber(undefined)).toBe("");
      expect(sanitizePhoneNumber("")).toBe("");
      expect(sanitizePhoneNumber("   ")).toBe("");
    });

    it("deve adicionar o DDI 55 para telefone celular de 11 dígitos com pontuação", () => {
      expect(sanitizePhoneNumber("(11) 98765-4321")).toBe("5511987654321");
      expect(sanitizePhoneNumber("11 98765-4321")).toBe("5511987654321");
      expect(sanitizePhoneNumber("11987654321")).toBe("5511987654321");
    });

    it("deve adicionar o DDI 55 para telefone fixo de 10 dígitos com pontuação", () => {
      expect(sanitizePhoneNumber("(11) 3456-7890")).toBe("551134567890");
      expect(sanitizePhoneNumber("1134567890")).toBe("551134567890");
    });

    it("deve manter o DDI 55 quando o número já o contiver", () => {
      expect(sanitizePhoneNumber("+55 (11) 98765-4321")).toBe("5511987654321");
      expect(sanitizePhoneNumber("5511987654321")).toBe("5511987654321");
      expect(sanitizePhoneNumber("+55 11 3456-7890")).toBe("551134567890");
    });

    it("deve higienizar qualquer caracter não numérico mantendo dígitos limpos", () => {
      expect(sanitizePhoneNumber("tel: +55.21.99999-8888")).toBe("5521999998888");
    });
  });

  describe("generateWhatsAppUrl", () => {
    it("deve gerar URL wa.me com DDI 55 e encode correto do texto", () => {
      const phone = "(11) 98765-4321";
      const message = "Olá Dr. Silva! Seja bem-vindo ao Pluri Health.";
      const url = generateWhatsAppUrl(phone, message);

      expect(url).toBe(
        "https://wa.me/5511987654321?text=Ol%C3%A1%20Dr.%20Silva!%20Seja%20bem-vindo%20ao%20Pluri%20Health."
      );
    });

    it("deve gerar URL sem parâmetro de texto caso texto não seja fornecido", () => {
      const phone = "11987654321";
      expect(generateWhatsAppUrl(phone)).toBe("https://wa.me/5511987654321");
      expect(generateWhatsAppUrl(phone, "")).toBe("https://wa.me/5511987654321");
    });

    it("deve retornar string vazia caso o telefone seja nulo, vazio ou inválido (fallback gracioso)", () => {
      expect(generateWhatsAppUrl(null, "Olá")).toBe("");
      expect(generateWhatsAppUrl(undefined, "Olá")).toBe("");
      expect(generateWhatsAppUrl("", "Olá")).toBe("");
      expect(generateWhatsAppUrl("   ", "Olá")).toBe("");
      expect(generateWhatsAppUrl("abc-xyz", "Olá")).toBe("");
    });
  });

  describe("buildSignupWelcomeMessage & buildPlanPurchaseMessage", () => {
    it("deve gerar mensagem personalizada com nome do usuário", () => {
      const msg = buildSignupWelcomeMessage("Dra. Beatriz Santos");
      expect(msg).toContain("Olá Dra. Beatriz Santos!");
      expect(msg).toContain("Pluri Health");
    });

    it("deve utilizar fallback gracioso caso o nome esteja vazio", () => {
      const msg = buildSignupWelcomeMessage("");
      expect(msg).toContain("Olá Profissional!");
    });

    it("deve gerar mensagem correta para compra de plano", () => {
      const msg = buildPlanPurchaseMessage("Carlos Silva", "Equipe Pro");
      expect(msg).toContain("Olá Carlos Silva!");
      expect(msg).toContain("Equipe Pro");
    });
  });

  describe("formatSignupTelegramText", () => {
    it("deve formatar os dados do cadastro com link wa.me quando telefone estiver presente", () => {
      const text = formatSignupTelegramText({
        name: "Mariana Souza",
        email: "mariana@exemplo.com",
        phone: "(21) 99887-6655",
        clinicName: "Clínica FisioLife",
        plan: "Degustação Gratuita (7 dias)",
        createdAt: "2026-10-02 16:30",
      });

      expect(text).toContain("🚀 <b>Novo Cadastro Realizado!</b>");
      expect(text).toContain("👤 <b>Nome:</b> Mariana Souza");
      expect(text).toContain("📧 <b>E-mail:</b> mariana@exemplo.com");
      expect(text).toContain("📱 <b>Telefone:</b> (21) 99887-6655");
      expect(text).toContain("🏥 <b>Clínica / Consultório:</b> Clínica FisioLife");
      expect(text).toContain("💬 <b>WhatsApp:</b> <a href=\"https://wa.me/5521998876655?text=");
    });

    it("deve escapar caracteres HTML maliciosos para prevenir HTML Injection", () => {
      const text = formatSignupTelegramText({
        name: "<b>Hacker</b>",
        email: "hack<test>@exemplo.com",
        phone: "11988887777",
        clinicName: "Clínica <script>alert(1)</script>",
      });

      expect(text).toContain("👤 <b>Nome:</b> &lt;b&gt;Hacker&lt;/b&gt;");
      expect(text).toContain("📧 <b>E-mail:</b> hack&lt;test&gt;@exemplo.com");
      expect(text).toContain("🏥 <b>Clínica / Consultório:</b> Clínica &lt;script&gt;alert(1)&lt;/script&gt;");
    });

    it("deve omitir link do WhatsApp de forma graciosa se telefone for nulo ou vazio", () => {
      const text = formatSignupTelegramText({
        name: "Sem Telefone",
        email: "semtel@exemplo.com",
        phone: null,
      });

      expect(text).toContain("📱 <b>Telefone:</b> Não informado");
      expect(text).not.toContain("💬 <b>WhatsApp:</b>");
    });
  });
});
