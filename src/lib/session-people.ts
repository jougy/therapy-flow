type SessionPersonLike = {
  email?: string | null;
  full_name?: string | null;
};

type SessionEditHistoryLike = {
  edited_at: string;
  editor_user_id: string;
  id: string;
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
