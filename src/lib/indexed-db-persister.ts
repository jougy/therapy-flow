/**
 * IndexedDB Persister (v2) for TanStack Query & Local-First Clinic Caching.
 * Includes a synchronous L1 LRU memory mirror (max 250 entries),
 * singleton connection management, offline outbox store, and file blobs store.
 */

const DB_NAME = "pluri_health_local_cache";
const DB_VERSION = 2;

const STORE_QUERY_CACHE = "query_cache";
const STORE_OFFLINE_OUTBOX = "offline_outbox";
const STORE_OFFLINE_BLOBS = "offline_file_blobs";

const L1_MAX_ENTRIES = 250;

interface CacheEntry<T = unknown> {
  data: T;
  savedAt: number;
  expiresAt?: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function isExpired(entry: CacheEntry<unknown>): boolean {
  return Boolean(entry.expiresAt && Date.now() > entry.expiresAt);
}

function setMemoryCacheEntry<T>(key: string, entry: CacheEntry<T>): void {
  if (memoryCache.has(key)) {
    memoryCache.delete(key);
  }
  memoryCache.set(key, entry);

  while (memoryCache.size > L1_MAX_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey === undefined) break;
    memoryCache.delete(oldestKey);
  }
}

export function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_QUERY_CACHE)) {
          db.createObjectStore(STORE_QUERY_CACHE);
        }
        if (!db.objectStoreNames.contains(STORE_OFFLINE_OUTBOX)) {
          db.createObjectStore(STORE_OFFLINE_OUTBOX);
        }
        if (!db.objectStoreNames.contains(STORE_OFFLINE_BLOBS)) {
          db.createObjectStore(STORE_OFFLINE_BLOBS);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onclose = () => {
          dbPromise = null;
        };
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        dbPromise = null;
        resolve(null);
      };

      request.onblocked = () => {
        dbPromise = null;
        resolve(null);
      };
    } catch {
      dbPromise = null;
      resolve(null);
    }
  });

  return dbPromise;
}

async function getStoreItem<T>(storeName: string, key: string): Promise<T | null> {
  try {
    const db = await openDatabase();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => {
          resolve((request.result as T | undefined) ?? null);
        };
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

async function putStoreItem<T>(storeName: string, key: string, value: T): Promise<boolean> {
  try {
    const db = await openDatabase();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.put(value, key);

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

async function deleteStoreItem(storeName: string, key: string): Promise<boolean> {
  try {
    const db = await openDatabase();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
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

async function getAllStoreItems<T>(storeName: string): Promise<T[]> {
  try {
    const db = await openDatabase();
    if (!db) return [];

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          resolve(Array.isArray(request.result) ? (request.result as T[]) : []);
        };
        request.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  } catch {
    return [];
  }
}

/**
 * Reads an item synchronously from the L1 LRU memory cache.
 * Returns null if absent or expired.
 */
export function getSyncMemoryCacheItem<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;

  if (isExpired(entry)) {
    memoryCache.delete(key);
    void deleteStoreItem(STORE_QUERY_CACHE, key);
    return null;
  }

  // Refresh LRU recency
  memoryCache.delete(key);
  memoryCache.set(key, entry);
  return entry.data as T;
}

export async function getLocalCacheItem<T>(key: string): Promise<T | null> {
  const memoryHit = getSyncMemoryCacheItem<T>(key);
  if (memoryHit !== null) {
    return memoryHit;
  }

  const entry = await getStoreItem<CacheEntry<T>>(STORE_QUERY_CACHE, key);
  if (!entry) return null;

  if (isExpired(entry)) {
    memoryCache.delete(key);
    void deleteStoreItem(STORE_QUERY_CACHE, key);
    return null;
  }

  setMemoryCacheEntry(key, entry);
  return entry.data;
}

export async function setLocalCacheItem<T>(
  key: string,
  data: T,
  ttlMs = 24 * 60 * 60 * 1000
): Promise<boolean> {
  const entry: CacheEntry<T> = {
    data,
    savedAt: Date.now(),
    expiresAt: ttlMs > 0 ? Date.now() + ttlMs : undefined,
  };

  setMemoryCacheEntry(key, entry);
  return putStoreItem(STORE_QUERY_CACHE, key, entry);
}

export async function deleteLocalCacheItem(key: string): Promise<boolean> {
  memoryCache.delete(key);
  return deleteStoreItem(STORE_QUERY_CACHE, key);
}

export async function clearLocalCache(): Promise<boolean> {
  memoryCache.clear();
  try {
    const db = await openDatabase();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_QUERY_CACHE, "readwrite");
        const store = transaction.objectStore(STORE_QUERY_CACHE);
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

export function getAllOutboxItems<T>(): Promise<T[]> {
  return getAllStoreItems<T>(STORE_OFFLINE_OUTBOX);
}

export function putOutboxItem<T>(key: string, val: T): Promise<boolean> {
  return putStoreItem(STORE_OFFLINE_OUTBOX, key, val);
}

export function deleteOutboxItem(key: string): Promise<boolean> {
  return deleteStoreItem(STORE_OFFLINE_OUTBOX, key);
}

export function putOfflineBlob(key: string, val: unknown): Promise<boolean> {
  return putStoreItem(STORE_OFFLINE_BLOBS, key, val);
}

export function getOfflineBlob<T>(key: string): Promise<T | null> {
  return getStoreItem<T>(STORE_OFFLINE_BLOBS, key);
}

export function deleteOfflineBlob(key: string): Promise<boolean> {
  return deleteStoreItem(STORE_OFFLINE_BLOBS, key);
}
