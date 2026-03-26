export const LOCAL_TEST_LOGINS = {
  clinic: {
    cnpjDigits: "98765432000110",
    cnpjFormatted: "98.765.432/0001-10",
    email: "clinic.owner@therapyflow.local",
    label: "Conta Clinic",
    password: "123456",
  },
  solo: {
    cnpjDigits: "12345678000190",
    cnpjFormatted: "12.345.678/0001-90",
    email: "solo@therapyflow.local",
    label: "Conta Solo",
    password: "123456",
  },
} as const;

export const isLocalSupabaseUrl = (url: string | undefined) => {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
};
