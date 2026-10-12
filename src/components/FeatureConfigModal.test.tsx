import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureConfigModal } from "@/components/FeatureConfigModal";

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: supabaseMocks.from,
    rpc: supabaseMocks.rpc,
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

describe("FeatureConfigModal - Assinaturas", () => {
  beforeEach(() => {
    supabaseMocks.from.mockReset();
    supabaseMocks.rpc.mockReset();

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    supabaseMocks.from.mockReturnValue({
      select: mockSelect,
    });
  });

  it("renders subscription_module official pricing matrix and Asaas environment switcher", async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });

    const onSave = vi.fn();
    render(
      <FeatureConfigModal
        featureKey="subscriptions_module"
        isOpen={true}
        onClose={vi.fn()}
        onSave={onSave}
        initialData={{ asaas_environment: "production" }}
      />
    );

    expect(screen.getByText(/Ambiente do Gateway Asaas: Oficial \(Produção\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Tabela de Preços e Ciclos Oficiais/i)).toBeInTheDocument();
    expect(screen.getByText(/Grupo 1: Planos Profissionais/i)).toBeInTheDocument();
    expect(screen.getByText(/Grupo 2: Planos para Clínicas & Equipes/i)).toBeInTheDocument();
    expect(screen.getByText(/Profissional Básico/i)).toBeInTheDocument();
    expect(screen.getByText(/Clínica Básico/i)).toBeInTheDocument();
    expect(screen.getByText(/Ambiente Seguro & Proteção de Credenciais/i)).toBeInTheDocument();
    expect(screen.getByText(/ASAAS_API_KEY/i)).toBeInTheDocument();
    expect(screen.getAllByText(/R\$ 57,00/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/R\$ 147,00/i).length).toBeGreaterThan(0);

    // Toggle to sandbox
    const sandboxCard = screen.getByText(/🟡 Sandbox \(Testes\)/i);
    fireEvent.click(sandboxCard);

    expect(screen.getByText(/Ambiente do Gateway Asaas: Sandbox \(Testes\)/i)).toBeInTheDocument();

    const saveBtn = screen.getByRole("button", { name: /Salvar configurações/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(supabaseMocks.rpc).toHaveBeenCalledWith("upsert_feature_flag", expect.objectContaining({
        _key: "subscriptions_module",
        _value: expect.objectContaining({
          asaas_environment: "sandbox",
        }),
      }));
      expect(onSave).toHaveBeenCalled();
    });
  });

  it("renders subscription_free_trial_enabled config and allows customizing duration and max sessions", async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });

    const onSave = vi.fn();
    render(
      <FeatureConfigModal
        featureKey="subscription_free_trial_enabled"
        isOpen={true}
        onClose={vi.fn()}
        onSave={onSave}
        initialData={{ trialDurationDays: 14, trialMaxSessions: 10 }}
      />
    );

    expect(screen.getByText(/Teste Gratuito \(7 dias\) \(Trial Volumétrico \/ Free Tier\)/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("14")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10")).toBeInTheDocument();

    const saveBtn = screen.getByRole("button", { name: /Salvar configurações/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(supabaseMocks.rpc).toHaveBeenCalledWith("upsert_feature_flag", expect.objectContaining({
        _key: "subscription_free_trial_enabled",
        _value: expect.objectContaining({
          trialDurationDays: 14,
          trialMaxSessions: 10,
        }),
      }));
      expect(onSave).toHaveBeenCalled();
    });
  });

  it("renders subscription_payment_methods config with PIX, card and boleto controls", async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });

    const onSave = vi.fn();
    render(
      <FeatureConfigModal
        featureKey="subscription_payment_methods"
        isOpen={true}
        onClose={vi.fn()}
        onSave={onSave}
        initialData={{ allowPix: true, allowCreditCard: true, allowBoleto: false, pixDiscountPercent: 5 }}
      />
    );

    expect(screen.getByText(/Métodos de Pagamento Habilitados/i)).toBeInTheDocument();
    expect(screen.getByText(/PIX Instantâneo/i)).toBeInTheDocument();
    expect(screen.getByText(/Cartão de Crédito/i)).toBeInTheDocument();
    expect(screen.getByText(/Boleto Bancário/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("5")).toBeInTheDocument();

    const saveBtn = screen.getByRole("button", { name: /Salvar configurações/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(supabaseMocks.rpc).toHaveBeenCalledWith("upsert_feature_flag", expect.objectContaining({
        _key: "subscription_payment_methods",
      }));
    });
  });

  it("renders subscription_coupons_enabled config with discount policies", async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });

    render(
      <FeatureConfigModal
        featureKey="subscription_coupons_enabled"
        isOpen={true}
        onClose={vi.fn()}
        initialData={{ showCouponInCheckout: true, allowCumulativePix: true }}
      />
    );

    expect(screen.getByText(/Políticas de Cupons Promocionais/i)).toBeInTheDocument();
    expect(screen.getByText(/Habilitar Campo de Cupom no Checkout/i)).toBeInTheDocument();
    expect(screen.getByText(/Acumular Cupom com Desconto PIX \(5%\)/i)).toBeInTheDocument();
  });

  it("renders FormEditorConfigModal when featureKey is forms_editor", () => {
    render(
      <FeatureConfigModal
        featureKey="forms_editor"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: /Editor de Formulários/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Componentes/i })).toBeInTheDocument();
  });

  it("renders clinical_portfolio_enabled configuration correctly", async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });

    const onSave = vi.fn();
    render(
      <FeatureConfigModal
        featureKey="clinical_portfolio_enabled"
        isOpen={true}
        onClose={vi.fn()}
        onSave={onSave}
        initialData={{
          show_lgpd_banner: true,
          allow_clinic_filter: true,
          allow_clinic_redirect: false,
          maintenance_message: "Sistema em manutenção programada",
        }}
      />
    );

    expect(screen.getAllByText(/Portfólio Clínico Profissional \(Acervo Pessoal\)/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Banner de Conformidade LGPD/i)).toBeInTheDocument();
    expect(screen.getByText(/Busca e Filtragem por Clínica/i)).toBeInTheDocument();
    expect(screen.getByText(/Atalho de Redirecionamento para Prontuário/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Sistema em manutenção programada")).toBeInTheDocument();

    const saveBtn = screen.getByRole("button", { name: /Salvar configurações/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(supabaseMocks.rpc).toHaveBeenCalledWith("upsert_feature_flag", expect.objectContaining({
        _key: "clinical_portfolio_enabled",
        _value: expect.objectContaining({
          show_lgpd_banner: true,
          allow_clinic_filter: true,
          allow_clinic_redirect: false,
          maintenance_message: "Sistema em manutenção programada",
        }),
      }));
      expect(onSave).toHaveBeenCalled();
    });
  });

  describe("Novas Feature Flags - Notificações", () => {
    it("renders and saves whatsapp_flows_enabled configuration", async () => {
      supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });
      const onSave = vi.fn();

      render(
        <FeatureConfigModal
          featureKey="whatsapp_flows_enabled"
          isOpen={true}
          onClose={vi.fn()}
          onSave={onSave}
          initialData={{
            enabled: true,
            flow_id: "987654321098765",
            fallback_to_chat: true,
            mode: "draft",
          }}
        />
      );

      expect(screen.getAllByText(/WhatsApp Flows \(Formulários Nativos Deslizantes\)/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByLabelText(/Ativação Geral do WhatsApp Flows/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Meta Flow ID/i)).toHaveValue("987654321098765");
      expect(screen.getByText(/Onde encontrar:/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Fallback Automático para Chat Conversacional/i)).toBeInTheDocument();
      expect(screen.getByText(/Especificação JSON do Flow/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Copiar JSON/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Baixar .json/i })).toBeInTheDocument();

      // Alterar Flow ID
      const flowIdInput = screen.getByLabelText(/Meta Flow ID/i);
      fireEvent.change(flowIdInput, { target: { value: "112233445566778" } });

      const saveBtn = screen.getByRole("button", { name: /Salvar configurações/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(supabaseMocks.rpc).toHaveBeenCalledWith("upsert_feature_flag", expect.objectContaining({
          _key: "whatsapp_flows_enabled",
          _value: expect.objectContaining({
            flow_id: "112233445566778",
            enabled: true,
            fallback_to_chat: true,
            mode: "draft",
          }),
        }));
        expect(onSave).toHaveBeenCalled();
      });
    });

    it("renders and saves notifications_whatsapp_onboarding", async () => {
      supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });
      const onSave = vi.fn();

      render(
        <FeatureConfigModal
          featureKey="notifications_whatsapp_onboarding"
          isOpen={true}
          onClose={vi.fn()}
          onSave={onSave}
          initialData={{
            botPhoneNumber: "5511980113936",
            delaySeconds: 20,
          }}
        />
      );

      expect(screen.getAllByText(/WhatsApp: Boas-Vindas & Onboarding Automático/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByLabelText(/Número do Bot \(Com DDI\)/i)).toHaveValue("5511980113936");
      expect(screen.getByLabelText(/Delay do Disparo \(Segundos\)/i)).toHaveValue(20);
      expect(screen.getByLabelText(/Texto da Mensagem de Boas-Vindas/i)).toBeInTheDocument();

      const saveBtn = screen.getByRole("button", { name: /Salvar configurações/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(supabaseMocks.rpc).toHaveBeenCalledWith("upsert_feature_flag", expect.objectContaining({
          _key: "notifications_whatsapp_onboarding",
          _value: expect.objectContaining({
            botPhoneNumber: "5511980113936",
            delaySeconds: 20,
          }),
        }));
        expect(onSave).toHaveBeenCalled();
      });
    });

    it("renders and saves notifications_whatsapp_transbordo with destination phone 5511980113936", async () => {
      supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });
      const onSave = vi.fn();

      render(
        <FeatureConfigModal
          featureKey="notifications_whatsapp_transbordo"
          isOpen={true}
          onClose={vi.fn()}
          onSave={onSave}
          initialData={{
            destinationPhoneNumber: "5511980113936",
            alertTypes: { suporte: true, novos_agendamentos: true },
          }}
        />
      );

      expect(screen.getAllByText(/Transbordo para Atendimento Comercial Humano/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByLabelText(/Número de Destino do Transbordo Comercial/i)).toHaveValue("5511980113936");
      expect(screen.getByText("Suporte Técnico")).toBeInTheDocument();
      expect(screen.getByText("Novos Agendamentos")).toBeInTheDocument();

      const saveBtn = screen.getByRole("button", { name: /Salvar configurações/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(supabaseMocks.rpc).toHaveBeenCalledWith("upsert_feature_flag", expect.objectContaining({
          _key: "notifications_whatsapp_transbordo",
        }));
        expect(onSave).toHaveBeenCalled();
      });
    });

    it("renders and saves notifications_whatsapp_billing", async () => {
      supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });

      render(
        <FeatureConfigModal
          featureKey="notifications_whatsapp_billing"
          isOpen={true}
          onClose={vi.fn()}
          initialData={{
            systemLoginLink: "https://plurihealth.com.br/login",
          }}
        />
      );

      expect(screen.getAllByText(/WhatsApp: Confirmação de Assinaturas & Upgrade \(Asaas\)/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByLabelText(/Link Direto de Login no Sistema/i)).toHaveValue("https://plurihealth.com.br/login");
      expect(screen.getByLabelText(/Texto de Agradecimento e Boas-Vindas ao Plano/i)).toBeInTheDocument();
    });

    it("renders and saves notifications_telegram_admin with event checkboxes", async () => {
      supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });

      render(
        <FeatureConfigModal
          featureKey="notifications_telegram_admin"
          isOpen={true}
          onClose={vi.fn()}
          initialData={{
            chatId: "-100999999",
          }}
        />
      );

      expect(screen.getAllByText(/Telegram: Alertas em Tempo Real do Administrador/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByLabelText(/Chat ID do Grupo \/ Administrador/i)).toHaveValue("-100999999");
      expect(screen.getByText("Novos Cadastros de Clínicas")).toBeInTheDocument();
      expect(screen.getByText("Pagamentos Confirmados Asaas")).toBeInTheDocument();
    });

    it("renders and saves notifications_patient_reminders", async () => {
      supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });

      render(
        <FeatureConfigModal
          featureKey="notifications_patient_reminders"
          isOpen={true}
          onClose={vi.fn()}
          initialData={{
            remind24hBefore: true,
            remind2hBefore: true,
          }}
        />
      );

      expect(screen.getAllByText(/Lembretes de Consultas e Atendimentos \(WhatsApp\/SMS\)/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("WhatsApp")).toBeInTheDocument();
      expect(screen.getByText("SMS Direto")).toBeInTheDocument();
      expect(screen.getByText(/Lembrete com 24 Horas de Antecedência/i)).toBeInTheDocument();
      expect(screen.getByText(/Lembrete com 2 Horas de Antecedência/i)).toBeInTheDocument();
    });
  });

  describe("Novas Feature Flags - Agenda", () => {
    it("renders and saves agenda_master_onboarding", async () => {
      supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });

      render(
        <FeatureConfigModal
          featureKey="agenda_master_onboarding"
          isOpen={true}
          onClose={vi.fn()}
          initialData={{
            defaultDurationMinutes: 15,
            meetingRoomUrl: "https://meet.google.com/test",
          }}
        />
      );

      expect(screen.getAllByText(/Agenda Master de Onboarding \(Backoffice\)/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByLabelText(/Duração Padrão das Reuniões \(Minutos\)/i)).toHaveValue(15);
      expect(screen.getByLabelText(/Link da Sala de Reunião Oficial \(Google Meet\)/i)).toHaveValue("https://meet.google.com/test");
    });

    it("renders and saves agenda_whatsapp_booking_flow", async () => {
      supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });

      render(
        <FeatureConfigModal
          featureKey="agenda_whatsapp_booking_flow"
          isOpen={true}
          onClose={vi.fn()}
          initialData={{
            startHour: "09:00",
            endHour: "17:00",
          }}
        />
      );

      expect(screen.getAllByText(/Agendamento Interativo via Bot WhatsApp/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByLabelText(/Horário Inicial de Expediente/i)).toHaveValue("09:00");
      expect(screen.getByLabelText(/Horário Final de Expediente/i)).toHaveValue("17:00");
      expect(screen.getByText("Segunda")).toBeInTheDocument();
      expect(screen.getByText("Sexta")).toBeInTheDocument();
    });

    it("renders and saves agenda_google_calendar_sync", async () => {
      supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });

      render(
        <FeatureConfigModal
          featureKey="agenda_google_calendar_sync"
          isOpen={true}
          onClose={vi.fn()}
          initialData={{
            cacheDurationMinutes: 20,
          }}
        />
      );

      expect(screen.getAllByText(/Sincronização com Google Calendar \(iCal Feed\)/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByLabelText(/URL do Feed iCal \/ Google Calendar/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Duração do Cache Local \(Minutos\)/i)).toHaveValue(20);
    });

    it("renders and saves agenda_smart_blocks_buffers", async () => {
      supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });

      render(
        <FeatureConfigModal
          featureKey="agenda_smart_blocks_buffers"
          isOpen={true}
          onClose={vi.fn()}
          initialData={{
            blockThursdayMorning: true,
            lunchBreakStart: "12:30",
          }}
        />
      );

      expect(screen.getAllByText(/Bloqueios Inteligentes & Margem de Segurança \(Buffers\)/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Bloqueio Especial: Quinta-feira de Manhã \(Reunião Clínica\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Início do Horário de Almoço/i)).toHaveValue("12:30");
    });
  });
});

