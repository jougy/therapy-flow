import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PatientQuickActionsMenu } from "./PatientQuickActionsMenu";
import type { PatientCardData } from "@/components/PatientCard";

const mockPatient: PatientCardData = {
  id: "p1",
  patient_code: "PAC-001",
  name: "Paciente Teste",
  gender: "feminino",
  pronoun: "ela/dela",
  date_of_birth: "1990-01-01",
  cpf: "12345678900",
  status: "ativo",
  lastSessionDate: null,
  groups: [],
};

describe("PatientQuickActionsMenu", () => {
  it("renders all 5 requested options and handles actions", async () => {
    const onSelect = vi.fn();
    const onNewAppointment = vi.fn();
    const onAttendNow = vi.fn();
    const onUpdateStatus = vi.fn();
    const onViewProfile = vi.fn();
    const onOpenChange = vi.fn();

    const { rerender } = render(
      <PatientQuickActionsMenu
        open={true}
        onOpenChange={onOpenChange}
        patient={mockPatient}
        onSelect={onSelect}
        onNewAppointment={onNewAppointment}
        onAttendNow={onAttendNow}
        onUpdateStatus={onUpdateStatus}
        onViewProfile={onViewProfile}
      />,
    );

    expect(screen.getByText("Selecionar")).toBeInTheDocument();
    expect(screen.getByText("Novo agendamento")).toBeInTheDocument();
    expect(screen.getByText("Atender agora")).toBeInTheDocument();
    expect(screen.getByText("Status de atividade")).toBeInTheDocument();
    expect(screen.getByText("Ver cadastro completo")).toBeInTheDocument();

    // 1. Click "Selecionar"
    fireEvent.click(screen.getByText("Selecionar"));
    expect(onSelect).toHaveBeenCalledWith("p1");
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // 2. Click "Novo agendamento"
    rerender(
      <PatientQuickActionsMenu
        open={true}
        onOpenChange={onOpenChange}
        patient={mockPatient}
        onSelect={onSelect}
        onNewAppointment={onNewAppointment}
        onAttendNow={onAttendNow}
        onUpdateStatus={onUpdateStatus}
        onViewProfile={onViewProfile}
      />,
    );
    fireEvent.click(screen.getByText("Novo agendamento"));
    expect(onNewAppointment).toHaveBeenCalledWith(mockPatient);

    // 3. Click "Atender agora"
    fireEvent.click(screen.getByText("Atender agora"));
    expect(onAttendNow).toHaveBeenCalledWith(mockPatient);

    // 4. Click "Ver cadastro completo"
    fireEvent.click(screen.getByText("Ver cadastro completo"));
    expect(onViewProfile).toHaveBeenCalledWith(mockPatient);

    // 5. Click "Status de atividade" -> opens status dialog
    fireEvent.click(screen.getByText("Status de atividade"));
    expect(await screen.findByText("Alterar status do paciente")).toBeInTheDocument();
    expect(screen.getByText("Pausado")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Pausado"));
    await waitFor(() => {
      expect(onUpdateStatus).toHaveBeenCalledWith("p1", "pausado");
    });
  });
});
