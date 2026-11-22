import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  Clock3,
  Copy,
  KeyRound,
  Loader2,
  Mail,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiquidTabs, type LiquidTabItem } from "@/components/ui/liquid-tabs";
import { PlatformMobileDock, type BackofficeDockTabItem } from "@/components/PlatformMobileDock";
import { PlatformAccountOperations } from "@/components/platform/PlatformAccountOperations";
import { PlatformUserGovernancePanel } from "@/components/PlatformUserGovernancePanel";
import { PlatformUserStatistics } from "@/components/PlatformUserStatistics";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { buildPublicAppUrl } from "@/lib/public-app-url";
import type { AccountOperation, PersonDetail } from "@/components/platform/types";
import {
  callPlatformAccountAdmin,
  callRpc,
  getErrorMessage,
  itemLabels,
  PLATFORM_CLINIC_DETAIL_ROUTE,
  storePlatformClinicKey,
} from "@/components/platform/platform-api";
import {
  PersonBackofficeAccessTab,
  PersonDataContextTab,
  PersonMembershipDialogs,
  usePersonMemberships,
} from "./person-detail";

const getMembershipOperationScope = (
  _memberships: Array<Record<string, unknown>>,
  isPending = false
): AccountOperation[] => {
  if (isPending) {
    return [
      "resend_invitation",
      "confirm_user_email_manually",
      "delete_user_attempt",
      "assign_user_to_clinic",
    ];
  }
  return [
    "reset_user_password",
    "change_user_email",
    "update_membership_role",
    "assign_user_to_clinic",
    "remove_user_from_clinic",
    "confirm_user_email_manually",
    "resend_invitation",
    "delete_user_attempt",
  ];
};

type PersonDetailTabId = "dados" | "operacoes" | "governanca" | "telemetria" | "backoffice";

export const PlatformPersonDetailPage = ({
  itemType,
  itemId,
}: {
  itemType: "account" | "patient";
  itemId: string;
}) => {
  const navigate = useNavigate();
  const { isPlatformOwner } = useAuth();
  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<PersonDetailTabId>("dados");

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = window.setInterval(() => {
      setResendCooldown((curr) => (curr > 0 ? curr - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [resendCooldown]);

  const openClinicDetail = useCallback(
    (clinicRouteKey: unknown) => {
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
    },
    [navigate]
  );

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
  const resolvedUserId = String(entity?.id ?? itemId);

  const isEmailConfirmed = Boolean(
    entity?.email_confirmed === true ||
      entity?.email_confirmed_at ||
      (detail?.invitation as Record<string, unknown> | undefined)?.account_state ===
        "registered_confirmed_pending_acceptance"
  );
  const hasUnconfirmedEmail =
    itemType === "account" &&
    Boolean(accountEmail) &&
    (!isEmailConfirmed ||
      String(entity?.status ?? "").toLowerCase().includes("não verificado") ||
      String(entity?.status ?? "").toLowerCase().includes("unconfirmed") ||
      (detail?.invitation as Record<string, unknown> | undefined)?.account_state ===
        "registered_unconfirmed");

  const membershipState = usePersonMemberships(itemId, title, () =>
    setReloadKey((curr) => curr + 1)
  );

  const tabsMeta = useMemo(() => {
    const items: Array<{ id: PersonDetailTabId; label: string; shortLabel: string; icon: typeof User }> = [
      { id: "dados", label: "Dados & Contexto", shortLabel: "Dados", icon: User },
      { id: "operacoes", label: "Operações Master", shortLabel: "Operações", icon: SlidersHorizontal },
    ];

    if (itemType === "account") {
      items.push(
        { id: "governanca", label: "Governança & Punições", shortLabel: "Governança", icon: ShieldAlert },
        { id: "telemetria", label: "Telemetria", shortLabel: "Telemetria", icon: Activity }
      );
      if (isPlatformOwner) {
        items.push({
          id: "backoffice",
          label: "Acesso ao Backoffice",
          shortLabel: "Backoffice",
          icon: KeyRound,
        });
      }
    }
    return items;
  }, [isPlatformOwner, itemType]);

  useEffect(() => {
    if (!tabsMeta.some((tab) => tab.id === activeTab)) {
      setActiveTab("dados");
    }
  }, [activeTab, tabsMeta]);

  const liquidTabs: LiquidTabItem[] = useMemo(
    () => tabsMeta.map(({ id, label, icon }) => ({ id, label, icon })),
    [tabsMeta]
  );

  const mobileDockTabs: BackofficeDockTabItem[] = useMemo(
    () => tabsMeta.map(({ id, label, shortLabel, icon }) => ({ id, label, shortLabel, icon })),
    [tabsMeta]
  );

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
    if (
      !window.confirm(
        `Confirma a validação manual do e-mail para ${accountEmail}? Isso permitirá que o usuário faça login imediatamente.`
      )
    ) {
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
    if (
      !window.confirm(
        `Tem certeza que deseja EXCLUIR a tentativa de cadastro de ${accountEmail}? Todos os registros de convite e autenticação serão cancelados para permitir uma nova tentativa do zero.`
      )
    ) {
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

  return (
    <div className="w-full max-w-full min-w-0 space-y-4 overflow-x-hidden pb-24 lg:pb-0">
      <Button variant="ghost" className="w-fit" onClick={() => navigate("/platform/diretorio")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar ao diretório
      </Button>

      {isPending && (
        <div className="w-full max-w-full min-w-0 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-950 dark:text-amber-200 shadow-sm space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Clock3 className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-sm sm:text-base">Conta com Pendência de Cadastro</p>
                <p className="text-xs text-amber-800 dark:text-amber-300 break-words">
                  {String(entity?.status ?? "Aguardando confirmação de e-mail ou conclusão do cadastro.")}
                </p>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-amber-400 bg-background text-foreground text-xs flex-1 sm:flex-initial"
                disabled={resendCooldown > 0 || actionLoading}
                onClick={() => void handleResendPending()}
              >
                {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                {resendCooldown > 0 ? `Reenviar (${resendCooldown}s)` : "Reenviar convite / ativação"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-amber-400 bg-background text-foreground text-xs flex-1 sm:flex-initial"
                onClick={() => void handleCopyLink()}
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar link
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-background hover:bg-emerald-50 dark:hover:bg-emerald-950 text-xs w-full sm:w-auto"
                disabled={actionLoading}
                onClick={() => void handleManualEmailConfirm()}
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                Confirmar e-mail manualmente
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-destructive text-destructive hover:bg-destructive/10 text-xs w-full sm:w-auto"
                disabled={actionLoading}
                onClick={() => void handleDeleteAttempt()}
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
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
        <div className="w-full max-w-full min-w-0 space-y-4">
          <LiquidTabs
            tabs={liquidTabs}
            activeTab={activeTab}
            onChange={(tabId) => setActiveTab(tabId as PersonDetailTabId)}
            className="hidden lg:inline-flex"
          />

          {activeTab === "dados" && (
            <PersonDataContextTab
              itemType={itemType}
              itemId={itemId}
              title={title}
              entity={entity}
              detail={detail}
              memberships={memberships}
              isEmailConfirmed={isEmailConfirmed}
              hasUnconfirmedEmail={hasUnconfirmedEmail}
              actionLoading={actionLoading}
              onManualEmailConfirm={() => void handleManualEmailConfirm()}
              onOpenClinicDetail={openClinicDetail}
              onOpenEditMembership={membershipState.handleOpenEditMembership}
              onOpenDeleteMembership={membershipState.handleOpenDeleteMembership}
              onOpenAddClinic={() => void membershipState.handleOpenAddClinic()}
              onAffiliateStatusChange={() => setReloadKey((value) => value + 1)}
            />
          )}

          {activeTab === "operacoes" && (
            <div className="w-full max-w-full min-w-0">
              <PlatformAccountOperations
                allowedOperations={
                  itemType === "account"
                    ? getMembershipOperationScope(memberships, isPending)
                    : ["update_patient", "delete_patient"]
                }
                clinicId={
                  String(detail?.clinic?.id ?? entity?.clinic_id ?? memberships[0]?.clinic_id ?? "") ||
                  undefined
                }
                clinicAccessStatus={String(detail?.clinic?.access_status ?? "active")}
                concurrentAccessLimit={String(
                  detail?.clinic?.concurrent_access_limit ?? detail?.clinic?.subaccount_limit ?? 4
                )}
                compact
                defaultIdentifier={
                  itemType === "account" ? String(entity?.email ?? entity?.id ?? "") : undefined
                }
                defaultPatientId={itemType === "patient" ? itemId : undefined}
                availableMemberships={
                  memberships as Array<{
                    clinic_id?: string;
                    clinic_name?: string;
                    operational_role?: string;
                    account_role?: string;
                  }>
                }
                onDone={() => setReloadKey((value) => value + 1)}
                subaccountLimit={String(detail?.clinic?.subaccount_limit ?? 4)}
                title={
                  itemType === "account"
                    ? "Operações master deste usuário"
                    : "Operações master deste paciente"
                }
              />
            </div>
          )}

          {itemType === "account" && activeTab === "governanca" && (
            <div className="w-full max-w-full min-w-0">
              <PlatformUserGovernancePanel userId={itemId} userName={title} />
            </div>
          )}

          {itemType === "account" && activeTab === "telemetria" && (
            <div className="w-full max-w-full min-w-0">
              <PlatformUserStatistics userId={itemId} userName={title} />
            </div>
          )}

          {itemType === "account" && isPlatformOwner && activeTab === "backoffice" && (
            <PersonBackofficeAccessTab
              userId={resolvedUserId}
              userName={title}
              userEmail={accountEmail || undefined}
            />
          )}

          <PlatformMobileDock
            activeTab={activeTab}
            onChange={(tabId) => setActiveTab(tabId as PersonDetailTabId)}
            tabs={mobileDockTabs}
          />
        </div>
      )}

      <PersonMembershipDialogs
        title={title}
        memberships={memberships}
        {...membershipState}
      />
    </div>
  );
};
