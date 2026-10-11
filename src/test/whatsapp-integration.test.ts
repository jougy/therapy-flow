import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  sanitizeWhatsAppNumber,
  sanitizeMessageInput,
  WhatsAppClient,
} from "../../supabase/functions/_shared/whatsapp-client.ts";
import {
  getNextBusinessDays,
  getAvailableWindowsForDay,
  formatAvailableWindowsText,
  validateSelectedTime,
  parseTimeToMinutes,
  formatMinutesToTime,
  generateGoogleCalendarUrl,
  generateIcsContent,
  createBrasiliaDate,
  parseIcsToBusySlots,
} from "../../supabase/functions/_shared/calendar-utils.ts";

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
    it("removes control characters, zero-width chars, bidi overrides and limits length", () => {
      const dirty = "Hello\x00World\x1F\u200B\u202E! 🚀";
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
      expect(parsedBody.interactive.action.buttons[1].reply.title.length).toBeLessThanOrEqual(20);

      fetchSpy.mockRestore();
    });

    it("correctly constructs Meta List Message payload with sections and rows", async () => {
      mockEnv.set("META_WHATSAPP_TOKEN", "test_meta_token_123");
      mockEnv.set("META_PHONE_NUMBER_ID", "10987654321");
      mockEnv.set("WHATSAPP_API_PROVIDER", "meta_cloud");

      let capturedBody: string | undefined;

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
        capturedBody = init?.body as string;
        return new Response(
          JSON.stringify({
            messaging_product: "whatsapp",
            messages: [{ id: "wamid.HBgLIST123" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      });

      const client = new WhatsAppClient();
      const res = await client.sendListMessage(
        "11999998888",
        "Escolha o melhor dia para a sua introdução:",
        "Escolher dia",
        [
          {
            title: "Dias disponíveis",
            rows: [
              { id: "day_2026-10-13", title: "Segunda-feira (13/10)", description: "Disponível 09h às 18h" },
              { id: "day_2026-10-14", title: "Terça-feira (14/10)", description: "Disponível 09h às 18h" },
            ],
          },
        ],
        { title: "PluriFisio - Agendamento", footer: "Atendimento Seg a Sex" }
      );

      expect(res.success).toBe(true);
      expect(res.messageId).toBe("wamid.HBgLIST123");

      const parsedBody = JSON.parse(capturedBody || "{}");
      expect(parsedBody.type).toBe("interactive");
      expect(parsedBody.interactive.type).toBe("list");
      expect(parsedBody.interactive.header.text).toBe("PluriFisio - Agendamento");
      expect(parsedBody.interactive.footer.text).toBe("Atendimento Seg a Sex");
      expect(parsedBody.interactive.action.button).toBe("Escolher dia");
      expect(parsedBody.interactive.action.sections).toHaveLength(1);
      expect(parsedBody.interactive.action.sections[0].rows).toHaveLength(2);
      expect(parsedBody.interactive.action.sections[0].rows[0].id).toBe("day_2026-10-13");

      fetchSpy.mockRestore();
    });

    it("triggers resilient text fallback when Meta List Message fails", async () => {
      mockEnv.set("META_WHATSAPP_TOKEN", "test_meta_token_123");
      mockEnv.set("META_PHONE_NUMBER_ID", "10987654321");
      mockEnv.set("WHATSAPP_API_PROVIDER", "meta_cloud");

      let attempt = 0;
      let lastBody: string | undefined;

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
        attempt++;
        lastBody = init?.body as string;

        if (attempt === 1) {
          return new Response(
            JSON.stringify({ error: { message: "List message failed" } }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            messaging_product: "whatsapp",
            messages: [{ id: "wamid.HBgFALLBACK_LIST" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      });

      const client = new WhatsAppClient();
      const res = await client.sendListMessage(
        "11999998888",
        "Escolha um dia:",
        "Ver dias",
        [
          {
            title: "Dias",
            rows: [
              { id: "day_1", title: "Segunda (13/10)" },
              { id: "day_2", title: "Terça (14/10)" },
            ],
          },
        ]
      );

      expect(res.success).toBe(true);
      expect(res.messageId).toBe("wamid.HBgFALLBACK_LIST");
      expect(attempt).toBe(2);

      const parsedBody = JSON.parse(lastBody || "{}");
      expect(parsedBody.type).toBe("text");
      expect(parsedBody.text.body).toContain("*1* - Segunda (13/10)");
      expect(parsedBody.text.body).toContain("*2* - Terça (14/10)");

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

    it("returns default admin commercial phone for human handoff", () => {
      const client = new WhatsAppClient();
      expect(client.getAdminCommercialPhone()).toBe("5511980113936");
    });
  });

  describe("Calendar Availability Engine & Google Calendar Integration", () => {
    describe("getNextBusinessDays", () => {
      it("returns 5 consecutive business days excluding weekends", () => {
        // Fix a Monday reference: 2026-10-12 10:00 UTC (07:00 Brasilia)
        const refMonday = new Date(Date.UTC(2026, 9, 12, 10, 0, 0));
        const days = getNextBusinessDays(5, refMonday);

        expect(days).toHaveLength(5);
        expect(days[0].displayDayOfWeek).toBe("Segunda-feira");
        expect(days[1].displayDayOfWeek).toBe("Terça-feira");
        expect(days[2].displayDayOfWeek).toBe("Quarta-feira");
        expect(days[3].displayDayOfWeek).toBe("Quinta-feira");
        expect(days[4].displayDayOfWeek).toBe("Sexta-feira");
      });
    });

    describe("getAvailableWindowsForDay & formatAvailableWindowsText", () => {
      it("computes normal weekday windows (09:00 - 13:00, 14:00 - 18:00) on a Monday", () => {
        // Monday 2026-10-12
        const { availableWindows, availableSlots } = getAvailableWindowsForDay("2026-10-12", []);
        expect(availableWindows).toHaveLength(2);
        expect(availableWindows[0].formattedStart).toBe("09:00");
        expect(availableWindows[0].formattedEnd).toBe("13:00");
        expect(availableWindows[1].formattedStart).toBe("14:00");
        expect(availableWindows[1].formattedEnd).toBe("18:00");

        const formatted = formatAvailableWindowsText(availableWindows);
        expect(formatted).toContain("*Manhã:* 09:00 às 13:00");
        expect(formatted).toContain("*Tarde:* 14:00 às 18:00");
        expect(availableSlots.length).toBeGreaterThan(0);
      });

      it("blocks Thursday morning (07:00 - 12:00) and only allows 12:00 - 13:00 and 14:00 - 18:00", () => {
        // Thursday 2026-10-15
        const { availableWindows } = getAvailableWindowsForDay("2026-10-15", []);
        expect(availableWindows).toHaveLength(2);
        expect(availableWindows[0].formattedStart).toBe("12:00");
        expect(availableWindows[0].formattedEnd).toBe("13:00");
        expect(availableWindows[1].formattedStart).toBe("14:00");
        expect(availableWindows[1].formattedEnd).toBe("18:00");
      });

      it("respects 30-minute safety buffer before and after existing meetings", () => {
        // Monday 2026-10-12 with meeting at 15:00 (15 min). Buffer: 14:30 to 15:45 blocked.
        const meetingDate = createBrasiliaDate("2026-10-12", "15:00");
        const { availableWindows } = getAvailableWindowsForDay("2026-10-12", [
          { scheduled_at: meetingDate, duration_minutes: 15, status: "scheduled" },
        ]);

        // Afternoon windows should split around the 14:30 - 15:45 block:
        // Window 1: 14:00 - 14:30
        // Window 2: 15:45 - 18:00
        const afternoonWindows = availableWindows.filter((w) => w.startMinutes >= 12 * 60);
        expect(afternoonWindows).toHaveLength(2);
        expect(afternoonWindows[0].formattedStart).toBe("14:00");
        expect(afternoonWindows[0].formattedEnd).toBe("14:30");
        expect(afternoonWindows[1].formattedStart).toBe("15:45");
        expect(afternoonWindows[1].formattedEnd).toBe("18:00");
      });
    });

    describe("validateSelectedTime", () => {
      it("validates a legitimate time in an open window", () => {
        const res = validateSelectedTime("2026-10-12", "10:30", []);
        expect(res.isValid).toBe(true);
        expect(res.normalizedTime).toBe("10:30");
        expect(res.dateObj).toBeDefined();
      });

      it("rejects a time inside the daily lunch break (13:00 - 14:00)", () => {
        const res = validateSelectedTime("2026-10-12", "13:15", []);
        expect(res.isValid).toBe(false);
        expect(res.errorMessage).toContain("não está disponível");
      });

      it("rejects Thursday morning before 12:00", () => {
        const res = validateSelectedTime("2026-10-15", "10:00", []);
        expect(res.isValid).toBe(false);
        expect(res.errorMessage).toContain("não está disponível");
      });

      it("rejects time colliding with 30-min buffer of existing meeting", () => {
        const meetingDate = createBrasiliaDate("2026-10-12", "15:00");
        // Meeting is 15:00-15:15. Buffer is 14:30-15:45. Trying to book 15:30:
        const res = validateSelectedTime("2026-10-12", "15:30", [
          { scheduled_at: meetingDate, duration_minutes: 15, status: "scheduled" },
        ]);
        expect(res.isValid).toBe(false);
      });
    });

    describe("generateGoogleCalendarUrl & generateIcsContent", () => {
      it("generates a valid Google Calendar render TEMPLATE URL", () => {
        const startDate = createBrasiliaDate("2026-10-13", "14:30");
        const url = generateGoogleCalendarUrl({
          title: "Introdução PluriFisio - Dr. Carlos",
          details: "Reunião de 15 min de introdução ao sistema.",
          startDate,
          durationMinutes: 15,
        });

        expect(url).toContain("https://calendar.google.com/calendar/render?action=TEMPLATE");
        expect(url).toContain("text=Introdu%C3%A7%C3%A3o%20PluriFisio%20-%20Dr.%20Carlos");
        expect(url).toContain("dates=20261013T173000Z/20261013T174500Z");
        expect(url).toContain("location=Online%20%2F%20WhatsApp%20(PluriFisio)");
      });

      it("generates standard RFC-5545 iCalendar content", () => {
        const startDate = createBrasiliaDate("2026-10-13", "14:30");
        const ics = generateIcsContent({
          title: "Introdução PluriFisio",
          details: "Apresentação da plataforma.",
          startDate,
          durationMinutes: 15,
        });

        expect(ics).toContain("BEGIN:VCALENDAR");
        expect(ics).toContain("BEGIN:VEVENT");
        expect(ics).toContain("DTSTART:20261013T173000Z");
        expect(ics).toContain("DTEND:20261013T174500Z");
        expect(ics).toContain("SUMMARY:Introdução PluriFisio");
        expect(ics).toContain("END:VCALENDAR");
      });

      it("parses Google Calendar iCal events and integrates them into availability windows", () => {
        // Exemplo real de feed .ics do Google Agenda com aula de inglês das 10h às 11h
        const sampleIcs = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//Google Inc//Google Calendar 70.9054//EN",
          "BEGIN:VEVENT",
          "DTSTART:20261014T130000Z", // 13:00 UTC = 10:00 BRT (Brasília)
          "DTEND:20261014T140000Z",   // 14:00 UTC = 11:00 BRT
          "SUMMARY:Aula de Inglês",
          "STATUS:CONFIRMED",
          "END:VEVENT",
          "BEGIN:VEVENT",
          "DTSTART:20261014T180000Z", // 18:00 UTC = 15:00 BRT
          "DTEND:20261014T190000Z",   // 19:00 UTC = 16:00 BRT
          "SUMMARY:Reunião Cancelada",
          "STATUS:CANCELLED",
          "END:VEVENT",
          "END:VCALENDAR",
        ].join("\r\n");

        const busySlots = parseIcsToBusySlots(sampleIcs, "2026-10-14");
        expect(busySlots).toHaveLength(1);
        expect(busySlots[0].duration_minutes).toBe(60);

        // Verifica que o slot das 10h às 11h + buffers de 30m bloqueia das 09:30 às 11:30
        const { availableWindows, availableSlots } = getAvailableWindowsForDay("2026-10-14", busySlots);
        
        // 10:00 está dentro da aula de inglês => não deve estar disponível
        expect(availableSlots.some((s) => s.formattedStart === "10:00")).toBe(false);
        // 10:30 está dentro da aula de inglês => não deve estar disponível
        expect(availableSlots.some((s) => s.formattedStart === "10:30")).toBe(false);
        // 09:30 coincide com o buffer de 30m antes => não deve estar disponível
        expect(availableSlots.some((s) => s.formattedStart === "09:30")).toBe(false);
        // 11:15 coincide com o buffer de 30m depois => não deve estar disponível
        expect(availableSlots.some((s) => s.formattedStart === "11:15")).toBe(false);

        // Janela da tarde após o almoço (14:00 em diante) deve estar livre
        expect(availableSlots.some((s) => s.formattedStart === "14:00")).toBe(true);
        expect(availableSlots.some((s) => s.formattedStart === "15:00")).toBe(true);
      });
    });
  });
});

