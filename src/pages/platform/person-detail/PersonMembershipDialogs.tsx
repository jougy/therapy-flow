import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PlatformRolesManagementModal } from "@/components/platform/PlatformRolesManagementModal";
import { PlatformRoleModularSummary } from "@/components/platform/PlatformRoleModularSummary";
import type { ClinicOperationalRoleDefinition, RoleCapabilityRow } from "@/pages/configuracoes/sections/team/types";
import type { AvailablePlatformClinic } from "./usePersonMemberships";

interface PersonMembershipDialogsProps {
  title: string;
  memberships: Array<Record<string, unknown>>;
  editMembership: Record<string, unknown> | null;
  setEditMembership: (val: Record<string, unknown> | null) => void;
  editRole: string;
  setEditRole: (val: string) => void;
  editStatus: string;
  setEditStatus: (val: string) => void;
  editReason: string;
  setEditReason: (val: string) => void;
  savingEdit: boolean;
  handleSaveEditMembership: () => Promise<void>;
  deleteMembership: Record<string, unknown> | null;
  setDeleteMembership: (val: Record<string, unknown> | null) => void;
  deleteReason: string;
  setDeleteReason: (val: string) => void;
  savingDelete: boolean;
  handleConfirmDeleteMembership: () => Promise<void>;
  addClinicModalOpen: boolean;
  setAddClinicModalOpen: (open: boolean) => void;
  availableClinics: AvailablePlatformClinic[];
  loadingClinics: boolean;
  newClinicId: string;
  setNewClinicId: (val: string) => void;
  newRole: string;
  setNewRole: (val: string) => void;
  newStatus: string;
  setNewStatus: (val: string) => void;
  newReason: string;
  setNewReason: (val: string) => void;
  savingAdd: boolean;
  handleSaveAddClinic: () => Promise<void>;
  clinicRoles: ClinicOperationalRoleDefinition[];
  clinicRoleCapabilities: RoleCapabilityRow[];
  manageRolesClinicId: string | null;
  setManageRolesClinicId: (val: string | null) => void;
  manageRolesClinicName: string | null;
  setManageRolesClinicName: (val: string | null) => void;
  manageRolesInitialRole: string;
  setManageRolesInitialRole: (val: string) => void;
  fetchClinicRolesAndCapabilities: (clinicId: string) => Promise<void>;
}

export function PersonMembershipDialogs({
  title,
  memberships,
  editMembership,
  setEditMembership,
  editRole,
  setEditRole,
  editStatus,
  setEditStatus,
  editReason,
  setEditReason,
  savingEdit,
  handleSaveEditMembership,
  deleteMembership,
  setDeleteMembership,
  deleteReason,
  setDeleteReason,
  savingDelete,
  handleConfirmDeleteMembership,
  addClinicModalOpen,
  setAddClinicModalOpen,
  availableClinics,
  loadingClinics,
  newClinicId,
  setNewClinicId,
  newRole,
  setNewRole,
  newStatus,
  setNewStatus,
  newReason,
  setNewReason,
  savingAdd,
  handleSaveAddClinic,
  clinicRoles,
  clinicRoleCapabilities,
  manageRolesClinicId,
  setManageRolesClinicId,
  manageRolesClinicName,
  setManageRolesClinicName,
  manageRolesInitialRole,
  setManageRolesInitialRole,
  fetchClinicRolesAndCapabilities,
}: PersonMembershipDialogsProps) {
  return (
    <>
      <Dialog open={Boolean(editMembership)} onOpenChange={(open) => !open && setEditMembership(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Relação com a Clínica</DialogTitle>
            <DialogDescription>
              Ajuste o papel operacional e o status de acesso do usuário em{" "}
              <span className="font-semibold text-foreground">
                {String(editMembership?.clinic_name ?? "Clínica")}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          {Boolean(editMembership) && (() => {
            const isOwner =
              editMembership?.account_role === "account_owner" || editMembership?.operational_role === "owner";
            return (
              <div className="space-y-4 py-2">
                {isOwner && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                    <span>
                      Este usuário é o <strong>proprietário (Owner)</strong> desta clínica. O papel hierárquico não pode ser alterado diretamente, mas você pode modificar seu status de acesso master.
                    </span>
                  </div>
                )}

                {!isOwner && (
                  <div className="space-y-2">
                    <Label htmlFor="edit-role">Papel Operacional / Hierarquia</Label>
                    <Select value={editRole} onValueChange={setEditRole}>
                      <SelectTrigger id="edit-role">
                        <SelectValue placeholder="Selecione o papel" />
                      </SelectTrigger>
                      <SelectContent>
                        {clinicRoles
                          .filter((r) => r.role_key !== "owner")
                          .map((r) => (
                            <SelectItem key={r.role_key} value={r.role_key}>
                              {r.label} ({r.role_key})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <PlatformRoleModularSummary
                  roleDefinition={clinicRoles.find((r) => r.role_key === (isOwner ? "owner" : editRole))}
                  roleCapabilitiesOverrides={clinicRoleCapabilities}
                  onOpenManageRoles={() => {
                    setManageRolesClinicId(String(editMembership?.clinic_id));
                    setManageRolesClinicName(String(editMembership?.clinic_name ?? "Clínica"));
                    setManageRolesInitialRole(isOwner ? "owner" : editRole);
                  }}
                />

                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status do Vínculo</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger id="edit-status">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo (acesso regular liberado)</SelectItem>
                      <SelectItem value="temporarily_paused">Pausado (suspensão temporária)</SelectItem>
                      <SelectItem value="banned">Bloqueado / Banido (sem acesso)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-reason">
                    Motivo da alteração <span className="text-xs text-muted-foreground">(mínimo 8 caracteres)</span>
                  </Label>
                  <Textarea
                    id="edit-reason"
                    placeholder="Ex: Promoção a administrador da unidade ou suspensão preventiva..."
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    rows={3}
                  />
                  {editReason.trim().length > 0 && editReason.trim().length < 8 && (
                    <p className="text-xs text-destructive">A justificativa deve conter pelo menos 8 caracteres.</p>
                  )}
                </div>
              </div>
            );
          })()}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setEditMembership(null)} disabled={savingEdit}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveEditMembership()}
              disabled={savingEdit || editReason.trim().length < 8}
            >
              {savingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteMembership)} onOpenChange={(open) => !open && setDeleteMembership(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Desvincular Usuário da Clínica</DialogTitle>
            <DialogDescription>
              Remover o vínculo de <span className="font-semibold text-foreground">{title}</span> em relação a{" "}
              <span className="font-semibold text-foreground">
                {String(deleteMembership?.clinic_name ?? "Clínica")}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          {Boolean(deleteMembership) && (() => {
            const isOwner =
              deleteMembership?.account_role === "account_owner" || deleteMembership?.operational_role === "owner";
            return (
              <div className="space-y-4 py-2">
                {isOwner ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-1">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Não é permitido desvincular o proprietário diretamente
                    </div>
                    <p>
                      Este usuário é o <strong>Owner</strong> desta clínica. Para remover este vínculo, é necessário primeiro transferir a titularidade da clínica para outro membro ou excluir a clínica inteira.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                      <span>
                        O usuário perderá o acesso a todos os prontuários, agendas e dados operacionais desta clínica. Registros clínicos assinados anteriormente continuarão vinculados por rastreabilidade legal.
                      </span>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="delete-reason">
                        Motivo da desvinculação <span className="text-xs text-muted-foreground">(mínimo 8 caracteres)</span>
                      </Label>
                      <Textarea
                        id="delete-reason"
                        placeholder="Ex: Desligamento do profissional do corpo clínico da unidade..."
                        value={deleteReason}
                        onChange={(e) => setDeleteReason(e.target.value)}
                        rows={3}
                      />
                      {deleteReason.trim().length > 0 && deleteReason.trim().length < 8 && (
                        <p className="text-xs text-destructive">A justificativa deve conter pelo menos 8 caracteres.</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDeleteMembership(null)} disabled={savingDelete}>
              Cancelar
            </Button>
            {!(deleteMembership?.account_role === "account_owner" || deleteMembership?.operational_role === "owner") && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleConfirmDeleteMembership()}
                disabled={savingDelete || deleteReason.trim().length < 8}
              >
                {savingDelete && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar desvinculação
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addClinicModalOpen} onOpenChange={setAddClinicModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular a uma Clínica</DialogTitle>
            <DialogDescription>
              Adicione <span className="font-semibold text-foreground">{title}</span> a uma nova clínica da plataforma definindo o papel e hierarquia de acesso.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-clinic">Clínica de Destino</Label>
              {loadingClinics ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando clínicas disponíveis...
                </div>
              ) : (
                <Select
                  value={newClinicId}
                  onValueChange={(val) => {
                    setNewClinicId(val);
                    if (val) {
                      void fetchClinicRolesAndCapabilities(val);
                    }
                  }}
                >
                  <SelectTrigger id="new-clinic">
                    <SelectValue placeholder="Selecione a clínica..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {availableClinics.map((c) => {
                      const alreadyMember = memberships.some(
                        (m) => String(m.clinic_id) === String(c.clinic_id)
                      );
                      return (
                        <SelectItem key={c.clinic_id} value={c.clinic_id} disabled={alreadyMember}>
                          {c.clinic_name} {c.clinic_cnpj ? `(${c.clinic_cnpj})` : ""}{" "}
                          {alreadyMember ? "— (Já vinculado)" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-role">Hierarquia / Posição</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger id="new-role">
                  <SelectValue placeholder="Selecione o papel" />
                </SelectTrigger>
                <SelectContent>
                  {clinicRoles
                    .filter((r) => r.role_key !== "owner")
                    .map((r) => (
                      <SelectItem key={r.role_key} value={r.role_key}>
                        {r.label} ({r.role_key})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {Boolean(newClinicId) && (
              <PlatformRoleModularSummary
                roleDefinition={clinicRoles.find((r) => r.role_key === newRole)}
                roleCapabilitiesOverrides={clinicRoleCapabilities}
                compact
                onOpenManageRoles={() => {
                  setManageRolesClinicId(newClinicId);
                  setManageRolesClinicName(
                    availableClinics.find((c) => c.clinic_id === newClinicId)?.clinic_name ?? "Clínica"
                  );
                  setManageRolesInitialRole(newRole);
                }}
              />
            )}

            <div className="space-y-2">
              <Label htmlFor="new-status">Status Inicial</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger id="new-status">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo (acesso imediato)</SelectItem>
                  <SelectItem value="temporarily_paused">Pausado (aguardando liberação)</SelectItem>
                  <SelectItem value="banned">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-reason">
                Motivo da vinculação <span className="text-xs text-muted-foreground">(mínimo 8 caracteres)</span>
              </Label>
              <Textarea
                id="new-reason"
                placeholder="Ex: Contratação do profissional para atuar na unidade..."
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                rows={3}
              />
              {newReason.trim().length > 0 && newReason.trim().length < 8 && (
                <p className="text-xs text-destructive">A justificativa deve conter pelo menos 8 caracteres.</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setAddClinicModalOpen(false)} disabled={savingAdd}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveAddClinic()}
              disabled={!newClinicId || savingAdd || newReason.trim().length < 8}
            >
              {savingAdd && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Vincular à clínica
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {manageRolesClinicId && (
        <PlatformRolesManagementModal
          clinicId={manageRolesClinicId}
          clinicName={manageRolesClinicName ?? "Clínica"}
          open={Boolean(manageRolesClinicId)}
          onOpenChange={(open) => {
            if (!open) {
              setManageRolesClinicId(null);
            }
          }}
          initialRoleKey={manageRolesInitialRole}
          onRolesUpdated={() => {
            if (manageRolesClinicId) {
              void fetchClinicRolesAndCapabilities(manageRolesClinicId);
            }
          }}
        />
      )}
    </>
  );
}
