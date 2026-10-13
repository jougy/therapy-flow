import {
  OwnerCustomerContext,
  RESTRICTED_NON_OWNER_MESSAGE,
  sendOwnerMainMenu,
  sendSupportMenu,
  sendFinanceMenu,
  handleFinancePixInvoice,
  handleFinanceNfse,
  handleFinanceUpgrade,
  handleBugReportSubmission,
  sendRecordsMenu,
  sendTermsMenu,
  handleTermsOption,
  validateAndFormatCpf,
  parseAndValidateBirthDate,
  savePatientPreRegistration,
  handleQuickPatientPreRegistrationFlow,
  handleFlowPreRegistrationSubmission,
  sendPatientPreRegistrationConfirmation,
  PreRegistrationStateData,
  sendAgendaMenu,
  sendNewAppointmentTypeMenu,
  handleAgendaCreationFlow,
  handleAgendaFull,
  handleAgendaNext,
  handleAppointmentAction,
  handleAppointmentEditFlow,
  AppointmentActionType,
  AgendaStateData,
  isGlobalCancelCommand,
  isGlobalBackCommand,
  resolveCustomerContext,
  isOwnerMenuTriggerCommand,
} from "../../supabase/functions/whatsapp-webhook/owner-copilot.ts";
import { TelegramClient } from "../../supabase/functions/_shared/telegram-client.ts";
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
import {
  getGlobalFeatureFlag,
  clearFeatureFlagsCache,
} from "../../supabase/functions/_shared/feature-flags-client.ts";

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

      it("respects AvailabilityOptions to toggle Thursday morning blocks and buffers (agenda_smart_blocks_buffers)", () => {
        // Thursday date
        const thursdayIso = "2026-10-15"; // Quinta-feira
        const sampleMeeting = [
          {
            scheduled_at: "2026-10-15T18:00:00Z", // 15:00 BRT
            duration_minutes: 15,
            status: "scheduled",
          },
        ];

        // 1. With default options: Thursday block until 12:00 is applied, buffer is 30m
        const defaultResult = getAvailableWindowsForDay(thursdayIso, sampleMeeting);
        expect(defaultResult.availableSlots.some((s) => s.formattedStart === "10:00")).toBe(false);
        // 14:45 is in 30m buffer before 15:00 => not available
        expect(defaultResult.availableSlots.some((s) => s.formattedStart === "14:45")).toBe(false);
        // 15:00 is occupied => not available
        expect(defaultResult.availableSlots.some((s) => s.formattedStart === "15:00")).toBe(false);

        // 2. With applyThursdayBlock: false, bufferMinutes: 0 (agenda_smart_blocks_buffers disabled)
        const disabledBuffersResult = getAvailableWindowsForDay(thursdayIso, sampleMeeting, {
          applyThursdayBlock: false,
          bufferMinutes: 0,
        });
        // Morning should now have available slots (Thursday block suppressed)
        expect(disabledBuffersResult.availableSlots.some((s) => s.formattedStart === "10:00")).toBe(true);
        // 14:45 has 0m buffer => now available
        expect(disabledBuffersResult.availableSlots.some((s) => s.formattedStart === "14:45")).toBe(true);
        // 15:00 is still occupied
        expect(disabledBuffersResult.availableSlots.some((s) => s.formattedStart === "15:00")).toBe(false);
      });
    });
  });

  describe("Feature Flags Client (getGlobalFeatureFlag)", () => {
    beforeEach(() => {
      clearFeatureFlagsCache();
      vi.restoreAllMocks();
    });

    afterEach(() => {
      clearFeatureFlagsCache();
      vi.restoreAllMocks();
    });

    it("returns defaultValue if supabase client is null or undefined (fail-safe)", async () => {
      const res = await getGlobalFeatureFlag(null, "notifications_whatsapp_onboarding", true);
      expect(res).toBe(true);

      const resFalse = await getGlobalFeatureFlag(undefined, "agenda_whatsapp_booking_flow", false);
      expect(resFalse).toBe(false);
    });

    it("returns defaultValue if database query throws an error", async () => {
      const mockClient = {
        from: () => {
          throw new Error("Database connection lost");
        },
      };

      const res = await getGlobalFeatureFlag(mockClient, "notifications_telegram_admin", true);
      expect(res).toBe(true);
    });

    it("reads boolean flags and normalizes boolean primitives and strings", async () => {
      let queryKey = "";
      const mockClient = {
        from: (table: string) => ({
          select: () => ({
            eq: (col1: string, val1: unknown) => {
              if (col1 === "key") queryKey = String(val1);
              return {
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { value: true },
                    error: null,
                  }),
                }),
                maybeSingle: async () => ({
                  data: { value: true },
                  error: null,
                }),
              };
            },
          }),
        }),
      };

      const enabled = await getGlobalFeatureFlag(mockClient, "notifications_whatsapp_billing", false);
      expect(enabled).toBe(true);
      expect(queryKey).toBe("notifications_whatsapp_billing");
    });

    it("handles JSONB object with { enabled: boolean }", async () => {
      const mockClient = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { value: { enabled: false, note: "temporarily off" } },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      const flag = await getGlobalFeatureFlag(mockClient, "agenda_whatsapp_booking_flow", true);
      expect(flag).toBe(false);
    });

    it("uses in-memory cache on subsequent calls within TTL", async () => {
      let callCount = 0;
      const mockClient = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => {
                  callCount++;
                  return {
                    data: { value: true },
                    error: null,
                  };
                },
              }),
            }),
          }),
        }),
      };

      const first = await getGlobalFeatureFlag(mockClient, "agenda_google_calendar_sync", false);
      expect(first).toBe(true);
      expect(callCount).toBe(1);

      const second = await getGlobalFeatureFlag(mockClient, "agenda_google_calendar_sync", false);
      expect(second).toBe(true);
      expect(callCount).toBe(1); // Cached!
    });
  });

  describe("WhatsApp Bot Anti-Loop & Admin Commercial Handoff Security", () => {
    it("distinguishes bot phone from admin commercial phone accurately", () => {
      const client = new WhatsAppClient({
        businessPhone: "5511960474566",
        adminCommercialPhone: "5511980113936",
      });

      // Bot business phone (número do robô)
      expect(client.isBotBusinessPhone("5511960474566")).toBe(true);
      expect(client.isBotBusinessPhone("11960474566")).toBe(true);
      expect(client.isBotBusinessPhone("5511980113936")).toBe(false);
      expect(client.isBotBusinessPhone("5511999998888")).toBe(false);

      // Admin commercial phone (número comercial do Jougy)
      expect(client.isAdminCommercialPhone("5511980113936")).toBe(true);
      expect(client.isAdminCommercialPhone("11980113936")).toBe(true);
      expect(client.isAdminCommercialPhone("5511960474566")).toBe(false);
      expect(client.isAdminCommercialPhone("5511999998888")).toBe(false);
    });

    it("ensures admin commercial messages are NOT blocked by bot anti-loop", () => {
      const client = new WhatsAppClient({
        businessPhone: "5511960474566",
        adminCommercialPhone: "5511980113936",
      });

      const adminPhone = "5511980113936";
      const botPhone = "5511960474566";
      const customerPhone = "5511977776666";

      // 1. O robô nunca responde a si mesmo (Anti-loop de entrada legítimo)
      expect(client.isBotBusinessPhone(botPhone)).toBe(true);

      // 2. O admin comercial conversando com o robô DEVE ter acesso liberado
      expect(client.isBotBusinessPhone(adminPhone)).toBe(false);

      // 3. Qualquer lead/cliente externo também tem acesso liberado
      expect(client.isBotBusinessPhone(customerPhone)).toBe(false);
    });

    it("suppresses self-notification on WhatsApp when message originates from admin commercial, but allows for leads", () => {
      const client = new WhatsAppClient({
        businessPhone: "5511960474566",
        adminCommercialPhone: "5511980113936",
      });

      const shouldSendWaToAdmin = (senderPhone: string): boolean => {
        return !client.isAdminCommercialPhone(senderPhone);
      };

      // Se quem enviou foi o próprio admin comercial: NÃO manda mensagem de alerta para si mesmo no WhatsApp
      expect(shouldSendWaToAdmin("5511980113936")).toBe(false);

      // Se quem enviou foi um lead / cliente externo: MANDA mensagem de alerta para o WhatsApp comercial do admin!
      expect(shouldSendWaToAdmin("5511999998888")).toBe(true);
    });

    it("evaluates customer.isOwnerOrAdmin as true and activeRole as 'platform_admin' when message comes from adminCommercialPhone", async () => {
      const client = new WhatsAppClient({
        adminCommercialPhone: "5511980113936",
      });

      // Mock do cliente Supabase simulando ambiente sem profile prévio vinculado
      const mockSupabase = {
        from: vi.fn((table: string) => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          filter: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };

      // Teste com o número canônico E.164
      const customer = await resolveCustomerContext(
        mockSupabase,
        client,
        "5511980113936",
        "Jougy Admin"
      );

      expect(customer.isOwnerOrAdmin).toBe(true);
      expect(customer.activeRole).toBe("platform_admin");
      expect(customer.userName).toBe("Jougy Admin");

      // Teste com formatação brasileira: +55 (11) 98011-3936
      const customerFormatted = await resolveCustomerContext(
        mockSupabase,
        client,
        "+55 (11) 98011-3936"
      );

      expect(customerFormatted.isOwnerOrAdmin).toBe(true);
      expect(customerFormatted.activeRole).toBe("platform_admin");
      expect(customerFormatted.userName).toBe("Administrador Master");
    });

    it("recognizes command 'Menu' and 'Oi' as triggers to open the Owner Main Menu (sendOwnerMainMenu) instead of human handoff", async () => {
      const client = new WhatsAppClient({
        adminCommercialPhone: "5511980113936",
      });

      // Validação dos gatilhos de comando
      expect(isOwnerMenuTriggerCommand("Menu")).toBe(true);
      expect(isOwnerMenuTriggerCommand("menu")).toBe(true);
      expect(isOwnerMenuTriggerCommand("Oi")).toBe(true);
      expect(isOwnerMenuTriggerCommand("oi")).toBe(true);
      expect(isOwnerMenuTriggerCommand("Olá")).toBe(true);
      expect(isOwnerMenuTriggerCommand("ola")).toBe(true);
      expect(isOwnerMenuTriggerCommand("btn_owner_menu")).toBe(true);

      // Garante que mensagens aleatórias não disparam o menu direto
      expect(isOwnerMenuTriggerCommand("Quero falar sobre dores na coluna")).toBe(false);

      // Simulação do envio do Menu Principal do Titular
      const sendListSpy = vi.spyOn(client, "sendListMessage").mockResolvedValue({
        success: true,
        provider: "meta_cloud",
        messageId: "wamid.MENU_TEST_123",
      });

      const masterContext: OwnerCustomerContext = {
        userId: "usr-admin-master",
        clinicId: "clinic-master-123",
        userName: "Administrador Master",
        userEmail: "admin@plurifisio.com.br",
        clinicName: "Clínica Matriz Pluri",
        planName: "Plano Clínica",
        professionInfo: "Fisioterapeuta - CREFITO-3",
        isOwnerOrAdmin: true,
        isSoloPlan: false,
        isClinicPlan: true,
        activeRole: "platform_admin",
      };

      // Quando o Titular Mestre envia 'Oi' ou 'Menu', o menu principal do Titular deve ser chamado
      await sendOwnerMainMenu(client, "5511980113936", masterContext);

      expect(sendListSpy).toHaveBeenCalledTimes(1);
      const [calledPhone, calledBody, calledButtonText, calledSections] = sendListSpy.mock.calls[0];
      expect(calledPhone).toBe("5511980113936");
      expect(calledBody).toContain("Copiloto de Gestão PluriFisio");
      expect(calledBody).toContain("Clínica Matriz Pluri");
      expect(calledButtonText).toBe("Ver Opções");
      expect(calledSections.some((s) => s.rows.some((r) => r.id === "btn_menu_records"))).toBe(true);
      expect(calledSections.some((s) => s.rows.some((r) => r.id === "btn_menu_agenda"))).toBe(true);
    });

    it("resolves phone number variations across Brazilian formats (with/without 55, with/without 9th digit, formatted)", () => {
      const client = new WhatsAppClient({
        adminCommercialPhone: "5511980113936",
      });

      // 1. Canônico completo (55 + DDD + 9 dígitos)
      expect(client.isAdminCommercialPhone("5511980113936")).toBe(true);

      // 2. Sem 55 (DDD + 9 dígitos)
      expect(client.isAdminCommercialPhone("11980113936")).toBe(true);

      // 3. Com formatação internacional: +55 (11) 98011-3936
      expect(client.isAdminCommercialPhone("+55 (11) 98011-3936")).toBe(true);

      // 4. Com formatação nacional: (11) 98011-3936
      expect(client.isAdminCommercialPhone("(11) 98011-3936")).toBe(true);

      // 5. Sem o 9º dígito: 1180113936 e 551180113936
      expect(client.isAdminCommercialPhone("1180113936")).toBe(true);
      expect(client.isAdminCommercialPhone("551180113936")).toBe(true);
      expect(client.isAdminCommercialPhone("(11) 8011-3936")).toBe(true);
      expect(client.isAdminCommercialPhone("+55 11 8011-3936")).toBe(true);

      // 6. Números diferentes NÃO devem casar
      expect(client.isAdminCommercialPhone("5511999998888")).toBe(false);
      expect(client.isAdminCommercialPhone("5511960474566")).toBe(false);
      expect(client.isAdminCommercialPhone("11999998888")).toBe(false);
      expect(client.isAdminCommercialPhone("")).toBe(false);
      expect(client.isAdminCommercialPhone(null)).toBe(false);
    });

    it("gracefully falls back to default active clinic for platform admin when not directly linked to a clinic", async () => {
      const client = new WhatsAppClient({
        adminCommercialPhone: "5511980113936",
      });

      // Mock do Supabase simulando ausência de vínculo direto, mas existência de clínica default no sistema
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "clinics") {
            return {
              select: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "clinic-fallback-default-999",
                  name: "Pluri Health Matriz Fallback",
                  subscription_plan: "clinica_pro",
                },
                error: null,
              }),
            };
          }

          if (table === "clinic_subscriptions") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  plan_type: "clinica_enterprise",
                  status: "ACTIVE",
                  total_recurring_monthly_price: 39900,
                },
                error: null,
              }),
            };
          }

          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            filter: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }),
      };

      const customer = await resolveCustomerContext(
        mockSupabase,
        client,
        "5511980113936",
        "Jougy"
      );

      // Verificação de integridade do fallback
      expect(customer.isOwnerOrAdmin).toBe(true);
      expect(customer.activeRole).toBe("platform_admin");
      expect(customer.clinicId).toBe("clinic-fallback-default-999");
      expect(customer.clinicName).toBe("Pluri Health Matriz Fallback");
      expect(customer.planName).toBe("clinica_enterprise");
      expect(customer.isClinicPlan).toBe(true);
      expect(customer.isSoloPlan).toBe(false);
    });
  });

  describe("Owner Copilot (Fase A) Governance, Menus & Finance", () => {
    const mockContextSolo: OwnerCustomerContext = {
      userId: "usr-owner-123",
      clinicId: "cln-456",
      userName: "Dr. Jouberth",
      userEmail: "jouberth@plurifisio.com.br",
      clinicName: "Clínica Pluri Saúde",
      planName: "prof_top",
      professionInfo: "Fisioterapeuta - CREFITO 12345",
      isOwnerOrAdmin: true,
      isSoloPlan: true,
      isClinicPlan: false,
      activeRole: "owner",
    };

    const mockContextClinic: OwnerCustomerContext = {
      ...mockContextSolo,
      planName: "clinica_medio",
      isSoloPlan: false,
      isClinicPlan: true,
    };

    it("provides the standard restriction message for non-owner/collaborators", () => {
      expect(RESTRICTED_NON_OWNER_MESSAGE).toContain("exclusiva para titulares e responsáveis");
      expect(RESTRICTED_NON_OWNER_MESSAGE).toContain("https://app.plurifisio.com.br");
    });

    it("sends Owner Main Menu list message with correct interactive options", async () => {
      let sentBody: string | undefined;
      const client = new WhatsAppClient();
      vi.spyOn(client, "sendListMessage").mockImplementation(async (_to, body, _btn, sections) => {
        sentBody = body;
        expect(sections).toHaveLength(2);
        expect(sections[0].title).toContain("Gestão Clínica");
        expect(sections[0].rows.map(r => r.id)).toEqual(["btn_menu_records", "btn_menu_agenda"]);
        expect(sections[1].title).toContain("Suporte & Financeiro");
        expect(sections[1].rows.map(r => r.id)).toEqual(["btn_menu_support", "btn_menu_finance"]);
        return { success: true, messageId: "wamid.MENU123" };
      });

      await sendOwnerMainMenu(client, "5511999998888", mockContextSolo);
      expect(sentBody).toContain("Dr. Jouberth");
      expect(sentBody).toContain("Clínica Pluri Saúde");
      expect(sentBody).toContain("Plano Solo");
    });

    it("sends Support submenu with report bug, faq and human support options", async () => {
      const client = new WhatsAppClient();
      vi.spyOn(client, "sendListMessage").mockImplementation(async (_to, _body, _btn, sections) => {
        expect(sections[0].rows.map(r => r.id)).toEqual([
          "support_report_bug",
          "support_faq",
          "support_human",
        ]);
        return { success: true };
      });

      await sendSupportMenu(client, "5511999998888", "Dr. Jouberth");
    });

    it("sends Finance submenu adapted to solo plan", async () => {
      const client = new WhatsAppClient();
      vi.spyOn(client, "sendListMessage").mockImplementation(async (_to, _body, _btn, sections) => {
        expect(sections[0].rows.map(r => r.id)).toEqual([
          "finance_pix_invoice",
          "finance_nfse",
          "finance_upgrade",
          "finance_human",
        ]);
        expect(sections[0].rows.find(r => r.id === "finance_upgrade")?.description).toContain("Solo superiores");
        return { success: true };
      });

      await sendFinanceMenu(client, "5511999998888", mockContextSolo);
    });

    it("sends Finance submenu adapted to clinic plan", async () => {
      const client = new WhatsAppClient();
      vi.spyOn(client, "sendListMessage").mockImplementation(async (_to, _body, _btn, sections) => {
        expect(sections[0].rows.find(r => r.id === "finance_upgrade")?.description).toContain("equipe");
        return { success: true };
      });

      await sendFinanceMenu(client, "5511999998888", mockContextClinic);
    });

    it("handles finance 2ª via PIX invoice with open invoice", async () => {
      const client = new WhatsAppClient();
      let sentText = "";
      vi.spyOn(client, "sendTextMessage").mockImplementation(async (_to, text) => {
        sentText = text;
        return { success: true };
      });

      const mockSupabase = {
        from: (table: string) => {
          if (table === "subscription_invoices") {
            return {
              select: () => ({
                eq: () => ({
                  in: () => ({
                    order: () => ({
                      limit: async () => ({
                        data: [
                          {
                            id: "inv-1",
                            value: 120.0,
                            due_date: "2026-10-25",
                            status: "PENDING",
                            pix_copy_paste: "00020126360014BR.GOV.BCB.PIX0114plurifisio123",
                            bank_slip_url: "https://asaas.com/b/123",
                          },
                        ],
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          return {};
        },
      } as any;

      await handleFinancePixInvoice(mockSupabase, client, "5511999998888", mockContextSolo);
      expect(sentText).toContain("2ª VIA DE FATURA");
      expect(sentText).toContain("00020126360014BR.GOV.BCB.PIX0114plurifisio123");
      expect(sentText).toContain("https://asaas.com/b/123");
    });

    it("handles finance 2ª via PIX invoice when account is 100% up to date", async () => {
      const client = new WhatsAppClient();
      let sentText = "";
      vi.spyOn(client, "sendTextMessage").mockImplementation(async (_to, text) => {
        sentText = text;
        return { success: true };
      });

      const mockSupabase = {
        from: (table: string) => {
          if (table === "subscription_invoices") {
            return {
              select: () => ({
                eq: () => ({
                  in: () => ({
                    order: () => ({
                      limit: async () => ({ data: [] }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "clinic_subscriptions") {
            return {
              select: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: { next_due_date: "2026-11-15", status: "ACTIVE" },
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          return {};
        },
      } as any;

      await handleFinancePixInvoice(mockSupabase, client, "5511999998888", mockContextSolo);
      expect(sentText).toContain("Sua conta está 100% em dia!");
      expect(sentText).toContain("15/11/2026");
    });

    it("handles bug report submission: logs error to platform_error_logs and notifies admin channels", async () => {
      const client = new WhatsAppClient();
      const telegram = new TelegramClient();

      let errorLogsInserted: any = null;
      let adminWaText = "";
      let tgText = "";

      vi.spyOn(client, "sendTextMessage").mockImplementation(async (to, text) => {
        if (to === "5511980113936") {
          adminWaText = text;
        }
        return { success: true };
      });

      vi.spyOn(telegram, "sendMessage").mockImplementation(async (text) => {
        tgText = text;
        return { success: true };
      });

      const mockSupabase = {
        from: (table: string) => {
          if (table === "platform_error_logs") {
            return {
              insert: async (data: any) => {
                errorLogsInserted = data;
                return { error: null };
              },
            };
          }
          return {};
        },
      } as any;

      await handleBugReportSubmission(
        mockSupabase,
        client,
        telegram,
        "5511999998888",
        mockContextSolo,
        "Botão salvar prontuário travou com tela branca",
        "https://example.com/screenshot.jpg"
      );

      expect(errorLogsInserted).not.toBeNull();
      expect(errorLogsInserted.error_type).toBe("WhatsApp Bug Report");
      expect(errorLogsInserted.scope).toBe("whatsapp_bug_report");
      expect(errorLogsInserted.context.image_url).toBe("https://example.com/screenshot.jpg");

      expect(adminWaText).toContain("NOVO REPORTE DE ERRO / BUG");
      expect(adminWaText).toContain("Botão salvar prontuário travou");
      expect(adminWaText).toContain("https://example.com/screenshot.jpg");

      expect(tgText).toContain("Novo Bug Report via WhatsApp!");
      expect(tgText).toContain("Dr. Jouberth");
    });
  });

  describe("Owner Copilot (Fase B) - Prontuários, Termos e Pré-Cadastro de Pacientes", () => {
    const mockContext: OwnerCustomerContext = {
      userId: "usr-owner-123",
      clinicId: "cln-456",
      userName: "Dr. Jouberth",
      userEmail: "jouberth@plurifisio.com.br",
      clinicName: "Clínica Pluri Saúde",
      planName: "prof_top",
      professionInfo: "Fisioterapeuta",
      isOwnerOrAdmin: true,
      isSoloPlan: true,
      isClinicPlan: false,
      activeRole: "owner",
    };

    it("sends Records submenu with options records_terms and records_quick_patient", async () => {
      const client = new WhatsAppClient();
      vi.spyOn(client, "sendListMessage").mockImplementation(async (_to, body, _btn, sections) => {
        expect(body).toContain("Dr. Jouberth");
        expect(body).toContain("Prontuário & Pacientes");
        expect(sections[0].rows.map((r) => r.id)).toEqual([
          "records_terms",
          "records_quick_patient",
        ]);
        return { success: true };
      });

      await sendRecordsMenu(client, "5511999998888", mockContext);
    });

    it("sends Terms submenu with options terms_adult and terms_pediatric", async () => {
      const client = new WhatsAppClient();
      vi.spyOn(client, "sendListMessage").mockImplementation(async (_to, body, _btn, sections) => {
        expect(body).toContain("Termo de Consentimento");
        expect(sections[0].rows.map((r) => r.id)).toEqual([
          "terms_adult",
          "terms_pediatric",
        ]);
        return { success: true };
      });

      await sendTermsMenu(client, "5511999998888", "Dr. Jouberth");
    });

    it("handles terms option generating direct link with clinic id for adult and pediatric", async () => {
      const client = new WhatsAppClient();
      let sentText = "";
      vi.spyOn(client, "sendTextMessage").mockImplementation(async (_to, text) => {
        sentText = text;
        return { success: true };
      });

      // Adult
      await handleTermsOption(client, "5511999998888", mockContext, "adult");
      expect(sentText).toContain("TERMO DE CONSENTIMENTO - ADULTO");
      expect(sentText).toContain("https://app.plurifisio.com.br/clinica/cln-456/termos?type=adult");

      // Pediatric
      await handleTermsOption(client, "5511999998888", mockContext, "pediatric");
      expect(sentText).toContain("TERMO DE CONSENTIMENTO DO RESPONSÁVEL (MENOR)");
      expect(sentText).toContain("https://app.plurifisio.com.br/clinica/cln-456/termos?type=pediatric");
    });

    describe("CPF and Birth Date Validation Helpers", () => {
      it("validates legitimate CPFs and rejects invalid CPFs", () => {
        // Valid CPF
        const valid = validateAndFormatCpf("52998224725");
        expect(valid.isValid).toBe(true);
        expect(valid.formatted).toBe("529.982.247-25");

        // Invalid CPFs
        expect(validateAndFormatCpf("11111111111").isValid).toBe(false);
        expect(validateAndFormatCpf("12345678900").isValid).toBe(false);
        expect(validateAndFormatCpf("123").isValid).toBe(false);
      });

      it("parses and validates birth dates, computing age and minor flag correctly", () => {
        // Adult (born 1990)
        const adult = parseAndValidateBirthDate("15/04/1990");
        expect(adult.isValid).toBe(true);
        expect(adult.isoDate).toBe("1990-04-15");
        expect(adult.formattedDate).toBe("15/04/1990");
        expect(adult.isMinor).toBe(false);
        expect(adult.ageYears).toBeGreaterThanOrEqual(18);

        // Minor (born 2020)
        const minor = parseAndValidateBirthDate("10/10/2020");
        expect(minor.isValid).toBe(true);
        expect(minor.isMinor).toBe(true);

        // Invalid formats & dates
        expect(parseAndValidateBirthDate("invalido").isValid).toBe(false);
        expect(parseAndValidateBirthDate("32/01/2000").isValid).toBe(false);
        expect(parseAndValidateBirthDate("15/15/2000").isValid).toBe(false);
        expect(parseAndValidateBirthDate("15/04/2099").isValid).toBe(false); // Future date
      });
    });

    describe("Pre-registration Flow & Database Idempotency", () => {
      it("runs Step 1 (ask name -> receives name -> asks birthdate)", async () => {
        const client = new WhatsAppClient();
        let sentMessage = "";
        vi.spyOn(client, "sendTextMessage").mockImplementation(async (_to, text) => {
          sentMessage = text;
          return { success: true };
        });

        const supabase = {} as any;
        const res = await handleQuickPatientPreRegistrationFlow(
          supabase,
          client,
          "5511999998888",
          mockContext,
          "precad_waiting_name",
          "Maria Alice Silva",
          "",
          {}
        );

        expect(res.handled).toBe(true);
        expect(res.nextStep).toBe("precad_waiting_birthdate");
        expect(res.updatedStateData.patientName).toBe("Maria Alice Silva");
        expect(sentMessage).toContain("Data de Nascimento");
      });

      it("runs Step 2 for Minor (<18) -> requests legal guardian CPF", async () => {
        const client = new WhatsAppClient();
        let sentMessage = "";
        vi.spyOn(client, "sendTextMessage").mockImplementation(async (_to, text) => {
          sentMessage = text;
          return { success: true };
        });

        const supabase = {} as any;
        const res = await handleQuickPatientPreRegistrationFlow(
          supabase,
          client,
          "5511999998888",
          mockContext,
          "precad_waiting_birthdate",
          "15/06/2018",
          "",
          { patientName: "Arthur Menor" }
        );

        expect(res.handled).toBe(true);
        expect(res.nextStep).toBe("precad_waiting_minor_parent_cpf");
        expect(res.updatedStateData.isMinor).toBe(true);
        expect(sentMessage).toContain("menor de 18 anos detectado");
        expect(sentMessage).toContain("CPF do Responsável Legal");
      });

      it("runs Step 2 for Adult (>=18) -> offers document buttons", async () => {
        const client = new WhatsAppClient();
        let sentOptions: any = null;
        vi.spyOn(client, "sendButtonsMessage").mockImplementation(async (_to, _text, opts) => {
          sentOptions = opts;
          return { success: true };
        });

        const supabase = {} as any;
        const res = await handleQuickPatientPreRegistrationFlow(
          supabase,
          client,
          "5511999998888",
          mockContext,
          "precad_waiting_birthdate",
          "10/05/1992",
          "",
          { patientName: "Carlos Maior" }
        );

        expect(res.handled).toBe(true);
        expect(res.nextStep).toBe("precad_waiting_doc_type");
        expect(res.updatedStateData.isMinor).toBe(false);
        expect(sentOptions.buttons.map((b: any) => b.id)).toEqual([
          "precad_doc_cpf",
          "precad_doc_rg",
          "precad_doc_passaporte",
        ]);
      });

      it("saves new patient in database with generated code PAC-xxx and sends confirmation", async () => {
        const client = new WhatsAppClient();
        let sentMessage = "";
        vi.spyOn(client, "sendTextMessage").mockImplementation(async (_to, text) => {
          sentMessage = text;
          return { success: true };
        });
        vi.spyOn(client, "sendButtonsMessage").mockImplementation(async (_to, text) => {
          sentMessage = text;
          return { success: true };
        });

        let insertedData: any = null;
        const mockSupabase = {
          from: (table: string) => {
            if (table === "patients") {
              return {
                select: () => ({
                  eq: () => ({
                    eq: () => ({
                      order: () => ({
                        limit: () => ({
                          maybeSingle: async () => ({ data: null }), // Does not exist
                        }),
                      }),
                    }),
                    ilike: () => ({
                      eq: () => ({
                        order: () => ({
                          limit: () => ({
                            maybeSingle: async () => ({ data: null }),
                          }),
                        }),
                      }),
                    }),
                  }),
                }),
                insert: (payload: any) => ({
                  select: () => ({
                    single: async () => {
                      insertedData = payload;
                      return { data: { id: "pat-uuid-999", patient_code: "PAC-042" }, error: null };
                    },
                  }),
                }),
              };
            }
            return {};
          },
          rpc: async (fn: string) => {
            if (fn === "generate_next_patient_code") {
              return { data: "PAC-042", error: null };
            }
            return { data: null, error: null };
          },
        } as any;

        const stateData: PreRegistrationStateData = {
          patientName: "Mariana Souza",
          birthDate: "1994-08-20",
          birthDateFormatted: "20/08/1994",
          ageYears: 32,
          isMinor: false,
          documentType: "CPF",
          documentNumber: "52998224725",
          phone: "11988887777",
        };

        const res = await handleQuickPatientPreRegistrationFlow(
          mockSupabase,
          client,
          "5511999998888",
          mockContext,
          "precad_waiting_email",
          "mariana@gmail.com",
          "",
          stateData
        );

        expect(res.handled).toBe(true);
        expect(res.nextStep).toBe("initial");
        expect(insertedData).not.toBeNull();
        expect(insertedData.name).toBe("Mariana Souza");
        expect(insertedData.clinic_id).toBe("cln-456");
        expect(insertedData.cpf).toBe("52998224725");
        expect(insertedData.phone).toBe("11988887777");
        expect(insertedData.email).toBe("mariana@gmail.com");
        expect(insertedData.status).toBe("ativo");

        expect(sentMessage).toContain("PRÉ-CADASTRO REALIZADO COM SUCESSO!");
        expect(sentMessage).toContain("PAC-042");
        expect(sentMessage).toContain("https://app.plurifisio.com.br/pacientes/PAC-042");
        expect(sentMessage).toContain("https://app.plurifisio.com.br/cadastro/");
      });

      it("handles adult document selection (RG), validates document number and advances to phone", async () => {
        const client = new WhatsAppClient();
        let sentMessage = "";
        vi.spyOn(client, "sendTextMessage").mockImplementation(async (_to, text) => {
          sentMessage = text;
          return { success: true };
        });

        const mockSupabase = {} as any;
        const stateData: PreRegistrationStateData = {
          patientName: "Carlos Eduardo",
          birthDate: "1988-05-10",
          birthDateFormatted: "10/05/1988",
          ageYears: 38,
          isMinor: false,
        };

        // 1. Escolhe RG
        const stepDocType = await handleQuickPatientPreRegistrationFlow(
          mockSupabase,
          client,
          "5511999998888",
          mockContext,
          "precad_waiting_doc_type",
          "RG",
          "precad_doc_rg",
          stateData
        );
        expect(stepDocType.nextStep).toBe("precad_waiting_doc_number");
        expect(stepDocType.updatedStateData.documentType).toBe("RG");
        expect(sentMessage).toContain("Número do RG");

        // 2. Digita número do RG
        const stepDocNum = await handleQuickPatientPreRegistrationFlow(
          mockSupabase,
          client,
          "5511999998888",
          mockContext,
          "precad_waiting_doc_number",
          "12.345.678-9",
          "",
          stepDocType.updatedStateData
        );
        expect(stepDocNum.nextStep).toBe("precad_waiting_phone");
        expect(stepDocNum.updatedStateData.documentNumber).toBe("12.345.678-9");
        expect(sentMessage).toContain("Telefone/WhatsApp");

        // 3. Fornece '0' para pular telefone
        const stepPhone = await handleQuickPatientPreRegistrationFlow(
          mockSupabase,
          client,
          "5511999998888",
          mockContext,
          "precad_waiting_phone",
          "0",
          "",
          stepDocNum.updatedStateData
        );
        expect(stepPhone.nextStep).toBe("precad_waiting_email");
        expect(stepPhone.updatedStateData.phone).toBe("");
        expect(sentMessage).toContain("E-mail");
      });

      it("guarantees patient idempotency: updates existing patient without duplicating record and outputs public token link", async () => {
        const client = new WhatsAppClient();
        let sentMessage = "";
        vi.spyOn(client, "sendTextMessage").mockImplementation(async (_to, text) => {
          sentMessage = text;
          return { success: true };
        });
        vi.spyOn(client, "sendButtonsMessage").mockImplementation(async (_to, text) => {
          sentMessage = text;
          return { success: true };
        });

        let updatedPatientId = "";
        let updatePayload: any = null;

        const mockSupabase = {
          from: (table: string) => {
            if (table === "patients") {
              return {
                select: () => ({
                  eq: () => ({
                    eq: () => ({
                      order: () => ({
                        limit: () => ({
                          maybeSingle: async () => ({
                            data: {
                              id: "pat-existing-123",
                              patient_code: "PAC-005",
                              name: "Juliana Mendes",
                              status: "ativo",
                            },
                          }),
                        }),
                      }),
                    }),
                  }),
                }),
                update: (payload: any) => ({
                  eq: async (col: string, val: string) => {
                    updatedPatientId = val;
                    updatePayload = payload;
                    return { error: null };
                  },
                }),
              };
            }
            return {};
          },
          rpc: async (fn: string) => {
            if (fn === "create_patient_registration_link") {
              return {
                data: {
                  token: "tok_public_secret_xyz",
                  password_prefix: "529982",
                },
                error: null,
              };
            }
            return { data: null, error: null };
          },
        } as any;

        const stateData: PreRegistrationStateData = {
          patientName: "Juliana Mendes",
          birthDate: "1992-03-15",
          birthDateFormatted: "15/03/1992",
          ageYears: 34,
          isMinor: false,
          documentType: "CPF",
          documentNumber: "52998224725",
          phone: "11977778888",
        };

        const res = await handleQuickPatientPreRegistrationFlow(
          mockSupabase,
          client,
          "5511999998888",
          mockContext,
          "precad_waiting_email",
          "juliana.mendes@gmail.com",
          "",
          stateData
        );

        expect(res.handled).toBe(true);
        expect(res.nextStep).toBe("initial");
        expect(updatedPatientId).toBe("pat-existing-123");
        expect(updatePayload).not.toBeNull();
        expect(updatePayload.phone).toBe("11977778888");
        expect(updatePayload.email).toBe("juliana.mendes@gmail.com");

        // Confirma status 'Atualizado no sistema' na mensagem final
        expect(sentMessage).toContain("Atualizado no sistema");
        expect(sentMessage).toContain("PAC-005");
        expect(sentMessage).toContain("https://app.plurifisio.com.br/pacientes/PAC-005");
        // Verifica o link com token público do formulário de preenchimento pelo paciente
        expect(sentMessage).toContain("https://app.plurifisio.com.br/cadastro/paciente/tok_public_secret_xyz");
        expect(sentMessage).toContain("Senha de Acesso:* `529982`");
      });

      it("enforces LGPD compliance by blocking pre-registration of minor without valid legal guardian CPF", async () => {
        const mockSupabase = {
          from: vi.fn(),
          rpc: vi.fn(),
        } as any;

        const minorStateWithoutParentCpf: PreRegistrationStateData = {
          patientName: "Lucas Menor Silva",
          birthDate: "2018-05-10",
          ageYears: 8,
          isMinor: true,
          parentCpf: "", // ausente
        };

        const result = await savePatientPreRegistration(
          mockSupabase,
          mockContext,
          minorStateWithoutParentCpf
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("Conformidade LGPD: CPF válido do responsável legal é obrigatório");

        // Com CPF inválido (todos dígitos iguais ou tamanho errado)
        const minorStateWithInvalidParentCpf: PreRegistrationStateData = {
          patientName: "Lucas Menor Silva",
          birthDate: "2018-05-10",
          ageYears: 8,
          isMinor: true,
          parentCpf: "11111111111", // inválido
        };

        const resultInvalid = await savePatientPreRegistration(
          mockSupabase,
          mockContext,
          minorStateWithInvalidParentCpf
        );

        expect(resultInvalid.success).toBe(false);
        expect(resultInvalid.error).toContain("Conformidade LGPD: CPF válido do responsável legal é obrigatório");
      });

      it("sanitizes patient name, document number and email against SQL injection and control characters", async () => {
        let insertedPayload: any = null;
        const mockSupabase = {
          from: vi.fn().mockImplementation((table: string) => {
            if (table === "patients") {
              return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                ilike: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                insert: vi.fn().mockImplementation((payload) => {
                  insertedPayload = payload;
                  return {
                    select: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({
                      data: { id: "pat-clean-123", patient_code: payload.patient_code || "PAC-010" },
                      error: null,
                    }),
                  };
                }),
              };
            }
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }),
          rpc: vi.fn().mockResolvedValue({ data: "PAC-010", error: null }),
        } as any;

        // Injeção de caracteres de controle, emojis, números e SQL no nome
        const dirtyData: PreRegistrationStateData = {
          patientName: "Carlos Eduardo '; DROP TABLE patients; -- 🚀 123",
          birthDate: "1988-10-20",
          birthDateFormatted: "20/10/1988",
          ageYears: 38,
          isMinor: false,
          documentType: "RG",
          documentNumber: "MG-12.345.678; SELECT *",
          phone: "+55 (31) 98888-7777\x00\x1F",
          email: "  carlos.eduardo@clinica.com.br \r\n",
        };

        const res = await savePatientPreRegistration(
          mockSupabase,
          mockContext,
          dirtyData
        );

        expect(res.success).toBe(true);
        expect(insertedPayload).not.toBeNull();
        // Nome limpo preserva apenas letras e espaços
        expect(insertedPayload.name).toBe("Carlos Eduardo DROP TABLE patients");
        // RG limpo sem SQL injection
        expect(insertedPayload.rg).toBe("MG-12.345.678SELECT");
        // Telefone limpo somente dígitos
        expect(insertedPayload.phone).toBe("5531988887777");
        // E-mail devidamente sanitizado e em minúsculas
        expect(insertedPayload.email).toBe("carlos.eduardo@clinica.com.br");
      });
    });

    describe("WhatsApp Flows & Hybrid Architecture Integration", () => {
      it("sends Flow message with Meta Cloud API interactive flow payload and buttons fallback", async () => {
        mockEnv.set("META_WHATSAPP_TOKEN", "meta_token_val");
        mockEnv.set("META_PHONE_NUMBER_ID", "12345678");
        mockEnv.set("META_WHATSAPP_FLOW_ID", "flow_998877");
        mockEnv.set("WHATSAPP_API_PROVIDER", "meta_cloud");

        let capturedPayload: any = null;
        vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
          capturedPayload = JSON.parse(init?.body as string);
          return new Response(JSON.stringify({ messages: [{ id: "msg_flow_01" }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        });

        const client = new WhatsAppClient();
        const res = await client.sendFlowMessage(
          "11987654321",
          "Olá! Abra o formulário abaixo:",
          {
            flowId: "flow_998877",
            buttonText: "⚡ Abrir Formulário",
            screenId: "SCREEN_PATIENT_INFO",
          }
        );

        expect(res.success).toBe(true);
        expect(res.messageId).toBe("msg_flow_01");
        expect(capturedPayload).not.toBeNull();
        expect(capturedPayload.interactive.type).toBe("flow");
        expect(capturedPayload.interactive.action.name).toBe("flow");
        expect(capturedPayload.interactive.action.parameters.flow_message_version).toBe("3");
        expect(capturedPayload.interactive.action.parameters.flow_id).toBe("flow_998877");
        expect(capturedPayload.interactive.action.parameters.flow_cta).toBe("⚡ Abrir Formulário");
        expect(capturedPayload.interactive.action.parameters.flow_action).toBe("navigate");
        expect(capturedPayload.interactive.action.parameters.flow_action_payload).toEqual({
          screen: "SCREEN_PATIENT_INFO",
        });
        // Instrução híbrida de fallback inclusa no texto
        expect(capturedPayload.interactive.body.text).toContain("responda *1* para preencher conversando diretamente no chat!");
      });

      it("processes valid interactive.nfm_reply flow submission and executes idempotent registration", async () => {
        const mockSupabase = {
          from: vi.fn().mockImplementation((table: string) => {
            if (table === "patients") {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      order: vi.fn().mockReturnValue({
                        limit: vi.fn().mockReturnValue({
                          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                        }),
                      }),
                    }),
                    ilike: vi.fn().mockReturnValue({
                      eq: vi.fn().mockReturnValue({
                        order: vi.fn().mockReturnValue({
                          limit: vi.fn().mockReturnValue({
                            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                          }),
                        }),
                      }),
                    }),
                  }),
                }),
                insert: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: "pat_flow_123",
                        patient_code: "PAC-088",
                        name: "Fernanda Lima",
                        cpf: "52998224725",
                        is_active: true,
                      },
                      error: null,
                    }),
                  }),
                }),
              };
            }
            if (table === "patient_registration_links") {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { token: "token_flow_abc", password_prefix: "529982" },
                        error: null,
                      }),
                    }),
                  }),
                }),
              };
            }
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }),
          rpc: vi.fn().mockResolvedValue({ data: "PAC-088", error: null }),
        } as any;

        const sentMessages: string[] = [];
        const mockClient = {
          sendTextMessage: vi.fn().mockImplementation(async (_phone: string, text: string) => {
            sentMessages.push(text);
            return { success: true };
          }),
          sendButtonsMessage: vi.fn().mockImplementation(async (_phone: string, text: string) => {
            sentMessages.push(text);
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        const mockContext: OwnerCustomerContext = {
          userId: "usr_owner_flow",
          clinicId: "clinic_flow_01",
          userName: "Dra. Renata",
          userEmail: "renata@fisio.com.br",
          clinicName: "Clínica Fisio Renata",
          planName: "Pluri Fisio Pro",
          professionInfo: "Fisioterapeuta",
          isOwnerOrAdmin: true,
          isSoloPlan: false,
          isClinicPlan: true,
          activeRole: "owner",
        };

        const flowPayload = {
          name: "Fernanda Lima",
          birth_date: "1994-08-14",
          doc_type: "CPF",
          doc_number: "529.982.247-25",
          parent_cpf: "",
          phone: "11988887777",
          email: "fernanda.lima@email.com",
        };

        const result = await handleFlowPreRegistrationSubmission(
          mockSupabase,
          mockClient,
          "5511999998888",
          mockContext,
          flowPayload
        );

        expect(result.success).toBe(true);
        expect(result.patientCode).toBe("PAC-088");
        expect(sentMessages.length).toBeGreaterThan(0);
        const lastMsg = sentMessages[sentMessages.length - 1];
        expect(lastMsg).toContain("PRÉ-CADASTRO REALIZADO COM SUCESSO!");
        expect(lastMsg).toContain("Fernanda Lima");
        expect(lastMsg).toContain("PAC-088");
        expect(lastMsg).toContain("termos?type=adult");
      });

      it("strictly validates minor (<18) in flow and blocks submission without valid guardian CPF", async () => {
        const mockSupabase = {
          from: vi.fn(),
          rpc: vi.fn(),
        } as any;

        const sentMessages: string[] = [];
        const mockClient = {
          sendTextMessage: vi.fn().mockImplementation(async (_phone: string, text: string) => {
            sentMessages.push(text);
            return { success: true };
          }),
          sendButtonsMessage: vi.fn().mockImplementation(async (_phone: string, text: string) => {
            sentMessages.push(text);
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        const mockContext: OwnerCustomerContext = {
          userId: "usr_owner_flow",
          clinicId: "clinic_flow_01",
          userName: "Dra. Renata",
          userEmail: "renata@fisio.com.br",
          clinicName: "Clínica Fisio Renata",
          planName: "Pluri Fisio Pro",
          professionInfo: "Fisioterapeuta",
          isOwnerOrAdmin: true,
          isSoloPlan: false,
          isClinicPlan: true,
          activeRole: "owner",
        };

        // Paciente nascido em 2018 (menor de idade) sem CPF do responsável
        const invalidMinorPayload = {
          name: "Gabrielzinho Silva",
          birth_date: "2018-05-10",
          doc_type: "RG",
          doc_number: "MG-11.222.333",
          parent_cpf: "111.111.111-11", // CPF falso com dígitos repetidos
          phone: "0",
          email: "0",
        };

        const result = await handleFlowPreRegistrationSubmission(
          mockSupabase,
          mockClient,
          "5511999998888",
          mockContext,
          invalidMinorPayload
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("responsável");
        expect(sentMessages.length).toBe(1);
        expect(sentMessages[0]).toContain("menor de 18 anos");
      });

      it("transitions smoothly to conversational chat when user triggers fallback", async () => {
        const sentMessages: string[] = [];
        const mockClient = {
          sendTextMessage: vi.fn().mockImplementation(async (_phone: string, text: string) => {
            sentMessages.push(text);
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        const mockContext: OwnerCustomerContext = {
          userId: "usr_owner_flow",
          clinicId: "clinic_flow_01",
          userName: "Dr. Marcelo",
          userEmail: "marcelo@fisio.com.br",
          clinicName: "Clínica Fisio",
          planName: "Pluri Fisio Pro",
          professionInfo: "Fisioterapeuta",
          isOwnerOrAdmin: true,
          isSoloPlan: false,
          isClinicPlan: true,
          activeRole: "owner",
        };

        // Usuário clica no botão de contingência de chat
        const res = await handleQuickPatientPreRegistrationFlow(
          {} as any,
          mockClient,
          "5511999998888",
          mockContext,
          "precad_waiting_name",
          "",
          "btn_flow_fallback_chat",
          {}
        );

        expect(res.handled).toBe(true);
        expect(res.nextStep).toBe("precad_waiting_name");
        expect(sentMessages.length).toBe(1);
        expect(sentMessages[0]).toContain("Nome Completo");
      });
    });
  });

  describe("Owner Copilot (Fase C) - Agenda & Atendimentos", () => {
    const mockContextClinic: OwnerCustomerContext = {
      userId: "usr_owner_clinic",
      clinicId: "clinic_agenda_01",
      userName: "Dra. Juliana",
      userEmail: "juliana@fisio.com.br",
      clinicName: "Clínica Pluri Equipe",
      planName: "Pluri Clínica",
      professionInfo: "Fisioterapeuta",
      isOwnerOrAdmin: true,
      isSoloPlan: false,
      isClinicPlan: true,
      activeRole: "owner",
    };

    const mockContextSolo: OwnerCustomerContext = {
      userId: "usr_owner_solo",
      clinicId: "clinic_solo_01",
      userName: "Dr. Roberto",
      userEmail: "roberto@fisio.com.br",
      clinicName: "Consultório Roberto",
      planName: "Pluri Solo",
      professionInfo: "Fisioterapeuta",
      isOwnerOrAdmin: true,
      isSoloPlan: true,
      isClinicPlan: false,
      activeRole: "owner",
    };

    it("sends Agenda submenu list message with agenda_new, agenda_full, and agenda_next", async () => {
      let capturedList: any;
      const mockClient = {
        sendListMessage: vi.fn(async (_phone, bodyText, buttonText, sections, options) => {
          capturedList = { bodyText, buttonText, sections, options };
          return { success: true, messageId: "msg_agenda_menu" };
        }),
      } as unknown as WhatsAppClient;

      await sendAgendaMenu(mockClient, "5511999998888", mockContextClinic);

      expect(mockClient.sendListMessage).toHaveBeenCalled();
      expect(capturedList.bodyText).toContain("Agenda & Atendimentos");
      const rowIds = capturedList.sections[0].rows.map((r: any) => r.id);
      expect(rowIds).toContain("agenda_new");
      expect(rowIds).toContain("agenda_full");
      expect(rowIds).toContain("agenda_next");
    });

    it("sends New Appointment Type selection menu", async () => {
      let capturedList: any;
      const mockClient = {
        sendListMessage: vi.fn(async (_phone, bodyText, buttonText, sections, options) => {
          capturedList = { bodyText, buttonText, sections, options };
          return { success: true, messageId: "msg_type_menu" };
        }),
      } as unknown as WhatsAppClient;

      await sendNewAppointmentTypeMenu(mockClient, "5511999998888", "Dra. Juliana");

      expect(mockClient.sendListMessage).toHaveBeenCalled();
      const rowIds = capturedList.sections[0].rows.map((r: any) => r.id);
      expect(rowIds).toContain("agenda_new_patient");
      expect(rowIds).toContain("agenda_new_event");
      expect(rowIds).toContain("agenda_new_meeting");
    });

    describe("Flow agenda_new_patient", () => {
      it("requests patient CPF, searches clinic database and offers quick pre-registration button if not found", async () => {
        let sentButtons: any;
        const mockClient = {
          sendTextMessage: vi.fn(async () => ({ success: true })),
          sendButtonsMessage: vi.fn(async (_phone, body, options) => {
            sentButtons = { body, options };
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        const mockSupabase = {
          from: vi.fn(() => ({
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                    })),
                  })),
                })),
              })),
            })),
          })),
        } as any;

        const res = await handleAgendaCreationFlow(
          mockSupabase,
          mockClient,
          "5511999998888",
          mockContextClinic,
          "agenda_waiting_patient_cpf",
          "52998224725",
          undefined,
          { subType: "patient" }
        );

        expect(res.handled).toBe(true);
        expect(res.nextStep).toBe("initial");
        expect(mockClient.sendButtonsMessage).toHaveBeenCalled();
        expect(sentButtons.body).toContain("Paciente não encontrado");
        const btnIds = sentButtons.options.buttons.map((b: any) => b.id);
        expect(btnIds).toContain("records_quick_patient");
      });

      it("finds patient and proceeds to date selection list", async () => {
        let capturedTextMessage = "";
        let capturedListMessage: any;

        const mockClient = {
          sendTextMessage: vi.fn(async (_phone, text) => {
            capturedTextMessage = text;
            return { success: true };
          }),
          sendListMessage: vi.fn(async (_phone, body, btnText, sections) => {
            capturedListMessage = { body, sections };
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        const mockSupabase = {
          from: vi.fn(() => ({
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({
                        data: {
                          id: "pat_123",
                          name: "Carlos Eduardo da Silva",
                          patient_code: "PAC-0042",
                          phone: "11988887777",
                        },
                        error: null,
                      })),
                    })),
                  })),
                })),
              })),
            })),
          })),
        } as any;

        const res = await handleAgendaCreationFlow(
          mockSupabase,
          mockClient,
          "5511999998888",
          mockContextClinic,
          "agenda_waiting_patient_cpf",
          "52998224725",
          undefined,
          { subType: "patient" }
        );

        expect(res.handled).toBe(true);
        expect(res.nextStep).toBe("agenda_waiting_date");
        expect(res.updatedStateData.patientId).toBe("pat_123");
        expect(res.updatedStateData.patientName).toBe("Carlos Eduardo da Silva");
        expect(capturedTextMessage).toContain("Paciente localizado!");
        expect(mockClient.sendListMessage).toHaveBeenCalled();
      });

      it("calculates available slots for chosen date using calendar-utils and asks for time", async () => {
        let sentTimePrompt = "";
        const mockClient = {
          sendTextMessage: vi.fn(async (_phone, text) => {
            sentTimePrompt = text;
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        const mockSupabase = {
          from: vi.fn(() => ({
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gte: vi.fn(() => ({
                  lte: vi.fn(() => ({
                    neq: vi.fn(async () => ({
                      data: [],
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          })),
        } as any;

        const res = await handleAgendaCreationFlow(
          mockSupabase,
          mockClient,
          "5511999998888",
          mockContextClinic,
          "agenda_waiting_date",
          "",
          "agenda_date_2026-10-14",
          {
            subType: "patient",
            patientId: "pat_123",
            patientName: "Carlos Eduardo",
          }
        );

        expect(res.handled).toBe(true);
        expect(res.nextStep).toBe("agenda_waiting_time");
        expect(res.updatedStateData.dateIso).toBe("2026-10-14");
        expect(sentTimePrompt).toContain("Data Selecionada:");
        expect(sentTimePrompt).toContain("Horários disponíveis");
      });

      it("handles Solo Plan: skips collaborator step and immediately creates agenda event + session", async () => {
        let sentConfirmationCard: any;
        const mockClient = {
          sendTextMessage: vi.fn(async () => ({ success: true })),
          sendButtonsMessage: vi.fn(async (_phone, body, options) => {
            sentConfirmationCard = { body, options };
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        let insertedAgendaEvent: any;
        let insertedSession: any;

        const mockSupabase = {
          from: vi.fn((table: string) => {
            if (table === "agenda_events") {
              return {
                select: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    gte: vi.fn(() => ({
                      lte: vi.fn(() => ({
                        neq: vi.fn(async () => ({ data: [], error: null })),
                      })),
                    })),
                  })),
                })),
                insert: vi.fn((payload) => {
                  insertedAgendaEvent = payload;
                  return {
                    select: vi.fn(() => ({
                      single: vi.fn(async () => ({ data: { id: "evt_new_01" }, error: null })),
                    })),
                  };
                }),
              };
            }
            if (table === "sessions") {
              return {
                insert: vi.fn(async (payload) => {
                  insertedSession = payload;
                  return { error: null };
                }),
              };
            }
            return {};
          }),
        } as any;

        const res = await handleAgendaCreationFlow(
          mockSupabase,
          mockClient,
          "5511999998888",
          mockContextSolo,
          "agenda_waiting_time",
          "10:30",
          undefined,
          {
            subType: "patient",
            patientId: "pat_123",
            patientName: "Carlos Eduardo",
            dateIso: "2026-10-14",
            dateDisplay: "14/10",
          }
        );

        expect(res.handled).toBe(true);
        expect(res.nextStep).toBe("initial");
        expect(insertedAgendaEvent).toBeDefined();
        expect(insertedAgendaEvent.clinic_id).toBe("clinic_solo_01");
        expect(insertedAgendaEvent.event_type).toBe("atendimento");
        expect(insertedAgendaEvent.patient_id).toBe("pat_123");
        expect(insertedAgendaEvent.status).toBe("confirmado");

        expect(insertedSession).toBeDefined();
        expect(insertedSession.patient_id).toBe("pat_123");
        expect(insertedSession.status).toBe("rascunho");

        expect(sentConfirmationCard.body).toContain("AGENDAMENTO CONFIRMADO");
        expect(sentConfirmationCard.body).toContain("calendar.google.com");
      });

      it("guarantees clinic owner full autonomy: allows scheduling on Thursday morning, lunch time and custom hours when schedule is free", async () => {
        let sentConfirmationCard: any;
        const mockClient = {
          sendTextMessage: vi.fn(async () => ({ success: true })),
          sendButtonsMessage: vi.fn(async (_phone, body, options) => {
            sentConfirmationCard = { body, options };
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        let insertedAgendaEvent: any;

        const mockSupabase = {
          from: vi.fn((table: string) => {
            if (table === "agenda_events") {
              return {
                select: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    gte: vi.fn(() => ({
                      lte: vi.fn(() => ({
                        neq: vi.fn(async () => ({ data: [], error: null })),
                      })),
                    })),
                  })),
                })),
                insert: vi.fn((payload) => {
                  insertedAgendaEvent = payload;
                  return {
                    select: vi.fn(() => ({
                      single: vi.fn(async () => ({ data: { id: "evt_owner_lunch_01" }, error: null })),
                    })),
                  };
                }),
              };
            }
            if (table === "sessions") {
              return {
                insert: vi.fn(async () => ({ error: null })),
              };
            }
            return {};
          }),
        } as any;

        // 1. Agendamento exatamente no horário de almoço (13:30) em uma quinta-feira (2026-10-15)
        const resLunchThursday = await handleAgendaCreationFlow(
          mockSupabase,
          mockClient,
          "5511999998888",
          mockContextSolo,
          "agenda_waiting_time",
          "13:30",
          undefined,
          {
            subType: "patient",
            patientId: "pat_123",
            patientName: "Carlos Eduardo",
            dateIso: "2026-10-15", // Quinta-feira
            dateDisplay: "15/10",
          }
        );

        expect(resLunchThursday.handled).toBe(true);
        expect(resLunchThursday.nextStep).toBe("initial");
        expect(insertedAgendaEvent).toBeDefined();
        expect(insertedAgendaEvent.scheduled_for).toContain("16:30:00.000Z"); // 13:30 Brasília = 16:30 UTC
        expect(sentConfirmationCard.body).toContain("AGENDAMENTO CONFIRMADO");

        // 2. Agendamento em quinta-feira de manhã (10:00) - que seria bloqueado para Lead/Master, mas é livre para Owner
        const resMorningThursday = await handleAgendaCreationFlow(
          mockSupabase,
          mockClient,
          "5511999998888",
          mockContextSolo,
          "agenda_waiting_time",
          "10:00",
          undefined,
          {
            subType: "patient",
            patientId: "pat_123",
            patientName: "Carlos Eduardo",
            dateIso: "2026-10-15", // Quinta-feira
            dateDisplay: "15/10",
          }
        );

        expect(resMorningThursday.handled).toBe(true);
        expect(resMorningThursday.nextStep).toBe("initial");
        expect(sentConfirmationCard.body).toContain("AGENDAMENTO CONFIRMADO");
      });

      it("handles Clinic Plan: asks for collaborators and records team in notes", async () => {
        let sentButtonsMessage: any;
        const mockClient = {
          sendTextMessage: vi.fn(async () => ({ success: true })),
          sendButtonsMessage: vi.fn(async (_phone, body, options) => {
            sentButtonsMessage = { body, options };
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        const mockSupabase = {
          from: vi.fn(() => ({
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gte: vi.fn(() => ({
                  lte: vi.fn(() => ({
                    neq: vi.fn(async () => ({ data: [], error: null })),
                  })),
                })),
              })),
            })),
          })),
        } as any;

        const res = await handleAgendaCreationFlow(
          mockSupabase,
          mockClient,
          "5511999998888",
          mockContextClinic,
          "agenda_waiting_time",
          "10:30",
          undefined,
          {
            subType: "patient",
            patientId: "pat_123",
            patientName: "Carlos Eduardo",
            dateIso: "2026-10-14",
            dateDisplay: "14/10",
          }
        );

        expect(res.handled).toBe(true);
        expect(res.nextStep).toBe("agenda_waiting_collab");
        expect(sentButtonsMessage.body).toContain("Participação de Colaboradores");
      });
    });

    describe("Flow agenda_new_event & agenda_new_meeting", () => {
      it("creates an event, blocks schedule and provides Google Calendar link", async () => {
        let sentConfirmationCard: any;
        const mockClient = {
          sendTextMessage: vi.fn(async () => ({ success: true })),
          sendButtonsMessage: vi.fn(async (_phone, body, options) => {
            sentConfirmationCard = { body, options };
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        let insertedAgendaEvent: any;

        const mockSupabase = {
          from: vi.fn((table: string) => {
            if (table === "agenda_events") {
              return {
                select: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    gte: vi.fn(() => ({
                      lte: vi.fn(() => ({
                        neq: vi.fn(async () => ({ data: [], error: null })),
                      })),
                    })),
                  })),
                })),
                insert: vi.fn((payload) => {
                  insertedAgendaEvent = payload;
                  return {
                    select: vi.fn(() => ({
                      single: vi.fn(async () => ({ data: { id: "evt_meeting_01" }, error: null })),
                    })),
                  };
                }),
              };
            }
            return {};
          }),
        } as any;

        const res = await handleAgendaCreationFlow(
          mockSupabase,
          mockClient,
          "5511999998888",
          mockContextSolo,
          "agenda_waiting_time",
          "15:00",
          undefined,
          {
            subType: "meeting",
            title: "Reunião de Alinhamento Clínico",
            dateIso: "2026-10-15",
            dateDisplay: "15/10",
          }
        );

        expect(res.handled).toBe(true);
        expect(res.nextStep).toBe("initial");
        expect(insertedAgendaEvent.event_type).toBe("reuniao");
        expect(insertedAgendaEvent.title).toBe("Reunião de Alinhamento Clínico");
        expect(sentConfirmationCard.body).toContain("Reunião");
        expect(sentConfirmationCard.body).toContain("calendar.google.com");
      });
    });

    describe("Module agenda_full", () => {
      it("fetches and presents complete schedule for today and the next 7 days", async () => {
        let sentCard: any;
        const mockClient = {
          sendTextMessage: vi.fn(async () => ({ success: true })),
          sendButtonsMessage: vi.fn(async (_phone, body, options) => {
            sentCard = { body, options };
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        const today = new Date();
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

        const mockSupabase = {
          from: vi.fn(() => ({
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gte: vi.fn(() => ({
                  lte: vi.fn(() => ({
                    neq: vi.fn(() => ({
                      order: vi.fn(async () => ({
                        data: [
                          {
                            id: "ev_1",
                            title: "Atendimento - Ana Lima",
                            scheduled_for: today.toISOString(),
                            duration_minutes: 50,
                            status: "confirmado",
                            event_type: "atendimento",
                          },
                          {
                            id: "ev_2",
                            title: "Reunião Diretoria",
                            scheduled_for: tomorrow.toISOString(),
                            duration_minutes: 60,
                            status: "aguardando_confirmacao",
                            event_type: "reuniao",
                          },
                        ],
                        error: null,
                      })),
                    })),
                  })),
                })),
              })),
            })),
          })),
        } as any;

        await handleAgendaFull(mockSupabase, mockClient, "5511999998888", mockContextClinic);

        expect(mockClient.sendButtonsMessage).toHaveBeenCalled();
        expect(sentCard.body).toContain("AGENDA DA CLÍNICA");
        expect(sentCard.body).toContain("Agenda de Hoje");
        expect(sentCard.body).toContain("Próximos dias da semana");
        expect(sentCard.body).toContain("Ana Lima");
        expect(sentCard.body).toContain("Reunião Diretoria");
      });
    });

    describe("Module agenda_next", () => {
      it("reports when there are no upcoming appointments", async () => {
        let sentEmptyCard: any;
        const mockClient = {
          sendTextMessage: vi.fn(async () => ({ success: true })),
          sendButtonsMessage: vi.fn(async (_phone, body, options) => {
            sentEmptyCard = { body, options };
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        const mockSupabase = {
          from: vi.fn(() => ({
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gte: vi.fn(() => ({
                  neq: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(() => ({
                        maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          })),
        } as any;

        await handleAgendaNext(mockSupabase, mockClient, "5511999998888", mockContextSolo);

        expect(sentEmptyCard.body).toContain("Você não tem nenhum atendimento agendado");
        const btnIds = sentEmptyCard.options.buttons.map((b: any) => b.id);
        expect(btnIds).toContain("agenda_new");
      });

      it("displays Meta List Message with 'Mudar Status' and 'Editar Informação' sections when appointment exists", async () => {
        let capturedList: any;
        const mockClient = {
          sendTextMessage: vi.fn(async () => ({ success: true })),
          sendButtonsMessage: vi.fn(async () => ({ success: true })),
          sendListMessage: vi.fn(async (_phone, body, buttonText, sections, options) => {
            capturedList = { body, buttonText, sections, options };
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        const nextHour = new Date(Date.now() + 60 * 60 * 1000);

        const mockSupabase = {
          from: vi.fn((table: string) => {
            if (table === "agenda_events") {
              return {
                select: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    gte: vi.fn(() => ({
                      neq: vi.fn(() => ({
                        order: vi.fn(() => ({
                          limit: vi.fn(() => ({
                            maybeSingle: vi.fn(async () => ({
                              data: {
                                id: "evt_next_88",
                                title: "Atendimento - Roberto Carlos",
                                scheduled_for: nextHour.toISOString(),
                                duration_minutes: 50,
                                status: "aguardando_confirmacao",
                                event_type: "atendimento",
                                patient_id: "pat_88",
                              },
                              error: null,
                            })),
                          })),
                        })),
                      })),
                    })),
                  })),
                })),
              };
            }
            if (table === "patients") {
              const patientChain: any = {
                eq: vi.fn(() => patientChain),
                maybeSingle: vi.fn(async () => ({
                  data: {
                    name: "Roberto Carlos",
                    phone: "11977776666",
                  },
                  error: null,
                })),
              };
              return {
                select: vi.fn(() => patientChain),
              };
            }
            return {};
          }),
        } as any;

        await handleAgendaNext(mockSupabase, mockClient, "5511999998888", mockContextClinic);

        expect(capturedList.body).toContain("PRÓXIMO AGENDAMENTO");
        expect(capturedList.body).toContain("Roberto Carlos");
        expect(capturedList.body).toContain("11977776666");
        expect(capturedList.buttonText).toBe("Ações Rápidas");

        // Verifica duas seções: Mudar Status e Editar Informação
        expect(capturedList.sections).toHaveLength(2);
        const [statusSection, editSection] = capturedList.sections;

        expect(statusSection.title).toBe("Mudar Status");
        const statusRowIds = statusSection.rows.map((r: any) => r.id);
        expect(statusRowIds).toEqual([
          "appt_status_confirm_evt_next_88",
          "appt_status_cancel_evt_next_88",
          "appt_status_complete_evt_next_88",
          "appt_status_awaiting_evt_next_88",
          "appt_status_delete_evt_next_88",
        ]);

        expect(editSection.title).toBe("Editar Informação");
        const editRowIds = editSection.rows.map((r: any) => r.id);
        expect(editRowIds).toContain("appt_edit_date_evt_next_88");
        expect(editRowIds).toContain("appt_edit_time_evt_next_88");
        expect(editRowIds).toContain("appt_back_menu_evt_next_88");
      });

      it("respects plan condition: excludes 'Colaboradores' row for Solo Plan", async () => {
        let capturedList: any;
        const mockClient = {
          sendTextMessage: vi.fn(async () => ({ success: true })),
          sendButtonsMessage: vi.fn(async () => ({ success: true })),
          sendListMessage: vi.fn(async (_phone, body, buttonText, sections, options) => {
            capturedList = { body, buttonText, sections, options };
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        const nextHour = new Date(Date.now() + 60 * 60 * 1000);
        const mockSupabase = {
          from: vi.fn((table: string) => {
            if (table === "agenda_events") {
              return {
                select: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    gte: vi.fn(() => ({
                      neq: vi.fn(() => ({
                        order: vi.fn(() => ({
                          limit: vi.fn(() => ({
                            maybeSingle: vi.fn(async () => ({
                              data: {
                                id: "evt_solo_123",
                                title: "Sessão Lucas",
                                scheduled_for: nextHour.toISOString(),
                                duration_minutes: 50,
                                status: "confirmado",
                                event_type: "atendimento",
                              },
                              error: null,
                            })),
                          })),
                        })),
                      })),
                    })),
                  })),
                })),
              };
            }
            return {};
          }),
        } as any;

        // Contexto com isSoloPlan = true, isClinicPlan = false
        await handleAgendaNext(mockSupabase, mockClient, "5511999998888", mockContextSolo);

        const editSection = capturedList.sections.find((s: any) => s.title === "Editar Informação");
        const rowIds = editSection.rows.map((r: any) => r.id);
        const rowTitles = editSection.rows.map((r: any) => r.title);

        expect(rowIds).not.toContain("appt_edit_collab_evt_solo_123");
        expect(rowTitles.some((t: string) => t.includes("Colaboradores"))).toBe(false);
      });

      it("respects plan condition: includes 'Colaboradores' row for Clinic Plan", async () => {
        let capturedList: any;
        const mockClient = {
          sendTextMessage: vi.fn(async () => ({ success: true })),
          sendButtonsMessage: vi.fn(async () => ({ success: true })),
          sendListMessage: vi.fn(async (_phone, body, buttonText, sections, options) => {
            capturedList = { body, buttonText, sections, options };
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        const nextHour = new Date(Date.now() + 60 * 60 * 1000);
        const mockSupabase = {
          from: vi.fn((table: string) => {
            if (table === "agenda_events") {
              return {
                select: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    gte: vi.fn(() => ({
                      neq: vi.fn(() => ({
                        order: vi.fn(() => ({
                          limit: vi.fn(() => ({
                            maybeSingle: vi.fn(async () => ({
                              data: {
                                id: "evt_clinic_456",
                                title: "Sessão Marina",
                                scheduled_for: nextHour.toISOString(),
                                duration_minutes: 50,
                                status: "confirmado",
                                event_type: "atendimento",
                              },
                              error: null,
                            })),
                          })),
                        })),
                      })),
                    })),
                  })),
                })),
              };
            }
            return {};
          }),
        } as any;

        // Contexto com isClinicPlan = true
        await handleAgendaNext(mockSupabase, mockClient, "5511999998888", mockContextClinic);

        const editSection = capturedList.sections.find((s: any) => s.title === "Editar Informação");
        const rowIds = editSection.rows.map((r: any) => r.id);
        const rowTitles = editSection.rows.map((r: any) => r.title);

        expect(rowIds).toContain("appt_edit_collab_evt_clinic_456");
        expect(rowTitles.some((t: string) => t.includes("Colaboradores"))).toBe(true);
      });

      it("executes appointment action: appt_status_confirm_* updates status to 'confirmado'", async () => {
        const mockClient = {
          sendTextMessage: vi.fn(async () => ({ success: true })),
          sendButtonsMessage: vi.fn(async () => ({ success: true })),
        } as unknown as WhatsAppClient;

        let updatedStatus = "";
        const mockSupabase = {
          from: vi.fn(() => ({
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: "evt_99", title: "Sessão Ana", status: "aguardando_confirmacao" },
                    error: null,
                  })),
                })),
              })),
            })),
            update: vi.fn((payload) => {
              updatedStatus = payload.status;
              const chain: any = {
                eq: vi.fn(() => chain),
              };
              return chain;
            }),
          })),
        } as any;

        const res = await handleAppointmentAction(
          mockSupabase,
          mockClient,
          "5511999998888",
          mockContextClinic,
          "confirm",
          "evt_99"
        );

        expect(res.success).toBe(true);
        expect(updatedStatus).toBe("confirmado");
      });

      it("executes appointment action: appt_status_cancel_* updates status to 'cancelado' and frees slot", async () => {
        const mockClient = {
          sendTextMessage: vi.fn(async () => ({ success: true })),
          sendButtonsMessage: vi.fn(async () => ({ success: true })),
        } as unknown as WhatsAppClient;

        let updatedStatus = "";
        const mockSupabase = {
          from: vi.fn(() => ({
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: "evt_99",
                      title: "Sessão Ana",
                      status: "confirmado",
                      scheduled_for: new Date().toISOString(),
                      patient_id: "pat_99",
                    },
                    error: null,
                  })),
                })),
              })),
            })),
            update: vi.fn((payload) => {
              updatedStatus = payload.status;
              const chain: any = {
                eq: vi.fn(() => chain),
                in: vi.fn(async () => ({ error: null })),
                neq: vi.fn(async () => ({ error: null })),
              };
              return chain;
            }),
          })),
        } as any;

        const res = await handleAppointmentAction(
          mockSupabase,
          mockClient,
          "5511999998888",
          mockContextClinic,
          "cancel",
          "evt_99"
        );

        expect(res.success).toBe(true);
        expect(updatedStatus).toBe("cancelado");
      });

      it("executes appointment action: appt_status_complete_* updates status to 'concluido'", async () => {
        const mockClient = {
          sendTextMessage: vi.fn(async () => ({ success: true })),
          sendButtonsMessage: vi.fn(async () => ({ success: true })),
        } as unknown as WhatsAppClient;

        let updatedStatus = "";
        const mockSupabase = {
          from: vi.fn(() => ({
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: "evt_comp_1",
                      title: "Sessão Fisioterapia",
                      status: "confirmado",
                      scheduled_for: new Date().toISOString(),
                      patient_id: "pat_comp_1",
                    },
                    error: null,
                  })),
                })),
              })),
            })),
            update: vi.fn((payload) => {
              updatedStatus = payload.status;
              const chain: any = {
                eq: vi.fn(() => chain),
                neq: vi.fn(async () => ({ error: null })),
              };
              return chain;
            }),
          })),
        } as any;

        const res = await handleAppointmentAction(
          mockSupabase,
          mockClient,
          "5511999998888",
          mockContextClinic,
          "complete",
          "evt_comp_1"
        );

        expect(res.success).toBe(true);
        expect(updatedStatus).toBe("concluido");
      });

      it("executes appointment action: appt_status_awaiting_* updates status to 'aguardando_confirmacao'", async () => {
        const mockClient = {
          sendTextMessage: vi.fn(async () => ({ success: true })),
          sendButtonsMessage: vi.fn(async () => ({ success: true })),
        } as unknown as WhatsAppClient;

        let updatedStatus = "";
        const mockSupabase = {
          from: vi.fn(() => ({
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: "evt_await_1",
                      title: "Atendimento Rogério",
                      status: "confirmado",
                    },
                    error: null,
                  })),
                })),
              })),
            })),
            update: vi.fn((payload) => {
              updatedStatus = payload.status;
              const chain: any = {
                eq: vi.fn(() => chain),
              };
              return chain;
            }),
          })),
        } as any;

        const res = await handleAppointmentAction(
          mockSupabase,
          mockClient,
          "5511999998888",
          mockContextClinic,
          "awaiting",
          "evt_await_1"
        );

        expect(res.success).toBe(true);
        expect(updatedStatus).toBe("aguardando_confirmacao");
      });


      it("executes appointment action: appt_status_delete_* deletes event from database", async () => {
        const mockClient = {
          sendTextMessage: vi.fn(async () => ({ success: true })),
          sendButtonsMessage: vi.fn(async () => ({ success: true })),
        } as unknown as WhatsAppClient;

        let deleteCalled = false;
        const mockSupabase = {
          from: vi.fn((table: string) => {
            if (table === "agenda_events") {
              return {
                select: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({
                        data: {
                          id: "evt_del_1",
                          title: "Consulta Teste",
                          status: "confirmado",
                          scheduled_for: new Date().toISOString(),
                          patient_id: "pat_del_1",
                        },
                        error: null,
                      })),
                    })),
                  })),
                })),
                delete: vi.fn(() => {
                  deleteCalled = true;
                  return {
                    eq: vi.fn(() => ({
                      eq: vi.fn(async () => ({ error: null })),
                    })),
                  };
                }),
              };
            }
            if (table === "sessions") {
              const sessionChain: any = {
                eq: vi.fn(() => sessionChain),
              };
              return {
                update: vi.fn(() => sessionChain),
              };
            }
            return {};
          }),
        } as any;

        const res = await handleAppointmentAction(
          mockSupabase,
          mockClient,
          "5511999998888",
          mockContextClinic,
          "delete",
          "evt_del_1"
        );

        expect(res.success).toBe(true);
        expect(deleteCalled).toBe(true);
      });

      it("executes appointment action: reschedule initiating interactive date selection", async () => {
        const sentTexts: string[] = [];
        let listCapturedTitle = "";
        const mockClient = {
          sendTextMessage: vi.fn(async (_phone: string, text: string) => {
            sentTexts.push(text);
            return { success: true };
          }),
          sendListMessage: vi.fn(async (_phone: string, _body: string, _btnText: string, _sections: any, options: any) => {
            listCapturedTitle = options?.title || "";
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        const mockSupabase = {
          from: vi.fn(() => ({
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: "evt_resched_1",
                      title: "Atendimento Carlos",
                      status: "confirmado",
                      scheduled_for: new Date().toISOString(),
                    },
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        } as any;

        const res = await handleAppointmentAction(
          mockSupabase,
          mockClient,
          "5511999998888",
          mockContextClinic,
          "reschedule",
          "evt_resched_1"
        );

        expect(res.success).toBe(true);
        expect(sentTexts.some((t) => t.includes("Remarcar Atendimento"))).toBe(true);
        expect(listCapturedTitle).toBe("Nova Data");
      });

      it("handles edit date flow: appt_edit_date_* initiates date selection and updates scheduled_for", async () => {
        const sentTexts: string[] = [];
        let listTitle = "";
        const mockClient = {
          sendTextMessage: vi.fn(async (_p: string, text: string) => {
            sentTexts.push(text);
            return { success: true };
          }),
          sendListMessage: vi.fn(async (_p: string, _b: string, _btn: string, _s: any, options: any) => {
            listTitle = options?.title || "";
            return { success: true };
          }),
          sendButtonsMessage: vi.fn(async () => ({ success: true })),
        } as unknown as WhatsAppClient;

        const mockSupabase = {} as any;

        // Passo 1: Disparo de appt_edit_date_evt_10
        const step1 = await handleAppointmentEditFlow(
          mockSupabase,
          mockClient,
          "5511999998888",
          mockContextClinic,
          "initial",
          "",
          "appt_edit_date_evt_10",
          {}
        );

        expect(step1.handled).toBe(true);
        expect(step1.nextStep).toBe("appt_edit_waiting_date");
        expect(step1.updatedStateData.editingEventId).toBe("evt_10");
        expect(step1.updatedStateData.editingField).toBe("date");
        expect(sentTexts.some((t) => t.includes("Alterar Data do Atendimento"))).toBe(true);
        expect(listTitle).toBe("Nova Data");

        // Passo 2: Usuário seleciona a nova data (agenda_date_2026-10-25)
        let updatedScheduledFor = "";
        const mockSupabaseStep2 = {
          from: vi.fn((table: string) => {
            if (table === "agenda_events") {
              return {
                select: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({
                        data: {
                          id: "evt_10",
                          title: "Atendimento Mariana",
                          scheduled_for: "2026-10-20T14:00:00.000Z",
                          patient_id: "pat_10",
                        },
                        error: null,
                      })),
                    })),
                  })),
                })),
                update: vi.fn((payload) => {
                  updatedScheduledFor = payload.scheduled_for;
                  return {
                    eq: vi.fn(() => ({
                      eq: vi.fn(async () => ({ error: null })),
                    })),
                  };
                }),
              };
            }
            if (table === "sessions") {
              const sessionChain: any = {
                eq: vi.fn(() => sessionChain),
              };
              return {
                update: vi.fn(() => sessionChain),
              };
            }
            return {};
          }),
        } as any;

        const step2 = await handleAppointmentEditFlow(
          mockSupabaseStep2,
          mockClient,
          "5511999998888",
          mockContextClinic,
          "appt_edit_waiting_date",
          "",
          "agenda_date_2026-10-25",
          step1.updatedStateData
        );

        expect(step2.handled).toBe(true);
        expect(step2.nextStep).toBe("initial");
        expect(updatedScheduledFor).toBeDefined();
        expect(updatedScheduledFor).toContain("2026-10-25");
      });

      it("handles edit time flow: appt_edit_time_* requests new time and updates scheduled_for", async () => {
        const sentTexts: string[] = [];
        const mockClient = {
          sendTextMessage: vi.fn(async (_p: string, text: string) => {
            sentTexts.push(text);
            return { success: true };
          }),
          sendButtonsMessage: vi.fn(async () => ({ success: true })),
        } as unknown as WhatsAppClient;

        const mockSupabase = {
          from: vi.fn(() => ({
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: "evt_time_20",
                      title: "Sessão Reabilitação",
                      scheduled_for: "2026-10-26T14:00:00.000Z",
                      patient_id: "pat_time_20",
                    },
                    error: null,
                  })),
                })),
                gte: vi.fn(() => ({
                  lte: vi.fn(() => ({
                    neq: vi.fn(async () => ({ data: [], error: null })),
                  })),
                })),
              })),
            })),
          })),
        } as any;

        // Passo 1: Início
        const step1 = await handleAppointmentEditFlow(
          mockSupabase,
          mockClient,
          "5511999998888",
          mockContextClinic,
          "initial",
          "",
          "appt_edit_time_evt_time_20",
          {}
        );

        expect(step1.handled).toBe(true);
        expect(step1.nextStep).toBe("appt_edit_waiting_time");
        expect(step1.updatedStateData.editingEventId).toBe("evt_time_20");
        expect(sentTexts.some((t) => t.includes("Alterar Horário do Atendimento"))).toBe(true);

        // Passo 2: Digita novo horário "10:30"
        let updatedTimeScheduled = "";
        const mockSupabaseStep2 = {
          from: vi.fn((table: string) => {
            if (table === "agenda_events") {
              return {
                select: vi.fn((fields: string) => ({
                  eq: vi.fn((col: string, val: string) => {
                    return {
                      eq: vi.fn(() => ({
                        maybeSingle: vi.fn(async () => ({
                          data: {
                            id: "evt_time_20",
                            title: "Sessão Reabilitação",
                            scheduled_for: "2026-10-26T14:00:00.000Z",
                            patient_id: "pat_time_20",
                          },
                          error: null,
                        })),
                      })),
                      gte: vi.fn(() => ({
                        lte: vi.fn(() => ({
                          neq: vi.fn(async () => ({ data: [], error: null })),
                        })),
                      })),
                    };
                  }),
                })),
                update: vi.fn((payload) => {
                  updatedTimeScheduled = payload.scheduled_for;
                  return {
                    eq: vi.fn(() => ({
                      eq: vi.fn(async () => ({ error: null })),
                    })),
                  };
                }),
              };
            }
            if (table === "sessions") {
              const sessionChain: any = {
                eq: vi.fn(() => sessionChain),
              };
              return {
                update: vi.fn(() => sessionChain),
              };
            }
            return {};
          }),
        } as any;

        const step2 = await handleAppointmentEditFlow(
          mockSupabaseStep2,
          mockClient,
          "5511999998888",
          mockContextClinic,
          "appt_edit_waiting_time",
          "10:30",
          "",
          step1.updatedStateData
        );

        expect(step2.handled).toBe(true);
        expect(step2.nextStep).toBe("initial");
        expect(updatedTimeScheduled).toBeDefined();
        expect(new Date(updatedTimeScheduled).toISOString()).toBe(updatedTimeScheduled);
      });

      it("handles edit collaborators flow (clinic plan): appt_edit_collab_* updates collaborators/notes", async () => {
        const sentTexts: string[] = [];
        const mockClient = {
          sendTextMessage: vi.fn(async (_p: string, text: string) => {
            sentTexts.push(text);
            return { success: true };
          }),
          sendButtonsMessage: vi.fn(async () => ({ success: true })),
        } as unknown as WhatsAppClient;

        // Passo 1: Início
        const step1 = await handleAppointmentEditFlow(
          {} as any,
          mockClient,
          "5511999998888",
          mockContextClinic,
          "initial",
          "",
          "appt_edit_collab_evt_collab_30",
          {}
        );

        expect(step1.handled).toBe(true);
        expect(step1.nextStep).toBe("appt_edit_waiting_collab");
        expect(step1.updatedStateData.editingEventId).toBe("evt_collab_30");
        expect(sentTexts.some((t) => t.includes("Atualizar Colaboradores da Equipe"))).toBe(true);

        // Passo 2: Digita os colaboradores
        let updatedNotes = "";
        const mockSupabaseStep2 = {
          from: vi.fn(() => ({
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: "evt_collab_30",
                      title: "Atendimento Equipe",
                      scheduled_for: "2026-10-25T14:00:00.000Z",
                      patient_id: "pat_collab_30",
                    },
                    error: null,
                  })),
                })),
              })),
            })),
            update: vi.fn((payload) => {
              updatedNotes = payload.notes;
              const sessionChain: any = {
                eq: vi.fn(() => sessionChain),
              };
              return sessionChain;
            }),
          })),
        } as any;

        const step2 = await handleAppointmentEditFlow(
          mockSupabaseStep2,
          mockClient,
          "5511999998888",
          mockContextClinic,
          "appt_edit_waiting_collab",
          "Dr. Marcos e Dra. Carla",
          "",
          step1.updatedStateData
        );

        expect(step2.handled).toBe(true);
        expect(step2.nextStep).toBe("initial");
        expect(updatedNotes).toContain("Dr. Marcos e Dra. Carla");
      });

      it("handles back to agenda menu: appt_back_menu_* returns to agenda submenu", async () => {
        let sentListTitle = "";
        const mockClient = {
          sendTextMessage: vi.fn(async () => ({ success: true })),
          sendListMessage: vi.fn(async (_p: string, _b: string, _btn: string, _s: any, options: any) => {
            sentListTitle = options?.title || "";
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        const res = await handleAppointmentEditFlow(
          {} as any,
          mockClient,
          "5511999998888",
          mockContextClinic,
          "initial",
          "",
          "appt_back_menu_evt_99",
          {}
        );

        expect(res.handled).toBe(true);
        expect(res.nextStep).toBe("initial");
        expect(sentListTitle).toBe("Agenda & Atendimentos");
      });
    });
  });

  describe("WhatsApp Conversational UX - Escape, Cancel and Back Commands", () => {
    const mockContext: OwnerCustomerContext = {
      userId: "usr_owner_ux",
      clinicId: "clinic_ux_01",
      userName: "Dra. Helena",
      userEmail: "helena@fisio.com.br",
      clinicName: "Clínica Pluri UX",
      planName: "Pluri Clínica",
      professionInfo: "Fisioterapeuta",
      isOwnerOrAdmin: true,
      isSoloPlan: false,
      isClinicPlan: true,
      activeRole: "owner",
    };

    describe("Utility Functions: isGlobalCancelCommand & isGlobalBackCommand", () => {
      it("correctly identifies global cancellation commands in various cases and accents", () => {
        const cancelInputs = [
          "cancelar",
          "Cancelar",
          "CANCELAR",
          "cancela",
          "Cancela",
          "cancel",
          "CANCEL",
          "desistir",
          "Desistir",
          "DESISTIR",
          "desisto",
          "sair",
          "Sair",
          "SAIR",
          "parar",
          "interromper",
          "abortar",
          "menu",
          "Menu",
          "MENU",
          "inicio",
          "início",
          "Início",
          "comecar",
          "começar",
          "opcoes",
          "opções",
          "Opções",
        ];

        for (const input of cancelInputs) {
          expect(isGlobalCancelCommand(input)).toBe(true);
        }
      });

      it("correctly identifies global back/return commands in various cases and accents", () => {
        const backInputs = [
          "voltar",
          "Voltar",
          "VOLTAR",
          "volta",
          "Volta",
          "anterior",
          "Anterior",
          "ANTERIOR",
          "retornar",
          "Retornar",
          "RETORNAR",
          "passo anterior",
          "Passo Anterior",
          "voltar atras",
          "voltar atrás",
          "Voltar Atrás",
        ];

        for (const input of backInputs) {
          expect(isGlobalBackCommand(input)).toBe(true);
        }
      });

      it("ensures normal clinical inputs DO NOT trigger false positive cancel or back", () => {
        const normalInputs = [
          "Carlos Antônio",
          "Maria das Dores",
          "12345678901",
          "52998224725",
          "Reunião de Equipe",
          "Avaliação Postural",
          "14:30",
          "09:00",
          "16:45",
          "15/04/1990",
          "paciente@email.com",
          "11999998888",
          "Rua das Palmeiras, 100",
          "Sim",
          "Não",
          "Apenas Eu",
        ];

        for (const input of normalInputs) {
          expect(isGlobalCancelCommand(input)).toBe(false);
          expect(isGlobalBackCommand(input)).toBe(false);
        }
      });
    });

    describe("Agenda Creation Flow - Escape, Cancel and Back Navigation", () => {
      it("typing 'cancelar' or 'menu' at time selection step (agenda_waiting_time) aborts flow, clears data and sends option buttons", async () => {
        let sentButtonsText = "";
        let sentButtonsList: any[] = [];
        const mockClient = {
          sendButtonsMessage: vi.fn(async (_phone: string, text: string, options: any) => {
            sentButtonsText = text;
            sentButtonsList = options?.buttons || [];
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        const resCancel = await handleAgendaCreationFlow(
          {} as any,
          mockClient,
          "5511999998888",
          mockContext,
          "agenda_waiting_time",
          "cancelar",
          undefined,
          { dateIso: "2026-10-15", subType: "patient" }
        );

        expect(resCancel.handled).toBe(true);
        expect(resCancel.nextStep).toBe("initial");
        expect(resCancel.updatedStateData).toEqual({});
        expect(sentButtonsText).toContain("cancelada");
        expect(sentButtonsList.some((b) => b.id === "btn_menu_agenda")).toBe(true);

        // Test with 'menu'
        const resMenu = await handleAgendaCreationFlow(
          {} as any,
          mockClient,
          "5511999998888",
          mockContext,
          "agenda_waiting_time",
          "menu",
          undefined,
          { dateIso: "2026-10-15", subType: "patient" }
        );

        expect(resMenu.handled).toBe(true);
        expect(resMenu.nextStep).toBe("initial");
        expect(resMenu.updatedStateData).toEqual({});
      });

      it("typing 'voltar' at time selection step (agenda_waiting_time) returns to date selection without time format validation error", async () => {
        let listTitle = "";
        const sentTexts: string[] = [];
        const mockClient = {
          sendTextMessage: vi.fn(async (_phone: string, text: string) => {
            sentTexts.push(text);
            return { success: true };
          }),
          sendListMessage: vi.fn(async (_phone: string, _body: string, _btn: string, _sections: any, options: any) => {
            listTitle = options?.title || "";
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        const res = await handleAgendaCreationFlow(
          {} as any,
          mockClient,
          "5511999998888",
          mockContext,
          "agenda_waiting_time",
          "voltar",
          undefined,
          { dateIso: "2026-10-15", dateDisplay: "15/10", subType: "patient", time: "14:00" }
        );

        expect(res.handled).toBe(true);
        expect(res.nextStep).toBe("agenda_waiting_date");
        expect(res.updatedStateData.time).toBeUndefined();
        expect(listTitle).toBe("Data do Agendamento");
        // Must NOT output validation error for time
        expect(sentTexts.some((t) => t.includes("Horário inválido"))).toBe(false);
      });

      it("typing 'voltar' at date selection step (agenda_waiting_date) returns to appointment type menu", async () => {
        let listTitle = "";
        const mockClient = {
          sendListMessage: vi.fn(async (_phone: string, _body: string, _btn: string, _sections: any, options: any) => {
            listTitle = options?.title || "";
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        const res = await handleAgendaCreationFlow(
          {} as any,
          mockClient,
          "5511999998888",
          mockContext,
          "agenda_waiting_date",
          "voltar",
          undefined,
          { dateIso: "2026-10-15", subType: "event", title: "Reunião Clínica" }
        );

        expect(res.handled).toBe(true);
        expect(res.nextStep).toBe("agenda_select_type");
        expect(res.updatedStateData.dateIso).toBeUndefined();
        expect(listTitle).toBe("Novo Agendamento");
      });

      it("typing 'voltar' at patient CPF step (agenda_waiting_patient_cpf) returns to agenda submenu", async () => {
        let listTitle = "";
        const mockClient = {
          sendListMessage: vi.fn(async (_phone: string, _body: string, _btn: string, _sections: any, options: any) => {
            listTitle = options?.title || "";
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        const res = await handleAgendaCreationFlow(
          {} as any,
          mockClient,
          "5511999998888",
          mockContext,
          "agenda_waiting_patient_cpf",
          "voltar",
          undefined,
          { subType: "patient" }
        );

        expect(res.handled).toBe(true);
        expect(res.nextStep).toBe("initial");
        expect(res.updatedStateData).toEqual({});
        expect(listTitle).toBe("Agenda & Atendimentos");
      });
    });

    describe("Pre-Registration Flow - Escape, Cancel and Back Navigation", () => {
      it("typing 'cancelar' in any pre-registration step cancels flow and returns to records menu options", async () => {
        let sentButtonsText = "";
        const mockClient = {
          sendButtonsMessage: vi.fn(async (_phone: string, text: string) => {
            sentButtonsText = text;
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        const res = await handleQuickPatientPreRegistrationFlow(
          {} as any,
          mockClient,
          "5511999998888",
          mockContext,
          "precad_waiting_birthdate",
          "cancelar",
          "",
          { patientName: "Carlos Antônio" }
        );

        expect(res.handled).toBe(true);
        expect(res.nextStep).toBe("initial");
        expect(res.updatedStateData).toEqual({});
        expect(sentButtonsText).toContain("cancelado");
      });

      it("typing 'voltar' at birthdate step (precad_waiting_birthdate) returns to asking patient name", async () => {
        const sentTexts: string[] = [];
        const mockClient = {
          sendTextMessage: vi.fn(async (_phone: string, text: string) => {
            sentTexts.push(text);
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        const res = await handleQuickPatientPreRegistrationFlow(
          {} as any,
          mockClient,
          "5511999998888",
          mockContext,
          "precad_waiting_birthdate",
          "voltar",
          "",
          { patientName: "Beatriz Miranda" }
        );

        expect(res.handled).toBe(true);
        expect(res.nextStep).toBe("precad_waiting_name");
        expect(sentTexts[0]).toContain("Nome Completo");
        expect(sentTexts.some((t) => t.includes("Data inválida"))).toBe(false);
      });

      it("typing 'voltar' at phone step (precad_waiting_phone) returns to document step", async () => {
        const sentTexts: string[] = [];
        const mockClient = {
          sendTextMessage: vi.fn(async (_phone: string, text: string) => {
            sentTexts.push(text);
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        // Caso Adulto
        const resAdult = await handleQuickPatientPreRegistrationFlow(
          {} as any,
          mockClient,
          "5511999998888",
          mockContext,
          "precad_waiting_phone",
          "voltar",
          "",
          { patientName: "Beatriz Miranda", isMinor: false, documentType: "CPF" }
        );

        expect(resAdult.handled).toBe(true);
        expect(resAdult.nextStep).toBe("precad_waiting_doc_number");
        expect(sentTexts[0]).toContain("Número do CPF");

        // Caso Menor de Idade
        const resMinor = await handleQuickPatientPreRegistrationFlow(
          {} as any,
          mockClient,
          "5511999998888",
          mockContext,
          "precad_waiting_phone",
          "voltar",
          "",
          { patientName: "Pedro Miranda", isMinor: true }
        );

        expect(resMinor.handled).toBe(true);
        expect(resMinor.nextStep).toBe("precad_waiting_minor_parent_cpf");
        expect(sentTexts[1]).toContain("CPF do Responsável Legal");
      });

      it("typing 'voltar' at email step (precad_waiting_email) returns to phone step", async () => {
        const sentTexts: string[] = [];
        const mockClient = {
          sendTextMessage: vi.fn(async (_phone: string, text: string) => {
            sentTexts.push(text);
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        const res = await handleQuickPatientPreRegistrationFlow(
          {} as any,
          mockClient,
          "5511999998888",
          mockContext,
          "precad_waiting_email",
          "voltar",
          "",
          { patientName: "Beatriz Miranda", phone: "11988887777" }
        );

        expect(res.handled).toBe(true);
        expect(res.nextStep).toBe("precad_waiting_phone");
        expect(sentTexts[0]).toContain("Telefone/WhatsApp");
        expect(sentTexts.some((t) => t.includes("E-mail em formato inválido"))).toBe(false);
      });
    });

    describe("Button Protection Against Text Interception", () => {
      it("guarantees real button clicks (btn_menu_agenda, agenda_new_patient, etc.) are processed without being intercepted as cancel/back", async () => {
        const sentTexts: string[] = [];
        const mockClient = {
          sendTextMessage: vi.fn(async (_phone: string, text: string) => {
            sentTexts.push(text);
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        // Even if userText contains 'voltar' or 'cancelar' along with button payload, button click has priority
        const res = await handleAgendaCreationFlow(
          {} as any,
          mockClient,
          "5511999998888",
          mockContext,
          "initial",
          "voltar",
          "agenda_new_patient",
          {}
        );

        expect(res.handled).toBe(true);
        expect(res.nextStep).toBe("agenda_waiting_patient_cpf");
        expect(sentTexts[0]).toContain("CPF do Paciente");
      });

      it("guarantees document selection buttons in pre-registration advance properly without being blocked", async () => {
        const sentTexts: string[] = [];
        const mockClient = {
          sendTextMessage: vi.fn(async (_phone: string, text: string) => {
            sentTexts.push(text);
            return { success: true };
          }),
        } as unknown as WhatsAppClient;

        const res = await handleQuickPatientPreRegistrationFlow(
          {} as any,
          mockClient,
          "5511999998888",
          mockContext,
          "precad_waiting_doc_type",
          "cancelar",
          "precad_doc_rg",
          { patientName: "Mariana Souza", isMinor: false }
        );

        expect(res.handled).toBe(true);
        expect(res.nextStep).toBe("precad_waiting_doc_number");
        expect(res.updatedStateData.documentType).toBe("RG");
        expect(sentTexts[0]).toContain("Número do RG");
      });
    });
  });
});


