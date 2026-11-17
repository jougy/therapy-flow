import { QueryClient } from "@tanstack/react-query";
import { isTransientSupabaseError } from "@/lib/supabase-resilience";

export const appQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false;
        return isTransientSupabaseError(error);
      },
      retryDelay: (attemptIndex) => Math.min(400 * Math.pow(3, attemptIndex), 5000) + Math.floor(Math.random() * 150),
    },
  },
});
