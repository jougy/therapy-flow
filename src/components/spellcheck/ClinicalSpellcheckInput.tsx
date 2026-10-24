/**
 * Clinical Spellcheck Single-Line Input with Floating Suggestion Balloon.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSpellchecker } from '@/hooks/useSpellchecker';
import { FloatingSuggestionBalloon } from './FloatingSuggestionBalloon';
import type { SpellcheckResult } from '@/types/spellchecker';

interface ClinicalSpellcheckInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChangeValue: (value: string) => void;
  clinicId?: string;
}

export const ClinicalSpellcheckInput: React.FC<ClinicalSpellcheckInputProps> = ({
  value,
  onChangeValue,
  clinicId,
  className = '',
  ...props
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [activeBalloon, setActiveBalloon] = useState<{
    result: SpellcheckResult;
    position: { top: number; left: number };
  } | null>(null);

  const [ignoredWords, setIgnoredWords] = useState<Set<string>>(new Set());

  const { isReady, results, checkText, addWordToClinic } = useSpellchecker({
    clinicId,
    debounceMs: 300,
  });

  useEffect(() => {
    if (isReady) {
      checkText(value);
    }
  }, [value, isReady, checkText]);

  const visibleErrors = results.filter((r) => !ignoredWords.has(r.word.toLowerCase()));

  const handleInputClick = useCallback(
    (e: React.MouseEvent<HTMLInputElement>) => {
      const input = inputRef.current;
      if (!input || visibleErrors.length === 0) {
        setActiveBalloon(null);
        return;
      }

      const cursorIndex = input.selectionStart ?? 0;
      const clickedError = visibleErrors.find(
        (err) => cursorIndex >= err.startIndex && cursorIndex <= err.endIndex
      );

      if (clickedError) {
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

  const handleApplySuggestion = (_original: string, replacement: string) => {
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

  const hasError = visibleErrors.length > 0;

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChangeValue(e.target.value)}
        onClick={handleInputClick}
        className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          hasError ? 'underline decoration-amber-500 decoration-wavy underline-offset-4' : ''
        } ${className}`}
        {...props}
      />

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
