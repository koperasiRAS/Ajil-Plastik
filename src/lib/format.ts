/**
 * Shared formatting utilities
 * Replaces duplicated formatRupiah across 8+ files
 */

/**
 * Format number to Indonesian Rupiah
 * @example formatRupiah(1000000) → "Rp 1.000.000"
 */
export function formatRupiah(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

/**
 * Format date to Indonesian locale
 * @example formatDate('2024-01-15') → "15 Jan 2024"
 */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('id-ID');
}

/**
 * Format date with time
 * @example formatDateTime('2024-01-15T10:30:00') → "15 Jan 2024, 10.30"
 */
export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('id-ID');
}

/**
 * Format date for input[type="date"]
 * @example formatDateForInput(new Date()) → "2024-01-15"
 */
export function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get payment method display label
 */
export function getPaymentLabel(method: string): string {
  switch (method) {
    case 'cash': return '💵 Cash';
    case 'qris': return '📱 QRIS';
    case 'transfer': return '🏦 Transfer';
    default: return method;
  }
}
