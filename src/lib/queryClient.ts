import { QueryClient } from '@tanstack/react-query';

// Create a singleton query client for use outside of React components
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 2 minutes — reduces unnecessary refetches
      staleTime: 2 * 60 * 1000,
      // Keep unused data in cache for 10 minutes — prevents reload when switching tabs
      gcTime: 10 * 60 * 1000,
      // Don't refetch on window focus — prevents extra loads when switching browser tabs
      refetchOnWindowFocus: false,
      // Retry failed requests once
      retry: 1,
    },
  },
});
