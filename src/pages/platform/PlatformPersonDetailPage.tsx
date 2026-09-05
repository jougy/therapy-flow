import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Clock3,
  Copy,
  Loader2,
  Mail,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformInfoGrid } from "@/components/platform/PlatformInfoGrid";
import { PlatformAccountOperations } from "@/components/platform/PlatformAccountOperations";
import { PlatformUserGovernancePanel } from "@/components/PlatformUserGovernancePanel";
import { PlatformUserStatistics } from "@/components/PlatformUserStatistics";
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
                        className="w-full rounded-lg border p-3 space-y-2 bg-card transition-colors hover:border-primary/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <button
                              type="button"
                              className="text-left font-medium hover:underline text-foreground"
                              onClick={() => openClinicDetail(membership.clinic_route_key)}
                              disabled={!membership.clinic_route_key}
                            >
                              {String(membership.clinic_name ?? "Clínica")}
                            </button>
                            <p className="text-xs text-muted-foreground">
                              {String(membership.account_role ?? "membro")} • Status: {String(membership.membership_status ?? "ativo")}
                            </p>
                          </div>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                            isOwner
                              ? "bg-purple-500/10 text-purple-700 border-purple-300 dark:text-purple-300"
                              : "bg-primary/10 text-primary border-primary/20"
                          }`}>
                            {String(membership.operational_role ?? "-")}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t">
                          {membership.clinic_route_key && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-2"
                              onClick={() => openClinicDetail(membership.clinic_route_key)}
                            >
                              Abrir clínica
                            </Button>
                          )}
                          {!isOwner && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2 text-destructive hover:bg-destructive/10 border-destructive/30"
                              disabled={actionLoading}
                              onClick={async () => {
                                const clinicName = String(membership.clinic_name ?? "esta clínica");
                                const reasonInput = window.prompt(
                                  `Confirma a desvinculação de ${title} de ${clinicName}? Informe o motivo auditável (mínimo 8 caracteres):`
                                );
                                if (!reasonInput || reasonInput.trim().length < 8) {
                                  if (reasonInput !== null) {
                                    toast({
                                      title: "Motivo obrigatório",
                                      description: "A justificativa auditável precisa ter no mínimo 8 caracteres.",
                                      variant: "destructive",
                                    });
                                  }
                                  return;
                                }
                                setActionLoading(true);
                                try {
                                  await callPlatformAccountAdmin(
                                    "remove_user_from_clinic",
                                    {
                                      clinicId: membership.clinic_id,
                                      identifier: itemId,
                                    },
                                    reasonInput.trim()
                                  );
                                  toast({
                                    title: "Vínculo removido",
                                    description: `O usuário foi desvinculado de ${clinicName}.`,
                                  });
                                  setReloadKey((curr) => curr + 1);
                                } catch (err) {
                                  toast({
                                    title: "Erro ao desvincular",
                                    description: getErrorMessage(err),
                                    variant: "destructive",
                                  });
                                } finally {
                                  setActionLoading(false);
                                }
                              }}
                            >
                              Desvincular
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
    </div>
  );
};
