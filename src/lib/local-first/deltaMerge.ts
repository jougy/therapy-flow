/**
 * O(N + M) Delta Merge utility by record ID.
 * Avoids quadratic nested `.some()` scans, discards soft-deleted items (`deleted_at`),
 * and keeps the record with the newest `updated_at` timestamp.
 */

export interface DeltaMergeRecord {
  id: string;
  updated_at?: string | null;
  deleted_at?: string | null;
}

function getRecordTimestampMs(item: DeltaMergeRecord): number {
  const raw = item.updated_at ?? item.deleted_at;
  if (!raw) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

export function deltaMergeById<T extends DeltaMergeRecord>(
  existing: T[],
  delta: T[],
  sortFn?: (a: T, b: T) => number
): T[] {
  const mergedMap = new Map<string, T>();

  for (const item of existing) {
    mergedMap.set(item.id, item);
  }

  for (const incoming of delta) {
    const current = mergedMap.get(incoming.id);
    if (!current) {
      mergedMap.set(incoming.id, incoming);
      continue;
    }

    const currentTs = getRecordTimestampMs(current);
    const incomingTs = getRecordTimestampMs(incoming);

    if (
      incomingTs === Number.NEGATIVE_INFINITY &&
      currentTs === Number.NEGATIVE_INFINITY
    ) {
      mergedMap.set(incoming.id, incoming);
    } else if (incomingTs >= currentTs) {
      mergedMap.set(incoming.id, incoming);
    }
  }

  const result: T[] = [];
  for (const item of mergedMap.values()) {
    if (!item.deleted_at) {
      result.push(item);
    }
  }

  if (sortFn) {
    result.sort(sortFn);
  }

  return result;
}
