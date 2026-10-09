import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  sanitizeWhatsAppNumber,
  sanitizeMessageInput,
  WhatsAppClient,
} from "../../supabase/functions/_shared/whatsapp-client.ts";

// Mock Deno environment for Vitest (Node environment)
const mockEnv = new Map<string, string>();
(globalThis as unknown as { Deno: { env: { get: (key: string) => string | undefined } } }).Deno = {
  env: {
    get: (key: string) => mockEnv.get(key),
  },
};

describe("WhatsApp Client & Meta Cloud API Integration", () => {
  beforeEach(() => {
    mockEnv.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("sanitizeWhatsAppNumber", () => {
    it("formats standard Brazilian phone numbers with DDI 55", () => {
      expect(sanitizeWhatsAppNumber("11999998888")).toBe("5511999998888");
      expect(sanitizeWhatsAppNumber("(11) 99999-8888")).toBe("5511999998888");
      expect(sanitizeWhatsAppNumber("+55 11 99999-8888")).toBe("5511999998888");
      expect(sanitizeWhatsAppNumber("011999998888")).toBe("5511999998888");
    });

    it("rejects invalid or too short inputs", () => {
      expect(sanitizeWhatsAppNumber("")).toBe("");
      expect(sanitizeWhatsAppNumber(null)).toBe("");
      expect(sanitizeWhatsAppNumber("123")).toBe("");
      expect(sanitizeWhatsAppNumber("abc")).toBe("");
    });
  });

  describe("sanitizeMessageInput", () => {
    it("removes control characters and limits length", () => {
      const dirty = "Hello\x00World\x1F! 🚀";
      expect(sanitizeMessageInput(dirty, 50)).toBe("HelloWorld! 🚀");
      expect(sanitizeMessageInput("abcdefgh", 4)).toBe("abcd");
    });
  });

  describe("Meta Cloud API Payload & Send Tests", () => {
    it("correctly constructs Meta Cloud API text payload and headers", async () => {
      mockEnv.set("META_WHATSAPP_TOKEN", "test_meta_token_123");
      mockEnv.set("META_PHONE_NUMBER_ID", "10987654321");
      mockEnv.set("WHATSAPP_API_PROVIDER", "meta_cloud");

      let capturedUrl = "";
      let capturedHeaders: HeadersInit | undefined;
      let capturedBody: string | undefined;

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        capturedUrl = String(input);
        capturedHeaders = init?.headers;
        capturedBody = init?.body as string;

        return new Response(
          JSON.stringify({
            messaging_product: "whatsapp",
            contacts: [{ input: "5511999998888", wa_id: "5511999998888" }],
            messages: [{ id: "wamid.HBgTEST123" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      });

      const client = new WhatsAppClient();
      expect(client.isConfigured()).toBe(true);
      expect(client.getProvider()).toBe("meta_cloud");

      const res = await client.sendTextMessage("11999998888", "Olá doutor! Bem-vindo.");

      expect(res.success).toBe(true);
      expect(res.messageId).toBe("wamid.HBgTEST123");
      expect(capturedUrl).toBe("https://graph.facebook.com/v19.0/10987654321/messages");

      const parsedHeaders = capturedHeaders as Record<string, string>;
      expect(parsedHeaders["Authorization"]).toBe("Bearer test_meta_token_123");
      expect(parsedHeaders["Content-Type"]).toBe("application/json");

      const parsedBody = JSON.parse(capturedBody || "{}");
      expect(parsedBody.messaging_product).toBe("whatsapp");
      expect(parsedBody.recipient_type).toBe("individual");
      expect(parsedBody.to).toBe("5511999998888");
      expect(parsedBody.type).toBe("text");
      expect(parsedBody.text.body).toBe("Olá doutor! Bem-vindo.");
      expect(parsedBody.text.preview_url).toBe(true);

      fetchSpy.mockRestore();
    });

    it("constructs Meta interactive buttons payload with max 20 chars per button title", async () => {
      mockEnv.set("META_WHATSAPP_TOKEN", "test_meta_token_123");
      mockEnv.set("META_PHONE_NUMBER_ID", "10987654321");
      mockEnv.set("WHATSAPP_API_PROVIDER", "meta_cloud");

      let capturedBody: string | undefined;

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
        capturedBody = init?.body as string;
        return new Response(
          JSON.stringify({
            messaging_product: "whatsapp",
            messages: [{ id: "wamid.HBgBTN123" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      });

      const client = new WhatsAppClient();
      const res = await client.sendButtonsMessage("11999998888", "Como prefere começar?", {
        title: "PluriFisio - Boas-vindas",
        footer: "Selecione uma opção",
        buttons: [
          { id: "btn_schedule_intro", label: "Agendar Introdução" },
          { id: "btn_self_explore", label: "Seguir por conta própria e explorar" }, // > 20 chars
        ],
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBe("wamid.HBgBTN123");

      const parsedBody = JSON.parse(capturedBody || "{}");
      expect(parsedBody.type).toBe("interactive");
      expect(parsedBody.interactive.type).toBe("button");
      expect(parsedBody.interactive.header.text).toBe("PluriFisio - Boas-vindas");
      expect(parsedBody.interactive.footer.text).toBe("Selecione uma opção");
      expect(parsedBody.interactive.action.buttons).toHaveLength(2);
      expect(parsedBody.interactive.action.buttons[0].reply.id).toBe("btn_schedule_intro");
      expect(parsedBody.interactive.action.buttons[0].reply.title).toBe("Agendar Introdução");
      // Truncated to 20 chars max for Meta Cloud API compliance
      expect(parsedBody.interactive.action.buttons[1].reply.title.length).toBeLessThanOrEqual(20);

      fetchSpy.mockRestore();
    });

    it("triggers resilient text fallback when Meta interactive buttons fail", async () => {
      mockEnv.set("META_WHATSAPP_TOKEN", "test_meta_token_123");
      mockEnv.set("META_PHONE_NUMBER_ID", "10987654321");
      mockEnv.set("WHATSAPP_API_PROVIDER", "meta_cloud");

      let attempt = 0;
      let lastBody: string | undefined;

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
        attempt++;
        lastBody = init?.body as string;

        if (attempt === 1) {
          // Button send failure (e.g. template required or 400 from Meta)
          return new Response(
            JSON.stringify({ error: { message: "Interactive messages not allowed outside 24h window" } }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Fallback text succeeds
        return new Response(
          JSON.stringify({
            messaging_product: "whatsapp",
            messages: [{ id: "wamid.HBgFALLBACK123" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      });

      const client = new WhatsAppClient();
      const res = await client.sendButtonsMessage("11999998888", "Mensagem teste", {
        buttons: [
          { id: "btn_1", label: "Opção 1" },
          { id: "btn_2", label: "Opção 2" },
        ],
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBe("wamid.HBgFALLBACK123");
      expect(attempt).toBe(2);

      const parsedBody = JSON.parse(lastBody || "{}");
      expect(parsedBody.type).toBe("text");
      expect(parsedBody.text.body).toContain("*1* - Opção 1");
      expect(parsedBody.text.body).toContain("*2* - Opção 2");

      fetchSpy.mockRestore();
    });

    it("provides absolute fail-safe if credentials are not configured", async () => {
      const client = new WhatsAppClient();
      expect(client.isConfigured()).toBe(false);

      const res = await client.sendTextMessage("11999998888", "Teste fail-safe");
      expect(res.success).toBe(false);
      expect(res.skipped).toBe(true);
      expect(res.error).toContain("não configuradas");
    });
  });
});
