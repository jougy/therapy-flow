import { useCallback, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  OPERATIONAL_ROLE_MANAGEMENT_ORDER,
  SYSTEM_OPERATIONAL_ROLE_DEFINITIONS,
  type ClinicOperationalRoleDefinition,
  type RoleCapabilityRow,
  type SubaccountOperationalRole,
} from "@/pages/configuracoes/sections/team/types";
import { callPlatformAccountAdmin, callRpc, getErrorMessage } from "@/components/platform/platform-api";

export interface AvailablePlatformClinic {
  clinic_id: string;
  clinic_name: string;
  clinic_cnpj?: string;
}

export function usePersonMemberships(
  itemId: string,
  title: string,
  onReload: () => void
) {
  const [editMembership, setEditMembership] = useState<Record<string, unknown> | null>(null);
  const [editRole, setEditRole] = useState<string>("professional");
  const [editStatus, setEditStatus] = useState<string>("active");
  const [editReason, setEditReason] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  const [deleteMembership, setDeleteMembership] = useState<Record<string, unknown> | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>("");
  const [savingDelete, setSavingDelete] = useState<boolean>(false);

  const [addClinicModalOpen, setAddClinicModalOpen] = useState<boolean>(false);
  const [availableClinics, setAvailableClinics] = useState<AvailablePlatformClinic[]>([]);
  const [loadingClinics, setLoadingClinics] = useState<boolean>(false);
  const [newClinicId, setNewClinicId] = useState<string>("");
  const [newRole, setNewRole] = useState<string>("professional");
  const [newStatus, setNewStatus] = useState<string>("active");
  const [newReason, setNewReason] = useState<string>("");
  const [savingAdd, setSavingAdd] = useState<boolean>(false);

  const [clinicRoles, setClinicRoles] = useState<ClinicOperationalRoleDefinition[]>(SYSTEM_OPERATIONAL_ROLE_DEFINITIONS);
  const [clinicRoleCapabilities, setClinicRoleCapabilities] = useState<RoleCapabilityRow[]>([]);
  const [manageRolesClinicId, setManageRolesClinicId] = useState<string | null>(null);
  const [manageRolesClinicName, setManageRolesClinicName] = useState<string | null>(null);
  const [manageRolesInitialRole, setManageRolesInitialRole] = useState<string>("admin");

  const fetchClinicRolesAndCapabilities = useCallback(async (targetClinicId: string) => {
    if (!targetClinicId) return;
    try {
      const { data: rpcData, error: rpcError } = await callRpc("get_platform_clinic_roles_overview", {
        _clinic_id: targetClinicId,
      });

      if (!rpcError && rpcData && typeof rpcData === "object") {
        const payload = rpcData as {
          roles?: ClinicOperationalRoleDefinition[];
          capabilities?: RoleCapabilityRow[];
        };
        const loadedRoles = payload.roles ?? [];
        const loadedCaps = payload.capabilities ?? [];

        const mergedRoles: ClinicOperationalRoleDefinition[] = [
          ...SYSTEM_OPERATIONAL_ROLE_DEFINITIONS.map((role) => ({
            ...role,
            clinic_id: targetClinicId,
            ...(loadedRoles.find((r) => r.role_key === role.role_key) ?? {}),
            is_system: true,
          })),
          ...loadedRoles.filter(
            (r) => !OPERATIONAL_ROLE_MANAGEMENT_ORDER.includes(r.role_key as SubaccountOperationalRole | "owner")
          ),
        ];
        setClinicRoles(mergedRoles);
        setClinicRoleCapabilities(loadedCaps);
        return;
      }

      const [rolesRes, capsRes] = await Promise.all([
        supabase.from("clinic_operational_roles").select("*").eq("clinic_id", targetClinicId),
        supabase.from("clinic_operational_role_capabilities").select("*").eq("clinic_id", targetClinicId),
      ]);

      const loadedRoles = (rolesRes.data ?? []) as ClinicOperationalRoleDefinition[];
      const loadedCaps = (capsRes.data ?? []) as RoleCapabilityRow[];

      const mergedRoles: ClinicOperationalRoleDefinition[] = [
        ...SYSTEM_OPERATIONAL_ROLE_DEFINITIONS.map((role) => ({
          ...role,
          clinic_id: targetClinicId,
          ...(loadedRoles.find((r) => r.role_key === role.role_key) ?? {}),
          is_system: true,
        })),
        ...loadedRoles.filter(
          (r) => !OPERATIONAL_ROLE_MANAGEMENT_ORDER.includes(r.role_key as SubaccountOperationalRole | "owner")
        ),
      ];
      setClinicRoles(mergedRoles);
      setClinicRoleCapabilities(loadedCaps);
    } catch {
      setClinicRoles(SYSTEM_OPERATIONAL_ROLE_DEFINITIONS);
      setClinicRoleCapabilities([]);
    }
  }, []);

  const handleOpenEditMembership = useCallback((membership: Record<string, unknown>) => {
    setEditMembership(membership);
    setEditRole(String(membership.operational_role || "professional"));
    const currentStatus = String(membership.membership_status || "active");
    setEditStatus(currentStatus === "blocked" ? "banned" : currentStatus === "paused" ? "temporarily_paused" : "active");
    setEditReason("");
    const clinicId = String(membership.clinic_id || "");
    if (clinicId) {
      void fetchClinicRolesAndCapabilities(clinicId);
    }
  }, [fetchClinicRolesAndCapabilities]);

  const handleSaveEditMembership = async () => {
    if (!editMembership || editReason.trim().length < 8) return;
    setSavingEdit(true);
    const clinicId = String(editMembership.clinic_id);
    const isOwner = editMembership.account_role === "account_owner" || editMembership.operational_role === "owner";
    try {
      if (isOwner) {
        await callPlatformAccountAdmin(
          "update_owner_access",
          { clinicId, identifier: itemId, status: editStatus },
          editReason.trim()
        );
      } else {
        await callPlatformAccountAdmin(
          "update_membership_role",
          { clinicId, identifier: itemId, role: editRole, status: editStatus },
          editReason.trim()
        );
      }
      toast({
        title: "Relação atualizada com sucesso",
        description: `O vínculo de ${title} com a clínica foi atualizado.`,
      });
      setEditMembership(null);
      onReload();
    } catch (err) {
      toast({
        title: "Erro ao atualizar relação",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleOpenDeleteMembership = useCallback((membership: Record<string, unknown>) => {
    setDeleteMembership(membership);
    setDeleteReason("");
  }, []);

  const handleConfirmDeleteMembership = async () => {
    if (!deleteMembership || deleteReason.trim().length < 8) return;
    setSavingDelete(true);
    const clinicId = String(deleteMembership.clinic_id);
    const clinicName = String(deleteMembership.clinic_name ?? "a clínica");
    try {
      await callPlatformAccountAdmin(
        "remove_user_from_clinic",
        { clinicId, identifier: itemId },
        deleteReason.trim()
      );
      toast({
        title: "Vínculo removido",
        description: `${title} foi desvinculado de ${clinicName}.`,
      });
      setDeleteMembership(null);
      onReload();
    } catch (err) {
      toast({
        title: "Erro ao desvincular",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setSavingDelete(false);
    }
  };

  const handleOpenAddClinic = async () => {
    setAddClinicModalOpen(true);
    setNewClinicId("");
    setNewRole("professional");
    setNewStatus("active");
    setNewReason("");
    setClinicRoles(SYSTEM_OPERATIONAL_ROLE_DEFINITIONS);
    setClinicRoleCapabilities([]);
    setLoadingClinics(true);
    try {
      const { data, error } = await callRpc("list_platform_clinics");
      if (!error && Array.isArray(data) && data.length > 0) {
        setAvailableClinics(
          data.map((c: Record<string, unknown>) => ({
            clinic_id: String(c.clinic_id),
            clinic_name: String(c.clinic_name ?? "Clínica"),
            clinic_cnpj: String(c.clinic_cnpj ?? ""),
          }))
        );
      } else {
        const { data: fallbackClinics } = await supabase
          .from("clinics")
          .select("id, name, cnpj")
          .order("name");
        if (fallbackClinics) {
          setAvailableClinics(
            fallbackClinics.map((c) => ({
              clinic_id: String(c.id),
              clinic_name: String(c.name ?? "Clínica"),
              clinic_cnpj: String(c.cnpj ?? ""),
            }))
          );
        }
      }
    } catch {
      // Silencioso: lista permanece vazia
    } finally {
      setLoadingClinics(false);
    }
  };

  const handleSaveAddClinic = async () => {
    if (!newClinicId || newReason.trim().length < 8) return;
    setSavingAdd(true);
    try {
      await callPlatformAccountAdmin(
        "assign_user_to_clinic",
        { clinicId: newClinicId, identifier: itemId, role: newRole, status: newStatus },
        newReason.trim()
      );
      toast({
        title: "Usuário vinculado à clínica",
        description: `${title} foi adicionado à clínica selecionada com sucesso.`,
      });
      setAddClinicModalOpen(false);
      onReload();
    } catch (err) {
      toast({
        title: "Erro ao vincular à clínica",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setSavingAdd(false);
    }
  };

  return {
    editMembership,
    setEditMembership,
    editRole,
    setEditRole,
    editStatus,
    setEditStatus,
    editReason,
    setEditReason,
    savingEdit,
    deleteMembership,
    setDeleteMembership,
    deleteReason,
    setDeleteReason,
    savingDelete,
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
    clinicRoles,
    clinicRoleCapabilities,
    manageRolesClinicId,
    setManageRolesClinicId,
    manageRolesClinicName,
    setManageRolesClinicName,
    manageRolesInitialRole,
    setManageRolesInitialRole,
    fetchClinicRolesAndCapabilities,
    handleOpenEditMembership,
    handleSaveEditMembership,
    handleOpenDeleteMembership,
    handleConfirmDeleteMembership,
    handleOpenAddClinic,
    handleSaveAddClinic,
  };
}
