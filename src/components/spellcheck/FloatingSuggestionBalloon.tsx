/**
 * Floating Suggestion Balloon & Non-Intrusive Mobile-First Popover
 * Rendered in an isolated layer via Portal to prevent Layout Shifts.
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, MoreVertical, Plus, X } from 'lucide-react';
import type { SpellcheckResult } from '@/types/spellchecker';

interface FloatingSuggestionBalloonProps {
  result: SpellcheckResult;
  position: { top: number; left: number };
  onApplySuggestion: (original: string, replacement: string) => void;
  onIgnore: (word: string) => void;
  onAddToClinic: (word: string) => void;
  onClose: () => void;
}

export const FloatingSuggestionBalloon: React.FC<FloatingSuggestionBalloonProps> = ({
  result,
  position,
  onApplySuggestion,
  onIgnore,
  onAddToClinic,
  onClose,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  // Get primary suggestion or top suggestion
  const primary = result.primarySuggestion || result.suggestions[0];

  return createPortal(
    <div
      className="fixed z-50 flex flex-col items-start bg-popover text-popover-foreground border border-border shadow-xl rounded-lg p-1.5 animate-in fade-in zoom-in-95"
      style={{
        top: `${Math.max(10, position.top - 48)}px`,
        left: `${Math.max(10, position.left)}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Primary Quick-Action Row */}
      <div className="flex items-center gap-1.5">
        {primary ? (
          <button
            type="button"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors min-h-[36px]"
            onClick={() => onApplySuggestion(result.word, primary)}
          >
            <Check className="w-3.5 h-3.5 text-primary-foreground" />
            <span>{primary}</span>
          </button>
        ) : (
          <span className="text-xs text-muted-foreground px-2 py-1">Sem sugestões</span>
        )}

        <button
          type="button"
          aria-label="Mais opções"
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          onClick={() => setShowMenu((prev) => !prev)}
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        <button
          type="button"
          aria-label="Fechar"
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Expanded Actions Popover / Mobile Menu */}
      {showMenu && (
        <div className="mt-1.5 pt-1.5 border-t border-border w-full flex flex-col gap-1 min-w-[200px]">
          {result.suggestions.length > 1 && (
            <div className="flex flex-col gap-0.5 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground px-2 py-0.5">
                Outras sugestões:
              </span>
              {result.suggestions.slice(1, 4).map((sug) => (
                <button
                  key={sug}
                  type="button"
                  className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent hover:text-accent-foreground transition-colors flex items-center min-h-[36px]"
                  onClick={() => onApplySuggestion(result.word, sug)}
                >
                  {sug}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-1.5 text-muted-foreground min-h-[40px]"
            onClick={() => onIgnore(result.word)}
          >
            <X className="w-3.5 h-3.5" />
            <span>Ignorar nesta sessão</span>
          </button>

          <button
            type="button"
            className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-1.5 text-primary font-medium min-h-[40px]"
            onClick={() => onAddToClinic(result.word)}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar ao corretor da clínica</span>
          </button>
        </div>
      )}
    </div>,
    document.body
  );
};
