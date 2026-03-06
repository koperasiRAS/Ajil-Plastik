'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UseBarcodeScanner {
  onScan: (barcode: string) => void;
  enabled?: boolean;
}

export function useBarcodeScanner({ onScan, enabled = true }: UseBarcodeScanner) {
  const bufferRef = useRef('');
  const lastScanRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore if focus is on an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const barcode = bufferRef.current.trim();

        if (barcode.length > 0) {
          const now = Date.now();
          // 400ms cooldown for duplicate scans
          if (now - lastScanRef.current > 400) {
            lastScanRef.current = now;
            onScan(barcode);
          }
        }

        bufferRef.current = '';
        if (timerRef.current) clearTimeout(timerRef.current);
        return;
      }

      // Only collect printable characters
      if (e.key.length === 1) {
        bufferRef.current += e.key;

        // Auto-clear buffer after 100ms of no input (not a scanner)
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          bufferRef.current = '';
        }, 100);
      }
    },
    [onScan, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [handleKeyDown, enabled]);
}
