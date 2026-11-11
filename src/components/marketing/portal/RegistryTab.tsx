import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, KeyRound } from "lucide-react";
import type { AffiliatePortalPartner } from "./types";

interface RegistryTabProps {
  partner: AffiliatePortalPartner;
  onRequestBankChange?: (totpCode: string) => void;
}

export function RegistryTab({ partner, onRequestBankChange }: RegistryTabProps) {
  const [showTotpInput, setShowTotpInput] = useState(false);
  const [totpCode, setTotpCode] = useState("");

  const kycBadge = {
    APPROVED: { label: "KYC Aprovado", variant: "default" as const },
    PENDING: { label: "Em Análise Asaas", variant: "secondary" as const },
    REJECTED: { label: "Documentação Pendente", variant: "destructive" as const },
  }[partner.kycStatus];

  return (
    <div className="space-y-4 pt-3 w-full max-w-full min-w-0">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Credenciamento Bancário & Split Asaas</CardTitle>
              <CardDescription className="text-xs">Dados para liquidação automática via PIX e TED</CardDescription>
            </div>
            <Badge variant={kycBadge.variant} className="min-h-[26px]">
              {kycBadge.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg bg-muted/40 border text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">Instituição Financeira</span>
              <span className="font-semibold text-foreground text-sm">{partner.bankName || "Não informado"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Chave PIX Cadastrada</span>
              <span className="font-semibold text-foreground text-sm font-mono">{partner.pixKey || "Não cadastrada"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Agência</span>
              <span className="font-semibold text-foreground">{partner.bankAgency || "Não informada"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Conta Corrente</span>
              <span className="font-semibold text-foreground font-mono">
                {partner.bankAccount ? `•••• ${partner.bankAccount.slice(-4)}` : "Não informada"}
              </span>
            </div>
          </div>

          {partner.hasActiveTransactions && (
            <div className="flex items-start gap-2.5 p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
              <Lock className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                <strong>Trava de Segurança Ativa:</strong> Há liquidações em andamento nesta conta. A alteração de dados bancários fica suspensa até o fechamento do lote.
              </span>
            </div>
          )}

          <div className="pt-2 border-t">
            {!showTotpInput ? (
              <Button
                variant="outline"
                disabled={partner.hasActiveTransactions}
                onClick={() => setShowTotpInput(true)}
                className="min-h-[44px] touch-manipulation w-full sm:w-auto"
              >
                <KeyRound className="h-4 w-4 mr-2" />
                Solicitar Alteração Bancária (2FA TOTP)
              </Button>
            ) : (
              <div className="p-3 bg-muted/60 rounded-lg border space-y-3">
                <p className="text-xs text-muted-foreground">
                  Digite o código de 6 dígitos gerado no seu aplicativo <strong>Ente Auth</strong> para liberar a edição:
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                    className="h-11 px-3 border rounded font-mono text-center tracking-widest text-base w-full sm:w-40 bg-background"
                  />
                  <Button
                    disabled={totpCode.length !== 6}
                    onClick={() => {
                      onRequestBankChange?.(totpCode);
                      setShowTotpInput(false);
                      setTotpCode("");
                    }}
                    className="min-h-[44px] touch-manipulation"
                  >
                    Confirmar com Ente Auth
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowTotpInput(false);
                      setTotpCode("");
                    }}
                    className="min-h-[44px] touch-manipulation"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
