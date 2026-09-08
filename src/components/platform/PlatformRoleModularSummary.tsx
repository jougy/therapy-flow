import React, { useMemo } from "react";
import { ShieldCheck, SlidersHorizontal, Check, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  buildCapabilitiesForContext,
  type AccessCapability,
  type MembershipContext,
} from "@/lib/rbac";
import {
  ROLE_PERMISSION_ITEMS,
  type ClinicOperationalRoleDefinition,
  type RoleCapabilityRow,
  type RolePermissionCategoryId,
} from "@/pages/configuracoes/sections/team/types";

export interface PlatformRoleModularSummaryProps {
  roleDefinition?: ClinicOperationalRoleDefinition | null;
  roleCapabilitiesOverrides?: RoleCapabilityRow[];
  onOpenManageRoles?: () => void;
  compact?: boolean;
}

export const PlatformRoleModularSummary: React.FC<PlatformRoleModularSummaryProps> = ({
  roleDefinition,
  roleCapabilitiesOverrides = [],
  onOpenManageRoles,
  compact = false,
}) => {
  if (!roleDefinition) return null;

  const capabilities = useMemo(() => {
    const overridesMap: Partial<Record<AccessCapability, boolean>> = {};
    for (const row of roleCapabilitiesOverrides) {
      if (row.operational_role === roleDefinition.role_key) {
        overridesMap[row.capability as AccessCapability] = row.enabled;
      }
    }

    const context: MembershipContext = {
      accountRole: null,
      isActive: true,
      membershipStatus: "active",
      operationalRole:
        roleDefinition.base_operational_role === "owner"
          ? "owner"
          : roleDefinition.base_operational_role,
      subscriptionPlan: "clinic",
    };

    return buildCapabilitiesForContext(context, overridesMap);
  }, [roleDefinition, roleCapabilitiesOverrides]);

  // Contagem por categoria
  const categoryCounts = useMemo(() => {
    const counts: Record<RolePermissionCategoryId, { enabled: number; total: number }> = {
      all: { enabled: 0, total: 0 },
      clinical: { enabled: 0, total: 0 },
      agenda: { enabled: 0, total: 0 },
      team: { enabled: 0, total: 0 },
      admin: { enabled: 0, total: 0 },
      finance: { enabled: 0, total: 0 },
    };

    ROLE_PERMISSION_ITEMS.forEach((item) => {
      item.actions.forEach((action) => {
        counts.all.total += 1;
        counts[item.category].total += 1;
        if (capabilities[action.capability]) {
          counts.all.enabled += 1;
          counts[item.category].enabled += 1;
        }
      });
    });

    return counts;
  }, [capabilities]);

  // Permissões-chave para exibição rápida
  const keyPermissions = useMemo(() => {
    const keys: Array<{ label: string; active: boolean }> = [
      { label: "Ver Pacientes", active: capabilities["patients.read"] },
      { label: "Editar Pacientes", active: capabilities["patients.write"] },
      { label: "Atendimentos Próprios", active: capabilities["sessions.write"] },
      { label: "Atendimentos da Equipe", active: capabilities["sessions.read_all"] },
      { label: "Agenda da Equipe", active: capabilities["schedule.read_all"] },
      { label: "Gestão da Equipe", active: capabilities["subaccounts.manage"] },
      { label: "Financeiro / Tesouraria", active: capabilities["treasury.manage"] },
    ];
    return keys;
  }, [capabilities]);

  return (
    <div className="rounded-xl border bg-muted/30 p-3.5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Modularização do Papel: {roleDefinition.label}
            </span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              Base: {roleDefinition.base_operational_role}
            </Badge>
          </div>
          {roleDefinition.description && (
            <p className="text-[11px] text-muted-foreground line-clamp-2">
              {roleDefinition.description}
            </p>
          )}
        </div>

        {onOpenManageRoles && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5 shrink-0 hover:bg-background border-primary/30 text-primary font-medium"
            onClick={onOpenManageRoles}
          >
            <SlidersHorizontal className="h-3 w-3" />
            Configurar na clínica
          </Button>
        )}
      </div>

      {/* Contadores por categoria */}
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 font-medium">
          Clínico: {categoryCounts.clinical.enabled}/{categoryCounts.clinical.total}
        </span>
        <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 font-medium">
          Agenda: {categoryCounts.agenda.enabled}/{categoryCounts.agenda.total}
        </span>
        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium">
          Equipe: {categoryCounts.team.enabled}/{categoryCounts.team.total}
        </span>
        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium">
          Admin: {categoryCounts.admin.enabled}/{categoryCounts.admin.total}
        </span>
        <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-300 font-medium">
          Financeiro: {categoryCounts.finance.enabled}/{categoryCounts.finance.total}
        </span>
      </div>

      {!compact && (
        <div className="pt-2 border-t border-border/50">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Acessos-chave concedidos
          </p>
          <div className="flex flex-wrap gap-1.5">
            {keyPermissions.map((kp) => (
              <span
                key={kp.label}
                className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${
                  kp.active
                    ? "bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-muted/50 text-muted-foreground border-transparent line-through opacity-60"
                }`}
              >
                {kp.active ? <Check className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
                {kp.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
