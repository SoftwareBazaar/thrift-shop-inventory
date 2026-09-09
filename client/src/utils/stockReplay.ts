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
 * Units sitting at the hub that came from stall→hub returns and have not
 * yet been sent back out. Later distributions only consume this pool when
 * it is > 0; distributions funded by new additions are ignored.
 */
export function netStallReturnsAtHub(
  distributions: Array<{ quantity_allocated?: number; date_distributed?: string; distribution_id?: number }>,
  withdrawals: Array<{
    stall_id?: number | null;
    quantity_withdrawn?: number;
    date_withdrawn?: string;
    withdrawal_id?: number;
  }>
): number {
  type LedgerEvent = { ts: number; kind: 'return' | 'dist'; qty: number; sortId: number };
  const events: LedgerEvent[] = [];

  for (const w of withdrawals || []) {
    if (w.stall_id == null) continue;
    const ts = w.date_withdrawn ? new Date(w.date_withdrawn).getTime() : NaN;
    if (!Number.isFinite(ts)) continue;
    events.push({
      ts,
      kind: 'return',
      qty: Number(w.quantity_withdrawn) || 0,
      sortId: Number(w.withdrawal_id) || 0
    });
  }
  for (const d of distributions || []) {
    const ts = d.date_distributed ? new Date(d.date_distributed).getTime() : NaN;
    if (!Number.isFinite(ts)) continue;
    events.push({
      ts,
      kind: 'dist',
      qty: Number(d.quantity_allocated) || 0,
      sortId: Number(d.distribution_id) || 0
    });
  }

  events.sort((a, b) => {
    if (a.ts !== b.ts) return a.ts - b.ts;
    // Apply returns before same-second redistributes so a withdraw+redistribute
    // pair in one action still nets correctly.
    if (a.kind !== b.kind) return a.kind === 'return' ? -1 : 1;
    return a.sortId - b.sortId;
  });

  let atHub = 0;
  for (const e of events) {
    if (e.kind === 'return') {
      atHub += e.qty;
    } else if (atHub > 0) {
      atHub -= Math.min(atHub, e.qty);
    }
  }
  return Math.max(0, atHub);
}

export function summarizeStallReturnLedger(
  distributions: Array<{ quantity_allocated?: number; date_distributed?: string; distribution_id?: number }>,
  withdrawals: Array<{
    stall_id?: number | null;
    quantity_withdrawn?: number;
    date_withdrawn?: string;
    withdrawal_id?: number;
  }>
): { stallReturned: number; extraAllocatedAfterStallReturns: number; netAtHub: number } {
  const stallReturns = (withdrawals || []).filter((w) => w.stall_id != null);
  const stallReturned = stallReturns.reduce((sum, w) => sum + (Number(w.quantity_withdrawn) || 0), 0);
  const netAtHub = netStallReturnsAtHub(distributions, withdrawals);
  return {
    stallReturned,
    extraAllocatedAfterStallReturns: Math.max(0, stallReturned - netAtHub),
    netAtHub
  };
}

/**
 * Hub stock for the admin UI.
 *
 * algebraic = received − allocated − central sales − central withdrawals
 *   (stall→hub returns already raise this by shrinking allocated)
 *
 * netStallReturnsAtHub = FIFO pool of returns not yet redistributed
 *
 * Use max(algebraic, fifo) so:
 * - healthy surplus stays visible
 * - deficit holes do not swallow returns
 * - alg==0 after filling a hole still shows returns sitting at the hub
 */
export function computeCentralAvailable(input: {
  initialStock: number;
  added: number;
  allocated: number;
  centralSold: number;
  centralWithdrawn: number;
  stallReturned?: number;
  extraAllocatedAfterStallReturns?: number;
  netStallReturnsAtHub?: number;
}): number {
  const algebraic =
    (Number(input.initialStock) || 0) +
    (Number(input.added) || 0) -
    (Number(input.allocated) || 0) -
    (Number(input.centralSold) || 0) -
    (Number(input.centralWithdrawn) || 0);

  const fifo =
    input.netStallReturnsAtHub != null
      ? Math.max(0, Number(input.netStallReturnsAtHub) || 0)
      : Math.max(
          0,
          (Number(input.stallReturned) || 0) - (Number(input.extraAllocatedAfterStallReturns) || 0)
        );

  return Math.max(0, algebraic, fifo);
}
