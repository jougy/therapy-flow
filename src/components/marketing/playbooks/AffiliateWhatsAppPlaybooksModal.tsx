import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, MessageCircle, Sparkles } from "lucide-react";

export interface PlaybookTemplate {
  id: string;
  title: string;
  badge: string;
  description: string;
  template: string;
}

export const PLAYBOOK_TEMPLATES: PlaybookTemplate[] = [
  {
    id: "colegas",
    title: "Indicação para Colega Autônomo",
    badge: "Colega / Autônomo",
    description: "Tom amigável para colegas de profissão, pós-graduação ou grupos de trabalho.",
    template:
      "Fala, {{PRIMEIRO_NOME}}! Tudo bem? Cara, lembrei de você porque comecei a usar uma plataforma muito boa para prontuário eletrônico e gestão de atendimentos de fisioterapia, a Pluri Health.\n\nEles têm avaliação postural rápida, histórico de evolução do paciente e dá para usar no celular direto no consultório.\n\nConsegui um cupom especial de 10% OFF para você testar com 7 dias grátis:\n👉 {{LINK_CUPOM}}\n\nDepois me fala o que achou!",
  },
  {
    id: "clinicas",
    title: "Abordagem para Clínicas e Consultórios",
    badge: "Clínicas & Gestão",
    description: "Foco em conformidade CFM/CREFITO, equipe e relatórios financeiros.",
    template:
      "Olá, {{PRIMEIRO_NOME}}! Tudo bem? Queria compartilhar uma recomendação de ferramenta que tem ajudado muito na organização de clínicas de fisioterapia.\n\nA Pluri Health centraliza agendamentos, prontuários eletrônicos com conformidade total do CFM/CREFITO e relatórios financeiros sem burocracia.\n\nVocê pode testar a plataforma gratuitamente por 7 dias com acesso completo da sua equipe, e com o meu cupom você garante 10% de desconto contínuo na assinatura:\n🔗 Acesse pelo link: {{LINK_CUPOM}} (Cupom: {{CODIGO_DO_CUPOM}})\n\nQualquer dúvida sobre a implantação, posso te passar mais detalhes!",
  },
  {
    id: "resgate",
    title: "Resgate de Teste Grátis / Demonstração",
    badge: "Fim do Papel",
    description: "Solução para quem ainda perde tempo com evolução em papel ou Excel.",
    template:
      "{{PRIMEIRO_NOME}}, você ainda perde horas da semana preenchendo evolução de paciente no papel ou em planilha Excel?\n\nDá uma olhada no fluxo de prontuário e ficha da Pluri. É super limpo, roda no celular e tablet sem travar nada.\n\nDá para criar uma conta de teste grátis em menos de 1 minuto sem precisar de cartão:\n👉 {{LINK_CUPOM}}",
  },
  {
    id: "stories",
    title: "Script para Stories e Redes Sociais",
    badge: "Stories & Redes",
    description: "Texto otimizado com emojis para legenda de post, stories ou link na bio.",
    template:
      "Se você é fisioterapeuta e quer profissionalizar o atendimento aos seus pacientes com prontuário eletrônico intuitivo, a @plurihealth é a melhor opção que encontrei.\n\nLink na bio com meu cupom {{CODIGO_DO_CUPOM}} garantindo 10% de desconto especial na assinatura! 🚀",
  },
];

export function interpolatePlaybook(
  template: string,
  couponCode: string,
  targetName?: string,
  affiliateSlug?: string
): string {
  const cleanName = targetName?.trim();
  const firstName = cleanName ? cleanName.split(/\s+/)[0] : "";
  const link = `https://pluri.health/?cupom=${encodeURIComponent(couponCode)}${
    affiliateSlug ? `&ref=${encodeURIComponent(affiliateSlug)}` : ""
  }`;

  let result = template
    .replace(/\{\{CODIGO_DO_CUPOM\}\}/g, couponCode)
    .replace(/\{\{LINK_CUPOM\}\}/g, link);

  if (firstName) {
    result = result.replace(/\{\{PRIMEIRO_NOME\}\}/g, firstName);
  } else {
    result = result
      .replace(/Fala, \{\{PRIMEIRO_NOME\}\}!/g, "Fala, Dr(a)!")
      .replace(/Olá, \{\{PRIMEIRO_NOME\}\}!/g, "Olá, tudo bem?")
      .replace(/\{\{PRIMEIRO_NOME\}\}, /g, "")
      .replace(/\{\{PRIMEIRO_NOME\}\}/g, "Dr(a)");
  }

  return result;
}

export function generateWhatsAppUrl(text: string, phone?: string): string {
  const cleanPhone = phone ? phone.replace(/\D/g, "") : "";
  if (!cleanPhone) {
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }
  const formattedPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;
}

export interface AffiliateWhatsAppPlaybooksModalProps {
  couponCode: string;
  affiliateSlug?: string;
  isOpen: boolean;
  onClose: () => void;
  targetPhone?: string;
  targetName?: string;
}

export function AffiliateWhatsAppPlaybooksModal({
  couponCode,
  affiliateSlug,
  isOpen,
  onClose,
  targetPhone = "",
  targetName = "",
}: AffiliateWhatsAppPlaybooksModalProps) {
  const [recipientName, setRecipientName] = useState(targetName);
  const [recipientPhone, setRecipientPhone] = useState(targetPhone);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRecipientName(targetName);
      setRecipientPhone(targetPhone);
      setCopiedId(null);
    }
  }, [isOpen, targetName, targetPhone]);

  const handleCopyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((curr) => (curr === id ? null : curr));
      }, 2000);
    } catch (err) {
      console.error("Falha ao copiar script:", err);
    }
  };

  const handleOpenWhatsApp = (text: string) => {
    const url = generateWhatsAppUrl(text, recipientPhone);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-lg min-w-0 overflow-x-hidden p-0 max-h-[90dvh] flex flex-col gap-0 border bg-background sm:rounded-lg">
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b text-left">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-bold leading-tight truncate">
                Playbooks & Scripts de WhatsApp
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Mensagens de alta conversão prontas com seu cupom oficial.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 max-h-[85dvh] overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
          <div className="bg-muted/40 p-3 rounded-lg border space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Personalizar Destinatário
              </span>
              {couponCode && (
                <Badge variant="outline" className="text-[11px] font-mono shrink-0">
                  Cupom: {couponCode}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label htmlFor="playbook-target-name" className="text-[11px] text-muted-foreground">
                  Nome do Colega (opcional)
                </Label>
                <Input
                  id="playbook-target-name"
                  data-testid="playbook-target-name"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Ex: Dr. Lucas"
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="playbook-target-phone" className="text-[11px] text-muted-foreground">
                  WhatsApp (opcional)
                </Label>
                <Input
                  id="playbook-target-phone"
                  data-testid="playbook-target-phone"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="Ex: 11 99999-8888"
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3.5">
            {PLAYBOOK_TEMPLATES.map((playbook) => {
              const text = interpolatePlaybook(
                playbook.template,
                couponCode,
                recipientName,
                affiliateSlug
              );
              const isCopied = copiedId === playbook.id;
              const whatsappUrl = generateWhatsAppUrl(text, recipientPhone);

              return (
                <Card
                  key={playbook.id}
                  className="w-full border-border/80 shadow-sm overflow-hidden"
                  data-testid={`playbook-card-${playbook.id}`}
                >
                  <CardHeader className="p-3 sm:p-3.5 pb-2 bg-muted/20 border-b">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm font-semibold truncate">
                        {playbook.title}
                      </CardTitle>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                        {playbook.badge}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs mt-0.5 line-clamp-1">
                      {playbook.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-3.5 space-y-3">
                    <div
                      className="bg-muted/50 p-2.5 sm:p-3 rounded-md text-xs font-sans whitespace-pre-wrap select-all border text-foreground/90 break-words max-h-44 overflow-y-auto"
                      data-testid={`playbook-text-${playbook.id}`}
                    >
                      {text}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 pt-0.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyText(playbook.id, text)}
                        className="min-h-[44px] flex-1 touch-manipulation text-xs font-medium"
                        data-testid={`copy-btn-${playbook.id}`}
                      >
                        {isCopied ? (
                          <>
                            <Check className="h-4 w-4 mr-1.5 text-emerald-500" />
                            Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-1.5" />
                            Copiar Texto
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleOpenWhatsApp(text)}
                        className="min-h-[44px] flex-1 touch-manipulation text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
                        data-testid={`whatsapp-btn-${playbook.id}`}
                        data-url={whatsappUrl}
                      >
                        <MessageCircle className="h-4 w-4 mr-1.5" />
                        Abrir no WhatsApp
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="p-3 sm:p-4 border-t bg-muted/20 flex justify-end">
          <Button
            variant="ghost"
            onClick={onClose}
            className="min-h-[44px] touch-manipulation text-xs sm:text-sm"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
