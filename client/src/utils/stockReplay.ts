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
  withdrawals?: Array<{ quantity_withdrawn: number; date_withdrawn: string; withdrawal_id?: number }>;
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
