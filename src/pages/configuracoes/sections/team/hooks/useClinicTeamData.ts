import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logRuntimeError } from "@/lib/runtime-debug";
import { getConcurrentAccessCapacity } from "@/lib/subaccounts";
import {
  OPERATIONAL_ROLE_MANAGEMENT_ORDER,
  SYSTEM_OPERATIONAL_ROLE_DEFINITIONS,
  type ActiveMember,
  type ActiveSessionRow,
  type ClinicOperationalRoleDefinition,
  type PendingCollaboratorInvitation,
  type RoleCapabilityRow,
  type SubaccountOperationalRole,
} from "../types";
import { useTeamRolesManagement } from "./useTeamRolesManagement";
import { useTeamInvitations } from "./useTeamInvitations";
import { useTeamMembers } from "./useTeamMembers";

export const useClinicTeamData = () => {
  const {
    accountRole,
    can,
    clinic: authClinic,
    clinicId,
    operationalRole,
    subscriptionPlan,
    user,
  } = useAuth();

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveSessionRow[]>([]);

  // Regras estritas de autorização baseadas em RBAC e Plano de Assinatura
  const isAccountOwner = accountRole === "account_owner" || operationalRole === "owner";
  const isOneSeatPlan =
    subscriptionPlan === "solo" ||
    subscriptionPlan === "prof_basico" ||
    subscriptionPlan === "prof_medio";
  const isProfTopPlan = subscriptionPlan === "prof_top";

  const canViewTeam = isAccountOwner || can("subaccounts.read") || can("subaccounts.manage");
  const canEditCollaborators = !isOneSeatPlan && (isAccountOwner || can("subaccounts.manage"));
  const canDeleteCollaborators = !isOneSeatPlan && (isAccountOwner || can("subaccounts.delete") || can("subaccounts.manage"));
  const canManageRoles = !isOneSeatPlan && (isAccountOwner || can("subaccounts_roles.manage"));
  const canViewRoles = !isOneSeatPlan && (isAccountOwner || can("subaccounts_roles.manage") || can("subaccounts_roles.read"));

  // Subhook 1: Gestão de papéis & capacidades
  const roles = useTeamRolesManagement({
    clinicId,
    subscriptionPlan,
    isAccountOwner,
    operationalRole,
    canManageRoles,
    canViewRoles,
    roleUsageCounts: {},
    pendingInvitations: [],
  });

  // Subhook 2: Convites
  const invitations = useTeamInvitations({
    clinicId,
    operationalRoleDefinitions: roles.operationalRoleDefinitions,
    isAccountOwner,
    actorRoleIndex: roles.actorRoleIndex,
    roleIndexMap: roles.roleIndexMap,
    onTeamDataChanged: () => void loadTeamData(),
  });

  // Subhook 3: Membros, edição e revogação
  const members = useTeamMembers({
    clinicId,
    userId: user?.id,
    isAccountOwner,
    canEditCollaborators,
    canDeleteCollaborators,
    canManageRoles,
    actorRoleIndex: roles.actorRoleIndex,
    sortedOperationalRoleDefinitions: roles.sortedOperationalRoleDefinitions,
    roleIndexMap: roles.roleIndexMap,
    operationalRoleDefinitions: roles.operationalRoleDefinitions,
    onTeamDataChanged: () => void loadTeamData(),
  });

  // Contagem O(N) indexada de colaboradores ativos não-proprietários
  const activeCollaboratorsCount = useMemo(() => {
    return (members.members ?? []).filter(
      (m) => m.operational_role !== "owner" && m.is_active && m.membership_status === "active"
    ).length;
  }, [members.members]);

  const pendingInvitationsCount = invitations.pendingInvitations?.length ?? 0;
  const isProfTopLimitReached = isProfTopPlan && (activeCollaboratorsCount + pendingInvitationsCount >= 1);

  const canInviteCollaborators = useMemo(() => {
    if (isOneSeatPlan) return false;
    if (isProfTopLimitReached) return false;
    return isAccountOwner || can("subaccounts.write") || can("subaccounts.manage");
  }, [isOneSeatPlan, isProfTopLimitReached, isAccountOwner, can]);

  const inviteDisabledReason = useMemo(() => {
    if (isOneSeatPlan) {
      return "Planos individuais (1 acesso) não permitem cadastrar colaboradores. Conheça os planos de expansão.";
    }
    if (isProfTopLimitReached) {
      return "O plano Profissional Top permite no máximo 1 colaborador de apoio além do titular. Vaga preenchida.";
    }
    if (!canInviteCollaborators) {
      return "Seu papel atual não possui permissão para convidar novos colaboradores.";
    }
    return undefined;
  }, [isOneSeatPlan, isProfTopLimitReached, canInviteCollaborators]);

  // Carregamento de dados centralizado
  const loadTeamData = useCallback(async () => {
    if (!clinicId) {
      setLoading(false);
      setFetchError(null);
      return;
    }
    setLoading(true);
    setFetchError(null);

    try {
      const [
        membershipsRes,
        { data: pendingData, error: pendingErr },
        { data: roleDefsData, error: roleDefsErr },
        { data: roleCapsData, error: roleCapsErr },
        { data: concurrentData, error: concurrentErr },
      ] = await Promise.all([
        supabase
          .from("clinic_memberships")
          .select("id, user_id, operational_role, role_key, membership_status, created_at, is_active")
          .eq("clinic_id", clinicId)
          .neq("membership_status", "invited"),
        supabase.rpc("get_clinic_pending_collaborator_invitations", { _clinic_id: clinicId }),
        supabase.from("clinic_operational_roles").select("*").eq("clinic_id", clinicId),
        supabase.from("clinic_operational_role_capabilities").select("*").eq("clinic_id", clinicId),
        supabase.rpc("get_clinic_concurrent_access_overview", { _clinic_id: clinicId }),
      ]);

      let rawMemberships = membershipsRes.data;
      if (membershipsRes.error) {
        // Fallback Expand & Contract: Se o banco remoto ainda não tiver aplicado a migração de role_key,
        // recupera sem a coluna e preenche role_key = null sem estourar erro de tela.
        if (
          membershipsRes.error.code === "42703" ||
          membershipsRes.error.message?.includes("role_key")
        ) {
          const fallbackRes = await supabase
            .from("clinic_memberships")
            .select("id, user_id, operational_role, membership_status, created_at, is_active")
            .eq("clinic_id", clinicId)
            .neq("membership_status", "invited");

          if (fallbackRes.error) {
            throw fallbackRes.error;
          }
          rawMemberships = (fallbackRes.data ?? []).map((m: any) => ({ ...m, role_key: null }));
        } else {
          throw membershipsRes.error;
        }
      }

      if (rawMemberships) {
        const userIds = Array.from(new Set(rawMemberships.map((m: any) => m.user_id).filter(Boolean)));
        let profilesList: Array<{
          id: string;
          full_name: string | null;
          email: string | null;
          job_title: string | null;
          specialty: string | null;
          working_hours: string | null;
          last_seen_at: string | null;
          cpf: string | null;
        }> = [];

        if (userIds.length > 0) {
          const profilesRes = await supabase
            .from("profiles")
            .select("id, full_name, email, job_title, specialty, working_hours, last_seen_at, cpf")
            .in("id", userIds);

          if (profilesRes.error) {
            throw profilesRes.error;
          }
          profilesList = (profilesRes.data ?? []) as typeof profilesList;
        }

        const profileMap = new Map(profilesList.map((p) => [p.id, p]));

        const mapped: ActiveMember[] = (rawMemberships ?? [])
          .filter((item: any) => item.membership_status !== "invited")
          .map((item: any) => {
            const profile = profileMap.get(item.user_id);
            const status =
              (item.membership_status as "active" | "suspended" | "inactive") ||
              (item.is_active !== false ? "active" : "inactive");

            const rawCpf = profile?.cpf ? String(profile.cpf).replace(/\D/g, "") : "";
            const hasCpf = rawCpf.length === 11 || Boolean(profile?.cpf);

            return {
              id: item.id,
              user_id: item.user_id,
              operational_role: item.operational_role || "professional",
              role_key: item.role_key || null,
              membership_status: status,
              is_active: item.is_active !== false,
              created_at: item.created_at,
              full_name: profile?.full_name || "Colaborador",
              email: profile?.email || "",
              job_title: profile?.job_title || null,
              specialty: profile?.specialty || null,
              working_hours: profile?.working_hours || null,
              last_seen_at: profile?.last_seen_at || null,
              cpf: profile?.cpf || null,
              has_cpf: hasCpf,
            };
          });
        members.setMembers(mapped);
      }

      if (pendingData && Array.isArray(pendingData)) {
        invitations.setPendingInvitations(pendingData as PendingCollaboratorInvitation[]);
      }

      if (roleDefsData && Array.isArray(roleDefsData)) {
        roles.setOperationalRoleDefinitions([
          ...SYSTEM_OPERATIONAL_ROLE_DEFINITIONS.map((role) => ({
            ...role,
            clinic_id: clinicId,
            ...((roleDefsData as ClinicOperationalRoleDefinition[]).find((r) => r.role_key === role.role_key) ?? {}),
            is_system: true,
          })),
          ...(roleDefsData as ClinicOperationalRoleDefinition[]).filter(
            (r) => !OPERATIONAL_ROLE_MANAGEMENT_ORDER.includes(r.role_key as SubaccountOperationalRole | "owner")
          ),
        ]);
      }

      if (roleCapsData && Array.isArray(roleCapsData)) {
        roles.setRoleCapabilityOverrides(roleCapsData as RoleCapabilityRow[]);
      }

      if (concurrentData && typeof concurrentData === "object") {
        const cData = concurrentData as { active_sessions?: ActiveSessionRow[] };
        if (Array.isArray(cData.active_sessions)) {
          setActiveSessions(cData.active_sessions);
        }
      }
    } catch (err: any) {
      logRuntimeError("team.loadTeamData", err, { clinicId });
      console.error("[useClinicTeamData] loadTeamData error:", err);
      setFetchError(err?.message || "Erro ao carregar dados da equipe.");
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    void loadTeamData();
  }, [loadTeamData]);

  const concurrentAccessCapacity = useMemo(() => {
    const sessionList = (activeSessions ?? []).map((s) => ({
      ended_at: null,
      last_seen_at: s.last_seen_at || new Date().toISOString(),
      session_key: s.session_key,
      user_id: s.user_id,
    }));
    return getConcurrentAccessCapacity(
      authClinic?.concurrent_access_limit ?? 1,
      sessionList,
      new Date()
    );
  }, [authClinic?.concurrent_access_limit, activeSessions]);

  return {
    authClinic,
    subscriptionPlan,
    loading,
    fetchError,
    retryLoadTeamData: loadTeamData,
    members: members.members,
    pendingInvitations: invitations.pendingInvitations,
    activeSessions,
    concurrentAccessCapacity,

    // RBAC
    roleManagementOpen: roles.roleManagementOpen,
    setRoleManagementOpen: roles.setRoleManagementOpen,
    selectedOperationalRole: roles.selectedOperationalRole,
    setSelectedOperationalRole: roles.setSelectedOperationalRole,
    rolePermissionCategory: roles.rolePermissionCategory,
    setRolePermissionCategory: roles.setRolePermissionCategory,
    sortedOperationalRoleDefinitions: roles.sortedOperationalRoleDefinitions,
    selectedRoleDefinition: roles.selectedRoleDefinition,
    editingRoleLabel: roles.editingRoleLabel,
    setEditingRoleLabel: roles.setEditingRoleLabel,
    savingRoleDefinition: roles.savingRoleDefinition,
    roleUsageCounts: members.roleUsageCounts,
    rolePermissionCategoryCounts: roles.rolePermissionCategoryCounts,
    visibleRolePermissionItems: roles.visibleRolePermissionItems,
    selectedRoleCapabilities: roles.selectedRoleCapabilities,
    canEditSelectedRole: roles.canEditSelectedRole,
    canMoveSelectedRole: roles.canMoveSelectedRole,
    canDeleteSelectedRole: roles.canDeleteSelectedRole,
    selectedRoleIndex: roles.selectedRoleIndex,
    handleToggleRoleCapability: roles.handleToggleRoleCapability,
    handleCreateOperationalRole: roles.handleCreateOperationalRole,
    handleMoveSelectedRole: roles.handleMoveSelectedRole,
    handleDeleteSelectedRole: roles.handleDeleteSelectedRole,
    handleSaveSelectedRoleLabel: roles.handleSaveSelectedRoleLabel,

    // Permissões e Cotas de Plano
    isAccountOwner,
    canViewTeam,
    canInviteCollaborators,
    inviteDisabledReason,
    canEditCollaborators,
    canDeleteCollaborators,
    canManageRoles,
    canViewRoles,
    activeCollaboratorsCount,
    isProfTopLimitReached,

    // Convite
    sendingInvite: invitations.sendingInvite,
    lastGeneratedInviteUrl: invitations.lastGeneratedInviteUrl,
    lastGeneratedInviteEmail: invitations.lastGeneratedInviteEmail,
    handleSendInvite: invitations.handleSendInvite,
    handleCopyLink: invitations.handleCopyLink,
    handleGetInviteLinkOnly: invitations.handleGetInviteLinkOnly,
    resendingId: invitations.resendingId,
    cancelingId: invitations.cancelingId,
    handleResendInvite: invitations.handleResendInvite,
    handleCancelInvite: invitations.handleCancelInvite,

    // Regularização de CPF
    sendingCompletionMemberId: invitations.sendingCompletionMemberId,
    handleSendCompletionInvite: invitations.handleSendCompletionInvite,

    // Membros
    canManageMember: members.canManageMember,
    togglingMemberId: members.togglingMemberId,
    handleToggleMemberStatus: members.handleToggleMemberStatus,

    // Edição
    editingMember: members.editingMember,
    setEditingMember: members.setEditingMember,
    editMemberRole: members.editMemberRole,
    setEditMemberRole: members.setEditMemberRole,
    editMemberJobTitle: members.editMemberJobTitle,
    setEditMemberJobTitle: members.setEditMemberJobTitle,
    editMemberSpecialty: members.editMemberSpecialty,
    setEditMemberSpecialty: members.setEditMemberSpecialty,
    editMemberWorkingHours: members.editMemberWorkingHours,
    setEditMemberWorkingHours: members.setEditMemberWorkingHours,
    editMemberStatus: members.editMemberStatus,
    setEditMemberStatus: members.setEditMemberStatus,
    savingMember: members.savingMember,
    handleOpenEditMember: members.handleOpenEditMember,
    handleSaveMember: members.handleSaveMember,
    assignableRoleDefinitions: roles.assignableRoleDefinitions,

    // Revogação
    revokingMember: members.revokingMember,
    setRevokingMember: members.setRevokingMember,
    isRevoking: members.isRevoking,
    handleConfirmRevokeAccess: members.handleConfirmRevokeAccess,
  };
};
