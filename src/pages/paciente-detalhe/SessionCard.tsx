import { memo, useRef } from "react";
import { Card } from "@/components/ui/card";
import type { AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";
import type { PatientPaymentPlanRow } from "@/lib/payment-plans";
import type { SessionShareSummary } from "@/lib/session-sharing";
import type { PatientGroup, Session } from "./pacienteDetalheTypes";
import { SessionCardCompact } from "./SessionCardCompact";
import { SessionCardDetailed } from "./SessionCardDetailed";

export interface SessionCardProps {
  baseSchema: AnamnesisTemplateSchema;
  borderColor?: string;
  canViewFinancialData: boolean;
  creatorName: string;
  creatorIsIntern: boolean;
  isCompact?: boolean;
  isExpanded?: boolean;
  isSelected: boolean;
  navigateTo: () => void;
  onEvolve?: () => void;
  onLinkGroup?: () => void;
  isEvolving?: boolean;
  onPressCancel: () => void;
  onPressStart: () => void;
  onToggleExpand?: () => void;
  onToggleSelect: () => void;
  onViewShareRecipients: () => void;
  selectionMode: boolean;
  shareSummary?: SessionShareSummary;
  session: Session;
  sessionGroups?: PatientGroup[];
  paymentPlan?: PatientPaymentPlanRow | null;
}

export const SessionCard = memo((props: SessionCardProps) => {
  const {
    borderColor,
    isCompact,
    isSelected,
    navigateTo,
    onPressCancel,
    onPressStart,
    onToggleSelect,
    selectionMode,
    ...viewProps
  } = props;
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressOccurredRef = useRef(false);

  const handleActivate = () => {
    if (selectionMode) onToggleSelect();
    else navigateTo();
  };

  return (
    <Card
      className={`min-w-0 max-w-full overflow-hidden border-l-4 cursor-pointer select-none ${
        isCompact ? "hover:shadow-xs transition-all" : "hover:shadow-md transition-shadow"
      } ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}
      style={borderColor ? { borderLeftColor: borderColor } : undefined}
      onClick={() => {
        if (longPressOccurredRef.current) {
          longPressOccurredRef.current = false;
          return;
        }
        handleActivate();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        handleActivate();
      }}
      onPointerDown={(e) => {
        if (selectionMode || (e.button !== undefined && e.button !== 0)) return;
        touchStartPosRef.current = { x: e.clientX, y: e.clientY };
        setTimeout(() => {
          if (touchStartPosRef.current) longPressOccurredRef.current = true;
        }, 400);
        onPressStart();
      }}
      onPointerMove={(e) => {
        if (selectionMode || !touchStartPosRef.current) return;
        const dx = Math.abs(e.clientX - touchStartPosRef.current.x);
        const dy = Math.abs(e.clientY - touchStartPosRef.current.y);
        if (dx > 10 || dy > 10) {
          touchStartPosRef.current = null;
          onPressCancel();
        }
      }}
      onPointerUp={() => {
        touchStartPosRef.current = null;
        if (!selectionMode) onPressCancel();
      }}
      onPointerCancel={() => {
        touchStartPosRef.current = null;
        if (!selectionMode) onPressCancel();
      }}
      onContextMenu={(e) => {
        if (!selectionMode && onPressStart) {
          e.preventDefault();
          longPressOccurredRef.current = true;
          touchStartPosRef.current = null;
          onPressStart();
        }
      }}
    >
      {isCompact ? (
        <SessionCardCompact {...viewProps} isSelected={isSelected} selectionMode={selectionMode} />
      ) : (
        <SessionCardDetailed {...viewProps} isSelected={isSelected} selectionMode={selectionMode} />
      )}
    </Card>
  );
});

SessionCard.displayName = "SessionCard";
