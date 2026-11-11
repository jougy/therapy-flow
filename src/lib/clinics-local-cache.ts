/**
 * Gerenciador Local-First para Cache de Clínicas Acessíveis.
 * Armazena no IndexedDB com fallback transparente para localStorage.
 * Complexidade de Leitura e Escrita: O(1).
 */

import { getLocalCacheItem, setLocalCacheItem, deleteLocalCacheItem } from "./indexed-db-persister";
import type { AccessibleClinic } from "@/hooks/useAuth";

const CLINICS_CACHE_PREFIX = "therapy-flow:clinics-cache:v1:";
const LOCAL_STORAGE_PREFIX = "therapy-flow.clinicsCache.";
// 7 dias de validade para resiliência quando o usuário fica 1 ou 2 dias fora
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Salva as clínicas acessíveis do usuário tanto no IndexedDB quanto no localStorage.
 * O(1) Big-O - gravação atômica assíncrona sem travar a UI.
 */
export async function saveUserClinicsToLocalCache(userId: string, clinics: AccessibleClinic[]): Promise<void> {
  if (!userId || !Array.isArray(clinics)) return;

  const cacheKey = `${CLINICS_CACHE_PREFIX}${userId}`;
  const lsKey = `${LOCAL_STORAGE_PREFIX}${userId}`;

  try {
    // 1. Grava no IndexedDB
    await setLocalCacheItem(cacheKey, clinics, CACHE_TTL_MS);
  } catch {
    // Silencioso em caso de restrições de sandbox
  }

  try {
    // 2. Grava no localStorage para acesso síncrono instantâneo
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(
        lsKey,
        JSON.stringify({
          data: clinics,
          savedAt: Date.now(),
        })
      );
    }
  } catch {
    // Evita estouro de quota
  }
}

/**
 * Recupera as clínicas salvas localmente para o usuário.
 * Estratégia O(1):
 * 1. Tenta localStorage primeiro (acesso síncrono ultra-rápido, 0ms).
 * 2. Em paralelo ou fallback, recupera do IndexedDB caso localStorage esteja vazio.
 */
export async function getUserClinicsFromLocalCache(userId: string): Promise<AccessibleClinic[] | null> {
  if (!userId) return null;

  const lsKey = `${LOCAL_STORAGE_PREFIX}${userId}`;
  const cacheKey = `${CLINICS_CACHE_PREFIX}${userId}`;

  // 1. Tenta síncrono no localStorage (0ms)
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(lsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.data) && parsed.data.length > 0) {
          return parsed.data as AccessibleClinic[];
        }
      }
    }
  } catch {
    // fallback para IndexedDB
  }

  // 2. Fallback assíncrono para IndexedDB
  try {
    const cached = await getLocalCacheItem<AccessibleClinic[]>(cacheKey);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Limpa o cache de clínicas do usuário ao fazer logout.
 */
export async function clearUserClinicsLocalCache(userId?: string | null): Promise<void> {
  if (!userId) return;

  try {
    await deleteLocalCacheItem(`${CLINICS_CACHE_PREFIX}${userId}`);
  } catch {
    // Silencioso
  }

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${userId}`);
    }
  } catch {
    // Silencioso
  }
}
