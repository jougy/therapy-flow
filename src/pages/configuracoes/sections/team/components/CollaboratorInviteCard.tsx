import React, { useState } from "react";
import { Copy, Loader2, Mail, Tag, UserPlus, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import type { ClinicOperationalRoleDefinition } from "../types";

export interface CollaboratorInviteCardProps {
  canInviteCollaborators: boolean;
  clinicName?: string;
  sendingInvite: boolean;
  lastGeneratedInviteUrl: string;
  lastGeneratedInviteEmail: string;
  assignableRoleDefinitions?: ClinicOperationalRoleDefinition[];
  onSendInvite: (payload: {
    email: string;
    role: string;
    jobTitle: string;
    specialty: string;
  }) => Promise<void>;
  onCopyLink: (url: string, email: string) => Promise<void>;
}

import {
  parseSpecialties,
  removeSpecialtyTag,
  SpecialtyTagsPreview,
} from "./SpecialtyTags";

export { parseSpecialties, removeSpecialtyTag, SpecialtyTagsPreview };

export const CollaboratorInviteCard: React.FC<CollaboratorInviteCardProps> = ({
  canInviteCollaborators,
  clinicName,
  sendingInvite,
  lastGeneratedInviteUrl,
  lastGeneratedInviteEmail,
  assignableRoleDefinitions,
  onSendInvite,
  onCopyLink,
}) => {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("professional");
  const [inviteJobTitle, setInviteJobTitle] = useState("");
  const [inviteSpecialty, setInviteSpecialty] = useState("");

  const handleSubmit = async () => {
    if (!inviteEmail.trim() || sendingInvite) return;
    await onSendInvite({
      email: inviteEmail.trim(),
      role: inviteRole,
      jobTitle: inviteJobTitle.trim(),
      specialty: inviteSpecialty.trim(),
    });
    setInviteEmail("");
    setInviteJobTitle("");
    setInviteSpecialty("");
    setInviteRole("professional");
  };

  return (
    <Card data-tutorial="settings-team-invite-card">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-400">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">Convidar Colaborador</CardTitle>
              <ComponentHelpButton helpId="settings-team-invite-block" size="sm" />
            </div>
            <CardDescription className="text-xs">
              Convide profissionais para fazerem parte da equipe da clínica com contas independentes.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div data-tutorial="settings-invite-email" className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label>E-mail do colaborador</Label>
            <Input
              type="email"
              placeholder="colaborador@email.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              E-mail para acesso à plataforma.
            </p>
          </div>
          <div data-tutorial="settings-invite-role" className="space-y-1.5">
            <Label>Papel operacional</Label>
            <Select value={inviteRole} onValueChange={(val) => setInviteRole(val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assignableRoleDefinitions && assignableRoleDefinitions.length > 0 ? (
                  assignableRoleDefinitions.map((role) => (
                    <SelectItem key={role.role_key} value={role.role_key}>
                      {role.label}
                    </SelectItem>
                  ))
                ) : (
                  <>
                    <SelectItem value="admin">Administrador(a)</SelectItem>
                    <SelectItem value="professional">Profissional</SelectItem>
                    <SelectItem value="assistant">Assistente</SelectItem>
                    <SelectItem value="estagiario">Estagiário(a)</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Hierarquia e poderes no sistema.
            </p>
          </div>
          <div data-tutorial="settings-invite-job" className="space-y-1.5">
            <Label>Cargo pré-definido</Label>
            <Input
              placeholder="Ex: Fisioterapeuta, Psicólogo(a)..."
              value={inviteJobTitle}
              onChange={(e) => setInviteJobTitle(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Profissão ou função na clínica.
            </p>
          </div>
          <div data-tutorial="settings-invite-specialty" className="space-y-1.5">
            <Label>Especialidade(s)</Label>
            <Input
              placeholder="Ex: Saúde da Mulher; Pediatria; TCC"
              value={inviteSpecialty}
              onChange={(e) => setInviteSpecialty(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Separe múltiplas especialidades com ponto e vírgula (;).
            </p>
            <SpecialtyTagsPreview
              value={inviteSpecialty}
              onRemove={(tag) =>
                removeSpecialtyTag(tag, inviteSpecialty, setInviteSpecialty)
              }
            />
          </div>
        </div>

        {lastGeneratedInviteUrl && (
          <div className="rounded-xl border border-sky-200 bg-sky-50/70 dark:bg-sky-950/30 dark:border-sky-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-sky-900 dark:text-sky-300">
                Convite emitido para <strong>{lastGeneratedInviteEmail}</strong>
              </p>
              <Badge className="bg-sky-600 text-white hover:bg-sky-600 text-[10px]">Válido por 14 dias</Badge>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={lastGeneratedInviteUrl} readOnly className="font-mono text-xs bg-background" />
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void onCopyLink(lastGeneratedInviteUrl, lastGeneratedInviteEmail)}
                >
                  <Copy className="h-4 w-4 mr-1.5" />
                  Copiar
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Olá! Você foi convidado para participar da equipe de ${clinicName || "nossa clínica"} na Pluri-Health. Acesse seu convite pelo link: ${lastGeneratedInviteUrl}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-700 hover:text-emerald-800"
                  >
                    WhatsApp
                  </a>
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
          {!canInviteCollaborators && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Seu papel atual não possui permissão para convidar novos colaboradores.
            </p>
          )}
          <div className="flex justify-end w-full sm:w-auto ml-auto">
            <Button
              data-tutorial="settings-team-invite-btn"
              onClick={() => void handleSubmit()}
              disabled={sendingInvite || !inviteEmail.trim() || !canInviteCollaborators}
              className="bg-primary text-primary-foreground gap-2 w-full sm:w-auto"
            >
              {sendingInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Enviar convite por e-mail
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
