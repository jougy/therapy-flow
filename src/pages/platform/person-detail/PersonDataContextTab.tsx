import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformInfoGrid } from "@/components/platform/PlatformInfoGrid";
import { PlatformUserAffiliateCard } from "@/components/platform/person-detail/PlatformUserAffiliateCard";
import type { PersonDetail } from "@/components/platform/types";

interface PersonDataContextTabProps {
  itemType: "account" | "patient";
  itemId: string;
  title: string;
  entity: Record<string, unknown> | undefined;
  detail: PersonDetail | null;
  memberships: Array<Record<string, unknown>>;
  isEmailConfirmed: boolean;
  hasUnconfirmedEmail: boolean;
  actionLoading: boolean;
  onManualEmailConfirm: () => void;
  onOpenClinicDetail: (clinicRouteKey: unknown) => void;
  onOpenEditMembership: (membership: Record<string, unknown>) => void;
  onOpenDeleteMembership: (membership: Record<string, unknown>) => void;
  onOpenAddClinic: () => void;
  onAffiliateStatusChange: () => void;
}

export function PersonDataContextTab({
  itemType,
  itemId,
  title,
  entity,
  detail,
  memberships,
  isEmailConfirmed,
  hasUnconfirmedEmail,
  actionLoading,
  onManualEmailConfirm,
  onOpenClinicDetail,
  onOpenEditMembership,
  onOpenDeleteMembership,
  onOpenAddClinic,
  onAffiliateStatusChange,
}: PersonDataContextTabProps) {
  return (
    <div className="grid w-full max-w-full min-w-0 gap-4 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="w-full max-w-full min-w-0">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between space-y-0 pb-3">
          <CardTitle>Dados principais</CardTitle>
          {hasUnconfirmedEmail && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-background hover:bg-emerald-50 dark:hover:bg-emerald-950 text-xs shadow-sm w-full sm:w-auto"
              disabled={actionLoading}
              onClick={onManualEmailConfirm}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              Confirmar e-mail manualmente
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <PlatformInfoGrid
            items={[
              ["Nome", title],
              ["E-mail", String(entity?.email ?? "-")],
              ["Status do E-mail", isEmailConfirmed ? "Confirmado" : "Não confirmado / Pendente"],
              ["Telefone", String(entity?.phone ?? "-")],
              ["CPF", String(entity?.cpf ?? "-")],
              ["RG", String(entity?.rg ?? "-")],
              ["Status", String(entity?.status ?? "-")],
              [
                "Data de registro",
                entity?.created_at
                  ? new Date(String(entity.created_at)).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "-",
              ],
            ]}
          />
        </CardContent>
      </Card>

      <div className="space-y-4 w-full max-w-full min-w-0">
        <Card className="w-full max-w-full min-w-0">
          <CardHeader>
            <CardTitle>Contexto</CardTitle>
          </CardHeader>
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
                  <Button className="w-full" onClick={() => onOpenClinicDetail(detail.clinic?.route_key)}>
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
                  const isOwner =
                    membership.account_role === "account_owner" || membership.operational_role === "owner";
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
                            onClick={() => onOpenClinicDetail(membership.clinic_route_key)}
                            disabled={!membership.clinic_route_key}
                          >
                            {String(membership.clinic_name ?? "Clínica")}
                          </button>
                          <p className="text-xs text-muted-foreground truncate">
                            {String(membership.account_role ?? "membro")} • Status:{" "}
                            {String(membership.membership_status ?? "ativo")}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                              isOwner
                                ? "bg-purple-500/10 text-purple-700 border-purple-300 dark:text-purple-300"
                                : "bg-primary/10 text-primary border-primary/20"
                            }`}
                          >
                            {String(membership.operational_role ?? "-")}
                          </span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent"
                            title="Alterar relação com a clínica"
                            onClick={() => onOpenEditMembership(membership)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">Alterar relação</span>
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title={
                              isOwner
                                ? "Owner não pode ser desvinculado diretamente"
                                : "Desvincular usuário desta clínica"
                            }
                            onClick={() => onOpenDeleteMembership(membership)}
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
                            onClick={() => onOpenClinicDetail(membership.clinic_route_key)}
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
                  onClick={onOpenAddClinic}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar a uma clínica
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {itemType === "account" && (
          <PlatformUserAffiliateCard
            userId={itemId}
            userName={title}
            userEmail={String(entity?.email ?? "") || undefined}
            userPhone={String(entity?.phone ?? "") || undefined}
            primaryClinicId={
              String(detail?.clinic?.id ?? entity?.clinic_id ?? memberships[0]?.clinic_id ?? "") || undefined
            }
            onAffiliateStatusChange={onAffiliateStatusChange}
          />
        )}
      </div>
    </div>
  );
}
