import { useSyncExternalStore } from "react";

export interface SyncStatusState {
  isOnline: boolean;
  pendingCount: number;
  failedCount: number;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  hydrationProgress: number;
  hydrationTotal: number;
  lastError: string | null;
}

let currentState: SyncStatusState = {
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  pendingCount: 0,
  failedCount: 0,
  isSyncing: false,
  lastSyncedAt: null,
  hydrationProgress: 0,
  hydrationTotal: 0,
  lastError: null,
};

const listeners = new Set<() => void>();

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function getSyncStatusSnapshot(): SyncStatusState {
  return currentState;
}

export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setSyncStatus(
  updater: Partial<SyncStatusState> | ((prev: SyncStatusState) => Partial<SyncStatusState>)
): void {
  const patch = typeof updater === "function" ? updater(currentState) : updater;
  const next: SyncStatusState = { ...currentState, ...patch };

  const hasChanged =
    next.isOnline !== currentState.isOnline ||
    next.pendingCount !== currentState.pendingCount ||
    next.failedCount !== currentState.failedCount ||
    next.isSyncing !== currentState.isSyncing ||
    next.lastSyncedAt !== currentState.lastSyncedAt ||
    next.hydrationProgress !== currentState.hydrationProgress ||
    next.hydrationTotal !== currentState.hydrationTotal ||
    next.lastError !== currentState.lastError;

  if (!hasChanged) return;

  currentState = next;
  emitChange();
}

export function useSyncStatus(): SyncStatusState {
  return useSyncExternalStore(
    subscribeSyncStatus,
    getSyncStatusSnapshot,
    getSyncStatusSnapshot
  );
}

let globalListenersRegistered = false;

export function initSyncStatusListeners(): void {
  if (globalListenersRegistered || typeof window === "undefined") return;
  globalListenersRegistered = true;

  window.addEventListener("online", () => {
    setSyncStatus({ isOnline: true, lastError: null });
  });

  window.addEventListener("offline", () => {
    setSyncStatus({ isOnline: false });
  });
}

initSyncStatusListeners();
