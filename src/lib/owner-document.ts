const CPF_LENGTH = 11;
const CNPJ_LENGTH = 14;

export const getOwnerDocumentDigits = (value: string) => value.replace(/\D/g, "").slice(0, CNPJ_LENGTH);

export const isOwnerDocumentValid = (value: string) => {
  const digits = getOwnerDocumentDigits(value);
  return digits.length === CPF_LENGTH || digits.length === CNPJ_LENGTH;
};

export const formatOwnerDocument = (value: string) => {
  const digits = getOwnerDocumentDigits(value);

  if (digits.length <= CPF_LENGTH) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};
