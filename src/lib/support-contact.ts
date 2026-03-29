export type SupportCategory = "erro" | "melhoria" | "duvida" | "outro";

export type SupportContactDraft = {
  category: SupportCategory;
  clinicName: string | null;
  currentPath: string | null;
  includeContext: boolean;
  message: string;
  subject: string;
  userEmail: string | null;
  userName: string | null;
};

const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  duvida: "Duvida",
  erro: "Erro",
  melhoria: "Melhoria",
  outro: "Outro",
};

export const sanitizeSupportPhone = (phone: string) => phone.replace(/\D/g, "");

const buildSupportSubject = (draft: SupportContactDraft) =>
  `[TherapyFlow] ${SUPPORT_CATEGORY_LABELS[draft.category]} - ${draft.subject.trim() || "Contato de suporte"}`;

const buildSupportContext = (draft: SupportContactDraft) => {
  if (!draft.includeContext) {
    return [];
  }

  return [
    draft.clinicName ? `Clínica: ${draft.clinicName}` : null,
    draft.userName ? `Usuário: ${draft.userName}` : null,
    draft.userEmail ? `E-mail: ${draft.userEmail}` : null,
    draft.currentPath ? `Página: ${draft.currentPath}` : null,
  ].filter(Boolean) as string[];
};

const buildSupportBody = (draft: SupportContactDraft) => {
  const lines = [
    buildSupportSubject(draft),
    null,
    `Categoria: ${SUPPORT_CATEGORY_LABELS[draft.category]}`,
    draft.subject.trim() ? `Assunto: ${draft.subject.trim()}` : null,
    null,
    draft.message.trim() || "Sem descrição informada.",
    null,
    ...buildSupportContext(draft),
  ].filter((line): line is string => line !== null);

  return lines.join("\n");
};

export const buildSupportEmailHref = (email: string, draft: SupportContactDraft) => {
  const subject = encodeURIComponent(buildSupportSubject(draft));
  const body = encodeURIComponent(buildSupportBody(draft));

  return `mailto:${email}?subject=${subject}&body=${body}`;
};

export const buildSupportWhatsAppHref = (phone: string, draft: SupportContactDraft) => {
  const cleanPhone = sanitizeSupportPhone(phone);
  const text = buildSupportBody(draft);

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
};
