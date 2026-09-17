import { AlertCircle } from "lucide-react";

interface PlatformOperationPendingChangesProps {
  changes: string[];
}

export const PlatformOperationPendingChanges = ({ changes }: PlatformOperationPendingChangesProps) => {
  if (!changes.length) return null;

  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
      <div className="flex items-center gap-2 font-semibold">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>Alterações pendentes (não salvas no banco):</span>
      </div>
      <ul className="mt-1.5 list-disc list-inside space-y-1 text-xs pl-1">
        {changes.map((change, idx) => (
          <li key={idx} className="font-medium">
            {change}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-amber-800/90 dark:text-amber-300/90">
        ⚠️ <strong>Atenção:</strong> Essas opções <strong>ainda não foram aplicadas</strong>. Para salvar definitivamente, informe o motivo auditável abaixo (mínimo de 8 caracteres) e clique em <strong>Salvar e aplicar alterações pendentes</strong>.
      </p>
    </div>
  );
};
