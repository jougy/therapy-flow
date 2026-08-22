import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

describe("PaymentPlanCollapsible Component", () => {
  it("renders form fields when active", () => {
    render(<PaymentPlanCollapsibleWrapper />);

    expect(screen.getByLabelText("Nome do Pacote / Plano")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantidade de Sessões")).toBeInTheDocument();
    expect(screen.getByLabelText("Valor Total do Pacote")).toBeInTheDocument();
  });

  it("toggles the collapsible section when clicking the checkbox", async () => {
    render(<PaymentPlanCollapsibleWrapper />);

    // Initially open because createPlan is true
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

  it("allows toggling weekday recurrence chips", () => {
    render(<PaymentPlanCollapsibleWrapper />);

    // Click on Friday ('Sex') chip
    const fridayButton = screen.getByRole("button", { name: "Sex" });
    fireEvent.click(fridayButton);

    // Verify it is active (has primary background class)
    expect(fridayButton.className).toContain("bg-primary");
  });
});
