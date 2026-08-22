import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { normalizePatientNameKey } from "@/lib/patient-registration";
import { notifyPatientsUpdated } from "@/lib/patient-events";
import { notifyAgendaEventsUpdated } from "@/lib/agenda-events";

const FIRST_NAMES_MALE = [
  "Lucas", "Mateus", "Gabriel", "Rodrigo", "Felipe",
  "Carlos", "Bruno", "Eduardo", "Guilherme", "Leonardo",
  "Diego", "Thiago", "Pedro", "Henrique", "Alexandre"
];

const FIRST_NAMES_FEMALE = [
  "Mariana", "Beatriz", "Camila", "Juliana", "Larissa",
  "Fernanda", "Carolina", "Amanda", "Letícia", "Natália",
  "Isabela", "Bruna", "Gabriela", "Renata", "Patrícia"
];

const LAST_NAMES = [
  "Silva", "Santos", "Oliveira", "Souza", "Rodrigues",
  "Ferreira", "Alves", "Pereira", "Lima", "Gomes",
  "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida",
  "Lopes", "Soares", "Fernandes", "Vieira", "Barbosa"
];

const PROFESSIONS = [
  "Engenheiro(a) de Software",
  "Designer Gráfico",
  "Advogado(a)",
  "Professor(a)",
  "Arquiteto(a)",
  "Analista de Marketing",
  "Médico(a) Veterinário(a)",
  "Contador(a)",
  "Jornalista",
  "Estudante"
];

const SAMPLE_NOTES = [
  "Paciente relatando queixas de ansiedade e sobrecarga no trabalho nas últimas semanas.",
  "Encaminhamento médico para acompanhamento psicoterapêutico de rotina.",
  "Primeira consulta de acolhimento e alinhamento de expectativas terapêuticas.",
  "Acompanhamento em andamento com boa adesão às atividades propostas."
];

export const generateValidCpf = (): string => {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));

  // Evitar 9 dígitos idênticos
  if (digits.every((d) => d === digits[0])) {
    digits[0] = (digits[0] + 1) % 10;
  }

  const calcDigit = (base: number[], factor: number) => {
    const sum = base.reduce((total, digit) => {
      const next = total + digit * factor;
      factor -= 1;
      return next;
    }, 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  const d1 = calcDigit(digits, 10);
  const d2 = calcDigit([...digits, d1], 11);

  return [...digits, d1, d2].join("");
};

export type SimulationPatientPreset = "adult" | "minor" | "elderly";

export interface GenerateTestPatientOptions {
  gender?: "male" | "female";
  includeFullProfile?: boolean;
  name?: string;
  preset?: SimulationPatientPreset;
}

export interface GeneratedPatientData {
  birthDate: string;
  city: string;
  clinicalNotes: string;
  cpf: string;
  email: string;
  gender: string;
  name: string;
  phone: string;
  profession: string;
  responsibleCpf: string | null;
  state: string;
  usesResponsibleCpf: boolean;
}

const getRandomItem = <T>(array: T[]): T => array[Math.floor(Math.random() * array.length)];

const generateBirthDate = (minAge: number, maxAge: number): string => {
  const today = new Date();
  const age = Math.floor(Math.random() * (maxAge - minAge + 1)) + minAge;
  const month = Math.floor(Math.random() * 12);
  const day = Math.floor(Math.random() * 28) + 1; // Evita dias inválidos como 30/02
  const year = today.getFullYear() - age;
  const birth = new Date(year, month, day);
  return birth.toISOString().split("T")[0];
};

export const generateSimulationPatientData = (options: GenerateTestPatientOptions = {}): GeneratedPatientData => {
  const preset = options.preset ?? "adult";
  const genderType = options.gender ?? (Math.random() > 0.5 ? "female" : "male");
  const firstName = genderType === "female" ? getRandomItem(FIRST_NAMES_FEMALE) : getRandomItem(FIRST_NAMES_MALE);
  const lastName1 = getRandomItem(LAST_NAMES);
  const lastName2 = getRandomItem(LAST_NAMES.filter((n) => n !== lastName1));
  const defaultName = `${firstName} ${lastName1} ${lastName2} (Teste)`;
  const name = options.name?.trim() || defaultName;

  let birthDate = "";
  let usesResponsibleCpf = false;
  let responsibleCpf: string | null = null;
  let cpf = generateValidCpf();

  if (preset === "minor") {
    birthDate = generateBirthDate(6, 16);
    usesResponsibleCpf = true;
    responsibleCpf = generateValidCpf();
    // No caso de menor com responsável, o CPF informado é o do responsável
    cpf = responsibleCpf;
  } else if (preset === "elderly") {
    birthDate = generateBirthDate(62, 82);
  } else {
    birthDate = generateBirthDate(20, 55);
  }

  const cleanFirstName = firstName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const email = `paciente.teste.${cleanFirstName}.${randomSuffix}@exemplo.com`;
  const randomPhoneDigits = Math.floor(10000000 + Math.random() * 90000000);
  const phone = `119${randomPhoneDigits}`;

  return {
    birthDate,
    city: "São Paulo",
    clinicalNotes: getRandomItem(SAMPLE_NOTES),
    cpf,
    email,
    gender: genderType === "female" ? "Feminino" : "Masculino",
    name,
    phone,
    profession: preset === "minor" ? "Estudante" : getRandomItem(PROFESSIONS),
    responsibleCpf,
    state: "SP",
    usesResponsibleCpf,
  };
};

export interface CreateSimulationPatientResult {
  data?: {
    id: string;
    name: string;
    patient_code?: string | null;
    status: "created" | "existing";
  };
  error?: string;
  success: boolean;
}

export const createSimulationTestPatient = async (
  supabase: SupabaseClient<Database>,
  clinicId: string,
  options: GenerateTestPatientOptions = {}
): Promise<CreateSimulationPatientResult> => {
  try {
    const patientData = generateSimulationPatientData(options);

    const { data: rpcData, error: rpcError } = await supabase.rpc("ensure_clinic_patient" as never, {
      _clinic_id: clinicId,
      _cpf: patientData.cpf,
      _date_of_birth: patientData.birthDate,
      _email: patientData.email,
      _name: patientData.name,
      _name_key: normalizePatientNameKey(patientData.name),
      _phone: patientData.phone,
      _uses_responsible_cpf: patientData.usesResponsibleCpf,
    } as never) as {
      data: { id: string; patient_code?: string | null; status: "created" | "existing" } | null;
      error: { message: string } | null;
    };

    if (rpcError || !rpcData?.id) {
      return {
        error: rpcError?.message || "Erro desconhecido ao cadastrar paciente teste.",
        success: false,
      };
    }

    const patientId = rpcData.id;

    // Atualizar dados complementares enriquecidos caso solicitado (ou por padrão para enriquecer o teste)
    if (options.includeFullProfile !== false) {
      await supabase
        .from("patients")
        .update({
          city: patientData.city,
          clinical_notes: patientData.clinicalNotes,
          gender: patientData.gender,
          profession: patientData.profession,
          registration_complete: true,
          state: patientData.state,
        })
        .eq("id", patientId);
    }

    notifyPatientsUpdated();
    notifyAgendaEventsUpdated();

    return {
      data: {
        id: patientId,
        name: patientData.name,
        patient_code: rpcData.patient_code,
        status: rpcData.status,
      },
      success: true,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro inesperado ao gerar paciente teste.";
    return {
      error: message,
      success: false,
    };
  }
};
