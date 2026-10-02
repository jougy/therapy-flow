import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
};

if (typeof window !== "undefined") {
  if (!window.localStorage || typeof window.localStorage.clear !== "function") {
    Object.defineProperty(window, "localStorage", {
      value: createStorageMock(),
      writable: true,
      configurable: true,
    });
  }
  if (!window.sessionStorage || typeof window.sessionStorage.clear !== "function") {
    Object.defineProperty(window, "sessionStorage", {
      value: createStorageMock(),
      writable: true,
      configurable: true,
    });
  }
}

if (!globalThis.fetch || typeof globalThis.fetch !== "function") {
  globalThis.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
  );
}

