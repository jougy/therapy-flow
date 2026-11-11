import React from "react";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import type { AffiliateRecord, KycStatus } from "./types";

export interface AffiliateRegistrationSectionProps {
  affiliate: AffiliateRecord;
  kycStatus: KycStatus;
}

export const AffiliateRegistrationSection: React.FC<AffiliateRegistrationSectionProps> = ({
  affiliate,
  kycStatus,
}) => {
  return (
    <div className="p-3.5 rounded-lg border space-y-3 bg-card w-full max-w-full min-w-0">
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Dados Cadastrais & Asaas
        </span>
        <Badge
          data-testid="kyc-badge"
          className={
            kycStatus === "APPROVED"
              ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
              : kycStatus === "REJECTED"
              ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300"
              : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
          }
        >
          {kycStatus === "APPROVED" && <CheckCircle2 className="h-3 w-3 mr-1" />}
          {kycStatus === "PENDING" && <Clock className="h-3 w-3 mr-1" />}
          {kycStatus === "REJECTED" && <AlertTriangle className="h-3 w-3 mr-1" />}
          KYC: {kycStatus}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div className="truncate">
          <span className="text-muted-foreground">Titular:</span>{" "}
          <strong className="text-foreground">{affiliate.profile?.full_name || "Não informado"}</strong>
        </div>
        <div className="truncate">
          <span className="text-muted-foreground">CPF/CNPJ:</span>{" "}
          <strong className="text-foreground">{affiliate.profile?.cpf || affiliate.pix_key || "—"}</strong>
        </div>
        <div className="truncate">
          <span className="text-muted-foreground">E-mail Fiscal:</span>{" "}
          <strong className="text-foreground">{affiliate.profile?.email || "—"}</strong>
        </div>
        <div className="truncate">
          <span className="text-muted-foreground">Chave PIX:</span>{" "}
          <strong className="text-foreground">{affiliate.pix_key || "Não cadastrada"}</strong>
        </div>
        <div className="truncate">
          <span className="text-muted-foreground">Subconta Asaas:</span>{" "}
          <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono">
            {affiliate.asaas_account_id}
          </code>
        </div>
        <div className="truncate">
          <span className="text-muted-foreground">Wallet Asaas:</span>{" "}
          <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono">
            {affiliate.asaas_wallet_id || "Não vinculada"}
          </code>
        </div>
      </div>
    </div>
  );
};
