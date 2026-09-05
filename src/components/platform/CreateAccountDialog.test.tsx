import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateAccountDialog } from "./CreateAccountDialog";
import { callPlatformAccountAdmin, callRpc } from "./platform-api";

window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

vi.mock("./platform-api", () => ({
  callPlatformAccountAdmin: vi.fn(),
  callRpc: vi.fn(),
  getErrorMessage: vi.fn((err: unknown) => String(err)),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

describe("CreateAccountDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(callRpc).mockResolvedValue({
      data: [
        { clinic_id: "clinic-1", clinic_name: "Clínica Teste", clinic_cnpj: "12345678000199" },
      ],
      error: null,
    });
    vi.mocked(callPlatformAccountAdmin).mockResolvedValue({ success: true });
  });

  it("renders with options to choose between clinic owner and simple user", async () => {
    render(<CreateAccountDialog open={true} onOpenChange={vi.fn()} onCreated={vi.fn()} />);

    expect(screen.getByText("Nova conta master-gerenciada")).toBeInTheDocument();
    expect(screen.getByText("Tipo de conta a criar")).toBeInTheDocument();
  });

  it("calls create_owner_account when submitting default owner form", async () => {
    const onCreated = vi.fn();
    render(<CreateAccountDialog open={true} onOpenChange={vi.fn()} onCreated={onCreated} />);

    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(passwordInput, { target: { value: "senhaSegura123" } });

    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: "owner@exemplo.com" } });

    // Preencher todos os inputs required
    const textInputs = document.querySelectorAll('input[type="text"], input:not([type])');
    textInputs.forEach((input) => {
      fireEvent.change(input, { target: { value: "Valor Teste" } });
    });

    const reasonTextarea = document.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(reasonTextarea, { target: { value: "Criação de clínica pelo backoffice" } });

    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(callPlatformAccountAdmin).toHaveBeenCalledWith(
        "create_owner_account",
        expect.objectContaining({
          email: "owner@exemplo.com",
          password: "senhaSegura123",
          plan: "clinic",
          status: "active",
        }),
        "Criação de clínica pelo backoffice"
      );
      expect(onCreated).toHaveBeenCalled();
    });
  });
});
