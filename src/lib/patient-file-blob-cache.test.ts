import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { patientFileBlobCache } from "./patient-file-blob-cache";

describe("patientFileBlobCache", () => {
  beforeEach(() => {
    patientFileBlobCache.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores and retrieves a blob entry", () => {
    const blob = new Blob(["hello world"], { type: "text/plain" });
    const url = patientFileBlobCache.set("upload-1", blob, "test.txt", "text/plain");

    expect(url).toBeDefined();
    expect(patientFileBlobCache.has("upload-1")).toBe(true);

    const entry = patientFileBlobCache.get("upload-1");
    expect(entry).not.toBeNull();
    expect(entry?.filename).toBe("test.txt");
    expect(entry?.contentType).toBe("text/plain");
    expect(patientFileBlobCache.getUrl("upload-1")).toBe(url);
  });

  it("expires entries after the TTL", () => {
    const blob = new Blob(["data"], { type: "image/png" });
    patientFileBlobCache.set("upload-2", blob, "image.png", "image/png", 5000);

    expect(patientFileBlobCache.has("upload-2")).toBe(true);

    // Avança o tempo além do TTL
    vi.advanceTimersByTime(6000);

    expect(patientFileBlobCache.has("upload-2")).toBe(false);
    expect(patientFileBlobCache.get("upload-2")).toBeNull();
    expect(patientFileBlobCache.getUrl("upload-2")).toBeNull();
  });

  it("deletes entries and clears cache", () => {
    const blob1 = new Blob(["1"], { type: "text/plain" });
    const blob2 = new Blob(["2"], { type: "text/plain" });

    patientFileBlobCache.set("u1", blob1, "f1.txt", "text/plain");
    patientFileBlobCache.set("u2", blob2, "f2.txt", "text/plain");

    expect(patientFileBlobCache.getStats().entriesCount).toBe(2);

    patientFileBlobCache.delete("u1");
    expect(patientFileBlobCache.has("u1")).toBe(false);
    expect(patientFileBlobCache.has("u2")).toBe(true);

    patientFileBlobCache.clear();
    expect(patientFileBlobCache.getStats().entriesCount).toBe(0);
  });
});
