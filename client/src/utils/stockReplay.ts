/**
 * Central-hub stock is computed by replaying history in time order.
 * Deductions (distribute / withdraw / central sale) never drive balance below 0,
 * so historical over-withdrawals stay in the audit log but do not create a
 * "deficit hole" that absorbs future stock additions.
 *
 * Additions always increase the running balance.
 */

export type StockEventKind = 'add' | 'sale' | 'withdraw' | 'dist';

export interface StockEvent {
  ts: number;
  kind: StockEventKind;
  qty: number;
  sortId?: number;
}

const KIND_ORDER: Record<StockEventKind, number> = {
  add: 1,
  sale: 2,
  withdraw: 3,
  dist: 4
};

export function computeCentralStockReplay(initialStock: number, events: StockEvent[]): number {
  const sorted = [...events].sort((a, b) => {
    if (a.ts !== b.ts) return a.ts - b.ts;
    const kindDiff = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (kindDiff !== 0) return kindDiff;
    return (a.sortId ?? 0) - (b.sortId ?? 0);
  });

  let central = Number(initialStock) || 0;
  for (const e of sorted) {
    const qty = Number(e.qty) || 0;
    if (e.kind === 'add') {
      central += qty;
    } else {
      central = Math.max(0, central - qty);
    }
  }
  return central;
}

export function buildStockEventsFromHistory(input: {
  additions?: Array<{ quantity_added: number; date_added: string; addition_id?: number }>;
  distributions?: Array<{ quantity_allocated: number; date_distributed: string; distribution_id?: number }>;
  withdrawals?: Array<{
    quantity_withdrawn: number;
    date_withdrawn: string;
    withdrawal_id?: number;
    stall_id?: number | null;
  }>;
  centralSales?: Array<{ quantity_sold: number; date_time: string; sale_id?: number }>;
}): StockEvent[] {
  const events: StockEvent[] = [];

  for (const row of input.additions || []) {
    events.push({
      ts: new Date(row.date_added).getTime(),
      kind: 'add',
      qty: row.quantity_added,
      sortId: row.addition_id
    });
  }
  for (const row of input.distributions || []) {
    events.push({
      ts: new Date(row.date_distributed).getTime(),
      kind: 'dist',
      qty: row.quantity_allocated,
      sortId: row.distribution_id
    });
  }
  for (const row of input.withdrawals || []) {
    // Stall returns (stall_id IS NOT NULL) are audit-only in the central replay.
    // Their effect on central stock comes from the distribution row being
    // reduced or deleted — NOT from adding the qty back here.
    // Only central-hub withdrawals (stall_id IS NULL) reduce central stock.
    if (row.stall_id != null) continue;
    events.push({
      ts: new Date(row.date_withdrawn).getTime(),
      kind: 'withdraw',
      qty: row.quantity_withdrawn,
      sortId: row.withdrawal_id
    });
  }
  for (const row of input.centralSales || []) {
    events.push({
      ts: new Date(row.date_time).getTime(),
      kind: 'sale',
      qty: row.quantity_sold,
      sortId: row.sale_id
    });
  }

  return events;
}

/**
 * Hub stock for the admin UI.
 * When history is consistent, this is the usual identity:
 *   received − currently allocated − central sales − central withdrawals
 * Stall→hub returns are already reflected as a smaller allocation, so they
 * must not be added again.
 *
 * When that identity is negative (legacy over-allocation), replay stays
 * floored at 0 and stall returns would vanish. In that case show the
 * stall-return total so units brought back to the hub remain visible.
 */
export function summarizeStallReturnLedger(
  distributions: Array<{ quantity_allocated?: number; date_distributed?: string }>,
  withdrawals: Array<{ stall_id?: number | null; quantity_withdrawn?: number; date_withdrawn?: string }>
): { stallReturned: number; extraAllocatedAfterStallReturns: number } {
  const stallReturns = (withdrawals || []).filter((w) => w.stall_id != null);
  const stallReturned = stallReturns.reduce((sum, w) => sum + (Number(w.quantity_withdrawn) || 0), 0);
  const lastReturnTs = stallReturns.reduce((max, w) => {
    const ts = w.date_withdrawn ? new Date(w.date_withdrawn).getTime() : 0;
    return Number.isFinite(ts) ? Math.max(max, ts) : max;
  }, 0);
  const extraAllocatedAfterStallReturns = lastReturnTs
    ? (distributions || [])
        .filter((d) => d.date_distributed && new Date(d.date_distributed).getTime() > lastReturnTs)
        .reduce((sum, d) => sum + (Number(d.quantity_allocated) || 0), 0)
    : 0;
  return { stallReturned, extraAllocatedAfterStallReturns };
}

export function computeCentralAvailable(input: {
  initialStock: number;
  added: number;
  allocated: number;
  centralSold: number;
  centralWithdrawn: number;
  stallReturned: number;
  extraAllocatedAfterStallReturns?: number;
}): number {
  const algebraic =
    (Number(input.initialStock) || 0) +
    (Number(input.added) || 0) -
    (Number(input.allocated) || 0) -
    (Number(input.centralSold) || 0) -
    (Number(input.centralWithdrawn) || 0);
  if (algebraic >= 0) return algebraic;
  return Math.max(
    0,
    (Number(input.stallReturned) || 0) - (Number(input.extraAllocatedAfterStallReturns) || 0)
  );
}
