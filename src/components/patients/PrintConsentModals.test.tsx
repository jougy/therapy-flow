import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PrintAdultConsentModal } from "./PrintAdultConsentModal";
import { PrintGuardianConsentModal } from "./PrintGuardianConsentModal";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
          single: async () => ({ data: null, error: null }),
        }),
        single: async () => ({ data: null, error: null }),
      }),
    }),
    rpc: async () => ({ data: null, error: null }),
  },
}));

describe("Print Consent Modals", () => {
  const dummyPatient = {
    id: "pat-123",
    name: "Ana Pereira Santos",
    date_of_birth: "1995-04-12",
    cpf: "12345678901",
    phone: "11988887777",
    email: "ana@email.com",
    patient_code: "PAT-001",
  };

  const dummyMinorPatient = {
    id: "pat-minor",
    name: "Lucas Pereira Santos",
    date_of_birth: "2018-05-20",
    cpf: "98765432100",
    responsible_name: "Mariana Pereira",
    responsible_relationship: "Mãe",
    responsible_cpf: "11122233344",
    phone: "11977776666",
    patient_code: "PAT-002",
  };

  it("renders PrintAdultConsentModal with patient information and print action", async () => {
    render(
      <PrintAdultConsentModal
        open={true}
        onOpenChange={vi.fn()}
        patient={dummyPatient}
        clinicName="Clínica Exemplo"
      />
    );

    expect(screen.getByText("Termo de Consentimento Livre e Esclarecido (Adulto)")).toBeInTheDocument();
    expect(await screen.findByText("Clínica Exemplo")).toBeInTheDocument();
    expect(screen.getAllByText("Ana Pereira Santos").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /Imprimir Termo Físico/i })).toBeInTheDocument();
  });

  it("renders PrintGuardianConsentModal with minor and guardian information", async () => {
    render(
      <PrintGuardianConsentModal
        open={true}
        onOpenChange={vi.fn()}
        patient={dummyMinorPatient}
        clinicName="Clínica Exemplo"
      />
    );

    expect(screen.getByText("Termo de Consentimento do Responsável (Menor de Idade)")).toBeInTheDocument();
    expect(await screen.findByText("Clínica Exemplo")).toBeInTheDocument();
    expect(screen.getAllByText("Lucas Pereira Santos").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Mariana Pereira").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /Imprimir Termo Físico/i })).toBeInTheDocument();
  });
});
