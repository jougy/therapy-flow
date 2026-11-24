/**
 * O(1) In-flight Request Coalescer.
 * Deduplicates concurrent async operations sharing the same key so only one network/IO call executes.
 */

const inFlightMap = new Map<string, Promise<unknown>>();

export function coalesceInFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlightMap.get(key) as Promise<T> | undefined;
  if (existing) {
    return existing;
  }

  let promise: Promise<T>;
  try {
    promise = Promise.resolve(fn()).finally(() => {
      if (inFlightMap.get(key) === promise) {
        inFlightMap.delete(key);
      }
    });
  } catch (err) {
    return Promise.reject(err);
  }

  inFlightMap.set(key, promise);
  return promise;
}

export function clearInFlightCoalescer(): void {
  inFlightMap.clear();
}
