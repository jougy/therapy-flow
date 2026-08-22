import {
  buildPatientRegistrationPutPayload,
  buildPatientShareMessages,
  calculateAgeDetails,
  calculatePatientAge,
  extractCpfDigits,
  formatNameTitleCase,
  formatPatientCpf,
  formatPatientPhone,
  getPatientRegistrationPassword,
  isValidCpfDigits,
  isValidPatientBirthDate,
  isValidPatientEmail,
  normalizePatientNameKey,
  putPatientRegistration,
  suggestEmailTypo,
  validatePatientPreRegistration,
} from "@/lib/patient-registration";

type PatientRow = Database["public"]["Tables"]["patients"]["Row"];

const basePatient = (): PatientRow => ({
  address_complement: null,
  address_number: null,
  age: 25,
  allergies: null,
  blood_type: null,
  cep: null,
  clinical_profile: null,
  chronic_conditions: null,
  city: null,
  clinic_id: "clinic-1",
  clinical_notes: null,
  continuous_medications: null,
  country: "Brasil",
  cpf: "12345678901",
  created_at: "2026-04-01T12:00:00.000Z",
  date_of_birth: "2000-04-20",
  email: "old@example.com",
  emergency_contact: null,
  gender: null,
  id: "patient-1",
  is_recurring: false,
  name: "Paciente Base",
  neighborhood: null,
  origin_insurance_member_id: null,
  origin_insurance_plan: null,
  origin_insurance_provider: null,
  origin_other_description: null,
  origin_other_name: null,
  origin_referrer_name: null,
  origin_type: "outros",
  phone: "11999998888",
  profession: null,
  pronoun: null,
  registration_complete: false,
  recurring_time: "09:00",
  recurring_weekdays: [],
  responsible_cpf: null,
  rg: null,
  state: null,
  status: "ativo",
  street: null,
  surgeries: null,
  updated_at: "2026-04-10T09:00:00.000Z",
  user_id: "user-1",
  uses_responsible_cpf: false,
});

describe("patient registration helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("extracts cpf digits and derives the registration password", () => {
    expect(extractCpfDigits("123.456.789-01")).toBe("12345678901");
    expect(getPatientRegistrationPassword("123.456.789-01")).toBe("123456");
    expect(getPatientRegistrationPassword("123")).toBeNull();
  });

  it("formats and validates required pre-registration fields", () => {
    expect(formatPatientCpf("52998224725<script>")).toBe("529.982.247-25");
    expect(formatPatientPhone("+55 (11) 98765-4321 ramal 999")).toBe("(11) 98765-4321");
    expect(formatPatientPhone("1132224455")).toBe("(11) 3222-4455"); // Fixo 10 dígitos
    expect(formatPatientPhone("11987654321")).toBe("(11) 98765-4321"); // Celular 11 dígitos
    expect(isValidCpfDigits("52998224725")).toBe(true);
    expect(isValidCpfDigits("11111111111")).toBe(false);
    expect(isValidCpfDigits("52998224724")).toBe(false);
    expect(isValidPatientBirthDate("2026-02-31")).toBe(false);
    expect(isValidPatientBirthDate("2100-01-01")).toBe(false);
    expect(isValidPatientBirthDate("2000-04-20")).toBe(true);
    expect(isValidPatientEmail("paciente@example.com")).toBe(true);
    expect(isValidPatientEmail("bad <script>@example.com")).toBe(false);
  });

  it("extracts password from patient object with fallback to responsible cpf and birth date", () => {
    expect(getPatientRegistrationPassword({ cpf: "529.982.247-25" })).toBe("529982");
    expect(getPatientRegistrationPassword({ responsible_cpf: "111.444.777-35" })).toBe("111444");
    expect(getPatientRegistrationPassword({ date_of_birth: "2000-04-20" })).toBe("200400");
  });

  it("builds personalized WhatsApp and Email share messages", () => {
    const femaleShare = buildPatientShareMessages({
      patientName: "Mariana Souza",
      clinicName: "Clínica Vida",
      shareUrl: "https://exemplo.com/cadastro/paciente/tok123",
      passwordPrefix: "529982",
      pronoun: "ela/dela",
      phone: "11987654321",
      email: "mariana@exemplo.com",
    });

    expect(femaleShare.whatsappMessage).toContain("Mariana");
    expect(femaleShare.whatsappMessage).toContain("bem-vinda");
    expect(femaleShare.whatsappMessage).toContain("Clínica Vida");
    expect(femaleShare.whatsappMessage).toContain("https://exemplo.com/cadastro/paciente/tok123");
    expect(femaleShare.whatsappUrl).toContain("5511987654321");
    expect(femaleShare.emailSubject).toContain("Mariana");
    expect(femaleShare.mailtoUrl).toContain("mailto:mariana%40exemplo.com");
  });

  it("builds stable patient name keys for idempotency", () => {
    expect(normalizePatientNameKey(" Ana  Maria da-Silva ")).toBe("anamariadasilva");
    expect(normalizePatientNameKey("Ána Maria da Silva")).toBe("anamariadasilva");
    expect(normalizePatientNameKey("Ana\u202E Maria 😀 da Silva")).toBe("anamariadasilva");
  });

  it("requires identity fields and treats contact fields as optional", () => {
    const invalid = validatePatientPreRegistration({
      cpf: "111.111.111-11",
      dateOfBirth: "2100-01-01",
      email: "bad <script>@example.com",
      name: "A",
      phone: "123",
    });

    expect(invalid.isValid).toBe(false);
    expect(invalid.errors).toMatchObject({
      cpf: expect.any(String),
      dateOfBirth: expect.any(String),
      email: expect.any(String),
      name: expect.any(String),
      phone: expect.any(String),
    });

    const validWithoutContact = validatePatientPreRegistration({
      cpf: "529.982.247-25<script>",
      dateOfBirth: "2000-04-20",
      email: "",
      name: "  Ana\u0000 Maria 😀  ",
      phone: "",
    });

    expect(validWithoutContact).toMatchObject({
      isValid: true,
      values: {
        cpf: "52998224725",
        dateOfBirth: "2000-04-20",
        email: "",
        name: "Ana Maria",
        phone: "",
        usesResponsibleCpf: false,
      },
    });

    const validWithContact = validatePatientPreRegistration({
      cpf: "529.982.247-25<script>",
      dateOfBirth: "2000-04-20",
      email: " PACIENTE@EXAMPLE.COM\u202E ",
      name: "  Ana\u0000 Maria 😀  ",
      phone: "(11) 98765-4321",
    });

    expect(validWithContact).toMatchObject({
      isValid: true,
      values: {
        email: "paciente@example.com",
        phone: "11987654321",
      },
    });
  });

  it("accepts a responsible CPF flag while keeping CPF validation strict", () => {
    const invalid = validatePatientPreRegistration({
      cpf: "123",
      dateOfBirth: "2020-04-20",
      email: "",
      name: "Crianca Teste",
      phone: "",
      usesResponsibleCpf: true,
    });

    expect(invalid.isValid).toBe(false);
    expect(invalid.errors.cpf).toBe("Informe um CPF válido do responsável.");

    const valid = validatePatientPreRegistration({
      cpf: "529.982.247-25",
      dateOfBirth: "2020-04-20",
      email: "",
      name: "Crianca Teste",
      phone: "",
      usesResponsibleCpf: true,
    });

    expect(valid).toMatchObject({
      isValid: true,
      values: {
        cpf: "52998224725",
        usesResponsibleCpf: true,
      },
    });
  });

  it("calculates patient age from the birth date", () => {
    expect(calculatePatientAge("2000-04-20")).toBe(26);
    expect(calculatePatientAge("")).toBeNull();
  });

  it("builds a normalized full payload for idempotent PUT updates", () => {
    const payload = buildPatientRegistrationPutPayload(basePatient(), {
      addressComplement: "Apto 12 ",
      addressNumber: " 101 ",
      allergies: " Dipirona ",
      bloodType: "O+",
      cep: "01310-930",
      clinicalProfile: {
        addiction_records: [],
        clinical_alerts: " Restricao cervical ",
        congenital_genetic_conditions: " Sindrome congenita ",
        diagnoses: " Lombalgia crônica ",
        falls_history: " Queda em 2025 ",
        family_history: " Osteoporose materna ",
        functional_independence: "parcialmente_dependente",
        has_addictions: false,
        implants_devices: " Prótese de joelho ",
        lifestyle_notes: " Sedentaria ",
        mobility_aids: " Bengala ",
        risk_flags: ["fall_risk", "diabetes"],
        substance_use_records: [],
        substance_use_history: " Tabagismo social no passado ",
        uses_substances: false,
      },
      cpf: "987.654.321-00",
      chronicConditions: " Asma ",
      city: " Sao Paulo ",
      clinicalNotes: " Observacao relevante ",
      continuousMedications: " Vitamina D ",
      country: " ",
      dateOfBirth: "1990-01-15",
      email: " paciente@teste.com ",
      emergencyContact: {
        name: " Maria da Silva ",
        phone: "(11) 97777-8888",
        relationship: " Irma ",
      },
      gender: "feminino",
      name: " Paciente Atualizado ",
      neighborhood: " Bela Vista ",
      phone: "(11) 98888-7777",
      profession: " Engenheira ",
      pronoun: "ela/dela",
      rg: "12.345.678-9",
      state: " SP ",
      street: " Av. Paulista ",
      surgeries: " Joelho ",
    });

    expect(payload).toMatchObject({
      address_complement: "Apto 12",
      address_number: "101",
      age: 36,
      allergies: "Dipirona",
      blood_type: "O+",
      cep: "01310930",
      clinical_profile: {
        clinical_alerts: "Restricao cervical",
        congenital_genetic_conditions: "Sindrome congenita",
        diagnoses: "Lombalgia crônica",
        falls_history: "Queda em 2025",
        family_history: "Osteoporose materna",
        functional_independence: "parcialmente_dependente",
        implants_devices: "Prótese de joelho",
        lifestyle_notes: "Sedentaria",
        mobility_aids: "Bengala",
        risk_flags: ["fall_risk", "diabetes"],
        substance_use_history: "Observações anteriores:\nTabagismo social no passado",
      },
      cpf: "98765432100",
      chronic_conditions: "Asma",
      city: "Sao Paulo",
      clinical_notes: "Observacao relevante",
      continuous_medications: "Vitamina D",
      country: "Brasil",
      date_of_birth: "1990-01-15",
      email: "paciente@teste.com",
      emergency_contact: {
        name: "Maria da Silva",
        phone: "(11) 97777-8888",
        relationship: "Irma",
      },
      gender: "feminino",
      id: "patient-1",
      name: "Paciente Atualizado",
      neighborhood: "Bela Vista",
      phone: "11988887777",
      profession: "Engenheira",
      pronoun: "ela/dela",
      registration_complete: true,
      rg: "12.345.678-9",
      state: "SP",
      status: "ativo",
      street: "Av. Paulista",
      surgeries: "Joelho",
      user_id: "user-1",
    });
  });

  it("sanitizes absurd patient registration payloads before persistence", () => {
    const hostileText = `  <img src=x onerror=alert(1)> Café\u0301 😀\u0000\u202E\n${"界".repeat(3_000)}  `;
    const payload = buildPatientRegistrationPutPayload(basePatient(), {
      addressComplement: hostileText,
      addressNumber: hostileText,
      allergies: hostileText,
      bloodType: hostileText,
      cep: "１２３45-678<script>",
      clinicalProfile: {
        addiction_records: [],
        clinical_alerts: hostileText,
        congenital_genetic_conditions: hostileText,
        diagnoses: hostileText,
        falls_history: hostileText,
        family_history: hostileText,
        functional_independence: "dependente",
        has_addictions: false,
        implants_devices: hostileText,
        lifestyle_notes: hostileText,
        mobility_aids: hostileText,
        risk_flags: ["allergy", "infection_risk"],
        substance_use_records: [
          {
            dependency_level: "dependencia_provavel",
            frequency: hostileText,
            id: hostileText,
            is_illicit: true,
            motivation: hostileText,
            name: hostileText,
            notes: hostileText,
            started_at: hostileText,
          },
        ],
        substance_use_history: hostileText,
        uses_substances: true,
      },
      chronicConditions: hostileText,
      city: hostileText,
      clinicalNotes: hostileText,
      continuousMedications: hostileText,
      country: hostileText,
      cpf: "abc123.456.789-01<script>",
      dateOfBirth: "2026-01-01",
      email: `${"a".repeat(300)}@example.com\u0000`,
      emergencyContact: {
        name: hostileText,
        phone: hostileText,
        relationship: hostileText,
      },
      gender: hostileText,
      name: hostileText,
      neighborhood: hostileText,
      originInsuranceMemberId: hostileText,
      originInsurancePlan: hostileText,
      originInsuranceProvider: hostileText,
      originOtherDescription: hostileText,
      originOtherName: hostileText,
      originReferrerName: hostileText,
      originType: "outros",
      phone: "+55 (11) 99999-8888 ramal <script>",
      profession: hostileText,
      pronoun: hostileText,
      rg: hostileText,
      state: hostileText,
      street: hostileText,
      surgeries: hostileText,
    });

    expect(Array.from(payload.name)).toHaveLength(160);
    expect(payload.name).toContain("Café");
    expect(payload.name).not.toContain("😀");
    expect(payload.name).not.toContain("\u0000");
    expect(payload.name).not.toContain("\u202E");
    expect(payload.clinical_notes?.length).toBeLessThanOrEqual(2_000);
    expect(payload.email?.length).toBeLessThanOrEqual(254);
    expect(payload.cpf).toBe("12345678901");
    expect(payload.phone).toBe("11999998888");
    expect(payload.origin_other_name?.length).toBeLessThanOrEqual(120);
    expect(payload.origin_other_description?.length).toBeLessThanOrEqual(500);
    expect(payload.clinical_profile).toMatchObject({
      functional_independence: "dependente",
      uses_substances: true,
    });
    const clinicalProfile = payload.clinical_profile as { clinical_alerts: string; substance_use_records: Array<{ name: string; notes: string }> };
    expect(clinicalProfile.clinical_alerts.length).toBeLessThanOrEqual(2_000);
    expect(clinicalProfile.substance_use_records[0].name.length).toBeLessThanOrEqual(240);
    expect(clinicalProfile.substance_use_records[0].notes.length).toBeLessThanOrEqual(2_000);
  });

  it("uses PUT against the patient REST resource", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));

    await putPatientRegistration({
      accessToken: "token-123",
      apiKey: "anon-key",
      patient: basePatient(),
      supabaseUrl: "https://example.supabase.co",
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/patients?id=eq.patient-1",
      expect.objectContaining({
        body: JSON.stringify(basePatient()),
        headers: expect.objectContaining({
          Authorization: "Bearer token-123",
          Prefer: "return=minimal",
          apikey: "anon-key",
        }),
        method: "PUT",
      })
    );
  });

  it("surfaces api errors from the PUT request", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ message: "violacao de regra" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(
      putPatientRegistration({
        accessToken: "token-123",
        apiKey: "anon-key",
        patient: basePatient(),
        supabaseUrl: "https://example.supabase.co",
        fetcher,
      })
    ).rejects.toThrow("violacao de regra");
  });

  it("calculates detailed age and flags minors", () => {
    // Current test date is 2026-04-21
    const minor = calculateAgeDetails("2016-04-21");
    expect(minor).toEqual({
      isMinor: true,
      label: "10 anos",
      months: 0,
      years: 10,
    });

    const adult = calculateAgeDetails("1996-04-21");
    expect(adult).toEqual({
      isMinor: false,
      label: "30 anos",
      months: 0,
      years: 30,
    });

    const baby = calculateAgeDetails("2025-10-21");
    expect(baby?.isMinor).toBe(true);
    expect(baby?.label).toBe("6 meses");

    expect(calculateAgeDetails("2099-01-01")).toBeNull();
  });

  it("suggests email domain typo corrections", () => {
    expect(suggestEmailTypo("usuario@gmai.com")).toBe("usuario@gmail.com");
    expect(suggestEmailTypo("maria@hotmial.com")).toBe("maria@hotmail.com");
    expect(suggestEmailTypo("contato@outlok.com")).toBe("contato@outlook.com");
    expect(suggestEmailTypo("joao@yahooo.com")).toBe("joao@yahoo.com");
    expect(suggestEmailTypo("correto@gmail.com")).toBeNull();
  });

  it("formats names in Title Case preserving prepositions", () => {
    expect(formatNameTitleCase("joao da silva")).toBe("Joao da Silva");
    expect(formatNameTitleCase("MARIA DE SOUZA E SILVA")).toBe("Maria de Souza e Silva");
    expect(formatNameTitleCase("ana clara dos santos")).toBe("Ana Clara dos Santos");
  });
});
