import { useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type {
  ActiveMember,
  ClinicOperationalRoleDefinition,
} from "../types";

export interface UseTeamMembersParams {
  clinicId?: string | null;
  userId?: string | null;
  isAccountOwner: boolean;
  canEditCollaborators: boolean;
  canDeleteCollaborators: boolean;
  canManageRoles: boolean;
  actorRoleIndex: number;
  sortedOperationalRoleDefinitions: ClinicOperationalRoleDefinition[];
  roleIndexMap?: Map<string, number>;
  operationalRoleDefinitions: ClinicOperationalRoleDefinition[];
  onTeamDataChanged: () => Promise<void> | void;
}

export const useTeamMembers = ({
  clinicId,
  userId,
  isAccountOwner,
  canEditCollaborators,
  canDeleteCollaborators,
  canManageRoles,
  actorRoleIndex,
  sortedOperationalRoleDefinitions,
  roleIndexMap,
  operationalRoleDefinitions,
  onTeamDataChanged,
}: UseTeamMembersParams) => {
  const [members, setMembers] = useState<ActiveMember[]>([]);

  // Gestão e Edição de Membros
  const [editingMember, setEditingMember] = useState<ActiveMember | null>(null);
  const [editMemberRole, setEditMemberRole] = useState<string>("professional");
  const [editMemberJobTitle, setEditMemberJobTitle] = useState("");
  const [editMemberSpecialty, setEditMemberSpecialty] = useState("");
  const [editMemberWorkingHours, setEditMemberWorkingHours] = useState("");
  const [editMemberStatus, setEditMemberStatus] = useState<"active" | "suspended" | "inactive">("active");
  const [savingMember, setSavingMember] = useState(false);

  // Revogação de Acesso
  const [revokingMember, setRevokingMember] = useState<ActiveMember | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // Toggle rápido de status (pausa / reativação)
  const [togglingMemberId, setTogglingMemberId] = useState<string | null>(null);

  // Otimização Big-O: Mapa interno O(1) de fallback caso roleIndexMap não seja provido
  const effectiveRoleIndexMap = useMemo(
    () => roleIndexMap ?? new Map(sortedOperationalRoleDefinitions.map((r, idx) => [r.role_key, idx])),
    [roleIndexMap, sortedOperationalRoleDefinitions]
  );

  const roleUsageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      counts[m.operational_role] = (counts[m.operational_role] || 0) + 1;
      if (m.role_key && m.role_key !== m.operational_role) {
        counts[m.role_key] = (counts[m.role_key] || 0) + 1;
      }
    }
    return counts;
  }, [members]);

  const canManageMember = useCallback(
    (targetMember: ActiveMember) => {
      // 1. O papel Owner nunca pode ser gerenciado ou alterado por terceiros
      if (targetMember.operational_role === "owner" || targetMember.role_key === "owner") return false;
      // 2. Não permite editar a si próprio por aqui para evitar auto-revogação acidental
      if (targetMember.user_id === userId) return false;
      // 3. Proprietário tem gestão irrestrita sobre todos os demais colaboradores
      if (isAccountOwner) return true;

      // 4. Verificação de permissões do colaborador atuante
      if (!canEditCollaborators && !canDeleteCollaborators && !canManageRoles) return false;

      // 5. Comparação hierárquica vertical estrita em O(1)
      const targetRoleKey = targetMember.role_key || targetMember.operational_role;
      const targetRoleIndex = effectiveRoleIndexMap.get(targetRoleKey) ?? -1;
      return actorRoleIndex >= 0 && targetRoleIndex > actorRoleIndex;
    },
    [
      userId,
      isAccountOwner,
      canEditCollaborators,
      canDeleteCollaborators,
      canManageRoles,
      effectiveRoleIndexMap,
      actorRoleIndex,
    ]
  );

  const handleOpenEditMember = (member: ActiveMember) => {
    setEditingMember(member);
    setEditMemberRole(member.role_key || member.operational_role);
    setEditMemberJobTitle(member.job_title || "");
    setEditMemberSpecialty(member.specialty || "");
    setEditMemberWorkingHours(member.working_hours || "");
    setEditMemberStatus((member.membership_status as "active" | "suspended" | "inactive") || "active");
  };

  const handleSaveMember = async (payload?: { roleKey?: string; baseOperationalRole?: string }) => {
    if (!editingMember || !clinicId) return;

    // Hardening de Poder Vertical: validação antes de qualquer chamada RPC
    if (!canManageMember(editingMember)) {
      toast({
        title: "Ação não permitida",
        description: "Você não tem autorização para alterar este colaborador.",
        variant: "destructive",
      });
      return;
    }

    const selectedRoleDef = operationalRoleDefinitions.find(
      (r) => r.role_key === (payload?.roleKey || editMemberRole)
    );
    const targetRoleKey = payload?.roleKey || selectedRoleDef?.role_key || editMemberRole;
    const baseOperationalRole = (payload?.baseOperationalRole || selectedRoleDef?.base_operational_role || editMemberRole) as any;

    if (!isAccountOwner) {
      if (targetRoleKey === "owner") {
        toast({
          title: "Nível não permitido",
          description: "Somente o Proprietário pode conceder este nível de acesso.",
          variant: "destructive",
        });
        return;
      }
      const newRoleIndex = effectiveRoleIndexMap.get(targetRoleKey) ?? -1;
      if (newRoleIndex <= actorRoleIndex) {
        toast({
          title: "Nível não permitido",
          description: "Você não pode atribuir um papel de nível hierárquico igual ou superior ao seu.",
          variant: "destructive",
        });
        return;
      }
    }

    setSavingMember(true);

    try {
      let { error } = await supabase.rpc("update_clinic_member_operational_fields", {
        _membership_id: editingMember.id,
        _job_title: editMemberJobTitle.trim() || undefined,
        _specialty: editMemberSpecialty.trim() || undefined,
        _working_hours: editMemberWorkingHours.trim() || undefined,
        _operational_role: baseOperationalRole,
        _role_key: targetRoleKey,
        _membership_status: editMemberStatus as any,
      } as any);

      // Fallback Expand & Contract caso a RPC remota ainda não tenha o parâmetro _role_key
      if (error && (error.message?.includes("_role_key") || error.code === "PGRST202")) {
        const fallback = await supabase.rpc("update_clinic_member_operational_fields", {
          _membership_id: editingMember.id,
          _job_title: editMemberJobTitle.trim() || undefined,
          _specialty: editMemberSpecialty.trim() || undefined,
          _working_hours: editMemberWorkingHours.trim() || undefined,
          _operational_role: baseOperationalRole,
          _membership_status: editMemberStatus as any,
        } as any);
        error = fallback.error;
      }

      if (error) throw new Error(error.message);

      toast({
        title: "Colaborador atualizado",
        description: `Os dados de ${editingMember.full_name} foram salvos com sucesso.`,
      });

      setEditingMember(null);
      void onTeamDataChanged();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar colaborador.";
      toast({ title: "Erro ao salvar", description: msg, variant: "destructive" });
    } finally {
      setSavingMember(false);
    }
  };

  const handleToggleMemberStatus = async (member: ActiveMember, nextStatus: "active" | "suspended") => {
    if (!clinicId) return;

    // Hardening de Poder Vertical: validação antes de alterar status
    if (!canManageMember(member)) {
      toast({
        title: "Ação não permitida",
        description: "Você não tem permissão para alterar o status deste colaborador.",
        variant: "destructive",
      });
      return;
    }

    setTogglingMemberId(member.id);

    const previousMembers = members;
    setMembers((curr) =>
      curr.map((m) =>
        m.id === member.id
          ? {
              ...m,
              membership_status: nextStatus,
              is_active: nextStatus === "active",
            }
          : m
      )
    );

    try {
      const { error } = await supabase.rpc("update_clinic_member_operational_fields", {
        _membership_id: member.id,
        _membership_status: nextStatus as any,
      });

      if (error) throw new Error(error.message);

      toast({
        title: nextStatus === "active" ? "Acesso reativado" : "Acesso pausado",
        description:
          nextStatus === "active"
            ? `O acesso de ${member.full_name} foi reativado.`
            : `O acesso de ${member.full_name} foi temporariamente pausado.`,
      });
    } catch (err) {
      setMembers(previousMembers);
      const msg = err instanceof Error ? err.message : "Erro ao alterar status do colaborador.";
      toast({ title: "Erro ao alterar status", description: msg, variant: "destructive" });
    } finally {
      setTogglingMemberId(null);
    }
  };

  const handleConfirmRevokeAccess = async () => {
    if (!revokingMember || !clinicId) return;

    // Hardening de Poder Vertical: validação antes de revogar
    if (!canManageMember(revokingMember)) {
      toast({
        title: "Ação não permitida",
        description: "Você não tem permissão para revogar o acesso deste colaborador.",
        variant: "destructive",
      });
      return;
    }

    setIsRevoking(true);

    try {
      const { error } = await supabase.rpc("revoke_clinic_member_access", {
        _membership_id: revokingMember.id,
      });

      if (error) throw new Error(error.message);

      toast({
        title: "Acesso revogado",
        description: `O acesso de ${revokingMember.full_name} à clínica foi revogado e as sessões ativas foram encerradas.`,
      });

      setRevokingMember(null);
      void onTeamDataChanged();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao revogar acesso do colaborador.";
      toast({ title: "Erro ao revogar acesso", description: msg, variant: "destructive" });
    } finally {
      setIsRevoking(false);
    }
  };

  return {
    members,
    setMembers,
    roleUsageCounts,
    canManageMember,
    editingMember,
    setEditingMember,
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
    handleOpenEditMember,
    handleSaveMember,
    togglingMemberId,
    handleToggleMemberStatus,
    revokingMember,
    setRevokingMember,
    isRevoking,
    handleConfirmRevokeAccess,
  };
};
