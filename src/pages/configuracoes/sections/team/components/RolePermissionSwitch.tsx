import React from "react";
import {
  Coins,
  Eye,
  EyeOff,
  Pencil,
  Printer,
  Share2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RolePermissionSwitchKind } from "../types";

export interface RolePermissionSwitchProps {
  checked: boolean;
  disabled?: boolean;
  kind: RolePermissionSwitchKind;
  label?: string;
  itemTitle?: string;
  onToggle: (checked: boolean) => void;
}

export const DEFAULT_SWITCH_KIND_LABELS: Record<RolePermissionSwitchKind, string> = {
  view: "Ver",
  edit: "Editar",
  delete: "Excluir",
  share: "Enviar",
  finance: "Receber",
  print: "Imprimir",
  manage: "Gerenciar",
};

export const RolePermissionSwitch: React.FC<RolePermissionSwitchProps> = React.memo(({
  checked,
  disabled,
  kind,
  label,
  itemTitle: _itemTitle,
  onToggle,
}) => {
  const displayLabel = label || DEFAULT_SWITCH_KIND_LABELS[kind] || "Ativar";
  const ariaLabel = _itemTitle ? `${_itemTitle}: ${displayLabel}` : displayLabel;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      data-kind={kind}
      data-state={checked ? "checked" : "unchecked"}
      className={cn(
        "role-permission-switch",
        checked && "role-permission-switch--checked",
        disabled && "role-permission-switch--disabled"
      )}
      onClick={() => onToggle(!checked)}
    >
      <span className="role-permission-switch__track" aria-hidden="true" />
      <span className="role-permission-switch__label" aria-hidden="true">
        {displayLabel}
      </span>
      <span className="role-permission-switch__thumb" aria-hidden="true">
        {kind === "view" && (
          <>
            <EyeOff className="role-permission-switch__icon role-permission-switch__icon--off" />
            <Eye className="role-permission-switch__icon role-permission-switch__icon--on" />
          </>
        )}
        {kind === "edit" && <Pencil className="role-permission-switch__icon role-permission-switch__icon--edit" />}
        {kind === "delete" && <Trash2 className="role-permission-switch__icon role-permission-switch__icon--delete" />}
        {kind === "share" && <Share2 className="role-permission-switch__icon role-permission-switch__icon--share" />}
        {kind === "finance" && <Coins className="role-permission-switch__icon role-permission-switch__icon--finance" />}
        {kind === "print" && <Printer className="role-permission-switch__icon role-permission-switch__icon--print" />}
        {kind === "manage" && <ShieldCheck className="role-permission-switch__icon role-permission-switch__icon--manage" />}
      </span>
    </button>
  );
});

RolePermissionSwitch.displayName = "RolePermissionSwitch";
