export const extractCpfDigits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

export const getPatientRegistrationPassword = (cpf: string | null | undefined) => {
  const digits = extractCpfDigits(cpf);

  if (digits.length < 6) {
    return null;
  }

  return digits.slice(0, 6);
};

export const buildPatientRegistrationUrl = (origin: string, token: string) =>
  `${origin}/cadastro/paciente/${token}`;
