'use client';

import { useEffect } from 'react';
import { queryClient } from '@/lib/queryClient';

// Event types for cross-tab communication
type CacheEventType = 'invalidate' | 'reset';

interface CacheEvent {
  type: CacheEventType;
  queryKey?: string[];
}

// Listen for cache invalidation events from other tabs
export function useCrossTabSync() {
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      // Only handle our custom events
      if (event.key !== 'pos-cache-event') return;

      try {
        const data: CacheEvent = JSON.parse(event.newValue || '{}');

        if (data.type === 'invalidate' && data.queryKey) {
          console.log('[CrossTab] Invalidating query:', data.queryKey);
          queryClient.invalidateQueries({ queryKey: data.queryKey });
        } else if (data.type === 'reset') {
          console.log('[CrossTab] Resetting all queries');
          queryClient.clear();
        }
      } catch (err) {
        console.error('[CrossTab] Failed to parse event:', err);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
}

// Broadcast cache invalidation to other tabs
export function broadcastCacheInvalidation(queryKey: string[]) {
  if (typeof window === 'undefined') return;

  const event: CacheEvent = {
    type: 'invalidate',
    queryKey,
  };

  // Set the item to trigger storage event in other tabs
  // Use a unique value to ensure the event fires
  const uniqueValue = `${Date.now()}-${Math.random()}`;
  localStorage.setItem('pos-cache-event', JSON.stringify(event));
  localStorage.setItem('pos-cache-trigger', uniqueValue);
}

// Broadcast full cache reset to other tabs
export function broadcastCacheReset() {
  if (typeof window === 'undefined') return;

  const event: CacheEvent = {
    type: 'reset',
  };

  localStorage.setItem('pos-cache-event', JSON.stringify(event));
  localStorage.setItem('pos-cache-trigger', `${Date.now()}-${Math.random()}`);
}
