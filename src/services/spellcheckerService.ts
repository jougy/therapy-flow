/**
 * Singleton Client-Side Spellchecker Service
 * Shares a SINGLE Web Worker and dictionary in memory across all inputs.
 */

import { get, set } from 'idb-keyval';
import { supabase } from '@/integrations/supabase/client';
import type {
  SpellcheckResult,
  WorkerInMessage,
  WorkerOutMessage,
  ClinicalWhitelistPayload,
} from '@/types/spellchecker';

const IDB_CLINIC_WORDS_KEY = 'pluri_spellcheck_clinic_words';
const IDB_BASE_WHITELIST_KEY = 'pluri_spellcheck_base_whitelist';
const IDB_AFF_KEY = 'pluri_spellcheck_aff_content';
const IDB_DIC_KEY = 'pluri_spellcheck_dic_content';

type SpellcheckCallback = (results: SpellcheckResult[]) => void;

class SpellcheckerService {
  private static instance: SpellcheckerService | null = null;
  private worker: Worker | null = null;
  private isReady = false;
  private isInitializing = false;
  private activeClinicId: string | null = null;
  private pendingCallbacks = new Map<string, SpellcheckCallback>();
  private readySubscribers = new Set<() => void>();

  private constructor() {}

  public static getInstance(): SpellcheckerService {
    if (!SpellcheckerService.instance) {
      SpellcheckerService.instance = new SpellcheckerService();
    }
    return SpellcheckerService.instance;
  }

  public subscribeReady(cb: () => void): () => void {
    if (this.isReady) {
      cb();
    } else {
      this.readySubscribers.add(cb);
    }
    return () => {
      this.readySubscribers.delete(cb);
    };
  }

  public getReadyStatus(): boolean {
    return this.isReady;
  }

  public async init(clinicId?: string): Promise<void> {
    if (this.isReady) {
      if (clinicId && clinicId !== this.activeClinicId) {
        this.activeClinicId = clinicId;
        await this.syncClinicWords(clinicId);
      }
      return;
    }

    if (this.isInitializing) return;
    this.isInitializing = true;
    this.activeClinicId = clinicId || null;

    try {
      // 1. Instantiate SINGLE Worker
      this.worker = new Worker(
        new URL('../workers/spellchecker.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
        const msg = event.data;
        if (msg.type === 'READY') {
          this.isReady = true;
          this.isInitializing = false;
          this.readySubscribers.forEach((cb) => cb());
          this.readySubscribers.clear();
        } else if (msg.type === 'CHECK_RESULT') {
          const callback = this.pendingCallbacks.get(msg.id);
          if (callback) {
            callback(msg.results);
            this.pendingCallbacks.delete(msg.id);
          }
        }
      };

      // 2. Load .aff and .dic (IDB Cache first -> zero network overhead after 1st load)
      let [affContent, dicContent] = await Promise.all([
        get<string>(IDB_AFF_KEY),
        get<string>(IDB_DIC_KEY),
      ]);

      if (!affContent || !dicContent) {
        const [affRes, dicRes] = await Promise.all([
          fetch('/dictionaries/pt_BR.aff'),
          fetch('/dictionaries/pt_BR.dic'),
        ]);

        [affContent, dicContent] = await Promise.all([
          affRes.text(),
          dicRes.text(),
        ]);

        // Cache in IDB for subsequent launches
        set(IDB_AFF_KEY, affContent).catch(() => {});
        set(IDB_DIC_KEY, dicContent).catch(() => {});
      }

      // 3. Load base whitelist
      let baseWhitelist: string[] = (await get(IDB_BASE_WHITELIST_KEY)) || [];
      if (baseWhitelist.length === 0) {
        try {
          const wlRes = await fetch('/dictionaries/clinical_whitelist.json');
          if (wlRes.ok) {
            const data: ClinicalWhitelistPayload = await wlRes.json();
            baseWhitelist = data.words || [];
            set(IDB_BASE_WHITELIST_KEY, baseWhitelist).catch(() => {});
          }
        } catch (err) {
          console.warn('[Spellchecker] Base whitelist load failed:', err);
        }
      }

      // 4. Load clinic whitelist
      let clinicWhitelist: string[] = [];
      if (clinicId) {
        const cached = await get<string[]>(`${IDB_CLINIC_WORDS_KEY}_${clinicId}`);
        if (cached) clinicWhitelist = cached;
      }

      // 5. Send INIT to Worker
      this.worker.postMessage({
        type: 'INIT',
        affContent,
        dicContent,
        baseWhitelist,
        clinicWhitelist,
      } as WorkerInMessage);

      // 6. Background sync with Supabase
      if (clinicId) {
        this.syncClinicWords(clinicId).catch(() => {});
      }
    } catch (err) {
      console.error('[SpellcheckerService] Initialization failed:', err);
      this.isInitializing = false;
    }
  }

  private async syncClinicWords(clinicId: string): Promise<void> {
    try {
      const { data, error } = await (supabase as any)
        .from('clinic_custom_words')
        .select('word')
        .eq('clinic_id', clinicId);

      if (!error && data && this.worker) {
        const freshWords = (data as Array<{ word: string }>).map((r) => r.word);
        await set(`${IDB_CLINIC_WORDS_KEY}_${clinicId}`, freshWords);
        for (const w of freshWords) {
          this.worker.postMessage({ type: 'ADD_WORD', word: w } as WorkerInMessage);
        }
      }
    } catch (err) {
      console.warn('[Spellchecker] Clinic words sync warning:', err);
    }
  }

  public checkText(text: string): Promise<SpellcheckResult[]> {
    return new Promise((resolve) => {
      if (!this.worker || !this.isReady || !text.trim()) {
        resolve([]);
        return;
      }

      const id = Math.random().toString(36).substring(2, 9);
      this.pendingCallbacks.set(id, resolve);

      this.worker.postMessage({
        type: 'CHECK_TEXT',
        id,
        text,
      } as WorkerInMessage);
    });
  }

  public async addWordToClinic(word: string, clinicId?: string): Promise<void> {
    const clean = word.toLowerCase().trim();
    if (!clean || !this.worker) return;

    this.worker.postMessage({
      type: 'ADD_WORD',
      word: clean,
    } as WorkerInMessage);

    const targetClinicId = clinicId || this.activeClinicId;
    if (targetClinicId) {
      const key = `${IDB_CLINIC_WORDS_KEY}_${targetClinicId}`;
      const currentList = ((await get(key)) as string[]) || [];
      if (!currentList.includes(clean)) {
        await set(key, [...currentList, clean]);
      }

      const { data: { user } } = await supabase.auth.getUser();
      await (supabase as any).from('clinic_custom_words').insert({
        clinic_id: targetClinicId,
        word: clean,
        created_by: user?.id,
      });
    }
  }
}

export const spellcheckerService = SpellcheckerService.getInstance();
