import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatMoneyCents, getPaymentStatusLabel, currencyDigitsToInput, type SessionPaymentStatus } from "@/lib/session-operations";
import { PAYMENT_AMOUNT_INPUT_MAX_LENGTH, paymentStatusBadgeClassNames } from "../types";

export const PaymentStatusAutoControl = ({
  disabled,
  onChange,
  saving,
  status,
}: {
  disabled?: boolean;
  onChange: (status: SessionPaymentStatus) => void;
  saving?: boolean;
  status: SessionPaymentStatus;
}) => {
  const isCourtesy = status === "cortesia";

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
      <Badge
        variant="outline"
        className={`w-fit gap-1.5 px-3 py-1 text-sm ${paymentStatusBadgeClassNames[status]}`}
      >
        {getPaymentStatusLabel(status)}
      </Badge>
      <label className="flex w-fit items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium">
        <Checkbox
          checked={isCourtesy}
          onCheckedChange={(checked) => onChange(checked ? "cortesia" : "nao_cobrado")}
          disabled={disabled || saving}
          aria-label="Marcar pagamento como cortesia"
        />
        <span>Cortesia</span>
      </label>
    </div>
  );
};

export const PaymentCompositionChips = ({
  creditCents,
  paidCents,
}: {
  creditCents: number;
  paidCents: number;
}) => {
  if (creditCents <= 0) {
    return null;
  }

  const complementaryCents = Math.max(0, paidCents - creditCents);

  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="rounded-full border border-success/20 bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
        Pago {formatMoneyCents(paidCents)}
      </span>
      <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
        Crédito {formatMoneyCents(creditCents)}
      </span>
      <span className="rounded-full border border-muted-foreground/20 bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
        Complemento {formatMoneyCents(complementaryCents)}
      </span>
    </div>
  );
};

export const CurrencyInput = ({
  disabled,
  id,
  onChange,
  value,
}: {
  disabled?: boolean;
  id: string;
  onChange: (value: string) => void;
  value: string;
}) => (
  <div className="relative">
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
      R$
    </span>
    <Input
      id={id}
      className="pl-10"
      inputMode="decimal"
      maxLength={PAYMENT_AMOUNT_INPUT_MAX_LENGTH}
      type="text"
      value={value}
      onChange={(event) => onChange(currencyDigitsToInput(event.target.value))}
      placeholder="0,00"
      disabled={disabled}
    />
  </div>
);
