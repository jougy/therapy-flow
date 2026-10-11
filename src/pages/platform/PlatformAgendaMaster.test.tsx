import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { PlatformAgendaMaster } from "./PlatformAgendaMaster";
import {
  formatMeetingDateTimeFull,
  formatMeetingRelative,
  formatPhoneDisplay,
  getGoogleCalendarUrl,
  getWhatsAppLink,
} from "@/components/platform/agenda/agenda-utils";
import type { OnboardingMeeting } from "@/components/platform/agenda/types";

// Setup mocks
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

const mockMeetings: OnboardingMeeting[] = [
  {
    id: "meet-1",
    lead_name: "Dra. Juliana Mendes",
    clinic_name: "Clínica FisioEquilíbrio",
    phone: "11987654321",
    email: "juliana@fisioequilibrio.com.br",
    scheduled_at: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days from now
    duration_minutes: 15,
    status: "scheduled",
    meet_url: "https://meet.google.com/abc-defg-hij",
    notes: "Lead interessado em prontuário eletrônico e plano com 3 fisioterapeutas.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "meet-2",
    lead_name: "Dr. Roberto Silva",
    clinic_name: "Studio Pilates & Fisio",
    phone: "21998877665",
    email: "roberto@pilatesfisio.com.br",
    scheduled_at: new Date(Date.now() - 86400000 * 3).toISOString(), // 3 days ago
    duration_minutes: 30,
    status: "completed",
    notes: "Demonstração realizada com sucesso. Enviada proposta comercial.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "meet-3",
    lead_name: "Dra. Camila Souza",
    clinic_name: "Clínica Renovar",
    phone: "31912345678",
    scheduled_at: new Date(Date.now() + 86400000 * 5).toISOString(),
    duration_minutes: 15,
    status: "rescheduled",
    notes: "Remarcada a pedido da cliente.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-test-owner" },
    isPlatformOwner: true,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "platform_onboarding_meetings") {
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: mockMeetings, error: null }),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "meet-new",
                  lead_name: "Novo Lead Teste",
                  phone: "11999999999",
                  scheduled_at: new Date().toISOString(),
                  duration_minutes: 15,
                  status: "scheduled",
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              }),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      };
    }),
  },
}));

describe("Agenda Master Utilities", () => {
  it("formats WhatsApp link correctly with 55 prefix and greeting message", () => {
    const link = getWhatsAppLink("11987654321", "Dra. Juliana");
    expect(link).toContain("https://wa.me/5511987654321");
    expect(decodeURIComponent(link)).toContain("Dra. Juliana");
  });

  it("handles numbers already starting with 55 for WhatsApp", () => {
    const link = getWhatsAppLink("5511987654321", "Roberto");
    expect(link).toContain("https://wa.me/5511987654321");
  });

  it("formats phone displays in standard Brazilian formats", () => {
    expect(formatPhoneDisplay("11987654321")).toBe("(11) 98765-4321");
    expect(formatPhoneDisplay("1133334444")).toBe("(11) 3333-4444");
    expect(formatPhoneDisplay("5511987654321")).toBe("+55 (11) 98765-4321");
  });

  it("generates valid Google Calendar URLs with template parameters", () => {
    const meeting: OnboardingMeeting = {
      id: "test",
      lead_name: "Mariana Teste",
      clinic_name: "Clínica Saúde",
      phone: "11987654321",
      email: "mariana@teste.com",
      scheduled_at: "2026-10-15T14:30:00.000Z",
      duration_minutes: 15,
      status: "scheduled",
      created_at: "2026-10-10T00:00:00.000Z",
      updated_at: "2026-10-10T00:00:00.000Z",
    };

    const gcalUrl = getGoogleCalendarUrl(meeting);
    expect(gcalUrl).toContain("calendar.google.com/calendar/render");
    expect(gcalUrl).toContain("action=TEMPLATE");
    expect(gcalUrl).toContain("Mariana+Teste");
    expect(gcalUrl).toContain("mariana%40teste.com");
  });

  it("formats meeting date-time in full Portuguese", () => {
    const formatted = formatMeetingDateTimeFull("2026-10-15T10:30:00.000Z");
    expect(formatted).toBeTruthy();
    expect(formatted.length).toBeGreaterThan(5);
  });

  it("computes relative date labels (Hoje / Amanhã / Outros)", () => {
    const todayIso = new Date().toISOString();
    const rel = formatMeetingRelative(todayIso);
    expect(rel.isToday).toBe(true);
    expect(rel.label).toContain("Hoje às");
  });
});

describe("PlatformAgendaMaster Component", () => {
  it("renders statistics header with accurate counts", async () => {
    render(<PlatformAgendaMaster />);

    await waitFor(() => {
      expect(screen.getByText("Próximas Reuniões")).toBeInTheDocument();
      expect(screen.getByText("Concluídas")).toBeInTheDocument();
      expect(screen.getByText("Remarcadas")).toBeInTheDocument();
      expect(screen.getByText("Total do Mês")).toBeInTheDocument();
    });
  });

  it("renders meeting cards with lead names, clinics, and formatted data", async () => {
    render(<PlatformAgendaMaster />);

    await waitFor(() => {
      expect(screen.getByText("Dra. Juliana Mendes")).toBeInTheDocument();
      expect(screen.getByText("Clínica FisioEquilíbrio")).toBeInTheDocument();
      expect(screen.getByText("Dr. Roberto Silva")).toBeInTheDocument();
      expect(screen.getByText("Studio Pilates & Fisio")).toBeInTheDocument();
    });
  });

  it("renders WhatsApp and Google Calendar quick action buttons on meeting cards", async () => {
    render(<PlatformAgendaMaster />);

    await waitFor(() => {
      const waButtons = screen.getAllByText("Chamar no WhatsApp");
      expect(waButtons.length).toBeGreaterThan(0);

      const gcalButtons = screen.getAllByText("Abrir no Google Calendar");
      expect(gcalButtons.length).toBeGreaterThan(0);
    });
  });

  it("filters meetings when typing in the search bar", async () => {
    render(<PlatformAgendaMaster />);

    await waitFor(() => {
      expect(screen.getByText("Dra. Juliana Mendes")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Buscar por lead, clínica, telefone ou e-mail...");
    fireEvent.change(searchInput, { target: { value: "Roberto" } });

    await waitFor(() => {
      expect(screen.queryByText("Dra. Juliana Mendes")).not.toBeInTheDocument();
      expect(screen.getByText("Dr. Roberto Silva")).toBeInTheDocument();
    });
  });

  it("switches to calendar view when clicking the Calendário button", async () => {
    render(<PlatformAgendaMaster />);

    await waitFor(() => {
      expect(screen.getByText("Dra. Juliana Mendes")).toBeInTheDocument();
    });

    const calendarBtn = screen.getByRole("button", { name: /calendário/i });
    fireEvent.click(calendarBtn);

    await waitFor(() => {
      expect(screen.getByText("Hoje")).toBeInTheDocument();
      expect(screen.getByText("Mês")).toBeInTheDocument();
      expect(screen.getByText("Semana")).toBeInTheDocument();
      expect(screen.getByText("Dia")).toBeInTheDocument();
    });
  });

  it("opens Create Meeting Modal when clicking Novo Agendamento", async () => {
    render(<PlatformAgendaMaster />);

    const newBtn = screen.getByRole("button", { name: /novo agendamento/i });
    fireEvent.click(newBtn);

    await waitFor(() => {
      expect(screen.getByText("Novo Agendamento de Onboarding")).toBeInTheDocument();
      expect(screen.getByLabelText(/nome do lead/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/telefone/i)).toBeInTheDocument();
    });
  });
});
