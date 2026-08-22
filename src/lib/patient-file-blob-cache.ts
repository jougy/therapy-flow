type CachedFileEntry = {
  blob: Blob;
  contentType: string;
  expiresAt: number;
  filename: string;
  objectUrl: string | null;
};

// TTL padrão de 15 minutos para manter arquivos visualizados na memória da sessão
const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_CACHE_ENTRIES = 50;

class PatientFileBlobCacheManager {
  private cache = new Map<string, CachedFileEntry>();

  public set(
    uploadId: string,
    blob: Blob,
    filename: string,
    contentType: string,
    ttlMs: number = DEFAULT_CACHE_TTL_MS
  ): string {
    this.cleanExpired();

    // Se atingir o limite de entradas, remove a mais antiga (FIFO / LRU simplificado)
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.delete(oldestKey);
      }
    }

    const existing = this.cache.get(uploadId);
    if (existing?.objectUrl) {
      URL.revokeObjectURL(existing.objectUrl);
    }

    const objectUrl = URL.createObjectURL(blob);
    this.cache.set(uploadId, {
      blob,
      contentType,
      expiresAt: Date.now() + ttlMs,
      filename,
      objectUrl,
    });

    return objectUrl;
  }

  public get(uploadId: string): CachedFileEntry | null {
    const entry = this.cache.get(uploadId);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.delete(uploadId);
      return null;
    }

    return entry;
  }

  public getUrl(uploadId: string): string | null {
    const entry = this.get(uploadId);
    return entry ? entry.objectUrl : null;
  }

  public has(uploadId: string): boolean {
    return this.get(uploadId) !== null;
  }

  public delete(uploadId: string): void {
    const entry = this.cache.get(uploadId);
    if (entry?.objectUrl) {
      URL.revokeObjectURL(entry.objectUrl);
    }
    this.cache.delete(uploadId);
  }

  public clear(): void {
    this.cache.forEach((entry) => {
      if (entry.objectUrl) {
        URL.revokeObjectURL(entry.objectUrl);
      }
    });
    this.cache.clear();
  }

  public getStats() {
    this.cleanExpired();
    let totalBytes = 0;
    this.cache.forEach((entry) => {
      totalBytes += entry.blob.size;
    });

    return {
      entriesCount: this.cache.size,
      totalBytes,
    };
  }

  private cleanExpired(): void {
    const now = Date.now();
    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        if (entry.objectUrl) {
          URL.revokeObjectURL(entry.objectUrl);
        }
        this.cache.delete(key);
      }
    });
  }
}

export const patientFileBlobCache = new PatientFileBlobCacheManager();
