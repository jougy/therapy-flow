/**
 * Fábricas Canônicas de Entidades Clínicas (Typed Test Factories)
 * Fornece fixtures estruturadas e tipadas para testes sem hardcode solto.
 */

export interface MockPatient {
  id: string;
  clinic_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  birth_date: string | null;
  gender: string | null;
  status: "active" | "inactive" | "archived";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MockSession {
  id: string;
  clinic_id: string;
  patient_id: string;
  professional_id: string;
  session_date: string;
  status: "completed" | "scheduled" | "canceled" | "draft";
  amount_charged_cents: number;
  payment_status: "paid" | "pending" | "exempt";
  notes?: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MockClinic {
  id: string;
  name: string;
  slug: string;
  document_number: string;
  status: "active" | "trialing" | "past_due";
  plan_tier: "prof_basico" | "prof_medio" | "prof_top" | "clinica_basico" | "clinica_medio" | "clinica_top";
  created_at: string;
}

export function createMockPatient(overrides: Partial<MockPatient> = {}): MockPatient {
  const id = overrides.id || `pat_${Math.random().toString(36).substring(2, 9)}`;
  return {
    id,
    clinic_id: "clinic_test_default",
    name: "Paciente de Teste QA",
    email: "paciente.qa@exemplo.com",
    phone: "11988887777",
    cpf: "123.456.789-00",
    birth_date: "1990-05-15",
    gender: "outro",
    status: "active",
    created_at: "2026-01-01T10:00:00Z",
    updated_at: "2026-01-01T10:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

export function createMockSession(overrides: Partial<MockSession> = {}): MockSession {
  const id = overrides.id || `ses_${Math.random().toString(36).substring(2, 9)}`;
  return {
    id,
    clinic_id: "clinic_test_default",
    patient_id: "pat_test_default",
    professional_id: "usr_test_default",
    session_date: "2026-11-08T14:00:00Z",
    status: "completed",
    amount_charged_cents: 15000, // R$ 150,00 estrito em centavos
    payment_status: "paid",
    notes: "Evolução clínica de teste automatizado.",
    created_at: "2026-11-08T14:00:00Z",
    updated_at: "2026-11-08T14:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

export function createMockClinic(overrides: Partial<MockClinic> = {}): MockClinic {
  const id = overrides.id || `cln_${Math.random().toString(36).substring(2, 9)}`;
  return {
    id,
    name: "Clínica Fisioterapia QA",
    slug: "clinica-qa",
    document_number: "12.345.678/0001-90",
    status: "active",
    plan_tier: "clinica_medio",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}
