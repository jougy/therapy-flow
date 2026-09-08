import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { callRpc, getErrorMessage } from "@/components/platform/platform-api";
import {
  buildCapabilitiesForContext,
  type AccessCapability,
  type MembershipContext,
} from "@/lib/rbac";
import { RolesManagementModal } from "@/pages/configuracoes/sections/team/components/RolesManagementModal";
import {
  OPERATIONAL_ROLE_MANAGEMENT_ORDER,
  ROLE_PERMISSION_CATEGORIES,
  ROLE_PERMISSION_CATEGORY_COUNTS,
  ROLE_PERMISSION_ITEMS,
  SYSTEM_OPERATIONAL_ROLE_DEFINITIONS,
  type ClinicOperationalRoleDefinition,
  type RoleCapabilityRow,
  type RolePermissionCategoryId,
  type SubaccountOperationalRole,
} from "@/pages/configuracoes/sections/team/types";

export interface PlatformRolesManagementModalProps {
  clinicId: string;
  clinicName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRoleKey?: string;
  onRolesUpdated?: () => void;
}

export const PlatformRolesManagementModal: React.FC<PlatformRolesManagementModalProps> = ({
  clinicId,
  clinicName,
  open,
  onOpenChange,
  initialRoleKey = "admin",
  onRolesUpdated,
}) => {
  const [loading, setLoading] = useState(false);
  const [operationalRoleDefinitions, setOperationalRoleDefinitions] = useState<ClinicOperationalRoleDefinition[]>(
    SYSTEM_OPERATIONAL_ROLE_DEFINITIONS
  );
  const [selectedOperationalRole, setSelectedOperationalRole] = useState<string>(initialRoleKey);
  const [rolePermissionCategory, setRolePermissionCategory] = useState<RolePermissionCategoryId>("all");
  const [roleCapabilityOverrides, setRoleCapabilityOverrides] = useState<RoleCapabilityRow[]>([]);
  const [roleUsageCounts, setRoleUsageCounts] = useState<Record<string, number>>({});
  const [savingRoleDefinition, setSavingRoleDefinition] = useState(false);

  // Sincroniza o papel inicial quando o modal abre
  useEffect(() => {
    if (open && initialRoleKey) {
      setSelectedOperationalRole(initialRoleKey);
    }
  }, [open, initialRoleKey]);

  // Carrega papéis, capacidades e contagem de membros da clínica
  const loadRolesData = useCallback(async () => {
    if (!clinicId || !open) return;
    setLoading(true);
    try {
      // 1. Tenta carregar via RPC otimizada get_platform_clinic_roles_overview
      const { data: rpcData, error: rpcError } = await callRpc("get_platform_clinic_roles_overview", {
        _clinic_id: clinicId,
      });

      if (!rpcError && rpcData && typeof rpcData === "object") {
        const payload = rpcData as {
          roles?: ClinicOperationalRoleDefinition[];
          capabilities?: RoleCapabilityRow[];
          usage_counts?: Record<string, number>;
        };

        const loadedRoles = payload.roles ?? [];
        const loadedCaps = payload.capabilities ?? [];
        const loadedCounts = payload.usage_counts ?? {};

        const mergedRoles: ClinicOperationalRoleDefinition[] = [
          ...SYSTEM_OPERATIONAL_ROLE_DEFINITIONS.map((role) => ({
            ...role,
            clinic_id: clinicId,
            ...(loadedRoles.find((r) => r.role_key === role.role_key) ?? {}),
            is_system: true,
          })),
          ...loadedRoles.filter(
            (r) => !OPERATIONAL_ROLE_MANAGEMENT_ORDER.includes(r.role_key as SubaccountOperationalRole | "owner")
          ),
        ];

        setOperationalRoleDefinitions(mergedRoles);
        setRoleCapabilityOverrides(loadedCaps);
        setRoleUsageCounts(loadedCounts);
        return;
      }

      // 2. Fallback via tabelas diretas com RLS de platform_owner
      const [rolesRes, capsRes, membersRes] = await Promise.all([
        supabase.from("clinic_operational_roles").select("*").eq("clinic_id", clinicId),
        supabase.from("clinic_operational_role_capabilities").select("*").eq("clinic_id", clinicId),
        supabase
          .from("clinic_memberships")
          .select("operational_role")
          .eq("clinic_id", clinicId)
          .neq("membership_status", "invited")
          .eq("is_active", true),
      ]);

      const loadedRoles = (rolesRes.data ?? []) as ClinicOperationalRoleDefinition[];
      const loadedCaps = (capsRes.data ?? []) as RoleCapabilityRow[];

      const counts: Record<string, number> = {};
      (membersRes.data ?? []).forEach((m) => {
        if (m.operational_role) {
          counts[m.operational_role] = (counts[m.operational_role] || 0) + 1;
        }
      });

      const mergedRoles: ClinicOperationalRoleDefinition[] = [
        ...SYSTEM_OPERATIONAL_ROLE_DEFINITIONS.map((role) => ({
          ...role,
          clinic_id: clinicId,
          ...(loadedRoles.find((r) => r.role_key === role.role_key) ?? {}),
          is_system: true,
        })),
        ...loadedRoles.filter(
          (r) => !OPERATIONAL_ROLE_MANAGEMENT_ORDER.includes(r.role_key as SubaccountOperationalRole | "owner")
        ),
      ];

      setOperationalRoleDefinitions(mergedRoles);
      setRoleCapabilityOverrides(loadedCaps);
      setRoleUsageCounts(counts);
    } catch (err) {
      console.error("Erro ao carregar papéis modulares da clínica:", err);
      toast({
        title: "Erro ao carregar papéis",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [clinicId, open]);

  useEffect(() => {
    void loadRolesData();
  }, [loadRolesData]);

  // Lista ordenada de papéis para navegação
  const sortedOperationalRoleDefinitions = useMemo(() => {
    return [...operationalRoleDefinitions].sort((a, b) => {
      const aIndex = OPERATIONAL_ROLE_MANAGEMENT_ORDER.indexOf(a.role_key as SubaccountOperationalRole | "owner");
      const bIndex = OPERATIONAL_ROLE_MANAGEMENT_ORDER.indexOf(b.role_key as SubaccountOperationalRole | "owner");
      if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
      if (aIndex >= 0) return -1;
      if (bIndex >= 0) return 1;
      return a.sort_order - b.sort_order;
    });
  }, [operationalRoleDefinitions]);

  const selectedRoleDefinition = useMemo(() => {
    return (
      sortedOperationalRoleDefinitions.find((role) => role.role_key === selectedOperationalRole) ??
      sortedOperationalRoleDefinitions[0] ??
      SYSTEM_OPERATIONAL_ROLE_DEFINITIONS[1]
    );
  }, [selectedOperationalRole, sortedOperationalRoleDefinitions]);

  const selectedRoleIndex = useMemo(() => {
    return sortedOperationalRoleDefinitions.findIndex((r) => r.role_key === selectedRoleDefinition.role_key);
  }, [sortedOperationalRoleDefinitions, selectedRoleDefinition]);

  // Calcula capacidades do papel selecionado
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
      subscriptionPlan: "clinic",
    };
    return buildCapabilitiesForContext(context, overridesMap);
  }, [selectedRoleDefinition, roleCapabilityOverrides]);

  // Permissões visíveis por categoria
  const visibleRolePermissionItems = useMemo(() => {
    if (rolePermissionCategory === "all") return ROLE_PERMISSION_ITEMS;
    return ROLE_PERMISSION_ITEMS.filter((item) => item.category === rolePermissionCategory);
  }, [rolePermissionCategory]);

  // Comutação de permissão modular
  const handleToggleRoleCapability = async (capability: AccessCapability, nextChecked: boolean) => {
    if (!clinicId) return;

    const relatedItem = ROLE_PERMISSION_ITEMS.find((item) =>
      item.actions.some((a) => a.capability === capability)
    );
    const viewAction = relatedItem?.actions.find((a) => a.kind === "view");

    const updates: Array<{ capability: AccessCapability; enabled: boolean }> = [
      { capability, enabled: nextChecked },
    ];

    // Ao ativar uma ação como editar/excluir, garante que o 'ver' esteja ativo
    if (nextChecked && viewAction && viewAction.capability !== capability) {
      if (!selectedRoleCapabilities[viewAction.capability]) {
        updates.push({ capability: viewAction.capability, enabled: true });
      }
    } else if (!nextChecked && viewAction && viewAction.capability === capability) {
      // Ao desativar o 'ver', desativa ações dependentes deste mesmo item
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
      toast({
        title: "Erro ao salvar permissão",
        description: error.message,
        variant: "destructive",
      });
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
    onRolesUpdated?.();
  };

  // Criação de novo papel personalizado para a clínica
  const handleCreateOperationalRole = async () => {
    if (!clinicId) return;
    const label = window.prompt("Nome do novo papel operacional:", "Novo Papel");
    if (!label || !label.trim()) return;

    setSavingRoleDefinition(true);
    const trimmedLabel = label.trim();
    const baseSlug = trimmedLabel
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 30);
    const roleKey = `role_${baseSlug || "custom"}_${Date.now().toString().slice(-4)}`;

    try {
      const newRole: Omit<ClinicOperationalRoleDefinition, "id" | "created_at" | "updated_at"> = {
        clinic_id: clinicId,
        role_key: roleKey,
        label: trimmedLabel,
        description: `Papel personalizado criado via Backoffice para ${clinicName || "a clínica"}.`,
        base_operational_role: "professional",
        sort_order: (sortedOperationalRoleDefinitions.length + 1) * 10,
        is_system: false,
      };

      const { data, error } = await supabase
        .from("clinic_operational_roles")
        .insert(newRole)
        .select()
        .single();

      if (error) throw error;

      setOperationalRoleDefinitions((curr) => [...curr, data as ClinicOperationalRoleDefinition]);
      setSelectedOperationalRole(roleKey);
      toast({ title: "Papel operacional criado", description: `O papel "${trimmedLabel}" foi criado.` });
      onRolesUpdated?.();
    } catch (err) {
      toast({
        title: "Erro ao criar papel",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setSavingRoleDefinition(false);
    }
  };

  // Salvar novo nome/label para o papel
  const handleSaveRoleLabel = async (newLabel: string) => {
    if (!clinicId || !selectedRoleDefinition) return;
    if (selectedRoleDefinition.role_key === "owner") {
      toast({ title: "Ação não permitida", description: "O nome do papel de Proprietário não pode ser alterado.", variant: "destructive" });
      return;
    }

    setSavingRoleDefinition(true);
    try {
      const { error } = await supabase
        .from("clinic_operational_roles")
        .upsert(
          {
            clinic_id: clinicId,
            role_key: selectedRoleDefinition.role_key,
            label: newLabel.trim(),
            description: selectedRoleDefinition.description,
            base_operational_role: selectedRoleDefinition.base_operational_role,
            sort_order: selectedRoleDefinition.sort_order,
            is_system: selectedRoleDefinition.is_system,
          },
          { onConflict: "clinic_id,role_key" }
        );

      if (error) throw error;

      setOperationalRoleDefinitions((curr) =>
        curr.map((r) => (r.role_key === selectedRoleDefinition.role_key ? { ...r, label: newLabel.trim() } : r))
      );
      toast({ title: "Rótulo atualizado" });
      onRolesUpdated?.();
    } catch (err) {
      toast({
        title: "Erro ao atualizar rótulo",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setSavingRoleDefinition(false);
    }
  };

  // Reordenação de hierarquia
  const handleMoveRole = async (direction: "up" | "down") => {
    if (selectedRoleIndex <= 0 && direction === "up") return;
    if (selectedRoleIndex >= sortedOperationalRoleDefinitions.length - 1 && direction === "down") return;

    const targetIndex = direction === "up" ? selectedRoleIndex - 1 : selectedRoleIndex + 1;
    const targetRole = sortedOperationalRoleDefinitions[targetIndex];
    if (!targetRole || targetRole.role_key === "owner" || selectedRoleDefinition.role_key === "owner") return;

    const currentOrder = selectedRoleDefinition.sort_order;
    const targetOrder = targetRole.sort_order;

    setSavingRoleDefinition(true);
    try {
      await Promise.all([
        supabase.from("clinic_operational_roles").upsert(
          {
            clinic_id: clinicId,
            role_key: selectedRoleDefinition.role_key,
            label: selectedRoleDefinition.label,
            base_operational_role: selectedRoleDefinition.base_operational_role,
            sort_order: targetOrder,
            is_system: selectedRoleDefinition.is_system,
          },
          { onConflict: "clinic_id,role_key" }
        ),
        supabase.from("clinic_operational_roles").upsert(
          {
            clinic_id: clinicId,
            role_key: targetRole.role_key,
            label: targetRole.label,
            base_operational_role: targetRole.base_operational_role,
            sort_order: currentOrder,
            is_system: targetRole.is_system,
          },
          { onConflict: "clinic_id,role_key" }
        ),
      ]);

      setOperationalRoleDefinitions((curr) =>
        curr.map((r) => {
          if (r.role_key === selectedRoleDefinition.role_key) return { ...r, sort_order: targetOrder };
          if (r.role_key === targetRole.role_key) return { ...r, sort_order: currentOrder };
          return r;
        })
      );
      onRolesUpdated?.();
    } catch (err) {
      toast({ title: "Erro ao reordenar", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setSavingRoleDefinition(false);
    }
  };

  // Exclusão de papel customizado
  const handleDeleteRole = async () => {
    if (!selectedRoleDefinition || selectedRoleDefinition.is_system || selectedRoleDefinition.role_key === "owner") {
      toast({ title: "Não permitido", description: "Papéis nativos do sistema não podem ser excluídos.", variant: "destructive" });
      return;
    }

    const count = roleUsageCounts[selectedRoleDefinition.role_key] || 0;
    if (count > 0) {
      toast({
        title: "Papel em uso",
        description: `Existem ${count} colaborador(es) com este papel. Mude-os de cargo antes de excluir.`,
        variant: "destructive",
      });
      return;
    }

    if (!window.confirm(`Tem certeza que deseja excluir o papel "${selectedRoleDefinition.label}"?`)) return;

    setSavingRoleDefinition(true);
    try {
      await supabase
        .from("clinic_operational_roles")
        .delete()
        .eq("clinic_id", clinicId)
        .eq("role_key", selectedRoleDefinition.role_key);

      setOperationalRoleDefinitions((curr) => curr.filter((r) => r.role_key !== selectedRoleDefinition.role_key));
      setSelectedOperationalRole("professional");
      toast({ title: "Papel excluído com sucesso" });
      onRolesUpdated?.();
    } catch (err) {
      toast({ title: "Erro ao excluir papel", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setSavingRoleDefinition(false);
    }
  };

  return (
    <RolesManagementModal
      open={open}
      onOpenChange={onOpenChange}
      operationalRoleDefinitions={sortedOperationalRoleDefinitions}
      selectedOperationalRole={selectedOperationalRole}
      onSelectOperationalRole={setSelectedOperationalRole}
      roleUsageCounts={roleUsageCounts}
      rolePermissionCategory={rolePermissionCategory}
      onSelectPermissionCategory={setRolePermissionCategory}
      categories={ROLE_PERMISSION_CATEGORIES}
      categoryCounts={ROLE_PERMISSION_CATEGORY_COUNTS}
      visibleRolePermissionItems={visibleRolePermissionItems}
      selectedRoleCapabilities={selectedRoleCapabilities}
      onToggleRoleCapability={handleToggleRoleCapability}
      canEditSelectedRole={selectedRoleDefinition.role_key !== "owner"}
      canMoveSelectedRole={selectedRoleDefinition.role_key !== "owner"}
      canDeleteSelectedRole={!selectedRoleDefinition.is_system && selectedRoleDefinition.role_key !== "owner"}
      hasRolesManagePermission={true}
      savingRoleDefinition={savingRoleDefinition || loading}
      selectedRoleIndex={selectedRoleIndex}
      onCreateOperationalRole={handleCreateOperationalRole}
      onSaveRoleLabel={handleSaveRoleLabel}
      onMoveRole={handleMoveRole}
      onDeleteRole={handleDeleteRole}
    />
  );
};
