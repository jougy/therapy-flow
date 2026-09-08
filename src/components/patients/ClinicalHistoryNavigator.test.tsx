import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  ClinicalHistoryNavigator,
  type ClinicalHistoryVersion,
} from "@/components/patients/ClinicalHistoryNavigator";

const emptySnapshotState = {
  allergies: "",
  blood_type: "",
  chronic_conditions: "",
  clinical_notes: "",
  continuous_medications: "",
  surgeries: "",
  clinical_alerts: "",
  congenital_genetic_conditions: "",
  diagnoses: "Depressão maior",
  falls_history: "",
  family_history: "",
  functional_independence: "",
  implants_devices: "",
  mobility_aids: "",
  substance_use_history: "",
};

describe("ClinicalHistoryNavigator Component", () => {
  it("renders empty state when versions list is empty", () => {
    render(
      <ClinicalHistoryNavigator
        currentIndex={0}
        onChangeIndex={vi.fn()}
        versions={[]}
      />
    );

    expect(screen.getByText("Nenhuma revisão registrada")).toBeInTheDocument();
    expect(screen.getByText(/Não constam alterações arquivadas/i)).toBeInTheDocument();
  });

  it("renders initial single version badge when versions length is 1", () => {
    const versions: ClinicalHistoryVersion[] = [
      {
        id: "current",
        date: "2026-03-01T10:00:00Z",
        isCurrent: true,
        state: emptySnapshotState,
        changedFields: [],
      },
    ];

    render(
      <ClinicalHistoryNavigator
        currentIndex={0}
        onChangeIndex={vi.fn()}
        versions={versions}
      />
    );

    expect(screen.getByText("Registro inicial sem revisões anteriores")).toBeInTheDocument();
    expect(screen.getByText("Versão Atual em Produção")).toBeInTheDocument();
  });

  it("handles navigation between versions and safe index clamping", () => {
    const onChangeIndex = vi.fn();
    const versions: ClinicalHistoryVersion[] = [
      {
        id: "current",
        date: "2026-03-01T10:00:00Z",
        isCurrent: true,
        state: emptySnapshotState,
        changedFields: [],
      },
      {
        id: "rev-1",
        date: "2026-02-01T10:00:00Z",
        isCurrent: false,
        authorLabel: "Dr. Roberto",
        note: "Ajuste na dosagem",
        state: { ...emptySnapshotState, diagnoses: "Ansiedade generalizada" },
        changedFields: ["diagnoses"],
      },
    ];

    const { rerender } = render(
      <ClinicalHistoryNavigator
        currentIndex={0}
        onChangeIndex={onChangeIndex}
        versions={versions}
      />
    );

    // Na versão atual (índice 0), botão 'mais recente' está desabilitado
    const nextBtn = screen.getByRole("button", { name: /ver revisão mais recente/i });
    expect(nextBtn).toBeDisabled();

    // Botão 'anterior' está habilitado
    const prevBtn = screen.getByRole("button", { name: /ver revisão anterior/i });
    expect(prevBtn).not.toBeDisabled();
    fireEvent.click(prevBtn);
    expect(onChangeIndex).toHaveBeenCalledWith(1);

    // Rerenderiza na revisão 1
    rerender(
      <ClinicalHistoryNavigator
        currentIndex={1}
        onChangeIndex={onChangeIndex}
        versions={versions}
      />
    );

    expect(screen.getByText("Dr. Roberto")).toBeInTheDocument();
    expect(screen.getByText("Ajuste na dosagem")).toBeInTheDocument();
    expect(screen.getByText("Modificado")).toBeInTheDocument();
  });
});
