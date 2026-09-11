/**
 * Central-hub stock is a running ledger replayed in time order.
 *
 *   + stock addition
 *   + stall -> hub return   (stock_withdrawals with stall_id NOT NULL)
 *   - distribution to a stall
 *   - hub sale
 *   - hub withdrawal        (stock_withdrawals with stall_id NULL)
 *
 * Deductions are floored at 0 at the moment they happen, so a historical
 * over-withdrawal is absorbed on the day it occurred instead of leaving a
 * deficit that silently swallows later additions.
 */

export interface AdditionRow {
  quantity_added?: number | null;
  date_added?: string | null;
  addition_id?: number | null;
}

export interface DistributionRow {
  distribution_id?: number | null;
  stall_id?: number | null;
  quantity_allocated?: number | null;
  date_distributed?: string | null;
}

export interface WithdrawalRow {
  withdrawal_id?: number | null;
  stall_id?: number | null;
  distribution_id?: number | null;
  quantity_withdrawn?: number | null;
  date_withdrawn?: string | null;
}

export interface CentralSaleRow {
  quantity_sold?: number | null;
  date_time?: string | null;
  sale_id?: number | null;
}

type LedgerKind = 'add' | 'return' | 'sale' | 'withdraw' | 'dist';

// Credits land before debits in the same second so a withdraw-then-redistribute
// pair performed in one action nets correctly.
const KIND_ORDER: Record<LedgerKind, number> = {
  add: 1,
  return: 2,
  sale: 3,
  withdraw: 4,
  dist: 5
};

const num = (value: unknown): number => Number(value) || 0;

const time = (value?: string | null): number => {
  if (!value) return NaN;
  return new Date(value).getTime();
};

/**
 * A stall return shrinks its distribution row in place, so the row no longer
 * says how much actually left the hub that day. Rebuild the original amount by
 * adding each return back onto the row it came from; returns with no linked row
 * (older history) go to that stall's earliest batch that predates the return.
 */
function originalAllocations(
  distributions: DistributionRow[],
  stallReturns: WithdrawalRow[]
): Map<number, number> {
  const original = new Map<number, number>();
  distributions.forEach((d, index) => {
    const key = d.distribution_id != null ? Number(d.distribution_id) : -(index + 1);
    original.set(key, num(d.quantity_allocated));
  });

  const unlinked: WithdrawalRow[] = [];
  for (const w of stallReturns) {
    const key = w.distribution_id != null ? Number(w.distribution_id) : null;
    if (key != null && original.has(key)) {
      original.set(key, (original.get(key) || 0) + num(w.quantity_withdrawn));
    } else {
      unlinked.push(w);
    }
  }

  for (const w of unlinked) {
    const returnedAt = time(w.date_withdrawn);
    const candidate = distributions
      .filter(
        (d) =>
          d.distribution_id != null &&
          Number(d.stall_id) === Number(w.stall_id) &&
          time(d.date_distributed) <= returnedAt
      )
      .sort((a, b) => time(a.date_distributed) - time(b.date_distributed))[0];
    if (!candidate) continue;
    const key = Number(candidate.distribution_id);
    original.set(key, (original.get(key) || 0) + num(w.quantity_withdrawn));
  }

  return original;
}

export function computeHubStock(input: {
  initialStock?: number | null;
  additions?: AdditionRow[];
  distributions?: DistributionRow[];
  withdrawals?: WithdrawalRow[];
  centralSales?: CentralSaleRow[];
}): number {
  const additions = input.additions || [];
  const distributions = input.distributions || [];
  const withdrawals = input.withdrawals || [];
  const centralSales = input.centralSales || [];

  const stallReturns = withdrawals.filter((w) => w.stall_id != null);
  const hubWithdrawals = withdrawals.filter((w) => w.stall_id == null);
  const original = originalAllocations(distributions, stallReturns);

  const events: Array<{ ts: number; kind: LedgerKind; qty: number; sortId: number }> = [];
  const push = (ts: number, kind: LedgerKind, qty: number, sortId: unknown) => {
    if (!Number.isFinite(ts)) return;
    events.push({ ts, kind, qty, sortId: num(sortId) });
  };

  for (const a of additions) {
    push(time(a.date_added), 'add', num(a.quantity_added), a.addition_id);
  }
  for (const w of stallReturns) {
    push(time(w.date_withdrawn), 'return', num(w.quantity_withdrawn), w.withdrawal_id);
  }
  for (const w of hubWithdrawals) {
    push(time(w.date_withdrawn), 'withdraw', num(w.quantity_withdrawn), w.withdrawal_id);
  }
  for (const s of centralSales) {
    push(time(s.date_time), 'sale', num(s.quantity_sold), s.sale_id);
  }
  distributions.forEach((d, index) => {
    const key = d.distribution_id != null ? Number(d.distribution_id) : -(index + 1);
    push(time(d.date_distributed), 'dist', original.get(key) ?? num(d.quantity_allocated), d.distribution_id);
  });

  events.sort((a, b) => {
    if (a.ts !== b.ts) return a.ts - b.ts;
    const kindDiff = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (kindDiff !== 0) return kindDiff;
    return a.sortId - b.sortId;
  });

  let hub = num(input.initialStock);
  for (const e of events) {
    hub = e.kind === 'add' || e.kind === 'return' ? hub + e.qty : Math.max(0, hub - e.qty);
  }
  return Math.max(0, hub);
}

/**
 * Units that came back from stalls and have not been sent out again.
 * Display-only; the hub balance comes from computeHubStock.
 */
export function summarizeStallReturnLedger(
  distributions: DistributionRow[],
  withdrawals: WithdrawalRow[]
): { stallReturned: number; netAtHub: number } {
  const stallReturns = (withdrawals || []).filter((w) => w.stall_id != null);
  const stallReturned = stallReturns.reduce((sum, w) => sum + num(w.quantity_withdrawn), 0);

  const events: Array<{ ts: number; kind: 'return' | 'dist'; qty: number }> = [];
  for (const w of stallReturns) {
    const ts = time(w.date_withdrawn);
    if (Number.isFinite(ts)) events.push({ ts, kind: 'return', qty: num(w.quantity_withdrawn) });
  }
  for (const d of distributions || []) {
    const ts = time(d.date_distributed);
    if (Number.isFinite(ts)) events.push({ ts, kind: 'dist', qty: num(d.quantity_allocated) });
  }
  events.sort((a, b) => (a.ts !== b.ts ? a.ts - b.ts : a.kind === 'return' ? -1 : 1));

  let netAtHub = 0;
  for (const e of events) {
    if (e.kind === 'return') netAtHub += e.qty;
    else if (netAtHub > 0) netAtHub -= Math.min(netAtHub, e.qty);
  }

  return { stallReturned, netAtHub: Math.max(0, netAtHub) };
}
