import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformAccountOperations } from "./PlatformAccountOperations";
import { callPlatformAccountAdmin } from "./platform-api";

window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

vi.mock("./platform-api", () => ({
  accountOperationLabels: {
    update_clinic_access: "Editar acesso da clínica",
    create_subaccount: "Criar subconta",
  },
  callPlatformAccountAdmin: vi.fn(),
  destructiveOperations: new Set(["delete_subaccount"]),
  getErrorMessage: vi.fn((err: unknown) => String(err)),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      mfa: {
        listFactors: vi.fn().mockResolvedValue({ data: { totp: [] }, error: null }),
        challengeAndVerify: vi.fn().mockResolvedValue({ error: null }),
      },
    },
  },
}));

describe("PlatformAccountOperations - Gestão de Clínica, Planos, Dias e Cortesia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(callPlatformAccountAdmin).mockResolvedValue({ success: true });
  });

  it("renderiza controles de tipo de plano, status da clínica, cortesia parceira e dias de assinatura", () => {
    render(
      <PlatformAccountOperations
        allowedOperations={["update_clinic_access"]}
        clinicId="clinic-123"
        clinicAccessStatus="active"
        subscriptionPlan="clinic"
        subscriptionData={{
          status: "ACTIVE",
          expires_at: "2026-10-15T00:00:00.000Z",
          is_courtesy: false,
        }}
        onDone={vi.fn()}
        title="Acesso e plano da clínica"
      />
    );

    expect(screen.getByText("Acesso e plano da clínica")).toBeInTheDocument();
    expect(screen.getByText("Tipo de plano")).toBeInTheDocument();
    expect(screen.getByText("Plano de Cortesia Parceira")).toBeInTheDocument();
    expect(screen.getByText("Dar / Tirar dias de assinatura")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("+/- dias (ex: 30)")).toBeInTheDocument();
  });

  it("calcula live preview ao adicionar dias de assinatura via atalho rápido", async () => {
    render(
      <PlatformAccountOperations
        allowedOperations={["update_clinic_access"]}
        clinicId="clinic-123"
        clinicAccessStatus="active"
        subscriptionPlan="clinic"
        subscriptionData={{
          status: "ACTIVE",
          expires_at: "2026-10-15T00:00:00.000Z",
          is_courtesy: false,
        }}
        onDone={vi.fn()}
        title="Acesso e plano da clínica"
      />
    );

    // Clica no atalho rápido +30d
    const btn30 = screen.getByRole("button", { name: "+30d" });
    fireEvent.click(btn30);

    const inputDays = screen.getByPlaceholderText("+/- dias (ex: 30)") as HTMLInputElement;
    expect(inputDays.value).toBe("30");

    // Live preview deve ser visível com a menção ao novo vencimento
    expect(screen.getByText(/Novo vencimento previsto:/i)).toBeInTheDocument();
    expect(screen.getByText(/\[\+30 dias\]/i)).toBeInTheDocument();
  });

  it("permite ativar o toggle de Cortesia Parceira ocultando o ajuste de dias e exibindo badge vitalício", async () => {
    render(
      <PlatformAccountOperations
        allowedOperations={["update_clinic_access"]}
        clinicId="clinic-123"
        clinicAccessStatus="active"
        subscriptionPlan="clinic"
        subscriptionData={{
          status: "ACTIVE",
          expires_at: "2026-10-15T00:00:00.000Z",
          is_courtesy: false,
        }}
        onDone={vi.fn()}
        title="Acesso e plano da clínica"
      />
    );

    const courtesySwitch = screen.getByRole("switch");
    expect(courtesySwitch).toHaveAttribute("aria-checked", "false");

    fireEvent.click(courtesySwitch);

    expect(courtesySwitch).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Vitalício & Gratuito")).toBeInTheDocument();
    // O controle de dias deve ficar oculto no modo cortesia
    expect(screen.queryByPlaceholderText("+/- dias (ex: 30)")).not.toBeInTheDocument();
  });

  it("envia payload completo para callPlatformAccountAdmin ao executar a ação administrativa", async () => {
    const onDone = vi.fn();
    render(
      <PlatformAccountOperations
        allowedOperations={["update_clinic_access"]}
        clinicId="clinic-123"
        clinicAccessStatus="active"
        subscriptionPlan="solo"
        subscriptionData={{
          status: "ACTIVE",
          expires_at: "2026-10-15T00:00:00.000Z",
          is_courtesy: false,
        }}
        onDone={onDone}
        title="Acesso e plano da clínica"
      />
    );

    // Ajusta dias
    const inputDays = screen.getByPlaceholderText("+/- dias (ex: 30)") as HTMLInputElement;
    fireEvent.change(inputDays, { target: { value: "45" } });

    // O banner de alterações pendentes deve aparecer
    expect(screen.getByText("Alterações pendentes (não salvas no banco):")).toBeInTheDocument();
    expect(screen.getByText("Dias de assinatura: +45 dia(s)")).toBeInTheDocument();

    // Preenche motivo auditável obrigatório
    const textarea = screen.getByPlaceholderText(/Informe a justificativa da ação administrativa/i);
    fireEvent.change(textarea, { target: { value: "Ajuste de cortesia e dias para clínica parceira" } });

    // Botão indica salvamento de alterações pendentes
    const submitBtn = screen.getByRole("button", { name: "Salvar e aplicar alterações pendentes" });
    expect(submitBtn).toBeEnabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(callPlatformAccountAdmin).toHaveBeenCalledWith(
        "update_clinic_access",
        expect.objectContaining({
          clinicId: "clinic-123",
          subscriptionPlan: "solo",
          daysAdjustment: 45,
          isCourtesy: false,
          status: "active",
        }),
        "Ajuste de cortesia e dias para clínica parceira"
      );
      expect(onDone).toHaveBeenCalled();
    });
  });

  it("permite preencher o motivo auditável clicando em um chip de motivo rápido", async () => {
    render(
      <PlatformAccountOperations
        allowedOperations={["update_clinic_access"]}
        clinicId="clinic-123"
        clinicAccessStatus="active"
        subscriptionPlan="solo"
        subscriptionData={{
          status: "ACTIVE",
          expires_at: "2026-10-15T00:00:00.000Z",
          is_courtesy: false,
        }}
        onDone={vi.fn()}
        title="Acesso e plano da clínica"
      />
    );

    // Inicialmente mostra que faltam 8 caracteres
    expect(screen.getByText(/Faltam 8 caractere\(s\)/i)).toBeInTheDocument();

    // Clica em um dos chips de motivos rápidos
    const chipBtn = screen.getByRole("button", { name: "Upgrade para Plano com Equipe" });
    fireEvent.click(chipBtn);

    const textarea = screen.getByPlaceholderText(/Informe a justificativa da ação administrativa/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe("Upgrade para Plano com Equipe");

    // Contador deve indicar válido / pronto para salvar
    expect(screen.getByText(/Pronto para salvar/i)).toBeInTheDocument();
  });
});
