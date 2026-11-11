import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AFFILIATE_TIERS, type AffiliateTier } from "@/lib/affiliate-tiers";
import { Award, Bell, Check, Copy, ExternalLink, Loader2, Mail, MessageSquare, Sparkles, User } from "lucide-react";

export type FloorTierOption = AffiliateTier | "custom";

export interface PlatformInviteAffiliateUser {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  clinicId?: string;
}

export interface PlatformInviteAffiliateModalProps {
  user: PlatformInviteAffiliateUser | null;
  isOpen: boolean;
  onClose: () => void;
  onInviteSuccess?: () => void;
}

export function buildAffiliateWhatsAppUrl(phone: string, inviteUrl: string, userName: string): string {
  const digits = phone.replace(/\D/g, "");
  const fullDigits = digits.startsWith("55") ? digits : `55${digits}`;
  const message = `Olá ${userName}! Você foi convidado(a) com exclusividade para o Programa Oficial de Afiliados do Pluri-Health. Acesse o link para conhecer as vantagens e ativar seus benefícios: ${inviteUrl}`;
  return `https://wa.me/${fullDigits}?text=${encodeURIComponent(message)}`;
}

export const PlatformInviteAffiliateModal: React.FC<PlatformInviteAffiliateModalProps> = ({
  user,
  isOpen,
  onClose,
  onInviteSuccess,
}) => {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [floorTier, setFloorTier] = useState<FloorTierOption>("bronze");
  const [customFirstMonth, setCustomFirstMonth] = useState<number | string>(30);
  const [customRecurring, setCustomRecurring] = useState<number | string>(10);
  const [sendInApp, setSendInApp] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const hasPhone = Boolean(user?.phone && user.phone.trim().length >= 8);
  const hasEmail = Boolean(user?.email && user.email.includes("@"));

  useEffect(() => {
    if (isOpen) {
      setSubmitting(false);
      setCopied(false);
      setFloorTier("bronze");
      setCustomFirstMonth(30);
      setCustomRecurring(10);
      setSendInApp(true);
      setSendEmail(hasEmail);
      setSendWhatsApp(hasPhone);
      setGeneratedLink(null);
    }
  }, [isOpen, hasEmail, hasPhone]);

  const handleCopyLink = async () => {
    if (!generatedLink) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(generatedLink);
      }
      setCopied(true);
      toast({ title: "Link copiado!", description: "Link copiado para a área de transferência." });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ title: "Erro ao copiar", description: "Copie o link manualmente.", variant: "destructive" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const isCustom = floorTier === "custom";
    const customFirstMonthNum = Number(customFirstMonth);
    const customRecurringNum = Number(customRecurring);

    if (isCustom) {
      if (
        isNaN(customFirstMonthNum) ||
        customFirstMonthNum < 0 ||
        customFirstMonthNum > 100 ||
        isNaN(customRecurringNum) ||
        customRecurringNum < 0 ||
        customRecurringNum > 100
      ) {
        toast({
          title: "Percentuais inválidos",
          description: "As comissões personalizadas devem estar entre 0% e 100%.",
          variant: "destructive",
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const token = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `aff-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const expiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
      const inviteUrl = `https://app.plurifisio.com.br/afiliados/onboarding?token=${token}`;

      const invitationMetadata: Record<string, any> = {
        channels: { in_app: sendInApp, email: sendEmail, whatsapp: sendWhatsApp },
        invited_at: new Date().toISOString(),
      };

      if (isCustom) {
        invitationMetadata.is_custom = true;
        invitationMetadata.custom_commissions = {
          first_month_percent: customFirstMonthNum,
          recurring_percent: customRecurringNum,
        };
      }

      const { error: inviteError } = await (supabase as any)
        .from("affiliate_invitations")
        .insert({
          invited_user_id: user.id,
          invited_email: user.email || null,
          clinic_id: user.clinicId || null,
          token,
          floor_tier: isCustom ? "bronze" : floorTier,
          status: "pending",
          expires_at: expiresAt,
          metadata: invitationMetadata,
        });
      if (inviteError) throw inviteError;

      if (sendInApp) {
        try {
          const notifBody = isCustom
            ? `Você foi convidado com comissões personalizadas (${customFirstMonthNum}% / ${customRecurringNum}%) para o Programa de Afiliados.`
            : `Você foi convidado com piso inicial ${floorTier.toUpperCase()} para o Programa de Afiliados.`;

          await supabase.rpc("create_user_notification", {
            _user_id: user.id,
            _clinic_id: user.clinicId || null,
            _actor_user_id: null,
            _category: "system",
            _event_type: "affiliate_invitation",
            _title: "Convite para o Programa de Afiliados Pluri-Health",
            _body: notifBody,
            _action_label: "Conhecer Programa",
            _action_url: `/afiliados/onboarding?token=${token}`,
            _payload: {
              invitation_token: token,
              floor_tier: isCustom ? "custom" : floorTier,
              ...(isCustom
                ? {
                    custom_commissions: {
                      first_month_percent: customFirstMonthNum,
                      recurring_percent: customRecurringNum,
                    },
                  }
                : {}),
            },
          });
        } catch (notifErr) {
          console.warn("[PlatformInviteAffiliateModal] Notificação in-app falhou suavemente:", notifErr);
        }
      }

      setGeneratedLink(inviteUrl);
      toast({
        title: "Convite gerado com sucesso!",
        description: `O convite para ${user.fullName} foi registrado com validade de 15 dias.`,
      });
      onInviteSuccess?.();
    } catch (err: any) {
      toast({
        title: "Erro ao gerar convite",
        description: err?.message || "Não foi possível registrar o convite de afiliado.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isCustom = floorTier === "custom";
  const selectedTierDef = !isCustom
    ? AFFILIATE_TIERS.find((t) => t.tier === floorTier) || AFFILIATE_TIERS[0]
    : null;
  const whatsAppUrl = user?.phone && generatedLink ? buildAffiliateWhatsAppUrl(user.phone, generatedLink, user.fullName) : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-6 sm:max-w-lg">
        <DialogHeader className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Convidar para Afiliado</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Envie um convite oficial com benefícios garantidos e validade de 15 dias.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {user && (
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-xs">
            <div className="flex items-center justify-between font-semibold text-foreground text-sm">
              <span className="flex items-center gap-1.5 truncate">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                {user.fullName}
              </span>
              <Badge variant="outline" className="text-[10px] font-mono">{user.id.slice(0, 8)}</Badge>
            </div>
            <div className="flex flex-wrap gap-x-3 text-muted-foreground">
              {user.email && <span>Email: {user.email}</span>}
              {user.phone && <span>Tel: {user.phone}</span>}
            </div>
          </div>
        )}

        {!generatedLink ? (
          <form noValidate onSubmit={handleSubmit} className="space-y-3.5 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="floor-tier-select" className="text-xs font-semibold">Piso Garantido Inicial (Floor Tier)</Label>
              <Select value={floorTier} onValueChange={(val) => setFloorTier(val as FloorTierOption)}>
                <SelectTrigger id="floor-tier-select" className="min-h-[44px]">
                  <SelectValue placeholder="Selecione o nível inicial" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {AFFILIATE_TIERS.map((t) => (
                    <SelectItem key={t.tier} value={t.tier} className="min-h-[44px]">
                      <span className="font-semibold">{t.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">({t.firstMonthCommissionPercent}% / {t.recurringCommissionPercent}%)</span>
                    </SelectItem>
                  ))}
                  <SelectItem value="custom" className="min-h-[44px]">
                    <span className="font-semibold">⚙️ Personalizado (Definir Comissões)</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {selectedTierDef && selectedTierDef.tier !== "bronze" && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 p-2 rounded-md">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span>Piso VIP: Usuário iniciará como parceiro {selectedTierDef.label}.</span>
                </div>
              )}
              {isCustom && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 p-2 rounded-md">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span>Piso Personalizado: Definir percentuais acordados com o afiliado.</span>
                </div>
              )}
            </div>

            {isCustom && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border bg-muted/30">
                <div className="space-y-1.5">
                  <Label htmlFor="custom-first-month" className="text-xs font-semibold">
                    Comissão Inicial - 1º Mês (%)
                  </Label>
                  <Input
                    id="custom-first-month"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={customFirstMonth}
                    onChange={(e) => setCustomFirstMonth(e.target.value)}
                    className="min-h-[44px] text-sm"
                    placeholder="30"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Percentual sobre a 1ª mensalidade paga (0 a 100%).
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="custom-recurring" className="text-xs font-semibold">
                    Comissão Recorrente (%)
                  </Label>
                  <Input
                    id="custom-recurring"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={customRecurring}
                    onChange={(e) => setCustomRecurring(e.target.value)}
                    className="min-h-[44px] text-sm"
                    placeholder="10"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Percentual recorrente mensal vitalício (0 a 100%).
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <Label className="text-xs font-semibold">Canais de Envio</Label>
              <div className="space-y-1.5 rounded-lg border p-2.5 bg-card text-xs">
                <label className="flex items-center gap-3 cursor-pointer min-h-[44px] px-1">
                  <Checkbox checked={sendInApp} onCheckedChange={(c) => setSendInApp(Boolean(c))} />
                  <Bell className="h-4 w-4 text-sky-500 shrink-0" />
                  <div>
                    <span className="font-medium text-foreground">In-App (Sino de Notificações)</span>
                    <p className="text-[11px] text-muted-foreground">Banner no Espaço Pessoal</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 min-h-[44px] px-1 ${hasEmail ? "cursor-pointer" : "opacity-60"}`}>
                  <Checkbox checked={sendEmail && hasEmail} disabled={!hasEmail} onCheckedChange={(c) => setSendEmail(Boolean(c))} />
                  <Mail className="h-4 w-4 text-purple-500 shrink-0" />
                  <div>
                    <span className="font-medium text-foreground">E-mail Transacional</span>
                    <p className="text-[11px] text-muted-foreground">{hasEmail ? "Instruções de onboarding" : "Sem e-mail cadastrado"}</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 min-h-[44px] px-1 ${hasPhone ? "cursor-pointer" : "opacity-60"}`}>
                  <Checkbox checked={sendWhatsApp && hasPhone} disabled={!hasPhone} onCheckedChange={(c) => setSendWhatsApp(Boolean(c))} />
                  <MessageSquare className="h-4 w-4 text-emerald-500 shrink-0" />
                  <div>
                    <span className="font-medium text-foreground">WhatsApp (wa.me)</span>
                    <p className="text-[11px] text-muted-foreground">{hasPhone ? "Link de envio rápido" : "Sem telefone cadastrado"}</p>
                  </div>
                </label>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-end pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="min-h-[44px]">Cancelar</Button>
              <Button type="submit" disabled={submitting} className="min-h-[44px] gap-2 bg-primary">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
                {submitting ? "Gerando Convite..." : "Gerar e Enviar Convite"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white mt-0.5">
                <Check className="h-3 w-3" />
              </div>
              <div>
                <p className="font-semibold text-emerald-800 dark:text-emerald-100">Convite gerado com sucesso!</p>
                <p className="text-emerald-700/90 dark:text-emerald-300/90">Validade: 15 dias. Compartilhe o link com o profissional:</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Link Direto de Onboarding</Label>
              <div className="flex items-center gap-2">
                <input readOnly value={generatedLink} className="flex-1 rounded-md border bg-muted/60 px-3 py-2 text-xs font-mono select-all truncate min-h-[44px]" />
                <Button type="button" variant="outline" onClick={handleCopyLink} className="min-h-[44px] px-3 gap-1.5 shrink-0">
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  <span>{copied ? "Copiado!" : "Copiar"}</span>
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              {whatsAppUrl && (
                <a href={whatsAppUrl} target="_blank" rel="noopener noreferrer" className="inline-flex w-full sm:flex-1">
                  <Button type="button" variant="outline" className="w-full min-h-[44px] gap-2 border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40">
                    <MessageSquare className="h-4 w-4" />
                    Enviar pelo WhatsApp
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </Button>
                </a>
              )}
              <Button type="button" onClick={onClose} className="w-full sm:w-auto min-h-[44px]">Concluir</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
