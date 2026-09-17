import { memo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
}

export const AccountStatusSelect = memo(({ onValueChange, value }: SelectProps) => (
  <Select value={value} onValueChange={onValueChange}>
    <SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="active">Ativa</SelectItem>
      <SelectItem value="payment_pending">Pagamento pendente</SelectItem>
      <SelectItem value="temporarily_paused">Pausada temporariamente</SelectItem>
      <SelectItem value="banned">Bloqueada</SelectItem>
    </SelectContent>
  </Select>
));
AccountStatusSelect.displayName = "AccountStatusSelect";

export const ClinicAccessStatusSelect = memo(({ onValueChange, value }: SelectProps) => (
  <Select value={value} onValueChange={onValueChange}>
    <SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="active">Ativa</SelectItem>
      <SelectItem value="payment_pending">Pagamento pendente</SelectItem>
      <SelectItem value="temporarily_paused">Pausada temporariamente</SelectItem>
      <SelectItem value="banned">Bloqueada</SelectItem>
      <SelectItem value="delete">Excluir definitivamente</SelectItem>
    </SelectContent>
  </Select>
));
ClinicAccessStatusSelect.displayName = "ClinicAccessStatusSelect";

export const OperationalRoleSelect = memo(({ onValueChange, value }: SelectProps) => (
  <Select value={value} onValueChange={onValueChange}>
    <SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="admin">Administrador</SelectItem>
      <SelectItem value="professional">Profissional</SelectItem>
      <SelectItem value="assistant">Assistente</SelectItem>
      <SelectItem value="estagiario">Estagiário</SelectItem>
    </SelectContent>
  </Select>
));
OperationalRoleSelect.displayName = "OperationalRoleSelect";
