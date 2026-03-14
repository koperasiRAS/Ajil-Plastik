import { QueryClient } from '@tanstack/react-query';

// Create a singleton query client for use outside of React components
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 5 seconds (reduced from 30s for better real-time)
      staleTime: 5 * 1000,
      // Keep unused data in cache for 2 minutes
      gcTime: 2 * 60 * 1000,
      // Refetch on window focus for better data sync across tabs
      refetchOnWindowFocus: true,
      // Retry failed requests once
      retry: 1,
    },
  },
});
