/**
 * Date utilities
 * Replaces duplicated date handling across multiple files
 */

/**
 * Get current month in YYYY-MM format
 * @example getCurrentMonth() → "2024-01"
 */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get today's date in YYYY-MM-DD format
 * @example getTodayDate() → "2024-01-15"
 */
export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get date range for today in UTC (for Supabase queries)
 * Returns start of today in UTC (which is 17:00 UTC previous day for WIB)
 */
export function getTodayUTC(): { start: string; dateStr: string } {
  const now = new Date();
  const wibOffset = 7 * 60; // UTC+7 in minutes
  const wibNow = new Date(now.getTime() + wibOffset * 60 * 1000);

  const wibMidnight = new Date(Date.UTC(
    wibNow.getUTCFullYear(),
    wibNow.getUTCMonth(),
    wibNow.getUTCDate(),
    0, 0, 0, 0
  ));

  const todayStartUTC = new Date(wibMidnight.getTime() - wibOffset * 60 * 1000);
  const todayDateWIB = `${wibNow.getUTCFullYear()}-${String(wibNow.getUTCMonth() + 1).padStart(2, '0')}-${String(wibNow.getUTCDate()).padStart(2, '0')}`;

  return {
    start: todayStartUTC.toISOString(),
    dateStr: todayDateWIB
  };
}

/**
 * Get date N days ago in UTC
 */
export function getDaysAgoUTC(days: number): string {
  const { start } = getTodayUTC();
  const date = new Date(new Date(start).getTime() - days * 24 * 60 * 60 * 1000);
  return date.toISOString();
}

/**
 * Parse month string (YYYY-MM) for display
 * @example formatMonth('2024-01') → "Januari 2024"
 */
export function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const monthIndex = parseInt(month, 10) - 1;
  return `${monthNames[monthIndex]} ${year}`;
}

/**
 * Set end of day for date filter
 * @example setEndOfDay('2024-01-15') → Date with time 23:59:59
 */
export function setEndOfDay(dateStr: string): Date {
  const date = new Date(dateStr);
  date.setHours(23, 59, 59);
  return date;
}
