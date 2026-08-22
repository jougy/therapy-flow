import { PrintResponsibilityModal } from "@/components/PrintResponsibilityModal";
import type { SessionDocumentKind } from "@/lib/session-documents";

export interface SessionPrintDocumentsModalProps {
  isOpen: boolean;
  pendingPrintKind: SessionDocumentKind | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export const SessionPrintDocumentsModal = ({
  isOpen,
  pendingPrintKind,
  onCancel,
  onConfirm,
}: SessionPrintDocumentsModalProps) => {
  return (
    <PrintResponsibilityModal
      isOpen={isOpen}
      documentTitle={`Documento de Atendimento (${pendingPrintKind ?? "Sessão"})`}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};
