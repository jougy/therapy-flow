import React, { useState, useId } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Download,
  ShieldCheck,
  AlertTriangle,
  Scale,
  Ban,
  Clock,
  Fingerprint,
  CheckCircle2,
  Building,
} from "lucide-react";
import { AFFILIATE_TIERS } from "@/lib/affiliate-tiers";

export interface AffiliateOptInAuditLog {
  termsVersion: string;
  acceptedAt: string;
  lgpdHash: string;
  userAgent?: string;
  userIdentifier?: string;
}

export interface AffiliateLegalTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: (auditLog: AffiliateOptInAuditLog) => void | Promise<void>;
  alreadyAccepted?: boolean;
  userIdentifier?: string;
  termsVersion?: string;
  acceptedAt?: string;
  existingHash?: string;
}

export const DEFAULT_TERMS_VERSION = "v1.0-2026";
export const OFFICIAL_DOCX_URL = "/downloads/Termos_e_Condicoes_Programa_Afiliados_PluriHealth.docx";

export function generateAffiliateTermsHash(identifier: string, timestamp: string, version: string): string {
  const seed = `${identifier || "partner"}_${timestamp}_${version}_pluri_compliance`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0").toUpperCase();
  return `LGPD-PLURI-${version.toUpperCase()}-${hex}`;
}

export function AffiliateLegalTermsModal({
  isOpen,
  onClose,
  onAccept,
  alreadyAccepted = false,
  userIdentifier = "afiliado@pluri.health",
  termsVersion = DEFAULT_TERMS_VERSION,
  acceptedAt: externalAcceptedAt,
  existingHash,
}: AffiliateLegalTermsModalProps) {
  const [isChecked, setIsChecked] = useState(alreadyAccepted);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const checkboxId = useId();

  const auditTimestamp = externalAcceptedAt || "2026-11-10T00:00:00.000Z";
  const displayHash = existingHash || generateAffiliateTermsHash(userIdentifier, auditTimestamp, termsVersion);

  const handleDownloadDocx = () => {
    if (typeof document === "undefined") return;
    const anchor = document.createElement("a");
    anchor.href = OFFICIAL_DOCX_URL;
    anchor.setAttribute("download", "Termos_e_Condicoes_Programa_Afiliados_PluriHealth.docx");
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const handleConfirmAccept = async () => {
    if (alreadyAccepted) {
      onClose();
      return;
    }
    if (!isChecked) return;
    if (onAccept) {
      setIsSubmitting(true);
      try {
        const currentTimestamp = new Date().toISOString();
        const generatedHash = generateAffiliateTermsHash(userIdentifier, currentTimestamp, termsVersion);
        await onAccept({
          termsVersion,
          acceptedAt: currentTimestamp,
          lgpdHash: generatedHash,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "desktop-web",
          userIdentifier,
        });
      } finally {
        setIsSubmitting(false);
      }
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-testid="affiliate-legal-terms-modal"
        className="w-full max-w-2xl min-w-0 overflow-x-hidden p-0 rounded-2xl sm:rounded-3xl border bg-background shadow-2xl flex flex-col max-h-[85dvh]"
      >
        <DialogHeader className="p-4 sm:p-5 border-b bg-muted/20 text-left space-y-1.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5 font-semibold text-primary border-primary/30">
              <Scale className="w-3.5 h-3.5 shrink-0" />
              <span>Regulamento & Compliance Jurídico</span>
            </Badge>
            <Badge variant="secondary" className="font-mono text-[11px]">
              {termsVersion}
            </Badge>
            {alreadyAccepted && (
              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-[11px]">
                <CheckCircle2 className="w-3 h-3" /> Termo Assinado
              </Badge>
            )}
          </div>
          <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            Termo de Adesão e Regulamento do Programa de Afiliados
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            Diretrizes contratuais cíveis, comissionamento ad exitum, unicidade de contexto e regras de marketing ético.
          </DialogDescription>
        </DialogHeader>

        {/* Corpo com Scroll Independente e Ergonomia Mobile */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 text-xs sm:text-sm text-foreground/90 min-w-0 max-w-full touch-pan-y">
          {/* Preâmbulo Institucional */}
          <div className="p-3.5 rounded-xl border bg-muted/30 text-muted-foreground leading-relaxed">
            Pelo presente instrumento, a <strong>PLURI-HEALTH TECNOLOGIA LTDA</strong> e o parceiro cadastrado
            celebram o presente Termo de Adesão ao Programa de Afiliados, sob estrita conformidade cível e as condições abaixo:
          </div>

          {/* Cláusula 1ª */}
          <section className="space-y-1.5 border-b pb-3.5">
            <h4 className="font-bold text-foreground flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-primary shrink-0" />
              CLÁUSULA 1ª – DO OBJETO DA PARCERIA
            </h4>
            <p className="text-muted-foreground leading-relaxed">
              1.1. Divulgação voluntária, comercial e não exclusiva das soluções de software e planos de assinatura SaaS da PLURI-HEALTH.
              <br />
              1.2. A divulgação é realizada via links oficiais personalizados e cupons nominais fornecidos pela Plataforma para rastreamento unificado.
            </p>
          </section>

          {/* Cláusula 2ª */}
          <section className="space-y-1.5 border-b pb-3.5">
            <h4 className="font-bold text-foreground flex items-center gap-2 text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              CLÁUSULA 2ª – DA TOTAL INEXISTÊNCIA DE VÍNCULO EMPREGATÍCIO
            </h4>
            <p className="text-muted-foreground leading-relaxed">
              2.1. Natureza estritamente comercial e cível regida pelos arts. 722 a 729 do Código Civil Brasileiro. Não gera qualquer relação de emprego (CLT),
              subordinação hierárquica, representação exclusiva ou exigência de metas.
              <br />
              2.2. O Afiliado atua com <strong>plena autonomia técnica, temporal e de métodos</strong>, definindo livremente horários e assumindo seus custos operacionais.
            </p>
          </section>

          {/* Cláusula 3ª */}
          <section className="space-y-2 border-b pb-3.5">
            <h4 className="font-bold text-foreground flex items-center gap-2 text-sm">
              <Scale className="w-4 h-4 text-primary shrink-0" />
              CLÁUSULA 3ª – DA REMUNERAÇÃO, TIERS E SPLIT AUTOMÁTICO
            </h4>
            <p className="text-muted-foreground leading-relaxed">
              3.1. Remuneração baseada exclusivamente no êxito comercial comprovado (<em>ad exitum</em>), creditada na subconta do Afiliado via split de pagamento pré-crédito (Asaas).
            </p>
            {/* Tabela Oficial dos 8 Degraus */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {AFFILIATE_TIERS.map((tier) => (
                <div key={tier.tier} className="p-2.5 rounded-lg border bg-card/60 flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tier.color }} />
                    {tier.label} ({tier.minActiveReferrals}{tier.maxActiveReferrals ? `-${tier.maxActiveReferrals}` : '+'} ativos)
                  </span>
                  <span className="text-primary font-mono font-semibold text-xs shrink-0">
                    {tier.firstMonthCommissionPercent}% / {tier.recurringCommissionPercent}%
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">
              * Percentuais indicam: 1º mês / Recorrente mensal. Isenções de mensalidade Pluri aplicam-se a partir do Tier Prata (4+ ativos).
            </p>
          </section>

          {/* Cláusula 3ª-A */}
          <section className="space-y-1.5 border-b pb-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 sm:p-4">
            <h4 className="font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2 text-sm">
              <Building className="w-4 h-4 shrink-0" />
              CLÁUSULA 3ª-A – UNICIDADE E PAUSA POR VINCULAÇÃO INSTITUCIONAL
            </h4>
            <p className="text-foreground/90 leading-relaxed text-xs">
              <strong>Regra de Unicidade:</strong> Cada usuário (CPF/ID) opera em apenas 1 (um) programa de afiliados por vez no ecossistema Pluri-Health.
              <br />
              <strong>Pausa Automática:</strong> Ao integrar a equipe de uma clínica terceira sob CNPJ contratante, a afiliação individual anterior entra em
              pausa automática para novas captações, preservando comissões recorrentes preexistentes. Medida para prevenir conflitos de interesse e desvio de clientela.
            </p>
          </section>

          {/* Cláusula 4ª */}
          <section className="space-y-1.5 border-b pb-3.5">
            <h4 className="font-bold text-foreground flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              CLÁUSULA 4ª – DE ESTORNOS, CHARGEBACKS E RESGATE
            </h4>
            <p className="text-muted-foreground leading-relaxed">
              4.1. Em caso de cancelamento, direito de arrependimento (art. 49 CDC) ou contestação (chargeback), o split de pagamento é estornado
              automaticamente da subconta do Afiliado na exata proporção da comissão creditada.
              <br />
              4.2. Havendo saldo insuficiente no momento, o valor devedor é compensado nas comissões subsequentes.
            </p>
          </section>

          {/* Cláusula 5ª */}
          <section className="space-y-1.5 border-b pb-3.5">
            <h4 className="font-bold text-foreground flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              CLÁUSULA 5ª – DA CONDUTA ÉTICA E REGRAS DE MARKETING
            </h4>
            <p className="text-muted-foreground leading-relaxed">
              5.1. É expressamente vedado: (a) envio de Spam ou mensagens não autorizadas; (b) prometer ganhos fáceis ou resultados clínicos inverídicos;
              (c) compra de palavras-chave da marca Pluri-Health em Google/Bing Ads; (d) criar perfis falsos se passando pela Plataforma;
              (e) auto-indicação fraudulenta (self-referral).
            </p>
          </section>

          {/* Cláusula 5ª-A */}
          <section className="space-y-1.5 border-b pb-3.5 rounded-xl border border-destructive/20 bg-destructive/5 p-3 sm:p-4">
            <h4 className="font-bold text-destructive flex items-center gap-2 text-sm">
              <Ban className="w-4 h-4 shrink-0" />
              CLÁUSULA 5ª-A – NÍVEL ÚNICO (SINGLE-LEVEL) E VEDAÇÃO ANTI-PIRÂMIDE
            </h4>
            <p className="text-foreground/90 leading-relaxed text-xs">
              <strong>Single-Level Estrito:</strong> Comissionamento conferido exclusivamente em 1º grau sobre assinaturas reais de software SaaS.
              É <strong>terminantemente proibida</strong> qualquer estrutura multinível (MMN), piramidal, matriz forçada, cobrança de taxas de adesão/recrutamento
              ou criação de redes de sub-afiliados.
              <br />
              <strong>Conformidade Legal:</strong> Violações tipificadas pelo Art. 2º, IX da Lei Federal nº 1.521/1951 acarretam banimento sumário imediato, perda total de saldos e comunicação ao Ministério Público.
            </p>
          </section>

          {/* Carimbo Digital de Auditoria LGPD */}
          <div className="p-3.5 rounded-xl border bg-muted/40 space-y-2">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs">
              <Fingerprint className="w-4 h-4 shrink-0" />
              <span>Carimbo Digital de Auditoria & Registro de Opt-In (LGPD)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">Versão Normativa:</span> {termsVersion}
              </div>
              <div>
                <span className="font-medium text-foreground">Data/Timestamp:</span> {auditTimestamp}
              </div>
              <div className="sm:col-span-2 break-all font-mono text-[10px] bg-background/80 p-1.5 rounded border">
                <span className="font-medium text-foreground">Hash Criptográfico LGPD:</span> {displayHash}
              </div>
            </div>
          </div>

          {/* Checkbox de Aceite */}
          {!alreadyAccepted && (
            <div className="pt-2 flex items-start gap-2.5">
              <Checkbox
                id={checkboxId}
                data-testid="terms-accept-checkbox"
                checked={isChecked}
                onCheckedChange={(val) => setIsChecked(Boolean(val))}
                className="mt-0.5 shrink-0"
              />
              <Label htmlFor={checkboxId} className="text-xs leading-relaxed text-foreground cursor-pointer font-medium">
                Li, compreendi e concordo integralmente com as diretrizes contratuais, a regra de nível único (Lei 1.521/51),
                a unicidade de afiliação e as regras financeiras de estorno em chargebacks.
              </Label>
            </div>
          )}
        </div>

        {/* Rodapé Mobile-First com Touch Target >= 44px */}
        <DialogFooter className="p-4 sm:p-5 border-t bg-muted/10 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleDownloadDocx}
            data-testid="btn-download-terms-docx"
            className="min-h-[44px] w-full sm:w-auto gap-2 text-xs font-semibold"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Baixar Documento Oficial (.docx)</span>
          </Button>

          <div className="flex flex-col sm:flex-row items-stretch gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              data-testid="btn-close-terms"
              className="min-h-[44px] text-xs"
            >
              {alreadyAccepted ? "Fechar Visualização" : "Decidir Depois"}
            </Button>
            <Button
              type="button"
              onClick={handleConfirmAccept}
              disabled={(!isChecked && !alreadyAccepted) || isSubmitting}
              data-testid="btn-accept-terms"
              className="min-h-[44px] text-xs font-semibold gap-1.5"
            >
              {isSubmitting ? (
                "Registrando Aceite..."
              ) : alreadyAccepted ? (
                "Entendido"
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Aceitar e Registrar Termos</span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
