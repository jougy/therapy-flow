/**
 * Web Worker for Client-Side Spellchecking & Phonetic Analysis
 * Runs Typo.js isolated from the React Main Thread.
 */

import Typo from 'typo-js';
import type {
  WorkerInMessage,
  WorkerOutMessage,
  SpellcheckResult,
  SpellErrorType,
} from '../types/spellchecker';

let typoInstance: Typo | null = null;
const whitelistSet = new Set<string>();
const diacriticsCanonMap = new Map<string, string>(); // 'analise' -> 'análise'

// Helper: Remove diacritics/accents for normalization
function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Regex to bypass clinical codes, numbers, scales, and measurements
const BYPASS_REGEX = /^[A-Z0-9\-/°%]+$|^\d+([xX]\d+)?([a-zA-Z%°]+)?$|^[C|T|L|S]\d(-[C|T|L|S]\d)?$|^[A-Z]{2,6}$/;

// Sibilant phonetic substitution patterns
const SIBILANT_RULES: Array<[RegExp, string]> = [
  [/ss/g, 'ç'],
  [/ç/g, 'ss'],
  [/c([eéií])/g, 's$1'],
  [/s([eéií])/g, 'c$1'],
  [/z/g, 's'],
  [/s(?=[aeiouáéíóúãõâêô])/g, 'z'],
  [/sc/g, 'ç'],
  [/xc/g, 'ss'],
  [/x/g, 'ch'],
  [/ch/g, 'x'],
];

// Clinical hyphenated composite words dictionary (space or unhyphenated to canonical)
const COMPOSITE_TERMS: Record<string, string> = {
  'pos operatorio': 'pós-operatório',
  'pos-operatorio': 'pós-operatório',
  'posoperatorio': 'pós-operatório',
  'pre operatorio': 'pré-operatório',
  'pre-operatorio': 'pré-operatório',
  'preoperatorio': 'pré-operatório',
  'pos cirurgico': 'pós-cirúrgico',
  'pos-cirurgico': 'pós-cirúrgico',
  'pre cirurgico': 'pré-cirúrgico',
  'pre-cirurgico': 'pré-cirúrgico',
  'infra espinhoso': 'infraespinhal',
  'infra-espinhoso': 'infraespinhal',
  'supra espinhoso': 'supraespinhal',
  'supra-espinhoso': 'supraespinhal',
};

function populateDiacriticsMap(words: Iterable<string>) {
  for (const raw of words) {
    const word = raw.toLowerCase().trim();
    if (!word) continue;
    const stripped = stripAccents(word);
    if (stripped !== word && !diacriticsCanonMap.has(stripped)) {
      diacriticsCanonMap.set(stripped, word);
    }
  }
}

function initSpellchecker(
  aff: string,
  dic: string,
  baseWhitelist: string[],
  clinicWhitelist: string[]
) {
  typoInstance = new Typo('pt_BR', aff, dic);

  whitelistSet.clear();
  diacriticsCanonMap.clear();

  for (const w of baseWhitelist) {
    whitelistSet.add(w.toLowerCase().trim());
  }
  for (const w of clinicWhitelist) {
    whitelistSet.add(w.toLowerCase().trim());
  }

  // Populate accent mapping from whitelist
  populateDiacriticsMap(whitelistSet);

  const readyMsg: WorkerOutMessage = { type: 'READY' };
  self.postMessage(readyMsg);
}

function checkWordValid(wordLower: string): boolean {
  if (whitelistSet.has(wordLower)) return true;
  if (typoInstance && typoInstance.check(wordLower)) return true;
  return false;
}

function findPhoneticOrAccentCandidate(rawWord: string): {
  primary: string | null;
  errorType: SpellErrorType;
} {
  const lower = rawWord.toLowerCase();

  // 1. Check composite hyphenated term match
  if (COMPOSITE_TERMS[lower]) {
    return { primary: COMPOSITE_TERMS[lower], errorType: 'hyphen' };
  }

  // 2. Direct Accentuation match: word without accents matches an accented canonical word
  const stripped = stripAccents(lower);
  if (diacriticsCanonMap.has(stripped)) {
    const canonical = diacriticsCanonMap.get(stripped)!;
    if (canonical !== lower) {
      return { primary: canonical, errorType: 'accentuation' };
    }
  }

  // If word is in dictionary when stripped or checked against Typo suggestions
  if (typoInstance) {
    const suggestions = typoInstance.suggest(lower, 5);
    for (const sug of suggestions) {
      if (stripAccents(sug.toLowerCase()) === stripped) {
        // Cache for future O(1) lookups
        diacriticsCanonMap.set(stripped, sug);
        return { primary: sug, errorType: 'accentuation' };
      }
    }

    // 3. Phonetic sibilant substitutions (c, s, ss, ç, sc, z, x, xc)
    for (const [pattern, repl] of SIBILANT_RULES) {
      const candidate = lower.replace(pattern, repl);
      if (candidate !== lower && checkWordValid(candidate)) {
        return { primary: candidate, errorType: 'phonetic' };
      }
    }

    // Fallback: First suggestion from Typo
    if (suggestions.length > 0) {
      return { primary: suggestions[0], errorType: 'unknown' };
    }
  }

  return { primary: null, errorType: 'unknown' };
}

function processText(id: string, text: string) {
  if (!typoInstance) {
    const fallbackResult: WorkerOutMessage = { type: 'CHECK_RESULT', id, results: [] };
    self.postMessage(fallbackResult);
    return;
  }

  const results: SpellcheckResult[] = [];
  // Tokenize retaining offsets (matches words including accented chars and internal hyphens)
  const tokenRegex = /[a-zA-Zà-ÿÀ-ß0-9\-/°%]+/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    const token = match[0];
    const startIndex = match.index;
    const endIndex = startIndex + token.length;

    // Check bypass regex (acronyms, numbers, measurements, vertebral levels)
    if (BYPASS_REGEX.test(token)) {
      continue;
    }

    const lower = token.toLowerCase();

    // Check if word is valid
    if (checkWordValid(lower)) {
      continue;
    }

    // Find phonetic or accent candidate
    const { primary, errorType } = findPhoneticOrAccentCandidate(token);
    const suggestions = typoInstance.suggest(lower, 4);

    results.push({
      word: token,
      isCorrect: false,
      errorType,
      primarySuggestion: primary || (suggestions[0] ?? null),
      suggestions: primary && !suggestions.includes(primary)
        ? [primary, ...suggestions.slice(0, 3)]
        : suggestions,
      startIndex,
      endIndex,
    });
  }

  const response: WorkerOutMessage = {
    type: 'CHECK_RESULT',
    id,
    results,
  };
  self.postMessage(response);
}

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;
  switch (msg.type) {
    case 'INIT':
      initSpellchecker(msg.affContent, msg.dicContent, msg.baseWhitelist, msg.clinicWhitelist);
      break;
    case 'CHECK_TEXT':
      processText(msg.id, msg.text);
      break;
    case 'ADD_WORD': {
      const clean = msg.word.toLowerCase().trim();
      if (clean) {
        whitelistSet.add(clean);
        const stripped = stripAccents(clean);
        if (stripped !== clean) {
          diacriticsCanonMap.set(stripped, clean);
        }
      }
      break;
    }
  }
};
