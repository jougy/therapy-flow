type SanitizeTextInputOptions = {
  maxLength: number;
  multiline?: boolean;
};

const truncateByCodePoints = (value: string, maxLength: number) => Array.from(value).slice(0, maxLength).join("");
const isControlCodePoint = (codePoint: number) => (codePoint >= 0x00 && codePoint <= 0x1f) || codePoint === 0x7f;

const stripUnsafeCharacters = (value: string, multiline: boolean) =>
  Array.from(value)
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;

      if (!isControlCodePoint(codePoint)) {
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
