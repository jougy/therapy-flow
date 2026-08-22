import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    testTimeout: 15000,
    hookTimeout: 15000,
    env: {
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.mock-key",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
