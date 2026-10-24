/**
 * Shared Type Contracts for Client-Side Spellchecker & Collaborative Dictionary
 * (Single Source of Truth - Pluri-Health Ecosystem)
 */

export type SpellErrorType = 'accentuation' | 'phonetic' | 'hyphen' | 'unknown';

export interface SpellcheckResult {
  word: string;
  isCorrect: boolean;
  errorType?: SpellErrorType;
  primarySuggestion: string | null;
  suggestions: string[];
  startIndex: number;
  endIndex: number;
}

export interface WorkerInMessageInit {
  type: 'INIT';
  affContent: string;
  dicContent: string;
  baseWhitelist: string[];
  clinicWhitelist: string[];
}

export interface WorkerInMessageCheck {
  type: 'CHECK_TEXT';
  id: string;
  text: string;
}

export interface WorkerInMessageAddWord {
  type: 'ADD_WORD';
  word: string;
}

export type WorkerInMessage =
  | WorkerInMessageInit
  | WorkerInMessageCheck
  | WorkerInMessageAddWord;

export interface WorkerOutMessageReady {
  type: 'READY';
}

export interface WorkerOutMessageResult {
  type: 'CHECK_RESULT';
  id: string;
  results: SpellcheckResult[];
}

export type WorkerOutMessage =
  | WorkerOutMessageReady
  | WorkerOutMessageResult;

export interface ClinicalWhitelistPayload {
  version: string;
  updatedAt: string;
  totalWords: number;
  words: string[];
}

export interface ClinicCustomWordRecord {
  id: string;
  clinic_id: string;
  word: string;
  created_by?: string;
  created_at: string;
}
