/**
 * Opening / change / closing cells for stock history (Opening → Δ → Closing).
 * Null means the row was recorded before we started storing balances.
 */

export function formatStockBalance(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return String(Number(value));
}
