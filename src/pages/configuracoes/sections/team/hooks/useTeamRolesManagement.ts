import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  ACCESS_CAPABILITIES,
  buildCapabilitiesForContext,
  type AccessCapability,
  type MembershipContext,
} from "@/lib/rbac";
import {
  OPERATIONAL_ROLE_MANAGEMENT_ORDER,
  ROLE_PERMISSION_CATEGORY_COUNTS,
  ROLE_PERMISSION_ITEMS,
  SYSTEM_OPERATIONAL_ROLE_DEFINITIONS,
  type ClinicOperationalRoleDefinition,
  type PendingCollaboratorInvitation,
  type RoleCapabilityRow,
  type RolePermissionCategoryId,
} from "../types";

// Otimização Big-O: Mapa estático O(1) de capability para item e ação de visualização
const CAPABILITY_TO_ITEM_ACTION_MAP = new Map<
  AccessCapability,
  {
    item: (typeof ROLE_PERMISSION_ITEMS)[number];
    viewAction?: (typeof ROLE_PERMISSION_ITEMS)[number]["actions"][number];
  }
>();

ROLE_PERMISSION_ITEMS.forEach((item) => {
  const viewAction = item.actions.find((a) => a.kind === "view");
  item.actions.forEach((action) => {
    CAPABILITY_TO_ITEM_ACTION_MAP.set(action.capability, { item, viewAction });
  });
});

export interface UseTeamRolesManagementParams {
  clinicId?: string | null;
  subscriptionPlan?: string | null;
  isAccountOwner: boolean;
  operationalRole?: string | null;
  canManageRoles: boolean;
  canViewRoles: boolean;
  roleUsageCounts: Record<string, number>;
  pendingInvitations: PendingCollaboratorInvitation[];
}

export const useTeamRolesManagement = ({
  clinicId,
  subscriptionPlan,
  isAccountOwner,
  operationalRole,
  canManageRoles,
  canViewRoles,
  roleUsageCounts,
  pendingInvitations,
}: UseTeamRolesManagementParams) => {
  const [roleManagementOpen, setRoleManagementOpen] = useState(false);
  const [selectedOperationalRole, setSelectedOperationalRole] = useState<string>("admin");
  const [rolePermissionCategory, setRolePermissionCategory] = useState<RolePermissionCategoryId>("all");
  const [operationalRoleDefinitions, setOperationalRoleDefinitions] = useState<ClinicOperationalRoleDefinition[]>(
    SYSTEM_OPERATIONAL_ROLE_DEFINITIONS
  );
  const [editingRoleLabel, setEditingRoleLabel] = useState("");
  const [savingRoleDefinition, setSavingRoleDefinition] = useState(false);
  const [roleCapabilityOverrides, setRoleCapabilityOverrides] = useState<RoleCapabilityRow[]>([]);

  // Hardening para plano prof_top (Você + Apoio): Somente Dono e Papel de Apoio (assistant)
  const isProfTopPlan = subscriptionPlan === "prof_top";

  // Hierarquia ordenada de papéis
  const sortedOperationalRoleDefinitions = useMemo(() => {
    const sorted = [...operationalRoleDefinitions].sort((a, b) => a.sort_order - b.sort_order);
    if (isProfTopPlan) {
      // Exibe apenas owner e assistant (Apoio/Secretária)
      return sorted.filter((r) => r.role_key === "owner" || r.role_key === "assistant");
    }
    return sorted;
  }, [operationalRoleDefinitions, isProfTopPlan]);

  // Otimização Big-O: Mapa O(1) para busca de índice hierárquico
  const roleIndexMap = useMemo(
    () => new Map(sortedOperationalRoleDefinitions.map((r, idx) => [r.role_key, idx])),
    [sortedOperationalRoleDefinitions]
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

  const hasRolesManagePermission = canManageRoles;
  const actorRoleKey = isAccountOwner ? "owner" : (operationalRole || "professional");
  const actorRoleIndex = roleIndexMap.get(actorRoleKey) ?? -1;
  const selectedRoleIndex = roleIndexMap.get(selectedRoleDefinition.role_key) ?? -1;

  const canEditSelectedRole =
    hasRolesManagePermission &&
    (isAccountOwner || (actorRoleIndex >= 0 && selectedRoleIndex > actorRoleIndex));

  const canMoveSelectedRole = !isProfTopPlan && canEditSelectedRole && selectedRoleDefinition.role_key !== "owner";
  const canDeleteSelectedRole =
    !isProfTopPlan && canEditSelectedRole && !selectedRoleDefinition.is_system && selectedRoleDefinition.role_key !== "owner";

  const selectedRoleCapabilities = useMemo(() => {
    // Hardening de Segurança: O papel de Owner sempre retém 100% de acesso irrestrito
    if (selectedRoleDefinition.role_key === "owner") {
      const fullAccess = {} as Record<AccessCapability, boolean>;
      for (const cap of ACCESS_CAPABILITIES) {
        fullAccess[cap] = true;
      }
      return fullAccess;
    }

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

    // Hardening contra bloqueio acidental: Owner NUNCA pode ter permissões desativadas
    if (selectedRoleDefinition.role_key === "owner" && !nextChecked) {
      toast({
        title: "Ação não permitida",
        description: "O papel do Proprietário (Owner) possui acesso irrestrito permanente e não pode ter permissões revogadas.",
        variant: "destructive",
      });
      return;
    }

    const mappedEntry = CAPABILITY_TO_ITEM_ACTION_MAP.get(capability);
    const relatedItem = mappedEntry?.item;
    const viewAction = mappedEntry?.viewAction;

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
    if (!clinicId || !hasRolesManagePermission || savingRoleDefinition || isProfTopPlan) return;
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
    const roleIndex = roleIndexMap.get(selectedRoleDefinition.role_key) ?? -1;
    const targetIndex = direction === "up" ? roleIndex - 1 : roleIndex + 1;
    const target = sortedOperationalRoleDefinitions[targetIndex];
    if (roleIndex < 0 || !target || target.role_key === "owner") return;

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
    const [movedRole] = reordered.splice(roleIndex, 1);
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

  // Otimização Big-O: Mapa O(P) para contagem de convites pendentes por papel
  const pendingInvitationsByRoleMap = useMemo(() => {
    const counts = new Map<string, number>();
    for (let i = 0; i < pendingInvitations.length; i++) {
      const r = pendingInvitations[i].operational_role;
      counts.set(r, (counts.get(r) || 0) + 1);
    }
    return counts;
  }, [pendingInvitations]);

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

    const pendingWithRole = pendingInvitationsByRoleMap.get(selectedRoleDefinition.role_key) ?? 0;
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

  // Otimização Big-O: Filtragem linear O(N) com busca O(1) de hierarquia
  const assignableRoleDefinitions = useMemo(() => {
    return sortedOperationalRoleDefinitions.filter((role) => {
      if (role.role_key === "owner") return false;
      if (isAccountOwner) return true;
      if (!canManageRoles) return false;
      const roleIndex = roleIndexMap.get(role.role_key) ?? -1;
      return actorRoleIndex >= 0 && roleIndex > actorRoleIndex;
    });
  }, [sortedOperationalRoleDefinitions, isAccountOwner, canManageRoles, roleIndexMap, actorRoleIndex]);

  const visibleRolePermissionItems = useMemo(
    () =>
      rolePermissionCategory === "all"
        ? ROLE_PERMISSION_ITEMS
        : ROLE_PERMISSION_ITEMS.filter((item) => item.category === rolePermissionCategory),
    [rolePermissionCategory]
  );

  return {
    roleManagementOpen,
    setRoleManagementOpen,
    selectedOperationalRole,
    setSelectedOperationalRole,
    rolePermissionCategory,
    setRolePermissionCategory,
    operationalRoleDefinitions,
    setOperationalRoleDefinitions,
    sortedOperationalRoleDefinitions,
    roleIndexMap,
    selectedRoleDefinition,
    editingRoleLabel,
    setEditingRoleLabel,
    savingRoleDefinition,
    setSavingRoleDefinition,
    roleCapabilityOverrides,
    setRoleCapabilityOverrides,
    rolePermissionCategoryCounts: ROLE_PERMISSION_CATEGORY_COUNTS,
    visibleRolePermissionItems,
    selectedRoleCapabilities,
    canEditSelectedRole,
    canMoveSelectedRole,
    canDeleteSelectedRole,
    selectedRoleIndex,
    actorRoleIndex,
    assignableRoleDefinitions,
    handleToggleRoleCapability,
    handleCreateOperationalRole,
    handleMoveSelectedRole,
    handleDeleteSelectedRole,
    handleSaveSelectedRoleLabel,
  };
};
