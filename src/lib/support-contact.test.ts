import { describe, expect, it } from "vitest";
import {
  buildSupportEmailHref,
  buildSupportWhatsAppHref,
  sanitizeSupportPhone,
  type SupportContactDraft,
} from "@/lib/support-contact";

const baseDraft: SupportContactDraft = {
  category: "erro",
  clinicName: "Clinica Aurora",
  currentPath: "/configuracoes",
  includeContext: true,
  message: "Ao abrir a tela, encontrei um comportamento inesperado.",
  subject: "Tela de configuracoes com falha",
  userEmail: "alice@aurora.test",
  userName: "Alice",
};

describe("support contact helpers", () => {
  it("sanitizes a phone number for WhatsApp links", () => {
    expect(sanitizeSupportPhone("+55 11 99230-5889")).toBe("5511992305889");
  });

  it("builds a mailto href with encoded subject and context", () => {
    const href = buildSupportEmailHref("jougy@gmx.com", baseDraft);

    expect(href).toContain("mailto:jougy@gmx.com");
    expect(href).toContain("subject=%5BPronto%20Health%20-%20Fisio%5D%20Erro%20-%20Tela%20de%20configuracoes%20com%20falha");
    expect(decodeURIComponent(href)).toContain("Clínica: Clinica Aurora");
    expect(decodeURIComponent(href)).toContain("Usuário: Alice");
    expect(decodeURIComponent(href)).toContain("Página: /configuracoes");
  });

  it("builds a WhatsApp url with a compact support message", () => {
    const href = buildSupportWhatsAppHref("+55 11 99230-5889", {
      ...baseDraft,
      category: "melhoria",
      subject: "Sugestao para agenda",
    });

    expect(href.startsWith("https://wa.me/5511992305889?text=")).toBe(true);
    expect(decodeURIComponent(href)).toContain("[Pronto Health - Fisio] Melhoria");
    expect(decodeURIComponent(href)).toContain("Sugestao para agenda");
    expect(decodeURIComponent(href)).toContain("Página: /configuracoes");
  });

  it("omits extra context when requested", () => {
    const href = buildSupportEmailHref("jougy@gmx.com", {
      ...baseDraft,
      includeContext: false,
    });

    expect(decodeURIComponent(href)).not.toContain("Clínica:");
    expect(decodeURIComponent(href)).not.toContain("Usuário:");
    expect(decodeURIComponent(href)).not.toContain("Página:");
  });
});
