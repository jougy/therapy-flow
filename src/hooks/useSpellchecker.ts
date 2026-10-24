/**
 * Optimized Hook for Client-Side Spellchecking
 * Uses the Singleton SpellcheckerService to eliminate redundant Worker instantiations,
 * network requests, and heap bloat.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { spellcheckerService } from '@/services/spellcheckerService';
import type { SpellcheckResult } from '@/types/spellchecker';

interface UseSpellcheckerOptions {
  clinicId?: string;
  debounceMs?: number;
}

export function useSpellchecker({ clinicId, debounceMs = 300 }: UseSpellcheckerOptions = {}) {
  const [isReady, setIsReady] = useState(spellcheckerService.getReadyStatus());
  const [results, setResults] = useState<SpellcheckResult[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 1. Trigger initialization on the singleton (noop if already ready or initializing)
    spellcheckerService.init(clinicId);

    // 2. Subscribe to ready state
    const unsubscribe = spellcheckerService.subscribeReady(() => {
      setIsReady(true);
    });

    return () => {
      unsubscribe();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [clinicId]);

  const checkText = useCallback(
    (text: string): Promise<SpellcheckResult[]> => {
      return new Promise((resolve) => {
        if (!isReady || !text.trim()) {
          setResults([]);
          resolve([]);
          return;
        }

        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(async () => {
          const res = await spellcheckerService.checkText(text);
          setResults(res);
          resolve(res);
        }, debounceMs);
      });
    },
    [isReady, debounceMs]
  );

  const addWordToClinic = useCallback(
    async (word: string) => {
      const cleanWord = word.toLowerCase().trim();
      if (!cleanWord) return;

      // Optimistically update local results
      setResults((prev) => prev.filter((r) => r.word.toLowerCase() !== cleanWord));

      await spellcheckerService.addWordToClinic(cleanWord, clinicId);
    },
    [clinicId]
  );

  return {
    isReady,
    results,
    checkText,
    addWordToClinic,
  };
}
