type SessionPersonLike = {
  email?: string | null;
  full_name?: string | null;
};

type SessionEditHistoryLike = {
  edited_at: string;
  editor_user_id: string;
  id: string;
};

const NAME_CONNECTIVES = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
]);

/**
 * Abrevia nomes longos para caber confortavelmente em cards e badges de atendimento:
 * Mantém o primeiro nome intacto e o restante como inicial (ex: "João Paulo Taddeo do Val" -> "João P.T.V.").
 * Conectivos comuns ("de", "da", "do", "das", "dos", "e") são descartados.
 */
export const formatAbbreviatedName = (name: string | null | undefined): string => {
  if (!name) return "";
  const trimmed = name.trim();
  if (!trimmed) return "";

  // Se for e-mail (ex: fallback sem full_name), preserva ou retorna a parte antes do @
  if (trimmed.includes("@") && !trimmed.includes(" ")) {
    return trimmed;
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return trimmed;
  }

  const firstName = parts[0];
  const middleAndLast = parts.slice(1);
  const initials: string[] = [];

  for (const part of middleAndLast) {
    const lower = part.toLowerCase();
    if (NAME_CONNECTIVES.has(lower)) {
      continue;
    }
    // Pega o primeiro caractere alfabético/válido
    const firstChar = part.charAt(0).toUpperCase();
    if (firstChar) {
      initials.push(`${firstChar}.`);
    }
  }

  if (initials.length === 0) {
    return firstName;
  }

  return `${firstName} ${initials.join("")}`;
};

export const getSessionPersonLabel = (
  person: SessionPersonLike | null | undefined,
  fallback = "Colaborador"
) => {
  const fullName = person?.full_name?.trim();

  if (fullName) {
    return fullName;
  }

  const email = person?.email?.trim();
  return email || fallback;
};

export const formatSessionAuditDateTime = (value: string | null | undefined) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("pt-BR");
};

export const buildSessionEditHistoryView = (
  entries: SessionEditHistoryLike[],
  profileMap: Map<string, SessionPersonLike>
) =>
  [...entries]
    .sort((left, right) => new Date(right.edited_at).getTime() - new Date(left.edited_at).getTime())
    .map((entry) => ({
      editedAtLabel: formatSessionAuditDateTime(entry.edited_at),
      editorName: getSessionPersonLabel(profileMap.get(entry.editor_user_id)),
      id: entry.id,
    }));
