import { getLocalCacheItem, setLocalCacheItem } from "@/lib/indexed-db-persister";

const RECONCILIATION_MAP_CACHE_KEY = "offline_id_reconciliation_map";
const RECONCILIATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const tempToServerIdMap = new Map<string, string>();
let reconciliationLoaded = false;

export async function ensureReconciliationLoaded(): Promise<void> {
  if (reconciliationLoaded) return;
  const cached = await getLocalCacheItem<Record<string, string>>(RECONCILIATION_MAP_CACHE_KEY);
  if (cached && typeof cached === "object") {
    for (const [tempId, serverId] of Object.entries(cached)) {
      tempToServerIdMap.set(tempId, serverId);
    }
  }
  reconciliationLoaded = true;
}

export function resolveOfflineEntityId(id: string): string {
  let current = id;
  const visited = new Set<string>();
  while (tempToServerIdMap.has(current) && !visited.has(current)) {
    visited.add(current);
    const mapped = tempToServerIdMap.get(current);
    if (!mapped) break;
    current = mapped;
  }
  return current;
}

export async function registerReconciledId(tempId: string, serverId: string): Promise<void> {
  if (!tempId || !serverId || tempId === serverId) return;
  await ensureReconciliationLoaded();
  tempToServerIdMap.set(tempId, serverId);
  await setLocalCacheItem(
    RECONCILIATION_MAP_CACHE_KEY,
    Object.fromEntries(tempToServerIdMap.entries()),
    RECONCILIATION_TTL_MS
  );
}

export function getReconciledIdMap(): Record<string, string> {
  return Object.fromEntries(tempToServerIdMap.entries());
}
