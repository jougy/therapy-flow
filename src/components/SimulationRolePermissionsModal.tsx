import { useState } from "react";
import { UserCog, Search, RotateCcw, ShieldCheck, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import {
  ACCESS_CAPABILITIES,
  ACCESS_CAPABILITY_LABELS,
  AccessCapability,
  hasDefaultCapability,
  MembershipContext,
  OperationalRole,
} from "@/lib/rbac";

interface SimulationRolePermissionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SimulationRolePermissionsModal({ open, onOpenChange }: SimulationRolePermissionsModalProps) {
  const {
    capabilities,
    can,
    membership,
    operationalRole,
    resetPlatformRoleCapabilityOverrides,
    setPlatformRoleCapabilityOverride,
    simulatedRoleCapabilityOverrides = {},
    subscriptionPlan,
  } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");

  const activeOverridesCount = Object.keys(simulatedRoleCapabilityOverrides).length;

  const mockContext: MembershipContext = {
    accountRole: membership?.account_role ?? null,
    isActive: true,
    membershipStatus: "active",
    operationalRole: (operationalRole as OperationalRole) ?? "owner",
    subscriptionPlan: subscriptionPlan ?? "clinic",
  };

  const filteredCapabilities = ACCESS_CAPABILITIES.filter((cap) => {
    const meta = ACCESS_CAPABILITY_LABELS[cap];
    if (!meta) return true;
    const matchesTerm =
      meta.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      meta.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cap.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTerm;
  });

  const roleName = operationalRole
    ? {
        admin: "Administrador",
        assistant: "Assistente",
        estagiario: "Estagiário",
        owner: "Owner",
        professional: "Profissional",
      }[operationalRole] ?? operationalRole
    : "Owner";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 overflow-hidden sm:rounded-2xl">
        <DialogHeader className="pb-3 border-b shrink-0">
          <div className="flex items-center justify-between gap-2 pr-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <UserCog className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
                  <span>Permissões do Papel: {roleName}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Ajuste temporariamente o poder do papel operando nesta simulação sem alterar as regras da clínica em produção.
                </DialogDescription>
              </div>
            </div>
            {activeOverridesCount > 0 && (
              <Badge variant="outline" className="border-blue-400 bg-blue-50 text-blue-900 font-medium">
                {activeOverridesCount} {activeOverridesCount === 1 ? "permissão alterada" : "permissões alteradas"}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row items-center gap-2 py-3 shrink-0 border-b">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar permissão por nome, chave ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs sm:text-sm"
            />
          </div>
          {activeOverridesCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-xs text-blue-700 hover:text-blue-900 hover:bg-blue-100"
              onClick={() => resetPlatformRoleCapabilityOverrides?.()}
              title="Resetar permissões para os padrões do papel"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Resetar para Padrão
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto pr-1 py-3 space-y-3">
          {filteredCapabilities.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              Nenhuma permissão encontrada para a busca efetuada.
            </div>
          ) : (
            filteredCapabilities.map((cap) => {
              const meta = ACCESS_CAPABILITY_LABELS[cap] ?? { label: cap, description: cap };
              const isOverridden = cap in simulatedRoleCapabilityOverrides;
              const defaultAllowed = hasDefaultCapability(mockContext, cap);
              const isCurrentlyActive = typeof can === "function" ? can(cap) : Boolean(capabilities?.[cap]);

              return (
                <div
                  key={cap}
                  className={`p-3.5 rounded-xl border transition-colors flex items-start justify-between gap-4 ${
                    isOverridden
                      ? "border-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                      : "border-border/60 bg-card hover:bg-accent/40"
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-xs sm:text-sm text-foreground">
                        {meta.label}
                      </span>
                      {defaultAllowed ? (
                        <Badge variant="secondary" className="text-[10px] py-0 h-4 px-1.5 font-normal bg-emerald-100 text-emerald-800 border-emerald-200">
                          Padrão Liberado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] py-0 h-4 px-1.5 font-normal text-muted-foreground">
                          Padrão Bloqueado
                        </Badge>
                      )}
                      {isOverridden && (
                        <Badge className="text-[10px] py-0 h-4 px-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium">
                          Simulado
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {meta.description}
                    </p>
                    <code className="text-[10px] text-muted-foreground/80 font-mono bg-muted/60 px-1.5 py-0.5 rounded inline-block">
                      {cap}
                    </code>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0 pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${isCurrentlyActive ? "text-emerald-600" : "text-slate-400"}`}>
                        {isCurrentlyActive ? "PERMITIDO" : "NEGADO"}
                      </span>
                      <Switch
                        checked={isCurrentlyActive}
                        onCheckedChange={(val) => setPlatformRoleCapabilityOverride?.(cap, val)}
                        aria-label={`Permissão ${meta.label}`}
                      />
                    </div>
                    {isOverridden && (
                      <button
                        type="button"
                        className="text-[11px] text-blue-700 hover:underline flex items-center gap-1"
                        onClick={() => {
                          const next = { ...simulatedRoleCapabilityOverrides };
                          delete next[cap];
                          resetPlatformRoleCapabilityOverrides?.();
                          Object.entries(next).forEach(([k, v]) =>
                            setPlatformRoleCapabilityOverride?.(k as AccessCapability, v as boolean)
                          );
                        }}
                      >
                        Restaurar padrão
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
