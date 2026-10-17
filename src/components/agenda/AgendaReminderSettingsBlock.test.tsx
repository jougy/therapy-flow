import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AgendaReminderSettingsBlock,
  DEFAULT_REMINDER_SETTINGS,
  type AgendaReminderSettingsValues,
  type CollaboratorOption,
} from "./AgendaReminderSettingsBlock";

// Mock useAuth
const mockCan = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-123" },
    clinic: { id: "clinic-1", name: "Clínica Vida", subscription_plan: "clinic" },
    clinicId: "clinic-1",
    subscriptionPlan: "clinic",
    can: mockCan,
  }),
}));

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn().mockImplementation((callback) =>
        Promise.resolve(callback({ data: [], error: null }))
      ),
    }),
  },
}));

const mockCollaborators: CollaboratorOption[] = [
  { id: "col-1", full_name: "Dr. Marcelo Santos", job_title: "Fisioterapeuta" },
  { id: "col-2", full_name: "Dra. Beatriz Lima", job_title: "Psicóloga" },
];

describe("AgendaReminderSettingsBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCan.mockImplementation((cap: string) => cap === "schedule.write_others");
  });

  describe("1. Renderização padrão com lembrete no horário ativo", () => {
    it("renderiza com o checkbox 'Lembrar no horário agendado' marcado por padrão", () => {
      render(<AgendaReminderSettingsBlock />);

      const remindCheckbox = screen.getByRole("checkbox", {
        name: /lembrar no horário agendado/i,
      });
      expect(remindCheckbox).toBeInTheDocument();
      expect(remindCheckbox).toBeChecked();
    });

    it("permite desmarcar e remarcar 'Lembrar no horário agendado'", () => {
      const onChange = vi.fn();
      render(
        <AgendaReminderSettingsBlock
          values={DEFAULT_REMINDER_SETTINGS}
          onChange={onChange}
        />
      );

      const remindCheckbox = screen.getByRole("checkbox", {
        name: /lembrar no horário agendado/i,
      });
      fireEvent.click(remindCheckbox);

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          remindAtEvent: false,
        })
      );
    });

    it("renderiza chips de opções de lembretes adicionais inativos por padrão", () => {
      render(<AgendaReminderSettingsBlock />);

      expect(screen.getByRole("button", { name: /15 min antes/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /30 min antes/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /1h antes/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /1 dia antes/i })).toBeInTheDocument();

      // Nenhum chip ativo por padrão
      expect(screen.queryByText("Ativos:")).not.toBeInTheDocument();
    });
  });

  describe("2. Adição e remoção de lembretes adicionais", () => {
    it("adiciona lembretes adicionais ao clicar nos chips", () => {
      const onChange = vi.fn();
      render(
        <AgendaReminderSettingsBlock
          values={DEFAULT_REMINDER_SETTINGS}
          onChange={onChange}
        />
      );

      const chip15 = screen.getByRole("button", { name: /15 min antes/i });
      fireEvent.click(chip15);

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          additionalReminders: [15],
        })
      );
    });

    it("adiciona múltiplos lembretes ordenados", () => {
      const onChange = vi.fn();
      const initialValues: AgendaReminderSettingsValues = {
        ...DEFAULT_REMINDER_SETTINGS,
        additionalReminders: [15],
      };

      render(
        <AgendaReminderSettingsBlock
          values={initialValues}
          onChange={onChange}
        />
      );

      const chip60 = screen.getByRole("button", { name: /1h antes/i });
      fireEvent.click(chip60);

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          additionalReminders: [15, 60],
        })
      );
    });

    it("remove um lembrete ao clicar novamente no chip", () => {
      const onChange = vi.fn();
      const initialValues: AgendaReminderSettingsValues = {
        ...DEFAULT_REMINDER_SETTINGS,
        additionalReminders: [15, 30],
      };

      render(
        <AgendaReminderSettingsBlock
          values={initialValues}
          onChange={onChange}
        />
      );

      // Clica no chip de 15 min antes que já está ativo
      const chip15 = screen.getByRole("button", { name: "15 min antes" });
      fireEvent.click(chip15);

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          additionalReminders: [30],
        })
      );
    });

    it("remove um lembrete através do botão X na lista de ativos", () => {
      const onChange = vi.fn();
      const initialValues: AgendaReminderSettingsValues = {
        ...DEFAULT_REMINDER_SETTINGS,
        additionalReminders: [30, 1440],
      };

      render(
        <AgendaReminderSettingsBlock
          values={initialValues}
          onChange={onChange}
        />
      );

      const removeBtn30 = screen.getByRole("button", { name: "Remover lembrete 30 min antes" });
      fireEvent.click(removeBtn30);

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          additionalReminders: [1440],
        })
      );
    });
  });

  describe("3. Checkboxes de WhatsApp (equipe e paciente)", () => {
    it("exibe 'Notificar equipe por WhatsApp' quando a clínica opera com equipe (não-solo)", () => {
      const onChange = vi.fn();
      render(
        <AgendaReminderSettingsBlock
          isSolo={false}
          values={DEFAULT_REMINDER_SETTINGS}
          onChange={onChange}
        />
      );

      const teamCheckbox = screen.getByRole("checkbox", {
        name: /notificar equipe por whatsapp/i,
      });
      expect(teamCheckbox).toBeInTheDocument();
      expect(teamCheckbox).not.toBeChecked();

      fireEvent.click(teamCheckbox);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          notifyTeam: true,
        })
      );
    });

    it("exibe 'No meu WhatsApp' quando a clínica opera em modo solo", () => {
      const onChange = vi.fn();
      render(
        <AgendaReminderSettingsBlock
          isSolo={true}
          values={DEFAULT_REMINDER_SETTINGS}
          onChange={onChange}
        />
      );

      expect(screen.queryByText(/notificar equipe por whatsapp/i)).not.toBeInTheDocument();

      const soloCheckbox = screen.getByRole("checkbox", {
        name: /no meu whatsapp/i,
      });
      expect(soloCheckbox).toBeInTheDocument();
      expect(soloCheckbox).not.toBeChecked();

      fireEvent.click(soloCheckbox);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          notifyTeam: true,
        })
      );
    });

    it("permite marcar e desmarcar 'Notificar o paciente por WhatsApp e E-mail'", () => {
      const onChange = vi.fn();
      render(
        <AgendaReminderSettingsBlock
          values={DEFAULT_REMINDER_SETTINGS}
          onChange={onChange}
          patientName="Clarice Lispector"
        />
      );

      const patientCheckbox = screen.getByRole("checkbox", {
        name: /notificar o paciente por whatsapp e e-mail/i,
      });
      expect(patientCheckbox).toBeInTheDocument();
      expect(patientCheckbox).not.toBeChecked();

      // Valida o nome do paciente no texto de suporte
      expect(screen.getByText(/clarice lispector/i)).toBeInTheDocument();

      fireEvent.click(patientCheckbox);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          notifyPatient: true,
        })
      );
    });
  });

  describe("4. Condição RBAC com can('schedule.write_others') para seletor de colaboradores", () => {
    it("exibe lista de colaboradores quando o usuário tem permissão schedule.write_others", () => {
      const onChange = vi.fn();
      render(
        <AgendaReminderSettingsBlock
          isSolo={false}
          canWriteOthers={true}
          collaborators={mockCollaborators}
          values={DEFAULT_REMINDER_SETTINGS}
          onChange={onChange}
        />
      );

      expect(screen.getByTestId("collaborators-selector")).toBeInTheDocument();
      expect(screen.getByText("Dr. Marcelo Santos")).toBeInTheDocument();
      expect(screen.getByText("Dra. Beatriz Lima")).toBeInTheDocument();
      expect(screen.queryByTestId("collaborators-permission-notice")).not.toBeInTheDocument();

      // Clicar em um colaborador para selecioná-lo
      const marceloCheckbox = screen.getByRole("checkbox", {
        name: /dr\. marcelo santos/i,
      });
      expect(marceloCheckbox).not.toBeChecked();

      fireEvent.click(marceloCheckbox);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          notifiedColleagueIds: ["col-1"],
        })
      );
    });

    it("permite desmarcar um colaborador selecionado", () => {
      const onChange = vi.fn();
      const initialValues: AgendaReminderSettingsValues = {
        ...DEFAULT_REMINDER_SETTINGS,
        notifiedColleagueIds: ["col-1", "col-2"],
      };

      render(
        <AgendaReminderSettingsBlock
          isSolo={false}
          canWriteOthers={true}
          collaborators={mockCollaborators}
          values={initialValues}
          onChange={onChange}
        />
      );

      const marceloCheckbox = screen.getByRole("checkbox", {
        name: /dr\. marcelo santos/i,
      });
      expect(marceloCheckbox).toBeChecked();

      fireEvent.click(marceloCheckbox);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          notifiedColleagueIds: ["col-2"],
        })
      );
    });

    it("não exibe o seletor e mostra aviso explicativo quando o usuário NÃO tem schedule.write_others", () => {
      render(
        <AgendaReminderSettingsBlock
          isSolo={false}
          canWriteOthers={false}
          collaborators={mockCollaborators}
          values={DEFAULT_REMINDER_SETTINGS}
        />
      );

      expect(screen.queryByTestId("collaborators-selector")).not.toBeInTheDocument();
      expect(screen.getByTestId("collaborators-permission-notice")).toBeInTheDocument();
      expect(screen.getByText(/schedule\.write_others/i)).toBeInTheDocument();
      expect(screen.queryByText("Dr. Marcelo Santos")).not.toBeInTheDocument();
    });

    it("avalia can('schedule.write_others') via useAuth se prop não for fornecida", () => {
      mockCan.mockReturnValue(false);

      render(
        <AgendaReminderSettingsBlock
          isSolo={false}
          collaborators={mockCollaborators}
          values={DEFAULT_REMINDER_SETTINGS}
        />
      );

      expect(mockCan).toHaveBeenCalledWith("schedule.write_others");
      expect(screen.getByTestId("collaborators-permission-notice")).toBeInTheDocument();
      expect(screen.queryByTestId("collaborators-selector")).not.toBeInTheDocument();
    });

    it("não exibe o seletor nem o aviso de permissão quando a clínica é solo", () => {
      render(
        <AgendaReminderSettingsBlock
          isSolo={true}
          canWriteOthers={true}
          collaborators={mockCollaborators}
          values={DEFAULT_REMINDER_SETTINGS}
        />
      );

      expect(screen.queryByTestId("collaborators-selector")).not.toBeInTheDocument();
      expect(screen.queryByTestId("collaborators-permission-notice")).not.toBeInTheDocument();
      expect(screen.queryByText(/colaboradores a notificar/i)).not.toBeInTheDocument();
    });
  });
});
