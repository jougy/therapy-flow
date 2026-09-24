import React from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, FileText } from "lucide-react";

interface InvoiceStatusBadgeProps {
  status: string;
}

export const InvoiceStatusBadge: React.FC<InvoiceStatusBadgeProps> = ({ status }) => {
  const isPaid = status === "CONFIRMED" || status === "RECEIVED";
  const isPending = status === "PENDING";

  return (
    <Badge
      variant="outline"
      className={
        isPaid
          ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
          : isPending
          ? "border-yellow-500/30 text-yellow-600 dark:text-yellow-400 bg-yellow-500/10"
          : "border-neutral-500/30 text-neutral-400"
      }
    >
      {isPaid ? "Pago / Confirmado" : isPending ? "Pendente" : status}
    </Badge>
  );
};

interface InvoiceNfeBadgeProps {
  nfeStatus?: string | null;
  nfeNumber?: string | null;
}

export const InvoiceNfeBadge: React.FC<InvoiceNfeBadgeProps> = ({ nfeStatus, nfeNumber }) => {
  if (nfeStatus === "AUTHORIZED") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 inline-flex items-center gap-1"
        title={nfeNumber ? `Número: ${nfeNumber}` : undefined}
      >
        <FileText className="w-3 h-3" />
        NFS-e Emitida
      </Badge>
    );
  }

  if (nfeStatus === "PENDING") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 inline-flex items-center gap-1"
      >
        <Clock className="w-3 h-3" />
        NFS-e em processamento
      </Badge>
    );
  }

  return <span className="text-muted-foreground text-xs">-</span>;
};
