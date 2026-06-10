/**
 * Labels for withdrawal history rows (central hub vs specific stall).
 */

export interface WithdrawalSourceRow {
  stall_id?: number | null;
  reason?: string | null;
  notes?: string | null;
  stalls?: { stall_name?: string | null } | null;
}

/** Where stock was withdrawn from (location). */
export function formatWithdrawalSource(row: WithdrawalSourceRow): string {
  if (row.stall_id == null || row.stall_id === undefined) {
    return 'Central Hub';
  }
  const name = row.stalls?.stall_name?.trim();
  return name ? name : `Stall #${row.stall_id}`;
}

/** Short explanation of what happened to the stock. */
export function formatWithdrawalEffect(row: WithdrawalSourceRow): string {
  if (row.stall_id == null || row.stall_id === undefined) {
    return 'Left central store (owner / personal use)';
  }
  const reason = (row.reason || '').toLowerCase();
  const notes = (row.notes || '').toLowerCase();
  if (reason.includes('central') || notes.includes('central')) {
    return 'Moved from stall back to central hub';
  }
  return 'Removed from stall stock';
}

/** CSS badge classes for source column. */
export function withdrawalSourceBadgeClass(row: WithdrawalSourceRow): string {
  if (row.stall_id == null || row.stall_id === undefined) {
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  }
  return 'bg-blue-100 text-blue-800 border-blue-200';
}
