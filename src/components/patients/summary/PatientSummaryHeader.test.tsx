import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PatientSummaryHeader } from "./PatientSummaryHeader";
import type { Database } from "@/integrations/supabase/types";

// Mock dropdown menu for jsdom execution
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    onSelect,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    onSelect?: (e: any) => void;
    disabled?: boolean;
  }) => (
    <button
      role="menuitem"
      onClick={
        disabled
          ? undefined
          : (e) => {
              if (onSelect) {
                onSelect(e);
              }
              if (onClick) {
                onClick();
              }
            }
      }
      disabled={disabled}
    >
      {children}
    </button>
  ),
}));

type Patient = Database["public"]["Tables"]["patients"]["Row"];

const mockPatient: Patient = {
  id: "patient-123",
  user_id: "user-123",
  name: "Maria Silva",
  patient_code: "PAC-001",
  age: 32,
  phone: "11987654321",
  status: "active",
  registration_complete: true,
  guardian_consent: null,
  responsible_name: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
} as unknown as Patient;

describe("PatientSummaryHeader - Efficiency & Double-Firing Audit", () => {
  it("calls onPrint exactly ONCE when print item is selected (prevents double-firing)", () => {
    const onPrint = vi.fn();
    const onExportJson = vi.fn();

    render(
      <PatientSummaryHeader
        patient={mockPatient}
        riskFlagsCount={0}
        canPrint={true}
        onBack={vi.fn()}
        onDashboard={vi.fn()}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onPrint={onPrint}
        onExportJson={onExportJson}
      />
    );

    // Select print option
    const printItem = screen.getByText(/imprimir cadastro \(pdf\)/i);
    fireEvent.click(printItem);

    // Verification: onPrint must be called exactly 1 time, not twice!
    expect(onPrint).toHaveBeenCalledTimes(1);
  });

  it("calls onExportJson exactly ONCE when export item is selected (prevents double-firing)", () => {
    const onPrint = vi.fn();
    const onExportJson = vi.fn();

    render(
      <PatientSummaryHeader
        patient={mockPatient}
        riskFlagsCount={0}
        canPrint={true}
        onBack={vi.fn()}
        onDashboard={vi.fn()}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onPrint={onPrint}
        onExportJson={onExportJson}
      />
    );

    // Select export JSON option
    const exportItem = screen.getByText(/exportar dados \(json\)/i);
    fireEvent.click(exportItem);

    // Verification: onExportJson must be called exactly 1 time, not twice!
    expect(onExportJson).toHaveBeenCalledTimes(1);
  });

  it("disables print option when canPrint is false", () => {
    const onPrint = vi.fn();

    render(
      <PatientSummaryHeader
        patient={mockPatient}
        riskFlagsCount={0}
        canPrint={false}
        onBack={vi.fn()}
        onDashboard={vi.fn()}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onPrint={onPrint}
        onExportJson={vi.fn()}
      />
    );

    const printItem = screen.getByText(/imprimir cadastro \(pdf\)/i).closest("button");
    expect(printItem).toBeDisabled();

    if (printItem) {
      fireEvent.click(printItem);
    }
    expect(onPrint).not.toHaveBeenCalled();
  });
});
