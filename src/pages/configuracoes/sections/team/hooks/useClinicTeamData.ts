import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { buildPublicAppUrl } from "@/lib/public-app-url";
import {
  ACCESS_CAPABILITIES,
  buildCapabilitiesForContext,
  type AccessCapability,
  type MembershipContext,
} from "@/lib/rbac";
import { getConcurrentAccessCapacity } from "@/lib/subaccounts";
import {
  OPERATIONAL_ROLE_MANAGEMENT_ORDER,
  ROLE_PERMISSION_CATEGORY_COUNTS,
  ROLE_PERMISSION_ITEMS,
  SYSTEM_OPERATIONAL_ROLE_DEFINITIONS,
  type ActiveMember,
  type ActiveSessionRow,
  type ClinicOperationalRoleDefinition,
  type PendingCollaboratorInvitation,
  type RoleCapabilityRow,
  type RolePermissionCategoryId,
  type SubaccountOperationalRole,
} from "../types";

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
  const [members, setMembers] = useState<ActiveMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingCollaboratorInvitation[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSessionRow[]>([]);

  // RBAC Roles state
  const [roleManagementOpen, setRoleManagementOpen] = useState(false);
  const [selectedOperationalRole, setSelectedOperationalRole] = useState<string>("admin");
  const [rolePermissionCategory, setRolePermissionCategory] = useState<RolePermissionCategoryId>("all");
  const [operationalRoleDefinitions, setOperationalRoleDefinitions] = useState<ClinicOperationalRoleDefinition[]>(
    SYSTEM_OPERATIONAL_ROLE_DEFINITIONS
  );
  const [editingRoleLabel, setEditingRoleLabel] = useState("");
  const [savingRoleDefinition, setSavingRoleDefinition] = useState(false);
  const [roleCapabilityOverrides, setRoleCapabilityOverrides] = useState<RoleCapabilityRow[]>([]);

  // Convite state
  const [sendingInvite, setSendingInvite] = useState(false);
  const [lastGeneratedInviteUrl, setLastGeneratedInviteUrl] = useState("");
  const [lastGeneratedInviteEmail, setLastGeneratedInviteEmail] = useState("");
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

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
          .select("id, user_id, operational_role, membership_status, created_at, is_active")
          .eq("clinic_id", clinicId)
          .neq("membership_status", "invited"),
        supabase.rpc("get_clinic_pending_collaborator_invitations", { _clinic_id: clinicId }),
        supabase.from("clinic_operational_roles").select("*").eq("clinic_id", clinicId),
        supabase.from("clinic_operational_role_capabilities").select("*").eq("clinic_id", clinicId),
        supabase.rpc("get_clinic_concurrent_access_overview", { _clinic_id: clinicId }),
      ]);

      if (membershipsRes.error) {
        throw membershipsRes.error;
      }

      if (membershipsRes.data) {
        const userIds = Array.from(new Set(membershipsRes.data.map((m: any) => m.user_id).filter(Boolean)));
        let profilesList: Array<{
          id: string;
          full_name: string | null;
          email: string | null;
          job_title: string | null;
          specialty: string | null;
          working_hours: string | null;
          last_seen_at: string | null;
        }> = [];

        if (userIds.length > 0) {
          const profilesRes = await supabase
            .from("profiles")
            .select("id, full_name, email, job_title, specialty, working_hours, last_seen_at")
            .in("id", userIds);

          if (profilesRes.error) {
            throw profilesRes.error;
          }
          profilesList = (profilesRes.data ?? []) as typeof profilesList;
        }

        const profileMap = new Map(profilesList.map((p) => [p.id, p]));

        const mapped: ActiveMember[] = membershipsRes.data
          .filter((item: any) => item.membership_status !== "invited")
          .map((item: any) => {
            const profile = profileMap.get(item.user_id);
            const status =
              (item.membership_status as "active" | "suspended" | "inactive") ||
              (item.is_active !== false ? "active" : "inactive");

            return {
              id: item.id,
              user_id: item.user_id,
              operational_role: item.operational_role || "professional",
              membership_status: status,
              is_active: item.is_active !== false,
              created_at: item.created_at,
              full_name: profile?.full_name || "Colaborador",
              email: profile?.email || "",
              job_title: profile?.job_title || null,
              specialty: profile?.specialty || null,
              working_hours: profile?.working_hours || null,
              last_seen_at: profile?.last_seen_at || null,
            };
          });
        setMembers(mapped);
      }

      if (pendingData && Array.isArray(pendingData)) {
        setPendingInvitations(pendingData as PendingCollaboratorInvitation[]);
      }

      if (roleDefsData && Array.isArray(roleDefsData)) {
        setOperationalRoleDefinitions([
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
        setRoleCapabilityOverrides(roleCapsData as RoleCapabilityRow[]);
      }

      if (concurrentData && typeof concurrentData === "object") {
        const cData = concurrentData as { active_sessions?: ActiveSessionRow[] };
        if (Array.isArray(cData.active_sessions)) {
          setActiveSessions(cData.active_sessions);
        }
      }
    } catch (err: any) {
      console.error("[useClinicTeamData] loadTeamData error:", err);
      setFetchError(err?.message || "Erro ao carregar dados da equipe.");
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    void loadTeamData();
  }, [loadTeamData]);

  // Hierarquia ordenada de papéis
  const sortedOperationalRoleDefinitions = useMemo(
    () => [...operationalRoleDefinitions].sort((a, b) => a.sort_order - b.sort_order),
    [operationalRoleDefinitions]
  );

  const selectedRoleDefinition = useMemo(
    () =>
      sortedOperationalRoleDefinitions.find((role) => role.role_key === selectedOperationalRole) ??
      sortedOperationalRoleDefinitions[0] ?? {
        base_operational_role: "professional",
        clinic_id: clinicId || "",
        description: "Papel operacional",
        is_system: true,
        label: "Profissional",
        role_key: "professional",
        sort_order: 10,
      },
    [selectedOperationalRole, sortedOperationalRoleDefinitions, clinicId]
  );

  useEffect(() => {
    setEditingRoleLabel(selectedRoleDefinition.label);
  }, [selectedRoleDefinition]);

  const roleUsageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach((m) => {
      counts[m.operational_role] = (counts[m.operational_role] || 0) + 1;
    });
    return counts;
  }, [members]);

  const rolePermissionCategoryCounts = ROLE_PERMISSION_CATEGORY_COUNTS;

  // Regras estritas de autorização e hierarquia vertical
  const isAccountOwner = accountRole === "account_owner" || operationalRole === "owner";
  const canViewTeam = isAccountOwner || can("subaccounts.read") || can("subaccounts.manage");
  const canInviteCollaborators = isAccountOwner || can("subaccounts.write") || can("subaccounts.manage");
  const canEditCollaborators = isAccountOwner || can("subaccounts.manage");
  const canDeleteCollaborators = isAccountOwner || can("subaccounts.delete") || can("subaccounts.manage");
  const canManageRoles = isAccountOwner || can("subaccounts_roles.manage");
  const canViewRoles = isAccountOwner || can("subaccounts_roles.manage") || can("subaccounts_roles.read");
  const hasRolesManagePermission = canManageRoles;
  const actorRoleKey = isAccountOwner ? "owner" : (operationalRole || "professional");
  const actorRoleIndex = sortedOperationalRoleDefinitions.findIndex((r) => r.role_key === actorRoleKey);
  const selectedRoleIndex = sortedOperationalRoleDefinitions.findIndex((r) => r.role_key === selectedRoleDefinition.role_key);

  const canEditSelectedRole =
    hasRolesManagePermission &&
    (isAccountOwner || (actorRoleIndex >= 0 && selectedRoleIndex > actorRoleIndex));

  const canMoveSelectedRole = canEditSelectedRole && selectedRoleDefinition.role_key !== "owner";
  const canDeleteSelectedRole =
    canEditSelectedRole && !selectedRoleDefinition.is_system && selectedRoleDefinition.role_key !== "owner";

  const selectedRoleCapabilities = useMemo(() => {
    const overridesMap: Partial<Record<AccessCapability, boolean>> = {};
    for (const row of roleCapabilityOverrides) {
      if (row.operational_role === selectedRoleDefinition.role_key) {
        overridesMap[row.capability as AccessCapability] = row.enabled;
      }
    }

    const context: MembershipContext = {
      accountRole: null,
      isActive: true,
      membershipStatus: "active",
      operationalRole:
        selectedRoleDefinition.base_operational_role === "owner"
          ? "owner"
          : selectedRoleDefinition.base_operational_role,
      subscriptionPlan: subscriptionPlan ?? "clinic",
    };
    return buildCapabilitiesForContext(context, overridesMap);
  }, [selectedRoleDefinition, roleCapabilityOverrides, subscriptionPlan]);

  const handleToggleRoleCapability = async (capability: AccessCapability, nextChecked: boolean) => {
    if (!clinicId || !canEditSelectedRole) return;

    const relatedItem = ROLE_PERMISSION_ITEMS.find((item) =>
      item.actions.some((a) => a.capability === capability)
    );
    const viewAction = relatedItem?.actions.find((a) => a.kind === "view");

    const updates: Array<{ capability: AccessCapability; enabled: boolean }> = [
      { capability, enabled: nextChecked },
    ];

    // Acoplamento inteligente: ao ativar uma ação como editar/excluir/compartilhar, garante que o 'ver' esteja ativo
    if (nextChecked && viewAction && viewAction.capability !== capability) {
      if (!selectedRoleCapabilities[viewAction.capability]) {
        updates.push({ capability: viewAction.capability, enabled: true });
      }
    } else if (!nextChecked && viewAction && viewAction.capability === capability) {
      // Ao desativar o 'ver', desativa as ações dependentes deste mesmo item
      relatedItem?.actions.forEach((a) => {
        if (a.capability !== capability && selectedRoleCapabilities[a.capability]) {
          updates.push({ capability: a.capability, enabled: false });
        }
      });
    }

    const upsertRows = updates.map((update) => ({
      clinic_id: clinicId,
      operational_role: selectedRoleDefinition.role_key,
      capability: update.capability,
      enabled: update.enabled,
    }));

    const { error } = await supabase.from("clinic_operational_role_capabilities").upsert(
      upsertRows,
      { onConflict: "clinic_id,operational_role,capability" }
    );

    if (error) {
      toast({ title: "Erro ao salvar permissão", description: error.message, variant: "destructive" });
      return;
    }

    setRoleCapabilityOverrides((curr) => {
      const updateCaps = new Set(updates.map((u) => u.capability));
      const filtered = curr.filter(
        (r) => !(r.operational_role === selectedRoleDefinition.role_key && updateCaps.has(r.capability as AccessCapability))
      );
      const newRows = updates.map((u) => ({
        clinic_id: clinicId,
        operational_role: selectedRoleDefinition.role_key,
        capability: u.capability,
        enabled: u.enabled,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        id: `${clinicId}-${selectedRoleDefinition.role_key}-${u.capability}`,
      }));
      return [...filtered, ...newRows];
    });

    toast({ title: "Permissão atualizada" });
  };

  const handleCreateOperationalRole = async () => {
    if (!clinicId || !hasRolesManagePermission || savingRoleDefinition) return;
    const existingCustomCount = operationalRoleDefinitions.filter((role) => !role.is_system).length;
    const roleKey = `papel_${Date.now().toString(36)}`;
    const nextRole: ClinicOperationalRoleDefinition = {
      base_operational_role: "professional",
      clinic_id: clinicId,
      description: "Papel personalizado da clínica.",
      is_system: false,
      label: `Novo papel ${existingCustomCount + 1}`,
      role_key: roleKey,
      sort_order: Math.max(...operationalRoleDefinitions.map((role) => role.sort_order), 0) + 10,
    };

    setSavingRoleDefinition(true);
    const { data, error } = await supabase
      .from("clinic_operational_roles")
      .upsert(nextRole, { onConflict: "clinic_id,role_key" })
      .select("*")
      .maybeSingle();

    setSavingRoleDefinition(false);
    if (error || !data) {
      toast({ title: "Erro ao criar papel", description: error?.message, variant: "destructive" });
      return;
    }

    setOperationalRoleDefinitions((current) =>
      [...current, data as ClinicOperationalRoleDefinition].sort((a, b) => a.sort_order - b.sort_order)
    );
    setSelectedOperationalRole(data.role_key);
    toast({ title: "Papel criado com sucesso!" });
  };

  const handleMoveSelectedRole = async (direction: "up" | "down") => {
    if (!canMoveSelectedRole || !clinicId) return;
    const index = sortedOperationalRoleDefinitions.findIndex((role) => role.role_key === selectedRoleDefinition.role_key);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const target = sortedOperationalRoleDefinitions[targetIndex];
    if (index < 0 || !target || target.role_key === "owner") return;

    if (!isAccountOwner && targetIndex <= actorRoleIndex) {
      toast({
        title: "Nível não permitido",
        description: "Você não pode mover um papel para o seu mesmo nível hierárquico ou acima.",
        variant: "destructive",
      });
      return;
    }

    // Reordenação atômica reindexada para evitar colisões de sort_order
    const reordered = [...sortedOperationalRoleDefinitions];
    const [movedRole] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, movedRole);

    const updatedList = reordered.map((role, idx) => ({
      ...role,
      sort_order: (idx + 1) * 10,
    }));

    setSavingRoleDefinition(true);

    const { error } = await supabase
      .from("clinic_operational_roles")
      .upsert(updatedList, { onConflict: "clinic_id,role_key" });

    setSavingRoleDefinition(false);

    if (error) {
      toast({
        title: "Erro ao reordenar papéis",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setOperationalRoleDefinitions(updatedList);
  };

  const handleDeleteSelectedRole = async () => {
    if (!clinicId || !canDeleteSelectedRole) return;
    const membersCount = roleUsageCounts[selectedRoleDefinition.role_key] ?? 0;
    if (membersCount > 0) {
      toast({
        title: "Papel em uso",
        description: `Remova os ${membersCount} colaborador(es) deste papel antes de excluir.`,
        variant: "destructive",
      });
      return;
    }

    const pendingWithRole = pendingInvitations.filter(
      (i) => i.operational_role === selectedRoleDefinition.role_key
    ).length;
    if (pendingWithRole > 0) {
      toast({
        title: "Papel com convites pendentes",
        description: `Remova ou cancele os ${pendingWithRole} convite(s) pendentes com este papel antes de excluir.`,
        variant: "destructive",
      });
      return;
    }

    setSavingRoleDefinition(true);
    const { error } = await supabase
      .from("clinic_operational_roles")
      .delete()
      .eq("clinic_id", clinicId)
      .eq("role_key", selectedRoleDefinition.role_key);

    if (!error) {
      await supabase
        .from("clinic_operational_role_capabilities")
        .delete()
        .eq("clinic_id", clinicId)
        .eq("operational_role", selectedRoleDefinition.role_key);
    }

    setSavingRoleDefinition(false);
    if (error) {
      toast({ title: "Erro ao excluir papel", description: error.message, variant: "destructive" });
      return;
    }

    setOperationalRoleDefinitions((current) => current.filter((role) => role.role_key !== selectedRoleDefinition.role_key));
    setRoleCapabilityOverrides((current) => current.filter((row) => row.operational_role !== selectedRoleDefinition.role_key));
    setSelectedOperationalRole("admin");
    toast({ title: "Papel excluído com sucesso!" });
  };

  const handleSaveSelectedRoleLabel = async () => {
    if (!selectedRoleDefinition || !canEditSelectedRole || !clinicId) return;
    if (editingRoleLabel.trim().length < 2) {
      toast({ title: "Nome muito curto", description: "Use pelo menos 2 caracteres.", variant: "destructive" });
      return;
    }

    setSavingRoleDefinition(true);
    const { error } = await supabase
      .from("clinic_operational_roles")
      .upsert(
        {
          clinic_id: clinicId,
          role_key: selectedRoleDefinition.role_key,
          label: editingRoleLabel.trim(),
          base_operational_role: selectedRoleDefinition.base_operational_role,
          description: selectedRoleDefinition.description,
          is_system: selectedRoleDefinition.is_system,
          sort_order: selectedRoleDefinition.sort_order,
        },
        { onConflict: "clinic_id,role_key" }
      );

    setSavingRoleDefinition(false);
    if (error) {
      toast({ title: "Erro ao renomear papel", description: error.message, variant: "destructive" });
      return;
    }

    setOperationalRoleDefinitions((curr) =>
      curr.map((r) => (r.role_key === selectedRoleDefinition.role_key ? { ...r, label: editingRoleLabel.trim() } : r))
    );
    toast({ title: "Papel renomeado com sucesso!" });
  };

  // Envio de novo convite
  const handleSendInvite = async (payload: {
    email: string;
    role: string;
    jobTitle: string;
    specialty: string;
  }) => {
    if (!clinicId || !payload.email.trim()) return;
    setSendingInvite(true);

    const { data, error } = await supabase.rpc("invite_clinic_collaborator", {
      _clinic_id: clinicId,
      _email: payload.email.trim(),
      _operational_role: payload.role,
      _job_title: payload.jobTitle.trim() || undefined,
      _specialty: payload.specialty.trim() || undefined,
    });

    if (error) {
      toast({ title: "Erro ao emitir convite", description: error.message, variant: "destructive" });
      setSendingInvite(false);
      return;
    }

    const resData = data as Record<string, unknown> | null;
    const token = resData?.token ? String(resData.token) : "";
    const inviteUrl = buildPublicAppUrl(`/convite/clinica/${token}`);

    setLastGeneratedInviteUrl(inviteUrl);
    setLastGeneratedInviteEmail(payload.email.trim());

    const { error: emailError } = await supabase.functions.invoke("send-clinic-invitation", {
      body: { inviteUrl, token },
    });

    if (emailError) {
      toast({
        title: "Convite gerado",
        description: `E-mail não pôde ser enviado automaticamente. Você pode copiar o link ou enviar no WhatsApp.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Convite enviado com sucesso!",
        description: `E-mail oficial enviado para ${payload.email}.`,
      });
    }

    setSendingInvite(false);
    void loadTeamData();
  };

  const handleCopyLink = async (url: string, email: string) => {
    await navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!", description: `Link de convite para ${email} copiado.` });
  };

  const handleGetInviteLinkOnly = async (invitation: PendingCollaboratorInvitation) => {
    try {
      const { data, error } = await supabase.rpc("invite_clinic_collaborator", {
        _clinic_id: clinicId || undefined,
        _email: invitation.email,
        _operational_role: invitation.operational_role,
        _job_title: invitation.job_title || undefined,
        _specialty: invitation.specialty || undefined,
      });

      if (error) throw new Error(error.message);

      const resData = data as Record<string, unknown>;
      const token = resData?.token ? String(resData.token) : "";
      const inviteUrl = buildPublicAppUrl(`/convite/clinica/${token}`);

      setLastGeneratedInviteUrl(inviteUrl);
      setLastGeneratedInviteEmail(invitation.email);

      await navigator.clipboard.writeText(inviteUrl);
      toast({
        title: "Link de convite copiado!",
        description: `Link exclusivo gerado e copiado para a área de transferência.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar link de convite.";
      toast({ title: "Erro ao copiar link", description: msg, variant: "destructive" });
    }
  };

  const handleResendInvite = async (invitation: PendingCollaboratorInvitation) => {
    setResendingId(invitation.id);

    try {
      const { data: fallbackData, error } = await supabase.rpc("invite_clinic_collaborator", {
        _clinic_id: clinicId || undefined,
        _email: invitation.email,
        _operational_role: invitation.operational_role,
        _job_title: invitation.job_title || undefined,
        _specialty: invitation.specialty || undefined,
      });

      if (error) throw new Error(error.message);

      const fData = fallbackData as Record<string, unknown>;
      const token = fData?.token ? String(fData.token) : "";
      const inviteUrl = buildPublicAppUrl(`/convite/clinica/${token}`);

      setLastGeneratedInviteUrl(inviteUrl);
      setLastGeneratedInviteEmail(invitation.email);

      const { error: emailError } = await supabase.functions.invoke("send-clinic-invitation", {
        body: { inviteUrl, token },
      });

      if (emailError) {
        toast({
          title: "Convite atualizado",
          description: `Novo link gerado. Copie o link direto caso o e-mail não chegue.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Convite reenviado!",
          description: `Novo e-mail enviado para ${invitation.email}.`,
        });
      }

      void loadTeamData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao reenviar convite.";
      toast({ title: "Erro ao reenviar", description: msg, variant: "destructive" });
    } finally {
      setResendingId(null);
    }
  };

  const handleCancelInvite = async (invitationId: string) => {
    setCancelingId(invitationId);
    const previousInvitations = pendingInvitations;
    setPendingInvitations((curr) => curr.filter((i) => i.id !== invitationId));

    const { error } = await supabase.rpc("cancel_clinic_collaborator_invitation", {
      _invitation_id: invitationId,
    });

    if (error) {
      setPendingInvitations(previousInvitations);
      toast({ title: "Erro ao cancelar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Convite cancelado com sucesso." });
    }
    setCancelingId(null);
  };

  const canManageMember = useCallback(
    (targetMember: ActiveMember) => {
      if (targetMember.operational_role === "owner") return false;
      if (targetMember.user_id === user?.id) return false;
      if (isAccountOwner) return true;

      if (!canEditCollaborators && !canDeleteCollaborators && !canManageRoles) return false;

      const targetRoleIndex = sortedOperationalRoleDefinitions.findIndex(
        (r) => r.role_key === targetMember.operational_role
      );
      return actorRoleIndex >= 0 && targetRoleIndex > actorRoleIndex;
    },
    [
      user?.id,
      isAccountOwner,
      canEditCollaborators,
      canDeleteCollaborators,
      canManageRoles,
      sortedOperationalRoleDefinitions,
      actorRoleIndex,
    ]
  );

  const assignableRoleDefinitions = useMemo(() => {
    return sortedOperationalRoleDefinitions.filter((role) => {
      if (role.role_key === "owner") return false;
      if (isAccountOwner) return true;
      if (!canManageRoles) return false;
      const roleIndex = sortedOperationalRoleDefinitions.findIndex((r) => r.role_key === role.role_key);
      return actorRoleIndex >= 0 && roleIndex > actorRoleIndex;
    });
  }, [sortedOperationalRoleDefinitions, isAccountOwner, canManageRoles, actorRoleIndex]);

  const handleOpenEditMember = (member: ActiveMember) => {
    setEditingMember(member);
    setEditMemberRole(member.operational_role);
    setEditMemberJobTitle(member.job_title || "");
    setEditMemberSpecialty(member.specialty || "");
    setEditMemberWorkingHours(member.working_hours || "");
    setEditMemberStatus((member.membership_status as "active" | "suspended" | "inactive") || "active");
  };

  const handleSaveMember = async () => {
    if (!editingMember || !clinicId) return;
    setSavingMember(true);

    try {
      const { error } = await supabase.rpc("update_clinic_member_operational_fields", {
        _membership_id: editingMember.id,
        _job_title: editMemberJobTitle.trim() || undefined,
        _specialty: editMemberSpecialty.trim() || undefined,
        _working_hours: editMemberWorkingHours.trim() || undefined,
        _operational_role: editMemberRole as any,
        _membership_status: editMemberStatus as any,
      });

      if (error) throw new Error(error.message);

      toast({
        title: "Colaborador atualizado",
        description: `Os dados de ${editingMember.full_name} foram salvos com sucesso.`,
      });

      setEditingMember(null);
      void loadTeamData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar colaborador.";
      toast({ title: "Erro ao salvar", description: msg, variant: "destructive" });
    } finally {
      setSavingMember(false);
    }
  };

  const handleToggleMemberStatus = async (member: ActiveMember, nextStatus: "active" | "suspended") => {
    if (!clinicId) return;
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
      void loadTeamData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao revogar acesso do colaborador.";
      toast({ title: "Erro ao revogar acesso", description: msg, variant: "destructive" });
    } finally {
      setIsRevoking(false);
    }
  };

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

  const visibleRolePermissionItems = useMemo(
    () =>
      rolePermissionCategory === "all"
        ? ROLE_PERMISSION_ITEMS
        : ROLE_PERMISSION_ITEMS.filter((item) => item.category === rolePermissionCategory),
    [rolePermissionCategory]
  );

  return {
    authClinic,
    loading,
    fetchError,
    retryLoadTeamData: loadTeamData,
    members,
    pendingInvitations,
    activeSessions,
    concurrentAccessCapacity,
    // RBAC
    roleManagementOpen,
    setRoleManagementOpen,
    selectedOperationalRole,
    setSelectedOperationalRole,
    rolePermissionCategory,
    setRolePermissionCategory,
    sortedOperationalRoleDefinitions,
    selectedRoleDefinition,
    editingRoleLabel,
    setEditingRoleLabel,
    savingRoleDefinition,
    roleUsageCounts,
    rolePermissionCategoryCounts,
    visibleRolePermissionItems,
    selectedRoleCapabilities,
    canEditSelectedRole,
    canMoveSelectedRole,
    canDeleteSelectedRole,
    selectedRoleIndex,
    handleToggleRoleCapability,
    handleCreateOperationalRole,
    handleMoveSelectedRole,
    handleDeleteSelectedRole,
    handleSaveSelectedRoleLabel,
    // Permissões
    isAccountOwner,
    canViewTeam,
    canInviteCollaborators,
    canEditCollaborators,
    canDeleteCollaborators,
    canManageRoles,
    canViewRoles,
    // Convite
    sendingInvite,
    lastGeneratedInviteUrl,
    lastGeneratedInviteEmail,
    handleSendInvite,
    handleCopyLink,
    handleGetInviteLinkOnly,
    resendingId,
    cancelingId,
    handleResendInvite,
    handleCancelInvite,
    // Membros
    canManageMember,
    togglingMemberId,
    handleToggleMemberStatus,
    // Edição
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
    assignableRoleDefinitions,
    // Revogação
    revokingMember,
    setRevokingMember,
    isRevoking,
    handleConfirmRevokeAccess,
  };
};

