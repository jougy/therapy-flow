import React from "react";
import {
  RolesManagementModal,
  type RolesManagementModalProps,
  PermissionHelpButton,
} from "./RolesManagementModal";

export type OperationalRolesModalProps = RolesManagementModalProps;

export const OperationalRolesModal: React.FC<RolesManagementModalProps> = (props) => {
  return <RolesManagementModal {...props} />;
};

export { PermissionHelpButton };
