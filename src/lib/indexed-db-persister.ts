/**
 * IndexedDB Persister for TanStack Query & Local-First Clinic Caching.
 * Zero external dependencies, asynchronous, and resilient to private browsing or test environments.
 */

const DB_NAME = "pluri_health_local_cache";
const STORE_NAME = "query_cache";
const DB_VERSION = 1;

interface CacheEntry<T = unknown> {
  data: T;
  savedAt: number;
  expiresAt?: number;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

export async function getLocalCacheItem<T>(key: string): Promise<T | null> {
  try {
    const db = await openDatabase();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
          const entry = request.result as CacheEntry<T> | undefined;
          if (!entry) {
            resolve(null);
            return;
          }

          if (entry.expiresAt && Date.now() > entry.expiresAt) {
            // Delete expired entry in background
            void deleteLocalCacheItem(key);
            resolve(null);
            return;
          }

          resolve(entry.data);
        };

        request.onerror = () => {
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

export async function setLocalCacheItem<T>(key: string, data: T, ttlMs = 24 * 60 * 60 * 1000): Promise<boolean> {
  try {
    const db = await openDatabase();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const entry: CacheEntry<T> = {
          data,
          savedAt: Date.now(),
          expiresAt: ttlMs > 0 ? Date.now() + ttlMs : undefined,
        };

        const request = store.put(entry, key);

        request.onsuccess = () => {
          resolve(true);
        };

        request.onerror = () => {
          resolve(false);
        };
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

export async function deleteLocalCacheItem(key: string): Promise<boolean> {
  try {
    const db = await openDatabase();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);

        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

export async function clearLocalCache(): Promise<boolean> {
  try {
    const db = await openDatabase();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}
