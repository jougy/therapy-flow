import React, { useState, useCallback } from "react";
import { CircleHelp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RolePermissionSwitch } from "./RolePermissionSwitch";
import type { AccessCapability } from "@/lib/rbac";
import type { RolePermissionAction, RolePermissionItem } from "../types";

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

export interface PermissionItemCardProps {
  item: RolePermissionItem;
  capabilities: Record<AccessCapability, boolean>;
  canEdit: boolean;
  onToggleRoleCapability: (capability: AccessCapability, nextChecked: boolean) => void;
}

export const PermissionItemCard: React.FC<PermissionItemCardProps> = React.memo(({
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
