import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { RolePermissionSwitch } from "./RolePermissionSwitch";
import { cn } from "@/lib/utils";
import type { AccessCapability } from "@/lib/rbac";
import {
  ROLE_PERMISSION_CATEGORIES,
  type ClinicOperationalRoleDefinition,
  type RolePermissionAction,
  type RolePermissionCategoryId,
  type RolePermissionItem,
} from "../types";

export interface RolesManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;

  // Definitions & Selection
  operationalRoleDefinitions?: ClinicOperationalRoleDefinition[];
  sortedOperationalRoleDefinitions?: ClinicOperationalRoleDefinition[];
  selectedOperationalRole: string;
  onSelectOperationalRole?: (roleKey: string) => void;
  setSelectedOperationalRole?: (roleKey: string) => void;
  selectedRoleDefinition?: ClinicOperationalRoleDefinition;

  // Label editing (supports controlled or dirty-check uncontrolled)
  editingRoleLabel?: string;
  setEditingRoleLabel?: (label: string) => void;
  onSaveRoleLabel?: (newLabel: string) => Promise<void> | void;
  onSaveSelectedRoleLabel?: () => Promise<void> | void;

  // Role usage counts
  roleUsageCounts: Record<string, number>;

  // Category filter
  rolePermissionCategory: RolePermissionCategoryId;
  onSelectPermissionCategory?: (category: RolePermissionCategoryId) => void;
  setRolePermissionCategory?: (category: RolePermissionCategoryId) => void;
  categories?: Array<{ id: RolePermissionCategoryId; label: string }>;
  categoryCounts?: Record<RolePermissionCategoryId, number>;
  rolePermissionCategoryCounts?: Record<RolePermissionCategoryId, number>;

  // Permission items & capabilities
  visibleRolePermissionItems: RolePermissionItem[];
  selectedRoleCapabilities: Record<AccessCapability, boolean>;
  onToggleRoleCapability: (capability: AccessCapability, nextChecked: boolean) => Promise<void> | void;

  // Permissions & States
  canEditSelectedRole: boolean;
  canMoveSelectedRole: boolean;
  canDeleteSelectedRole: boolean;
  hasRolesManagePermission?: boolean;
  savingRoleDefinition: boolean;
  selectedRoleIndex: number;

  // Actions
  onCreateOperationalRole: () => Promise<void> | void;
  onMoveRole?: (direction: "up" | "down") => Promise<void> | void;
  onMoveSelectedRole?: (direction: "up" | "down") => Promise<void> | void;
  onDeleteRole?: () => Promise<void> | void;
  onDeleteSelectedRole?: () => Promise<void> | void;
}

export const PermissionHelpButton: React.FC<{ details: string; title: string }> = ({
  details,
  title,
}) => {
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

// Subcomponente memoizado para renderizar cada switch sem re-render desnecessário
interface RolePermissionSwitchItemProps {
  action: RolePermissionAction;
  itemTitle: string;
  checked: boolean;
  disabled: boolean;
  onToggle: (capability: AccessCapability, nextChecked: boolean) => void;
}

const RolePermissionSwitchItem: React.FC<RolePermissionSwitchItemProps> = React.memo(({
  action,
  itemTitle,
  checked,
  disabled,
  onToggle,
}) => {
  const handleToggle = useCallback(
    (next: boolean) => {
      onToggle(action.capability, next);
    },
    [action.capability, onToggle]
  );

  return (
    <RolePermissionSwitch
      checked={checked}
      disabled={disabled}
      kind={action.kind}
      label={action.label}
      itemTitle={itemTitle}
      onToggle={handleToggle}
    />
  );
});

RolePermissionSwitchItem.displayName = "RolePermissionSwitchItem";

// Subcomponente memoizado para cada linha de função/permissão, isolando re-renderizações
interface PermissionItemCardProps {
  item: RolePermissionItem;
  capabilities: Record<AccessCapability, boolean>;
  canEdit: boolean;
  onToggleRoleCapability: (capability: AccessCapability, nextChecked: boolean) => void;
}

const PermissionItemCard: React.FC<PermissionItemCardProps> = React.memo(({
  item,
  capabilities,
  canEdit,
  onToggleRoleCapability,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border bg-card p-3.5 transition-colors hover:border-primary/30">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm text-foreground">{item.title}</p>
          <PermissionHelpButton details={item.details} title={item.title} />
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto shrink-0">
        {item.actions.map((action) => (
          <RolePermissionSwitchItem
            key={`${item.key}-${action.kind}-${action.capability}`}
            action={action}
            itemTitle={item.title}
            checked={capabilities[action.capability] ?? false}
            disabled={!canEdit}
            onToggle={onToggleRoleCapability}
          />
        ))}
      </div>
    </div>
  );
});

PermissionItemCard.displayName = "PermissionItemCard";

export const RolesManagementModal: React.FC<RolesManagementModalProps> = ({
  open,
  onOpenChange,
  trigger,
  operationalRoleDefinitions,
  sortedOperationalRoleDefinitions,
  selectedOperationalRole,
  onSelectOperationalRole,
  setSelectedOperationalRole,
  selectedRoleDefinition: passedSelectedRoleDefinition,
  editingRoleLabel,
  setEditingRoleLabel,
  onSaveRoleLabel,
  onSaveSelectedRoleLabel,
  roleUsageCounts,
  rolePermissionCategory,
  onSelectPermissionCategory,
  setRolePermissionCategory,
  categories,
  categoryCounts,
  rolePermissionCategoryCounts,
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
  onMoveRole,
  onMoveSelectedRole,
  onDeleteRole,
  onDeleteSelectedRole,
}) => {
  const roleDefs = operationalRoleDefinitions || sortedOperationalRoleDefinitions || [];
  const onSelectRole = onSelectOperationalRole || setSelectedOperationalRole;
  const onMove = onMoveRole || onMoveSelectedRole;
  const onDelete = onDeleteRole || onDeleteSelectedRole;
  const onCategoryChange = onSelectPermissionCategory || setRolePermissionCategory;
  const activeCategories = categories || ROLE_PERMISSION_CATEGORIES;
  const activeCategoryCounts = categoryCounts || rolePermissionCategoryCounts || ({} as Record<RolePermissionCategoryId, number>);
  const canManage = hasRolesManagePermission ?? canEditSelectedRole;

  const activeSelectedRole = useMemo(() => {
    if (passedSelectedRoleDefinition) return passedSelectedRoleDefinition;
    return (
      roleDefs.find((role) => role.role_key === selectedOperationalRole) ||
      roleDefs[0]
    );
  }, [passedSelectedRoleDefinition, roleDefs, selectedOperationalRole]);

  // Suporte a estado controlado ou local com dirty checking
  const isLabelControlled = typeof editingRoleLabel === "string" && typeof setEditingRoleLabel === "function";
  const [localLabel, setLocalLabel] = useState(activeSelectedRole?.label || "");

  useEffect(() => {
    if (!isLabelControlled && activeSelectedRole) {
      setLocalLabel(activeSelectedRole.label);
    }
  }, [isLabelControlled, activeSelectedRole?.role_key, activeSelectedRole?.label]);

  const currentLabel = isLabelControlled ? editingRoleLabel : localLabel;

  const handleLabelChange = (val: string) => {
    if (isLabelControlled) {
      setEditingRoleLabel?.(val);
    } else {
      setLocalLabel(val);
    }
  };

  const handleBlurLabel = () => {
    const trimmed = currentLabel.trim();
    if (!activeSelectedRole) return;

    if (onSaveRoleLabel) {
      if (trimmed && trimmed !== activeSelectedRole.label) {
        void onSaveRoleLabel(trimmed);
      } else if (!trimmed) {
        if (isLabelControlled) {
          setEditingRoleLabel?.(activeSelectedRole.label);
        } else {
          setLocalLabel(activeSelectedRole.label);
        }
      }
    } else if (onSaveSelectedRoleLabel) {
      void onSaveSelectedRoleLabel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
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
          {/* Hierarquias na Lateral do Modal (Fixa à esquerda em desktop; oculta em mobile em favor do Select no topo) */}
          <aside className="hidden md:flex md:w-72 border-r bg-muted/20 p-4 shrink-0 flex-col overflow-hidden">
            <div className="mb-3 flex items-center justify-between gap-2 shrink-0">
              <p className="text-sm font-semibold text-foreground">Hierarquias</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                onClick={() => void onCreateOperationalRole()}
                disabled={savingRoleDefinition || !canManage}
              >
                <Plus className="h-3.5 w-3.5" />
                Novo papel
              </Button>
            </div>
            <div className="space-y-1.5 overflow-y-auto pr-1 flex-1">
              {roleDefs.map((role) => {
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
                    onClick={() => onSelectRole?.(role.role_key)}
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
            {/* Seletor Mobile de Papel Operacional (apenas em telas menores que md:) */}
            <div className="mb-4 flex flex-col gap-2 rounded-xl border bg-muted/20 p-3 md:hidden shrink-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Selecionar Papel:
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={() => void onCreateOperationalRole()}
                  disabled={savingRoleDefinition || !canManage}
                >
                  <Plus className="h-3 w-3" />
                  Criar papel
                </Button>
              </div>
              <Select
                value={selectedOperationalRole}
                onValueChange={(val) => onSelectRole?.(val)}
              >
                <SelectTrigger className="w-full h-9 text-xs bg-background">
                  <SelectValue placeholder="Escolha um papel..." />
                </SelectTrigger>
                <SelectContent>
                  {roleDefs.map((role) => {
                    const count = roleUsageCounts[role.role_key] ?? 0;
                    return (
                      <SelectItem key={role.role_key} value={role.role_key}>
                        {role.label} ({count} pessoa{count === 1 ? "" : "s"})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between shrink-0">
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    className="h-9 max-w-xs font-semibold"
                    value={currentLabel}
                    maxLength={40}
                    disabled={!canEditSelectedRole || savingRoleDefinition}
                    onChange={(e) => handleLabelChange(e.target.value)}
                    onBlur={handleBlurLabel}
                  />
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-9 w-9"
                      disabled={!canMoveSelectedRole || savingRoleDefinition || selectedRoleIndex <= 1}
                      onClick={() => void onMove?.("up")}
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
                        selectedRoleIndex >= roleDefs.length - 1
                      }
                      onClick={() => void onMove?.("down")}
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
                      onClick={() => void onDelete?.()}
                      aria-label="Excluir papel"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground max-w-2xl">
                  {!canEditSelectedRole
                    ? "Seu nível de acesso atual não permite alterar este papel (somente papéis em hierarquia inferior podem ser editados)."
                    : activeSelectedRole?.role_key === "owner"
                    ? "Conta principal da clínica. Gestão irrestrita de permissões e diretrizes operacionais."
                    : activeSelectedRole?.description ||
                      "Acompanha a equipe, ajusta acessos e gerencia configurações operacionais da clínica."}
                </p>
              </div>
              {!canEditSelectedRole ? (
                <Badge variant="outline" className="w-fit shrink-0 text-amber-600 border-amber-300">
                  Somente leitura
                </Badge>
              ) : activeSelectedRole?.role_key === "owner" ? (
                <Badge variant="secondary" className="w-fit shrink-0">
                  Topo (Owner)
                </Badge>
              ) : null}
            </div>

            {/* Filtro de Categorias de Permissão com Contadores Dinâmicos */}
            <div className="mb-3 flex flex-wrap gap-1.5 rounded-xl border bg-muted/30 p-1.5 shrink-0">
              {activeCategories.map((category) => {
                const isActive = rolePermissionCategory === category.id;
                const count = activeCategoryCounts[category.id] ?? 0;

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => onCategoryChange?.(category.id)}
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
              {visibleRolePermissionItems.map((item) => (
                <PermissionItemCard
                  key={item.key}
                  item={item}
                  capabilities={selectedRoleCapabilities}
                  canEdit={canEditSelectedRole}
                  onToggleRoleCapability={onToggleRoleCapability}
                />
              ))}
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
