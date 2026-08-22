import type { Database } from "@/integrations/supabase/types";

export type PatientPaymentPlanRow = Database["public"]["Tables"]["patient_payment_plans"]["Row"];
export type PatientPaymentPlanInsert = Database["public"]["Tables"]["patient_payment_plans"]["Insert"];

export interface PaymentPlanFormValues {
  createPlan: boolean;
  name: string;
  totalSessions: number;
  totalAmount: string; // Formated currency or raw digits string
  paymentMethod: string;
  paymentInstallments: number;
  paymentStatus: "pendente" | "pago" | "parcial" | "cancelado";
  paymentStatusDate: string;
  startDate: string; // YYYY-MM-DD
  autoPreScheduleAgenda: boolean;
  autoCreateDraftSessions: boolean;
  recurringWeekdays: number[]; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  recurringTime: string; // HH:mm
}

export const DEFAULT_PAYMENT_PLAN_FORM_VALUES: PaymentPlanFormValues = {
  createPlan: false,
  name: "Pacote de 10 Sessões",
  totalSessions: 10,
  totalAmount: "0,00",
  paymentMethod: "nao_informado",
  paymentInstallments: 1,
  paymentStatus: "pago",
  paymentStatusDate: new Date().toISOString().split("T")[0],
  startDate: new Date().toISOString().split("T")[0],
  autoPreScheduleAgenda: true,
  autoCreateDraftSessions: false,
  recurringWeekdays: [1], // Default: Monday
  recurringTime: "14:00",
};

export const PAYMENT_PLAN_STATUS_OPTIONS = [
  { value: "pago", label: "Pago integralmente" },
  { value: "pendente", label: "Pendente" },
  { value: "parcial", label: "Pago parcialmente" },
  { value: "cancelado", label: "Cancelado" },
] as const;

export const getPaymentPlanStatusLabel = (status: string | null | undefined): string => {
  switch (status) {
    case "pago":
      return "Pago integralmente";
    case "pendente":
      return "Pendente";
    case "parcial":
      return "Pago parcialmente";
    case "cancelado":
      return "Cancelado";
    default:
      return "Pendente";
  }
};

export const getPaymentPlanBadgeStyle = (status: string | null | undefined): string => {
  switch (status) {
    case "pago":
      return "border-success/20 bg-success/15 text-success";
    case "parcial":
      return "border-warning/20 bg-warning/15 text-warning";
    case "cancelado":
      return "border-destructive/20 bg-destructive/15 text-destructive";
    case "pendente":
    default:
      return "border-primary/20 bg-primary/10 text-primary";
  }
};

export const calculateSessionUnitAmountCents = (totalAmountCents: number, totalSessions: number): number => {
  if (totalSessions <= 0 || totalAmountCents <= 0) {
    return 0;
  }
  return Math.round(totalAmountCents / totalSessions);
};

/**
  Generates upcoming N session dates based on start date, recurring weekdays, and time.
  If no weekdays are selected, it defaults to weekly intervals (every 7 days).
 */
export const generatePlanScheduleDates = ({
  count,
  recurringTime = "14:00",
  recurringWeekdays = [],
  startDateStr,
}: {
  count: number;
  recurringTime?: string;
  recurringWeekdays?: number[];
  startDateStr: string;
}): Date[] => {
  if (count <= 0) {
    return [];
  }

  const [hoursStr, minutesStr] = recurringTime.split(":");
  const hours = parseInt(hoursStr || "14", 10);
  const minutes = parseInt(minutesStr || "0", 10);

  const dates: Date[] = [];
  const baseDate = new Date(`${startDateStr}T00:00:00`);
  
  if (isNaN(baseDate.getTime())) {
    return [];
  }

  const activeWeekdays = recurringWeekdays.filter((w) => w >= 0 && w <= 6);

  if (activeWeekdays.length === 0) {
    // Default: weekly intervals starting from startDate
    for (let i = 0; i < count; i++) {
      const current = new Date(baseDate);
      current.setDate(baseDate.getDate() + i * 7);
      current.setHours(hours, minutes, 0, 0);
      dates.push(current);
    }
    return dates;
  }

  // Iterate day by day from startDate until count dates are found
  const current = new Date(baseDate);
  while (dates.length < count) {
    const dayOfWeek = current.getDay();
    if (activeWeekdays.includes(dayOfWeek)) {
      const dateCopy = new Date(current);
      dateCopy.setHours(hours, minutes, 0, 0);
      dates.push(dateCopy);
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
};
