"use client";

/**
 * React Query Provider
 *
 * Configures TanStack Query for client-side data fetching and caching.
 * Optimized for SSR/Hydration in React 19.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

interface QueryProviderProps {
  children: React.ReactNode;
}

/**
 * Create a query client with sensible defaults
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: 2,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: 1,
      },
    },
  });
}

// 2026 Mastermind Singleton Pattern
let browserQueryClient: QueryClient | undefined;

function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    // Server: always create a new client for every request
    return makeQueryClient();
  }

  // Browser: reuse client across the entire session
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

/**
 * Query Provider Component
 */
export function QueryProvider({ children }: QueryProviderProps): React.JSX.Element {
  // 2026 Edition: In React 19, we keep the initialization lazy but stable
  const queryClient = getQueryClient();

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
