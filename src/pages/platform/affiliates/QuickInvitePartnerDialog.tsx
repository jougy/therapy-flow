import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus } from "lucide-react";
import type { PlatformInviteAffiliateUser } from "@/components/platform/PlatformInviteAffiliateModal";

export interface QuickInvitePartnerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: (user: PlatformInviteAffiliateUser) => void;
}

export const QuickInvitePartnerDialog: React.FC<QuickInvitePartnerDialogProps> = ({
  isOpen,
  onClose,
  onProceed,
}) => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;

    const pseudoUser: PlatformInviteAffiliateUser = {
      id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `usr-inv-${Date.now()}`,
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
    };

    onProceed(pseudoUser);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-md p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Convidar Novo Parceiro
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Insira os dados de contato do parceiro para configurar o convite oficial e alíquotas de comissão.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 py-2">
          <div className="space-y-1">
            <Label className="text-xs font-medium">Nome Completo *</Label>
            <Input
              required
              placeholder="Ex: Dra. Mariana Silva"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-9 text-xs sm:text-sm"
              data-testid="invite-partner-name-input"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium">E-mail de Contato *</Label>
            <Input
              required
              type="email"
              placeholder="mariana@clinicaexemplo.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 text-xs sm:text-sm"
              data-testid="invite-partner-email-input"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium">WhatsApp / Telefone (Opcional)</Label>
            <Input
              type="tel"
              placeholder="(11) 98765-4321"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-9 text-xs sm:text-sm"
              data-testid="invite-partner-phone-input"
            />
          </div>

          <DialogFooter className="pt-3 flex flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="w-full sm:w-auto h-9 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!fullName.trim() || !email.trim()}
              className="w-full sm:w-auto h-9 text-xs font-semibold"
              data-testid="proceed-invite-btn"
            >
              Continuar Convite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
