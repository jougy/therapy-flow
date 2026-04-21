export const PATIENT_STATUS_META = {
  ativo: {
    badgeClassName: "bg-success/15 text-success border-success/20 hover:bg-success/20",
    label: "Ativo",
    priority: 0,
  },
  pausado: {
    badgeClassName: "bg-warning/15 text-warning border-warning/20 hover:bg-warning/20",
    label: "Pausado",
    priority: 1,
  },
  pagamento_pendente: {
    badgeClassName: "bg-warning/15 text-warning border-warning/20 hover:bg-warning/20",
    label: "Pagamento pendente",
    priority: 2,
  },
  inativo: {
    badgeClassName: "",
    label: "Inativo",
    priority: 3,
  },
  alta: {
    badgeClassName: "bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100",
    label: "Alta",
    priority: 4,
  },
} as const;

export type KnownPatientStatus = keyof typeof PATIENT_STATUS_META;
export type EditablePatientStatus = Exclude<KnownPatientStatus, "pagamento_pendente">;

export const PATIENT_STATUS_OPTIONS = (Object.entries(PATIENT_STATUS_META) as Array<
  [KnownPatientStatus, (typeof PATIENT_STATUS_META)[KnownPatientStatus]]
>).map(([value, meta]) => ({
  label: meta.label,
  value,
}));

export const EDITABLE_PATIENT_STATUS_VALUES: EditablePatientStatus[] = ["ativo", "pausado", "inativo", "alta"];

export const EDITABLE_PATIENT_STATUS_OPTIONS = EDITABLE_PATIENT_STATUS_VALUES.map((value) => ({
  label: PATIENT_STATUS_META[value].label,
  value,
}));

const formatFallbackPatientStatusLabel = (status: string | null | undefined) => {
  if (!status) {
    return PATIENT_STATUS_META.inativo.label;
  }

  return status
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
};

export const getPatientStatusMeta = (status: string | null | undefined) => {
  if (status && status in PATIENT_STATUS_META) {
    return PATIENT_STATUS_META[status as KnownPatientStatus];
  }

  return {
    badgeClassName: PATIENT_STATUS_META.inativo.badgeClassName,
    label: formatFallbackPatientStatusLabel(status),
    priority: Number.MAX_SAFE_INTEGER,
  };
};

export const comparePatientStatusPriority = (leftStatus: string, rightStatus: string) =>
  getPatientStatusMeta(leftStatus).priority - getPatientStatusMeta(rightStatus).priority;
