import { QueryClient } from '@tanstack/react-query';

// Create a singleton query client for use outside of React components
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 30 seconds to reduce server load and data transfer
      staleTime: 30 * 1000,
      // Keep unused data in cache for 1 minute - shorter to save memory
      gcTime: 60 * 1000,
      // Refetch on window focus for better data sync across tabs
      refetchOnWindowFocus: false, // Disabled to save data on tab switch
      // Retry failed requests once
      retry: 1,
    },
  },
});
