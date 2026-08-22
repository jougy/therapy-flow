import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PaymentPlanLab from "../../designlab/PaymentPlanLab";
import { PaymentPlanCollapsible } from "@/components/PaymentPlanCollapsible";
import { useState } from "react";
import { DEFAULT_PAYMENT_PLAN_FORM_VALUES } from "@/lib/payment-plans";

const PaymentPlanCollapsibleWrapper = () => {
  const [values, setValues] = useState({
    ...DEFAULT_PAYMENT_PLAN_FORM_VALUES,
    createPlan: true,
    name: "Pacote 10 Sessões",
    totalSessions: 10,
    totalAmount: "1.500,00",
  });

  return <PaymentPlanCollapsible values={values} onChange={setValues} />;
};

describe("PaymentPlanLab & PaymentPlanCollapsible Component", () => {
  it("renders the PaymentPlanLab page with header, device toggles, and summary cards", () => {
    render(<PaymentPlanLab />);

    expect(screen.getByText("Módulo de Planos de Pagamento")).toBeInTheDocument();
    expect(screen.getByText("DesignLab")).toBeInTheDocument();
    expect(screen.getByText("Desktop")).toBeInTheDocument();
    expect(screen.getByText(/Mobile \(375px\)/i)).toBeInTheDocument();
    expect(screen.getByText("Resumo do Pacote")).toBeInTheDocument();
    expect(screen.getByText("Pré-agendamentos na Agenda (10)")).toBeInTheDocument();
  });

  it("toggles the collapsible section when clicking the checkbox", async () => {
    render(<PaymentPlanCollapsibleWrapper />);

    // Initially open because createPlan is true
    expect(screen.getByLabelText("Nome do Pacote / Plano")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantidade de Sessões")).toBeInTheDocument();
    expect(screen.getByLabelText("Valor Total do Pacote")).toBeInTheDocument();

    // Click checkbox to collapse
    const toggleCheckbox = screen.getByRole("checkbox", { name: /Criar Plano de Pagamento/i });
    expect(toggleCheckbox).toHaveAttribute("data-state", "checked");

    fireEvent.click(toggleCheckbox);

    await waitFor(() => {
      expect(toggleCheckbox).toHaveAttribute("data-state", "unchecked");
      expect(screen.queryByLabelText("Nome do Pacote / Plano")).not.toBeInTheDocument();
    });

    // Click checkbox again to expand
    fireEvent.click(toggleCheckbox);

    await waitFor(() => {
      expect(toggleCheckbox).toHaveAttribute("data-state", "checked");
      expect(screen.getByLabelText("Nome do Pacote / Plano")).toBeInTheDocument();
    });
  });

  it("switches to mobile 375px preview and ensures container layout supports scrolling", () => {
    const { container } = render(<PaymentPlanLab />);

    const mobileButton = screen.getByText(/Mobile \(375px\)/i);
    fireEvent.click(mobileButton);

    // Verify container has mobile constraints and overflow-y-auto for scrollability
    const mobileContainer = container.querySelector(".max-w-\\[375px\\]");
    expect(mobileContainer).toBeInTheDocument();
    expect(mobileContainer?.classList.contains("overflow-y-auto")).toBe(true);

    // Switch back to desktop
    const desktopButton = screen.getByText("Desktop");
    fireEvent.click(desktopButton);
    expect(container.querySelector(".max-w-6xl")).toBeInTheDocument();
  });

  it("allows changing the session count and updates financial calculations", () => {
    render(<PaymentPlanLab />);

    const totalSessionsInput = screen.getByLabelText("Quantidade de Sessões");
    fireEvent.change(totalSessionsInput, { target: { value: "5" } });

    // Check that pre-scheduling recalculates
    expect(screen.getByText("Pré-agendamentos na Agenda (5)")).toBeInTheDocument();
  });

  it("allows toggling weekday recurrence chips", () => {
    render(<PaymentPlanLab />);

    // Click on Friday ('Sex') chip
    const fridayButton = screen.getByRole("button", { name: "Sex" });
    fireEvent.click(fridayButton);

    // Verify it is active (has primary background class)
    expect(fridayButton.className).toContain("bg-primary");
  });
});
