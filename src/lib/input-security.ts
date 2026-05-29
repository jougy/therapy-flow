type SanitizeTextInputOptions = {
  maxLength: number;
  multiline?: boolean;
};

export const INPUT_LIMITS = {
  addressComplement: 120,
  addressNumber: 40,
  city: 120,
  clinicalLongText: 2_000,
  country: 80,
  email: 254,
  formDescription: 300,
  formFieldLabel: 160,
  formHelpText: 300,
  formOptionLabel: 120,
  formPlaceholder: 160,
  formTemplateName: 120,
  id: 120,
  name: 160,
  agendaTitle: 160,
  patientDocument: 32,
  phone: 24,
  profession: 120,
  shortText: 240,
  state: 40,
  street: 160,
  treatmentInstruction: 1_500,
  treatmentShortText: 160,
} as const;

const truncateByCodePoints = (value: string, maxLength: number) => Array.from(value).slice(0, maxLength).join("");
const isControlCodePoint = (codePoint: number) => (codePoint >= 0x00 && codePoint <= 0x1f) || codePoint === 0x7f;
const isUnsafeFormatCodePoint = (codePoint: number) =>
  (codePoint >= 0x200b && codePoint <= 0x200f) ||
  (codePoint >= 0x202a && codePoint <= 0x202e) ||
  (codePoint >= 0x2060 && codePoint <= 0x206f) ||
  codePoint === 0xfeff;
const isEmojiCodePoint = (codePoint: number) =>
  (codePoint >= 0x1f000 && codePoint <= 0x1faff) ||
  (codePoint >= 0x2600 && codePoint <= 0x27bf) ||
  (codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff) ||
  (codePoint >= 0x1f3fb && codePoint <= 0x1f3ff) ||
  codePoint === 0xfe0e ||
  codePoint === 0xfe0f;

const stripUnsafeCharacters = (value: string, multiline: boolean) =>
  Array.from(value)
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;

      if (isEmojiCodePoint(codePoint)) {
        return false;
      }

      if (!isControlCodePoint(codePoint) && !isUnsafeFormatCodePoint(codePoint)) {
        return true;
      }

      return multiline && character === "\n";
    })
    .join("");

export const sanitizeTextInput = (
  value: string,
  { maxLength, multiline = false }: SanitizeTextInputOptions
) => {
  const normalized = value.normalize("NFC");

  if (!multiline) {
    return truncateByCodePoints(
      stripUnsafeCharacters(
        normalized
        .replace(/\r\n?/g, " ")
        .replace(/\n/g, " ")
        .replace(/\t/g, " "),
        false
      ),
      maxLength
    );
  }

  return truncateByCodePoints(
    stripUnsafeCharacters(
      normalized
      .replace(/\r\n?/g, "\n")
      .replace(/\t/g, " "),
      true
    ),
    maxLength
  );
};

export const sanitizeSingleLineInput = (value: string, maxLength: number) =>
  sanitizeTextInput(value, { maxLength });

export const sanitizeMultilineInput = (value: string, maxLength: number) =>
  sanitizeTextInput(value, { maxLength, multiline: true });
