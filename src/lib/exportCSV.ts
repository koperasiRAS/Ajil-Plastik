/**
 * CSV Export utilities
 * Replaces duplicated CSV export logic across 4 files
 */

/**
 * Export data to CSV file
 * @param headers - Array of column headers
 * @param rows - Array of row data (each row is array of cell values)
 * @param filename - Name of the file to download
 *
 * @example
 * exportToCSV(
 *   ['Nama', 'Harga', 'Stok'],
 *   [['Indomie', '3000', '50'], ['Kopi', '5000', '20']],
 *   'produk.csv'
 * )
 */
export function exportToCSV(
  headers: string[],
  rows: (string | number)[][],
  filename: string
): void {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Create CSV row from object
 * @param obj - Object with keys matching headers
 * @param headers - Array of keys to extract
 * @returns Array of values
 *
 * @example
 * const row = objectToCSVRow(product, ['name', 'price', 'stock'])
 * // ['Indomie Goreng', 3000, 50]
 */
export function objectToCSVRow<T extends Record<string, unknown>>(
  obj: T,
  headers: (keyof T)[]
): (string | number)[] {
  return headers.map(key => {
    const value = obj[key];
    if (value === null || value === undefined) return '';
    // Escape commas and quotes
    const strValue = String(value);
    if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
      return `"${strValue.replace(/"/g, '""')}"`;
    }
    return strValue;
  });
}
