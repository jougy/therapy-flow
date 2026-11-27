const STORAGE_PREFIX = "pluri.releaseNotes.seen:";

export interface LocalReleaseAckState {
  releaseId: string;
  versionOrder: number;
  dismissedAt: number;
  synced: boolean;
}

export function readLocalReleaseAck(userId: string): LocalReleaseAckState | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalReleaseAckState>;
    if (
      typeof parsed.releaseId === "string" &&
      typeof parsed.versionOrder === "number" &&
      Number.isFinite(parsed.versionOrder)
    ) {
      return {
        releaseId: parsed.releaseId,
        versionOrder: parsed.versionOrder,
        dismissedAt: typeof parsed.dismissedAt === "number" ? parsed.dismissedAt : Date.now(),
        synced: parsed.synced === true,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeLocalReleaseAck(
  userId: string,
  state: Omit<LocalReleaseAckState, "dismissedAt"> & { dismissedAt?: number }
): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    const payload: LocalReleaseAckState = {
      releaseId: state.releaseId,
      versionOrder: state.versionOrder,
      dismissedAt: state.dismissedAt ?? Date.now(),
      synced: state.synced,
    };
    window.localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(payload));
  } catch {
    // Graceful fallback se localStorage estiver indisponível
  }
}
