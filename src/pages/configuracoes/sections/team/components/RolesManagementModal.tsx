import React, { useState, useEffect, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { RolePermissionSwitch } from "./RolePermissionSwitch";
import { cn } from "@/lib/utils";
import type { AccessCapability } from "@/lib/rbac";
import type {
  ClinicOperationalRoleDefinition,
  RolePermissionCategoryId,
  RolePermissionItem,
} from "../types";

export interface RolesManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Definitions & Selection
  operationalRoleDefinitions: ClinicOperationalRoleDefinition[];
  selectedOperationalRole: string;
  onSelectOperationalRole: (roleKey: string) => void;
  // Role counts
  roleUsageCounts: Record<string, number>;
  // Category filter
  rolePermissionCategory: RolePermissionCategoryId;
  onSelectPermissionCategory: (category: RolePermissionCategoryId) => void;
  categories: Array<{ id: RolePermissionCategoryId; label: string }>;
  categoryCounts: Record<RolePermissionCategoryId, number>;
  // Permission items & capabilities
  visibleRolePermissionItems: RolePermissionItem[];
  selectedRoleCapabilities: Record<AccessCapability, boolean>;
  onToggleRoleCapability: (capability: AccessCapability, nextChecked: boolean) => Promise<void> | void;
  // Permissions & States
  canEditSelectedRole: boolean;
  canMoveSelectedRole: boolean;
  canDeleteSelectedRole: boolean;
  hasRolesManagePermission: boolean;
  savingRoleDefinition: boolean;
  selectedRoleIndex: number;
  // Actions
  onCreateOperationalRole: () => Promise<void> | void;
  onSaveRoleLabel: (newLabel: string) => Promise<void> | void;
  onMoveRole: (direction: "up" | "down") => Promise<void> | void;
  onDeleteRole: () => Promise<void> | void;
}

const PermissionHelpButton = ({ details, title }: { details: string; title: string }) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 touch-manipulation"
          aria-label={`Explicar permissão ${title}`}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((prev) => !prev);
          }}
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3 text-xs" side="top" align="start">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-muted-foreground">{details}</p>
      </PopoverContent>
    </Popover>
  );
};

export const RolesManagementModal: React.FC<RolesManagementModalProps> = ({
  open,
  onOpenChange,
  operationalRoleDefinitions,
  selectedOperationalRole,
  onSelectOperationalRole,
  roleUsageCounts,
  rolePermissionCategory,
  onSelectPermissionCategory,
  categories,
  categoryCounts,
  visibleRolePermissionItems,
  selectedRoleCapabilities,
  onToggleRoleCapability,
  canEditSelectedRole,
  canMoveSelectedRole,
  canDeleteSelectedRole,
  hasRolesManagePermission,
  savingRoleDefinition,
  selectedRoleIndex,
  onCreateOperationalRole,
  onSaveRoleLabel,
  onMoveRole,
  onDeleteRole,
}) => {
  const selectedRoleDefinition = useMemo(() => {
    return (
      operationalRoleDefinitions.find((role) => role.role_key === selectedOperationalRole) ||
      operationalRoleDefinitions[0]
    );
  }, [operationalRoleDefinitions, selectedOperationalRole]);

  // Local editing label state with dirty checking
  const [editingRoleLabel, setEditingRoleLabel] = useState(selectedRoleDefinition?.label || "");

  // Update local label when selected role changes
  useEffect(() => {
    if (selectedRoleDefinition) {
      setEditingRoleLabel(selectedRoleDefinition.label);
    }
  }, [selectedRoleDefinition?.role_key, selectedRoleDefinition?.label]);

  const handleBlurLabel = () => {
    const trimmed = editingRoleLabel.trim();
    if (!selectedRoleDefinition) return;
    // Dirty check: only save if changed and non-empty
    if (trimmed && trimmed !== selectedRoleDefinition.label) {
      void onSaveRoleLabel(trimmed);
    } else if (!trimmed) {
      // Revert to original if emptied
      setEditingRoleLabel(selectedRoleDefinition.label);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] p-0 sm:max-w-5xl flex flex-col overflow-hidden rounded-2xl">
        <DialogHeader className="border-b px-6 py-4 flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-2 pr-6">
            <DialogTitle className="text-lg font-bold">Gerenciar papéis operacionais</DialogTitle>
            <ComponentHelpButton helpId="settings-team-roles-modal-block" size="sm" />
          </div>
          <DialogDescription className="sr-only">
            Painel para configurar papéis operacionais e permissões da equipe da clínica.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Hierarquias na Lateral do Modal (Sidebar com suporte responsivo a mobile) */}
          <aside className="w-full md:w-72 border-b md:border-b-0 md:border-r bg-muted/20 p-4 shrink-0 flex flex-col max-h-48 md:max-h-none overflow-hidden">
            <div className="mb-3 flex items-center justify-between gap-2 shrink-0">
              <p className="text-sm font-semibold text-foreground">Hierarquias</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                onClick={() => void onCreateOperationalRole()}
                disabled={savingRoleDefinition || !hasRolesManagePermission}
              >
                <Plus className="h-3.5 w-3.5" />
                Novo papel
              </Button>
            </div>
            <div className="space-y-1.5 overflow-y-auto pr-1 flex-1">
              {operationalRoleDefinitions.map((role) => {
                const isSelected = selectedOperationalRole === role.role_key;
                const isOwnerRole = role.role_key === "owner";
                const count = roleUsageCounts[role.role_key] ?? 0;

                return (
                  <button
                    key={role.role_key}
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm transition-all",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                        : "bg-background hover:bg-muted/60 text-foreground"
                    )}
                    onClick={() => onSelectOperationalRole(role.role_key)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{role.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground font-normal">
                        {count} pessoa{count === 1 ? "" : "s"}
                      </span>
                    </span>
                    {isOwnerRole ? (
                      <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Conteúdo de Permissões do Papel Selecionado (Scrollável à direita) */}
          <section className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between shrink-0">
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    className="h-9 max-w-xs font-semibold"
                    value={editingRoleLabel}
                    maxLength={40}
                    disabled={!canEditSelectedRole || savingRoleDefinition}
                    onChange={(e) => setEditingRoleLabel(e.target.value)}
                    onBlur={handleBlurLabel}
                  />
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-9 w-9"
                      disabled={!canMoveSelectedRole || savingRoleDefinition || selectedRoleIndex <= 1}
                      onClick={() => void onMoveRole("up")}
                      aria-label="Subir papel na hierarquia"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-9 w-9"
                      disabled={
                        !canMoveSelectedRole ||
                        savingRoleDefinition ||
                        selectedRoleIndex >= operationalRoleDefinitions.length - 1
                      }
                      onClick={() => void onMoveRole("down")}
                      aria-label="Descer papel na hierarquia"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={!canDeleteSelectedRole || savingRoleDefinition}
                      onClick={() => void onDeleteRole()}
                      aria-label="Excluir papel"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground max-w-2xl">
                  {!canEditSelectedRole
                    ? "Seu nível de acesso atual não permite alterar este papel (somente papéis em hierarquia inferior podem ser editados)."
                    : selectedRoleDefinition?.role_key === "owner"
                    ? "Conta principal da clínica. Gestão irrestrita de permissões e diretrizes operacionais."
                    : selectedRoleDefinition?.description ||
                      "Acompanha a equipe, ajusta acessos e gerencia configurações operacionais da clínica."}
                </p>
              </div>
              {!canEditSelectedRole ? (
                <Badge variant="outline" className="w-fit shrink-0 text-amber-600 border-amber-300">
                  Somente leitura
                </Badge>
              ) : selectedRoleDefinition?.role_key === "owner" ? (
                <Badge variant="secondary" className="w-fit shrink-0">
                  Topo (Owner)
                </Badge>
              ) : null}
            </div>

            {/* Filtro de Categorias de Permissão com Contadores Dinâmicos */}
            <div className="mb-3 flex flex-wrap gap-1.5 rounded-xl border bg-muted/30 p-1.5 shrink-0">
              {categories.map((category) => {
                const isActive = rolePermissionCategory === category.id;
                const count = categoryCounts[category.id] ?? 0;

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => onSelectPermissionCategory(category.id)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs transition-all",
                      isActive
                        ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                        : "border-transparent bg-transparent text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {category.label}
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted-foreground/20 text-muted-foreground"
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Cabeçalho da Tabela */}
            <div className="hidden sm:grid grid-cols-[minmax(0,1fr),auto] gap-3 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 border-b pb-2">
              <span>Função</span>
              <span className="text-right pr-2">Ações e Permissões</span>
            </div>

            {/* Lista de Permissões com Rolagem Independente */}
            <div className="space-y-2 overflow-y-auto flex-1 pr-1 pb-4">
              {visibleRolePermissionItems.map((item) => {
                return (
                  <div
                    key={item.key}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border bg-card p-3.5 transition-colors hover:border-primary/30"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-foreground">{item.title}</p>
                        <PermissionHelpButton details={item.details} title={item.title} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                    </div>

                    {/* Grid flexível de switches semânticos para as ações desta função */}
                    <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto shrink-0">
                      {item.actions.map((action) => {
                        const isChecked = selectedRoleCapabilities[action.capability] ?? false;
                        const isDisabled = !canEditSelectedRole;

                        return (
                          <RolePermissionSwitch
                            key={`${item.key}-${action.kind}-${action.capability}`}
                            checked={isChecked}
                            disabled={isDisabled}
                            kind={action.kind}
                            label={action.label}
                            itemTitle={item.title}
                            onToggle={(next) => void onToggleRoleCapability(action.capability, next)}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Rodapé Fixo */}
        <DialogFooter className="px-6 py-3 border-t bg-card shrink-0 flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Concluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
