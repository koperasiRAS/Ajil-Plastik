'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import { broadcastCacheReset } from '@/hooks/useCrossTabSync';

interface MidnightResetOptions {
  enabled?: boolean;
  onReset?: () => void;
}

/**
 * Hook that automatically closes all open shifts at midnight (00:00 WIB)
 * and resets the dashboard data for a new day.
 * Works for all stores/branches.
 */
export function useMidnightReset(options: MidnightResetOptions = {}) {
  const { enabled = true, onReset } = options;
  const [lastResetDate, setLastResetDate] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const resetExecutedRef = useRef(false);
  const onResetRef = useRef(onReset);

  // Update ref when onReset changes
  useEffect(() => {
    onResetRef.current = onReset;
  }, [onReset]);

  // Get current date in WIB (UTC+7)
  const getWIBDate = () => {
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000; // UTC+7
    const wibNow = new Date(now.getTime() + wibOffset);
    return wibNow.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  // Close all open shifts for all stores
  const closeAllShifts = useCallback(async () => {
    if (isResetting) return;

    setIsResetting(true);
    try {
      // Get all open shifts
      const { data: openShifts, error: fetchError } = await supabase
        .from('shifts')
        .select('*')
        .eq('status', 'open');

      if (fetchError) {
        console.error('Error fetching open shifts:', fetchError);
        setIsResetting(false);
        return;
      }

      if (!openShifts || openShifts.length === 0) {
        console.log('No open shifts to close');
        setIsResetting(false);
        return;
      }

      console.log(`Found ${openShifts.length} open shifts to close`);

      // Close each shift with current time
      const closingTime = new Date().toISOString();

      for (const shift of openShifts) {
        // Calculate expected closing cash: opening_cash + cash sales from transactions
        let closingCash = Number(shift.opening_cash) || 0;

        // Get today's cash transactions for this shift
        const today = new Date();
        const wibOffset = 7 * 60 * 60 * 1000;
        const wibToday = new Date(today.getTime() + wibOffset);

        // Start of today in UTC (midnight UTC = 07:00 WIB)
        const todayStart = new Date(Date.UTC(
          wibToday.getUTCFullYear(),
          wibToday.getUTCMonth(),
          wibToday.getUTCDate(),
          0, 0, 0, 0
        )).toISOString();

        const { data: transactions } = await supabase
          .from('transactions')
          .select('total')
          .eq('shift_id', shift.id)
          .eq('payment_method', 'cash')
          .gte('created_at', todayStart);

        if (transactions) {
          const cashSales = transactions.reduce((sum, t) => sum + Number(t.total), 0);
          closingCash += cashSales;
        }

        // Update shift to closed
        const { error: updateError } = await supabase
          .from('shifts')
          .update({
            closing_cash: closingCash,
            closed_at: closingTime,
            status: 'closed'
          })
          .eq('id', shift.id);

        if (updateError) {
          console.error(`Error closing shift ${shift.id}:`, updateError);
        } else {
          console.log(`Shift ${shift.id} closed with cash: ${closingCash}`);
        }
      }

      // Clear all cached data and broadcast reset
      queryClient.clear();
      broadcastCacheReset();

      // Call the onReset callback if provided (using ref to avoid dependency issues)
      if (onResetRef.current) {
        onResetRef.current();
      }

      console.log('Midnight reset completed');
    } catch (err) {
      console.error('Error in midnight reset:', err);
    } finally {
      setIsResetting(false);
    }
  }, [isResetting]);

  useEffect(() => {
    if (!enabled) return;

    const currentDate = getWIBDate();
    setLastResetDate(currentDate);

    // Check every minute if the date has changed (midnight in WIB)
    const checkInterval = setInterval(() => {
      const now = getWIBDate();

      // If date changed (new day), trigger reset
      if (now !== lastResetDate && !resetExecutedRef.current) {
        console.log('Date changed, executing midnight reset...');
        resetExecutedRef.current = true;
        closeAllShifts();
        setLastResetDate(now);

        // Reset the flag after 2 minutes to allow next day's reset
        setTimeout(() => {
          resetExecutedRef.current = false;
        }, 120000);
      }
    }, 60000); // Check every minute

    return () => {
      clearInterval(checkInterval);
    };
  }, [enabled, lastResetDate, closeAllShifts]);

  return {
    isResetting,
    lastResetDate,
    triggerReset: closeAllShifts
  };
}