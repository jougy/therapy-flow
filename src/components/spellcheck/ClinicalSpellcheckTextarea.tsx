/**
 * Clinical Spellcheck Textarea with non-destructive underline overlay
 * and Floating Balloon Suggestions.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSpellchecker } from '@/hooks/useSpellchecker';
import { FloatingSuggestionBalloon } from './FloatingSuggestionBalloon';
import type { SpellcheckResult } from '@/types/spellchecker';

interface ClinicalSpellcheckTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChangeValue: (value: string) => void;
  clinicId?: string;
}

export const ClinicalSpellcheckTextarea: React.FC<ClinicalSpellcheckTextareaProps> = ({
  value,
  onChangeValue,
  clinicId,
  className = '',
  ...props
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [activeBalloon, setActiveBalloon] = useState<{
    result: SpellcheckResult;
    position: { top: number; left: number };
  } | null>(null);

  const [ignoredWords, setIgnoredWords] = useState<Set<string>>(new Set());

  const { isReady, results, checkText, addWordToClinic } = useSpellchecker({
    clinicId,
    debounceMs: 300,
  });

  // Re-run check on text change
  useEffect(() => {
    if (isReady) {
      checkText(value);
    }
  }, [value, isReady, checkText]);

  // Filter out temporarily ignored words
  const visibleErrors = results.filter((r) => !ignoredWords.has(r.word.toLowerCase()));

  // Open suggestion balloon when user clicks on a misspelled word
  const handleTextareaClick = useCallback(
    (e: React.MouseEvent<HTMLTextAreaElement>) => {
      const textarea = textareaRef.current;
      if (!textarea || visibleErrors.length === 0) {
        setActiveBalloon(null);
        return;
      }

      const cursorIndex = textarea.selectionStart;
      const clickedError = visibleErrors.find(
        (err) => cursorIndex >= err.startIndex && cursorIndex <= err.endIndex
      );

      if (clickedError) {
        // Calculate screen coordinate from click event
        setActiveBalloon({
          result: clickedError,
          position: {
            top: e.clientY,
            left: e.clientX,
          },
        });
      } else {
        setActiveBalloon(null);
      }
    },
    [visibleErrors]
  );

  const handleApplySuggestion = (original: string, replacement: string) => {
    if (!activeBalloon) return;
    const { startIndex, endIndex } = activeBalloon.result;
    const before = value.substring(0, startIndex);
    const after = value.substring(endIndex);
    const updated = before + replacement + after;
    onChangeValue(updated);
    setActiveBalloon(null);
  };

  const handleIgnore = (word: string) => {
    setIgnoredWords((prev) => new Set(prev).add(word.toLowerCase()));
    setActiveBalloon(null);
  };

  const handleAddToClinic = async (word: string) => {
    await addWordToClinic(word);
    setActiveBalloon(null);
  };

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChangeValue(e.target.value)}
        onClick={handleTextareaClick}
        className={`w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          visibleErrors.length > 0 ? 'underline decoration-amber-500 decoration-wavy underline-offset-4' : ''
        } ${className}`}
        {...props}
      />

      {/* Floating Suggestion Popover */}
      {activeBalloon && (
        <FloatingSuggestionBalloon
          result={activeBalloon.result}
          position={activeBalloon.position}
          onApplySuggestion={handleApplySuggestion}
          onIgnore={handleIgnore}
          onAddToClinic={handleAddToClinic}
          onClose={() => setActiveBalloon(null)}
        />
      )}
    </div>
  );
};
