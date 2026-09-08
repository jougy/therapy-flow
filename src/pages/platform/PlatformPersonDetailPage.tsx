import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Clock3,
  Copy,
  Loader2,
  Mail,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PlatformInfoGrid } from "@/components/platform/PlatformInfoGrid";
import { PlatformAccountOperations } from "@/components/platform/PlatformAccountOperations";
import { PlatformRolesManagementModal } from "@/components/platform/PlatformRolesManagementModal";
import { PlatformRoleModularSummary } from "@/components/platform/PlatformRoleModularSummary";
import { PlatformUserGovernancePanel } from "@/components/PlatformUserGovernancePanel";
import { PlatformUserStatistics } from "@/components/PlatformUserStatistics";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { buildPublicAppUrl } from "@/lib/public-app-url";
import {
  OPERATIONAL_ROLE_MANAGEMENT_ORDER,
  SYSTEM_OPERATIONAL_ROLE_DEFINITIONS,
  type ClinicOperationalRoleDefinition,
  type RoleCapabilityRow,
  type SubaccountOperationalRole,
} from "@/pages/configuracoes/sections/team/types";
import type { AccountOperation, PersonDetail } from "@/components/platform/types";
import {
  callPlatformAccountAdmin,
  callRpc,
  getErrorMessage,
  itemLabels,
  PLATFORM_CLINIC_DETAIL_ROUTE,
  storePlatformClinicKey,
} from "@/components/platform/platform-api";

const getMembershipOperationScope = (memberships: Array<Record<string, unknown>>, isPending = false): AccountOperation[] => {
  if (isPending) {
    return ["resend_invitation", "confirm_user_email_manually", "delete_user_attempt", "assign_user_to_clinic", "update_subaccount_access"];
  }
  const firstMembership = memberships[0];
  if (firstMembership?.account_role === "account_owner" || firstMembership?.operational_role === "owner") {
    return ["update_owner_access", "assign_user_to_clinic", "confirm_user_email_manually"];
  }
  return [
    "update_membership_role",
    "assign_user_to_clinic",
    "remove_user_from_clinic",
    "update_subaccount_access",
    "resend_invitation",
    "confirm_user_email_manually",
    "delete_user_attempt",
    "delete_subaccount",
  ];
};

export const PlatformPersonDetailPage = ({ itemType, itemId }: { itemType: "account" | "patient"; itemId: string }) => {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  // Estados para Edição de Relação (Lápis)
  const [editMembership, setEditMembership] = useState<Record<string, unknown> | null>(null);
  const [editRole, setEditRole] = useState<string>("professional");
  const [editStatus, setEditStatus] = useState<string>("active");
  const [editReason, setEditReason] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Estados para Desvinculação (Lixeira)
  const [deleteMembership, setDeleteMembership] = useState<Record<string, unknown> | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>("");
  const [savingDelete, setSavingDelete] = useState<boolean>(false);

  // Estados para Adição de Nova Clínica (+)
  const [addClinicModalOpen, setAddClinicModalOpen] = useState<boolean>(false);
  const [availableClinics, setAvailableClinics] = useState<Array<{ clinic_id: string; clinic_name: string; clinic_cnpj?: string }>>([]);
  const [loadingClinics, setLoadingClinics] = useState<boolean>(false);
  const [newClinicId, setNewClinicId] = useState<string>("");
  const [newRole, setNewRole] = useState<string>("professional");
  const [newStatus, setNewStatus] = useState<string>("active");
  const [newReason, setNewReason] = useState<string>("");
  const [savingAdd, setSavingAdd] = useState<boolean>(false);

  // Estados para Modularização de Papéis da Clínica
  const [clinicRoles, setClinicRoles] = useState<ClinicOperationalRoleDefinition[]>(SYSTEM_OPERATIONAL_ROLE_DEFINITIONS);
  const [clinicRoleCapabilities, setClinicRoleCapabilities] = useState<RoleCapabilityRow[]>([]);
  const [loadingRoles, setLoadingRoles] = useState<boolean>(false);
  const [manageRolesClinicId, setManageRolesClinicId] = useState<string | null>(null);
  const [manageRolesClinicName, setManageRolesClinicName] = useState<string | null>(null);
  const [manageRolesInitialRole, setManageRolesInitialRole] = useState<string>("admin");

  const fetchClinicRolesAndCapabilities = useCallback(async (targetClinicId: string) => {
    if (!targetClinicId) return;
    setLoadingRoles(true);
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

      // Fallback
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
    } catch (err) {
      console.error("Erro ao carregar papéis da clínica:", err);
      setClinicRoles(SYSTEM_OPERATIONAL_ROLE_DEFINITIONS);
      setClinicRoleCapabilities([]);
    } finally {
      setLoadingRoles(false);
    }
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = window.setInterval(() => {
      setResendCooldown((curr) => (curr > 0 ? curr - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [resendCooldown]);

  const openClinicDetail = useCallback((clinicRouteKey: unknown) => {
    if (typeof clinicRouteKey !== "string" || !clinicRouteKey.trim()) {
      toast({
        title: "Rota mascarada indisponível",
        description: "Não foi possível abrir esta clínica pelo painel master.",
        variant: "destructive",
      });
      return;
    }

    storePlatformClinicKey(clinicRouteKey);
    navigate(PLATFORM_CLINIC_DETAIL_ROUTE, { state: { clinicKey: clinicRouteKey } });
  }, [navigate]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await callRpc("get_platform_person_detail", {
          _item_id: itemId,
          _item_type: itemType,
        });
        if (error) throw error;
        setDetail((data ?? null) as PersonDetail | null);
      } catch (error) {
        toast({
          title: "Detalhe indisponível",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [itemId, itemType, reloadKey]);

  const entity = itemType === "account" ? detail?.profile : detail?.patient;
  const title = String(entity?.full_name ?? entity?.name ?? itemLabels[itemType]);
  const memberships = detail?.memberships ?? [];
  const isPending = Boolean(detail?.is_pending_registration);
  const invitationId = String(detail?.invitation?.id ?? itemId);
  const accountEmail = String(entity?.email ?? "");

  const handleResendPending = async () => {
    if (resendCooldown > 0 || actionLoading) return;
    setActionLoading(true);
    try {
      await callPlatformAccountAdmin(
        "resend_invitation",
        { identifier: invitationId || accountEmail, invitationId },
        "Reenvio de convite / ativação via painel master"
      );
      setResendCooldown(30);
      toast({
        title: "Convite / Ativação reenviado!",
        description: `Novo e-mail disparado para ${accountEmail}. Cooldown de 30 segundos iniciado.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao reenviar convite",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyLink = async () => {
    const inviteUrl = buildPublicAppUrl(`/convite?email=${encodeURIComponent(accountEmail)}`);
    await navigator.clipboard.writeText(inviteUrl);
    toast({
      title: "Link copiado",
      description: "Link de acesso copiado para a área de transferência.",
    });
  };

  const handleManualEmailConfirm = async () => {
    if (!window.confirm(`Confirma a validação manual do e-mail para ${accountEmail}? Isso permitirá que o usuário faça login imediatamente.`)) {
      return;
    }
    setActionLoading(true);
    try {
      await callPlatformAccountAdmin(
        "confirm_user_email_manually",
        { identifier: accountEmail || itemId },
        "Confirmação manual de e-mail autorizada pelo platform_owner"
      );
      toast({
        title: "E-mail confirmado com sucesso!",
        description: `O e-mail ${accountEmail} foi marcado como verificado no sistema de autenticação.`,
      });
      setReloadKey((curr) => curr + 1);
    } catch (error) {
      toast({
        title: "Falha ao confirmar e-mail",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAttempt = async () => {
    if (!window.confirm(`Tem certeza que deseja EXCLUIR a tentativa de cadastro de ${accountEmail}? Todos os registros de convite e autenticação serão cancelados para permitir uma nova tentativa do zero.`)) {
      return;
    }
    setActionLoading(true);
    try {
      await callPlatformAccountAdmin(
        "delete_user_attempt",
        { identifier: accountEmail || itemId },
        "Exclusão definitiva de tentativa de cadastro para reset via painel master"
      );
      toast({
        title: "Tentativa de cadastro removida",
        description: "Os dados temporários foram limpos. O usuário pode ser convidado novamente.",
      });
      navigate("/platform/diretorio");
    } catch (error) {
      toast({
        title: "Erro ao excluir tentativa",
        description: getErrorMessage(error),
        variant: "destructive",
      });
      setActionLoading(false);
    }
  };

  const handleOpenEditMembership = (membership: Record<string, unknown>) => {
    setEditMembership(membership);
    const role = String(membership.operational_role || "professional");
    setEditRole(role);
    const currentStatus = String(membership.membership_status || "active");
    setEditStatus(currentStatus === "blocked" ? "banned" : currentStatus === "paused" ? "temporarily_paused" : "active");
    setEditReason("");
    const clinicId = String(membership.clinic_id || "");
    if (clinicId) {
      void fetchClinicRolesAndCapabilities(clinicId);
    }
  };

  const handleSaveEditMembership = async () => {
    if (!editMembership || editReason.trim().length < 8) return;
    setSavingEdit(true);
    const clinicId = String(editMembership.clinic_id);
    const isOwner = editMembership.account_role === "account_owner" || editMembership.operational_role === "owner";
    try {
      if (isOwner) {
        await callPlatformAccountAdmin(
          "update_owner_access",
          {
            clinicId,
            identifier: itemId,
            status: editStatus,
          },
          editReason.trim()
        );
      } else {
        await callPlatformAccountAdmin(
          "update_membership_role",
          {
            clinicId,
            identifier: itemId,
            role: editRole,
            status: editStatus,
          },
          editReason.trim()
        );
      }
      toast({
        title: "Relação atualizada com sucesso",
        description: `O vínculo de ${title} com a clínica foi atualizado.`,
      });
      setEditMembership(null);
      setReloadKey((curr) => curr + 1);
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

  const handleOpenDeleteMembership = (membership: Record<string, unknown>) => {
    setDeleteMembership(membership);
    setDeleteReason("");
  };

  const handleConfirmDeleteMembership = async () => {
    if (!deleteMembership || deleteReason.trim().length < 8) return;
    setSavingDelete(true);
    const clinicId = String(deleteMembership.clinic_id);
    const clinicName = String(deleteMembership.clinic_name ?? "a clínica");
    try {
      await callPlatformAccountAdmin(
        "remove_user_from_clinic",
        {
          clinicId,
          identifier: itemId,
        },
        deleteReason.trim()
      );
      toast({
        title: "Vínculo removido",
        description: `${title} foi desvinculado de ${clinicName}.`,
      });
      setDeleteMembership(null);
      setReloadKey((curr) => curr + 1);
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
    } catch (err) {
      console.error("Erro ao carregar lista de clínicas:", err);
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
        {
          clinicId: newClinicId,
          identifier: itemId,
          role: newRole,
          status: newStatus,
        },
        newReason.trim()
      );
      toast({
        title: "Usuário vinculado à clínica",
        description: `${title} foi adicionado à clínica selecionada com sucesso.`,
      });
      setAddClinicModalOpen(false);
      setReloadKey((curr) => curr + 1);
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

  return (
    <div className="space-y-4">
      <Button variant="ghost" className="w-fit" onClick={() => navigate("/platform/diretorio")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar ao diretório
      </Button>

      {isPending && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-950 dark:text-amber-200 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold text-sm sm:text-base">Conta com Pendência de Cadastro</p>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  {String(entity?.status ?? "Aguardando confirmação de e-mail ou conclusão do cadastro.")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-amber-400 bg-background text-foreground text-xs"
                disabled={resendCooldown > 0 || actionLoading}
                onClick={() => void handleResendPending()}
              >
                {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                {resendCooldown > 0 ? `Reenviar (${resendCooldown}s)` : "Reenviar convite / ativação"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-amber-400 bg-background text-foreground text-xs"
                onClick={() => void handleCopyLink()}
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar link
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-background hover:bg-emerald-50 dark:hover:bg-emerald-950 text-xs"
                disabled={actionLoading}
                onClick={() => void handleManualEmailConfirm()}
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Confirmar e-mail manualmente
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-destructive text-destructive hover:bg-destructive/10 text-xs"
                disabled={actionLoading}
                onClick={() => void handleDeleteAttempt()}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir tentativa / resetar
              </Button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardHeader><CardTitle>Dados principais</CardTitle></CardHeader>
            <CardContent>
              <PlatformInfoGrid
                items={[
                  ["Nome", title],
                  ["E-mail", String(entity?.email ?? "-")],
                  ["Telefone", String(entity?.phone ?? "-")],
                  ["CPF", String(entity?.cpf ?? "-")],
                  ["RG", String(entity?.rg ?? "-")],
                  ["Status", String(entity?.status ?? "-")],
                  ["Data de registro", entity?.created_at ? new Date(entity.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"],
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Contexto</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {itemType === "patient" ? (
                <>
                  <PlatformInfoGrid
                    items={[
                      ["Clínica", String(detail?.clinic?.name ?? "-")],
                      ["Atendimentos", String(detail?.counts?.sessions ?? 0)],
                      ["Concluídos", String(detail?.counts?.completed ?? 0)],
                      ["Rascunhos", String(detail?.counts?.drafts ?? 0)],
                    ]}
                  />
                  {detail?.clinic?.route_key && (
                    <Button className="w-full" onClick={() => openClinicDetail(detail.clinic?.route_key)}>
                      Abrir clínica
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{memberships.length} vínculo(s) com clínica.</p>
                  </div>
                  {memberships.map((membership) => {
                    const isOwner = membership.account_role === "account_owner" || membership.operational_role === "owner";
                    return (
                      <div
                        key={String(membership.membership_id)}
                        className="w-full rounded-lg border p-3 space-y-2.5 bg-card transition-colors hover:border-primary/50 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              className="text-left font-medium hover:underline text-foreground truncate block max-w-full"
                              onClick={() => openClinicDetail(membership.clinic_route_key)}
                              disabled={!membership.clinic_route_key}
                            >
                              {String(membership.clinic_name ?? "Clínica")}
                            </button>
                            <p className="text-xs text-muted-foreground truncate">
                              {String(membership.account_role ?? "membro")} • Status: {String(membership.membership_status ?? "ativo")}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                              isOwner
                                ? "bg-purple-500/10 text-purple-700 border-purple-300 dark:text-purple-300"
                                : "bg-primary/10 text-primary border-primary/20"
                            }`}>
                              {String(membership.operational_role ?? "-")}
                            </span>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent"
                              title="Alterar relação com a clínica"
                              onClick={() => handleOpenEditMembership(membership as Record<string, unknown>)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="sr-only">Alterar relação</span>
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title={isOwner ? "Owner não pode ser desvinculado diretamente" : "Desvincular usuário desta clínica"}
                              onClick={() => handleOpenDeleteMembership(membership as Record<string, unknown>)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="sr-only">Desvincular</span>
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t">
                          {membership.clinic_route_key ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-2 text-muted-foreground hover:text-primary"
                              onClick={() => openClinicDetail(membership.clinic_route_key)}
                            >
                              Abrir clínica
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem rota mascarada</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2 border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 text-primary text-sm font-medium py-2 shadow-sm"
                    onClick={() => void handleOpenAddClinic()}
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar a uma clínica
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
          <div className="lg:col-span-2">
            <PlatformAccountOperations
              allowedOperations={itemType === "account" ? getMembershipOperationScope(memberships, isPending) : ["update_patient", "delete_patient"]}
              clinicId={String(detail?.clinic?.id ?? entity?.clinic_id ?? memberships[0]?.clinic_id ?? "") || undefined}
              clinicAccessStatus={String(detail?.clinic?.access_status ?? "active")}
              concurrentAccessLimit={String(detail?.clinic?.concurrent_access_limit ?? detail?.clinic?.subaccount_limit ?? 4)}
              compact
              defaultIdentifier={itemType === "account" ? String(entity?.email ?? entity?.id ?? "") : undefined}
              defaultPatientId={itemType === "patient" ? itemId : undefined}
              onDone={() => setReloadKey((value) => value + 1)}
              subaccountLimit={String(detail?.clinic?.subaccount_limit ?? 4)}
              title={itemType === "account" ? "Operações master desta conta" : "Operações master deste paciente"}
            />
          </div>
          {itemType === "account" && (
            <>
              <div className="lg:col-span-2 mt-2">
                <PlatformUserGovernancePanel userId={itemId} userName={title} />
              </div>
              <div className="lg:col-span-2 mt-2">
                <PlatformUserStatistics userId={itemId} userName={title} />
              </div>
            </>
          )}
        </div>
      )}

      {/* Diálogo de Edição de Relação com Clínica (Lápis) */}
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
            const isOwner = editMembership?.account_role === "account_owner" || editMembership?.operational_role === "owner";
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

                {/* Modularização do Papel Selecionado */}
                <PlatformRoleModularSummary
                  roleDefinition={clinicRoles.find((r) => r.role_key === (isOwner ? "owner" : editRole))}
                  roleCapabilitiesOverrides={clinicRoleCapabilities}
                  onOpenManageRoles={() => {
                    setManageRolesClinicId(String(editMembership.clinic_id));
                    setManageRolesClinicName(String(editMembership.clinic_name ?? "Clínica"));
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditMembership(null)}
              disabled={savingEdit}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveEditMembership}
              disabled={savingEdit || editReason.trim().length < 8}
            >
              {savingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Exclusão/Desvinculação de Clínica (Lixeira) */}
      <Dialog open={Boolean(deleteMembership)} onOpenChange={(open) => !open && setDeleteMembership(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Desvincular Usuário da Clínica</DialogTitle>
            <DialogDescription>
              Remover o vínculo de{" "}
              <span className="font-semibold text-foreground">{title}</span> em relação a{" "}
              <span className="font-semibold text-foreground">
                {String(deleteMembership?.clinic_name ?? "Clínica")}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          {Boolean(deleteMembership) && (() => {
            const isOwner = deleteMembership?.account_role === "account_owner" || deleteMembership?.operational_role === "owner";
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteMembership(null)}
              disabled={savingDelete}
            >
              Cancelar
            </Button>
            {!(deleteMembership?.account_role === "account_owner" || deleteMembership?.operational_role === "owner") && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmDeleteMembership}
                disabled={savingDelete || deleteReason.trim().length < 8}
              >
                {savingDelete && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar desvinculação
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Adição de Usuário a Nova Clínica (+) */}
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
                        <SelectItem
                          key={c.clinic_id}
                          value={c.clinic_id}
                          disabled={alreadyMember}
                        >
                          {c.clinic_name} {c.clinic_cnpj ? `(${c.clinic_cnpj})` : ""} {alreadyMember ? "— (Já vinculado)" : ""}
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
                  setManageRolesClinicName(availableClinics.find((c) => c.clinic_id === newClinicId)?.clinic_name ?? "Clínica");
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddClinicModalOpen(false)}
              disabled={savingAdd}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveAddClinic}
              disabled={!newClinicId || savingAdd || newReason.trim().length < 8}
            >
              {savingAdd && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Vincular à clínica
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Completo de Gestão de Papéis Operacionais e Modularizações da Clínica */}
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
    </div>
  );
};
