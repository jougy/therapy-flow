import React, { useState } from "react";
import { Check, CheckCircle2, Copy, ExternalLink, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { formatPatientPhone } from "@/lib/patient-registration";
import { createDocumentSignatureRecord } from "./signatureService";
import {
  buildPublicDocumentSignUrl,
  buildWhatsAppSignatureUrl,
  generateDocumentSignToken,
} from "./types";

interface WhatsAppGeneratedLinkState {
  signToken: string;
  publicUrl: string;
  whatsappUrl: string;
}

interface DocumentWhatsAppChannelBoxProps {
  clinicId?: string | null;
  clinicDisplayName: string;
  patientId?: string;
  sessionId?: string | null;
  userId?: string | null;
  persistedTemplateId: string | null;
  templateTitle: string;
  rawInterpolatedMarkdown: string;
  recipientDisplayName: string;
  signerRole: "paciente" | "responsavel";
  onSignerRoleChange: (role: "paciente" | "responsavel") => void;
  whatsappPhone: string;
  onWhatsappPhoneChange: (phone: string) => void;
  canPersist: boolean;
}

export const DocumentWhatsAppChannelBox: React.FC<DocumentWhatsAppChannelBoxProps> = ({
  clinicId,
  clinicDisplayName,
  patientId,
  sessionId,
  userId,
  persistedTemplateId,
  templateTitle,
  rawInterpolatedMarkdown,
  recipientDisplayName,
  signerRole,
  onSignerRoleChange,
  whatsappPhone,
  onWhatsappPhoneChange,
  canPersist,
}) => {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<WhatsAppGeneratedLinkState | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleGenerateWhatsApp = async () => {
    if (!clinicId || !patientId) {
      toast({
        title: "Dados incompletos",
        description: "É necessário um paciente e clínica vinculados para gerar o link de assinatura.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const signToken = generateDocumentSignToken();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const publicUrl = buildPublicDocumentSignUrl(origin, signToken);

      await createDocumentSignatureRecord({
        clinicId,
        patientId,
        sessionId: sessionId || null,
        templateId: persistedTemplateId,
        templateTitle,
        renderedMarkdown: rawInterpolatedMarkdown,
        signToken,
        status: "pending",
        signerName: recipientDisplayName,
        signerRole,
        signatureMetadata: {
          channel: "whatsapp",
          requested_at: new Date().toISOString(),
        },
        createdBy: userId || null,
      });

      const message = `Olá, ${recipientDisplayName}! A clínica *${clinicDisplayName}* enviou o documento *${templateTitle}* para sua leitura e assinatura digital segura.\n\nAcesse o link abaixo para revisar e assinar:\n${publicUrl}`;
      const whatsappUrl = buildWhatsAppSignatureUrl(whatsappPhone, message);

      setResult({ signToken, publicUrl, whatsappUrl });
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");

      toast({
        title: "Link de assinatura gerado!",
        description: "O registro foi salvo como pendente e o WhatsApp foi aberto.",
      });
    } catch (err) {
      toast({
        title: "Erro ao gerar link de assinatura",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleCopyLink = async () => {
    if (!result?.publicUrl) return;
    try {
      await navigator.clipboard.writeText(result.publicUrl);
      setCopiedLink(true);
      toast({ title: "Link copiado para a área de transferência!" });
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast({
        title: "Não foi possível copiar automaticamente",
        description: "Selecione e copie o link exibido na tela.",
        variant: "destructive",
      });
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()} className="pt-2 space-y-2.5 border-t border-border/50">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="wa-phone-input" className="text-[11px] font-medium">
            WhatsApp do Destinatário
          </Label>
          <Input
            id="wa-phone-input"
            value={whatsappPhone}
            onChange={(e) => onWhatsappPhoneChange(formatPatientPhone(e.target.value))}
            placeholder="(11) 99999-9999"
            className="h-10 text-xs bg-background"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] font-medium block">Destinatário</Label>
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={signerRole === "paciente" ? "default" : "outline"}
              onClick={() => onSignerRoleChange("paciente")}
              className="h-10 text-xs flex-1"
            >
              Paciente
            </Button>
            <Button
              type="button"
              size="sm"
              variant={signerRole === "responsavel" ? "default" : "outline"}
              onClick={() => onSignerRoleChange("responsavel")}
              className="h-10 text-xs flex-1"
            >
              Responsável
            </Button>
          </div>
        </div>
      </div>

      <Button
        type="button"
        disabled={!canPersist || sending}
        onClick={handleGenerateWhatsApp}
        className="w-full min-h-[44px] text-xs font-semibold gap-2"
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
        Gerar Link e Abrir WhatsApp
      </Button>

      {result && (
        <div className="p-3 rounded-lg border bg-background space-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Solicitação pendente registrada!</span>
          </div>
          <p className="text-[11px] font-mono text-muted-foreground break-all bg-muted/40 p-2 rounded border">
            {result.publicUrl}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="min-h-[40px] text-xs gap-1.5 flex-1"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedLink ? "Link Copiado!" : "Copiar Link"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => window.open(result.whatsappUrl, "_blank", "noopener,noreferrer")}
              className="min-h-[40px] text-xs gap-1.5 flex-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir WhatsApp
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
