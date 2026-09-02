import React from "react";
import { Loader2, Save, Tag, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ActiveMember,
  ClinicOperationalRoleDefinition,
} from "../types";

export interface EditMemberModalProps {
  member: ActiveMember | null;
  onClose: () => void;
  assignableRoleDefinitions: ClinicOperationalRoleDefinition[];
  role: string;
  onRoleChange: (val: string) => void;
  jobTitle: string;
  onJobTitleChange: (val: string) => void;
  specialty: string;
  onSpecialtyChange: (val: string) => void;
  workingHours: string;
  onWorkingHoursChange: (val: string) => void;
  status: "active" | "suspended" | "inactive";
  onStatusChange: (val: "active" | "suspended" | "inactive") => void;
  canManageRoles: boolean;
  saving: boolean;
  onSave: () => Promise<void> | void;
}

import {
  parseSpecialties,
  removeSpecialtyTag,
  SpecialtyTagsPreview,
} from "./SpecialtyTags";

export { parseSpecialties, removeSpecialtyTag, SpecialtyTagsPreview };

export const EditMemberModal: React.FC<EditMemberModalProps> = ({
  member,
  onClose,
  assignableRoleDefinitions,
  role,
  onRoleChange,
  jobTitle,
  onJobTitleChange,
  specialty,
  onSpecialtyChange,
  workingHours,
  onWorkingHoursChange,
  status,
  onStatusChange,
  canManageRoles,
  saving,
  onSave,
}) => {
  return (
    <Dialog open={member !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Editar Colaborador</DialogTitle>
          <DialogDescription>
            Altere o cargo, papel operacional, especialidades e status de acesso à clínica.
          </DialogDescription>
        </DialogHeader>

        {member && (
          <div className="space-y-4 py-2 overflow-y-auto pr-1">
            <div className="rounded-lg bg-muted/40 p-3 border text-xs space-y-1">
              <p className="font-semibold text-foreground text-sm">{member.full_name}</p>
              <p className="text-muted-foreground">{member.email}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-member-role">Papel Operacional</Label>
              <Select value={role} onValueChange={onRoleChange} disabled={!canManageRoles}>
                <SelectTrigger id="edit-member-role">
                  <SelectValue placeholder="Selecione o papel" />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoleDefinitions.map((r) => (
                    <SelectItem key={r.role_key} value={r.role_key}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {canManageRoles
                  ? "Define o conjunto de poderes e permissões no sistema."
                  : "Seu papel não possui permissão para alterar a hierarquia operacional de colaboradores."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-member-job">Cargo pré-definido</Label>
              <Input
                id="edit-member-job"
                placeholder="Ex: Fisioterapeuta, Psicólogo(a)..."
                value={jobTitle}
                onChange={(e) => onJobTitleChange(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Profissão ou função exercida na clínica.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-member-specialty">Especialidade(s)</Label>
              <Input
                id="edit-member-specialty"
                placeholder="Ex: Ortopedia; Pediatria; TCC"
                value={specialty}
                onChange={(e) => onSpecialtyChange(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Separe múltiplas especialidades com ponto e vírgula (;).
              </p>
              <SpecialtyTagsPreview
                value={specialty}
                onRemove={(tag) => removeSpecialtyTag(tag, specialty, onSpecialtyChange)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-member-hours">Horário / Carga Horária (Opcional)</Label>
              <Input
                id="edit-member-hours"
                placeholder="Ex: Seg a Sex, 08h às 18h"
                value={workingHours}
                onChange={(e) => onWorkingHoursChange(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-member-status">Status de Acesso à Clínica</Label>
              <Select
                value={status}
                onValueChange={(val) => onStatusChange(val as "active" | "suspended" | "inactive")}
              >
                <SelectTrigger id="edit-member-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo (Acesso normal liberado)</SelectItem>
                  <SelectItem value="suspended">Suspenso (Acesso pausado temporariamente)</SelectItem>
                  <SelectItem value="inactive">Inativo (Acesso desativado)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Colaboradores suspensos ou inativos não conseguem acessar os dados da clínica.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="border-t pt-3 flex flex-row items-center justify-end gap-2">
          <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void onSave()} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Save className="h-4 w-4 mr-1.5" />
            )}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
