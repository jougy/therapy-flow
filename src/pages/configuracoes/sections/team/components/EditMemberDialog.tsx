import React from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActiveMember, ClinicOperationalRoleDefinition } from "../types";
import { removeSpecialtyTag, SpecialtyTagsPreview } from "./SpecialtyTags";

export interface EditMemberDialogProps {
  editingMember: ActiveMember | null;
  onClose: () => void;
  editMemberRole: string;
  setEditMemberRole: (role: string) => void;
  editMemberJobTitle: string;
  setEditMemberJobTitle: (job: string) => void;
  editMemberSpecialty: string;
  setEditMemberSpecialty: (specialty: string) => void;
  editMemberWorkingHours: string;
  setEditMemberWorkingHours: (hours: string) => void;
  editMemberStatus: "active" | "suspended" | "inactive";
  setEditMemberStatus: (status: "active" | "suspended" | "inactive") => void;
  savingMember: boolean;
  canManageRoles: boolean;
  assignableRoleDefinitions: ClinicOperationalRoleDefinition[];
  onSaveMember: () => Promise<void>;
}

export const EditMemberDialog: React.FC<EditMemberDialogProps> = ({
  editingMember,
  onClose,
  editMemberRole,
  setEditMemberRole,
  editMemberJobTitle,
  setEditMemberJobTitle,
  editMemberSpecialty,
  setEditMemberSpecialty,
  editMemberWorkingHours,
  setEditMemberWorkingHours,
  editMemberStatus,
  setEditMemberStatus,
  savingMember,
  canManageRoles,
  assignableRoleDefinitions,
  onSaveMember,
}) => {
  return (
    <Dialog open={editingMember !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Editar Colaborador</DialogTitle>
          <DialogDescription>
            Altere o cargo, papel operacional, especialidades e status de acesso à clínica.
          </DialogDescription>
        </DialogHeader>

        {editingMember && (
          <div className="space-y-4 py-2 overflow-y-auto pr-1">
            <div className="rounded-lg bg-muted/40 p-3 border text-xs space-y-1">
              <p className="font-semibold text-foreground text-sm">{editingMember.full_name}</p>
              <p className="text-muted-foreground">{editingMember.email}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-member-role">Papel Operacional</Label>
              <Select value={editMemberRole} onValueChange={setEditMemberRole} disabled={!canManageRoles}>
                <SelectTrigger id="edit-member-role">
                  <SelectValue placeholder="Selecione o papel" />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoleDefinitions.map((role) => (
                    <SelectItem key={role.role_key} value={role.role_key}>
                      {role.label}
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
                value={editMemberJobTitle}
                onChange={(e) => setEditMemberJobTitle(e.target.value)}
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
                value={editMemberSpecialty}
                onChange={(e) => setEditMemberSpecialty(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Separe múltiplas especialidades com ponto e vírgula (;).
              </p>
              <SpecialtyTagsPreview
                value={editMemberSpecialty}
                onRemove={(tag) =>
                  removeSpecialtyTag(tag, editMemberSpecialty, setEditMemberSpecialty)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-member-hours">Horário / Carga Horária (Opcional)</Label>
              <Input
                id="edit-member-hours"
                placeholder="Ex: Seg a Sex, 08h às 18h"
                value={editMemberWorkingHours}
                onChange={(e) => setEditMemberWorkingHours(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-member-status">Status de Acesso à Clínica</Label>
              <Select
                value={editMemberStatus}
                onValueChange={(val) => setEditMemberStatus(val as "active" | "suspended" | "inactive")}
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
          <Button variant="outline" type="button" onClick={onClose} disabled={savingMember}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void onSaveMember()} disabled={savingMember}>
            {savingMember ? (
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

