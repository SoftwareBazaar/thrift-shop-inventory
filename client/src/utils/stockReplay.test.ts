import { computeHubStock } from './stockReplay';

const at = (day: number, hour = 12) =>
  new Date(Date.UTC(2026, 0, day, hour, 0, 0)).toISOString();

describe('computeHubStock', () => {
  it('runs a plain add / distribute / sell cycle', () => {
    const hub = computeHubStock({
      initialStock: 0,
      additions: [{ addition_id: 1, quantity_added: 100, date_added: at(1) }],
      distributions: [
        { distribution_id: 1, stall_id: 1, quantity_allocated: 60, date_distributed: at(2) }
      ],
      centralSales: [{ sale_id: 1, quantity_sold: 10, date_time: at(3) }],
      withdrawals: []
    });
    expect(hub).toBe(30);
  });

  // Usual Jeans, 01 Sep: 18 units came back from a stall at 20:33 and the owner
  // withdrew them at 20:34. The hub kept showing 18 as available to distribute.
  it('does not keep showing stall returns that were later withdrawn from the hub', () => {
    const scenario = {
      initialStock: 0,
      additions: [{ addition_id: 1, quantity_added: 20, date_added: at(1) }],
      distributions: [
        // Shrunk in place from 20 to 2 when the 18 were returned.
        { distribution_id: 1, stall_id: 1, quantity_allocated: 2, date_distributed: at(2) }
      ],
      centralSales: []
    };

    const returnOnly = computeHubStock({
      ...scenario,
      withdrawals: [
        { withdrawal_id: 1, stall_id: 1, distribution_id: 1, quantity_withdrawn: 18, date_withdrawn: at(3) }
      ]
    });
    expect(returnOnly).toBe(18);

    const returnThenOwnerWithdrawal = computeHubStock({
      ...scenario,
      withdrawals: [
        { withdrawal_id: 1, stall_id: 1, distribution_id: 1, quantity_withdrawn: 18, date_withdrawn: at(3) },
        { withdrawal_id: 2, stall_id: null, quantity_withdrawn: 18, date_withdrawn: at(3, 13) }
      ]
    });
    expect(returnThenOwnerWithdrawal).toBe(0);
  });

  // Baggy jeans: the item was 41 units underwater, so a 50-unit addition used
  // to disappear into the hole instead of raising the hub.
  it('credits a new addition in full even when history is in deficit', () => {
    const history = {
      initialStock: 0,
      additions: [{ addition_id: 1, quantity_added: 10, date_added: at(1) }],
      distributions: [
        { distribution_id: 1, stall_id: 1, quantity_allocated: 10, date_distributed: at(2) }
      ],
      withdrawals: [
        { withdrawal_id: 1, stall_id: null, quantity_withdrawn: 41, date_withdrawn: at(3) }
      ],
      centralSales: []
    };

    expect(computeHubStock(history)).toBe(0);
    expect(
      computeHubStock({
        ...history,
        additions: [
          ...history.additions,
          { addition_id: 2, quantity_added: 50, date_added: at(4) }
        ]
      })
    ).toBe(50);
  });

  it('nets a withdraw and a redistribute recorded in the same second', () => {
    const hub = computeHubStock({
      initialStock: 0,
      additions: [{ addition_id: 1, quantity_added: 10, date_added: at(1) }],
      distributions: [
        { distribution_id: 1, stall_id: 1, quantity_allocated: 5, date_distributed: at(2) },
        { distribution_id: 2, stall_id: 2, quantity_allocated: 5, date_distributed: at(3) }
      ],
      withdrawals: [
        { withdrawal_id: 1, stall_id: 1, distribution_id: 1, quantity_withdrawn: 5, date_withdrawn: at(3) }
      ],
      centralSales: []
    });
    expect(hub).toBe(0);
  });

  // Older rows recorded the return without linking it to a distribution.
  it('handles a stall return that is not linked to a distribution row', () => {
    const hub = computeHubStock({
      initialStock: 0,
      additions: [{ addition_id: 1, quantity_added: 10, date_added: at(1) }],
      distributions: [
        { distribution_id: 1, stall_id: 1, quantity_allocated: 5, date_distributed: at(2) },
        { distribution_id: 2, stall_id: 2, quantity_allocated: 5, date_distributed: at(3) }
      ],
      withdrawals: [
        { withdrawal_id: 1, stall_id: 1, distribution_id: null, quantity_withdrawn: 5, date_withdrawn: at(3) }
      ],
      centralSales: []
    });
    expect(hub).toBe(0);
  });

  it('never reports a negative hub', () => {
    const hub = computeHubStock({
      initialStock: 5,
      additions: [],
      distributions: [
        { distribution_id: 1, stall_id: 1, quantity_allocated: 99, date_distributed: at(2) }
      ],
      withdrawals: [{ withdrawal_id: 1, stall_id: null, quantity_withdrawn: 99, date_withdrawn: at(3) }],
      centralSales: [{ sale_id: 1, quantity_sold: 99, date_time: at(4) }]
    });
    expect(hub).toBe(0);
  });

  it('ignores rows with unusable dates instead of producing NaN', () => {
    const hub = computeHubStock({
      initialStock: 10,
      additions: [{ addition_id: 1, quantity_added: 5, date_added: null }],
      distributions: [
        { distribution_id: 1, stall_id: 1, quantity_allocated: 3, date_distributed: 'not-a-date' }
      ],
      withdrawals: [],
      centralSales: []
    });
    expect(hub).toBe(10);
  });

  // The bug class the client kept hitting: stock added must always show up at
  // the hub, whatever shape the item's history is in.
  it('always raises the hub by exactly the amount added', () => {
    const shapes = [
      { initial: 0, added: 10, allocated: 10, hubWithdrawn: 41, stallReturn: 0 },
      { initial: 76, added: 240, allocated: 295, hubWithdrawn: 20, stallReturn: 19 },
      { initial: 3, added: 343, allocated: 290, hubWithdrawn: 97, stallReturn: 39 },
      { initial: 0, added: 0, allocated: 0, hubWithdrawn: 0, stallReturn: 0 }
    ];

    for (const shape of shapes) {
      const history = {
        initialStock: shape.initial,
        additions: [{ addition_id: 1, quantity_added: shape.added, date_added: at(1) }],
        distributions: [
          { distribution_id: 1, stall_id: 1, quantity_allocated: shape.allocated, date_distributed: at(2) }
        ],
        withdrawals: [
          { withdrawal_id: 1, stall_id: null, quantity_withdrawn: shape.hubWithdrawn, date_withdrawn: at(3) },
          { withdrawal_id: 2, stall_id: 1, distribution_id: 1, quantity_withdrawn: shape.stallReturn, date_withdrawn: at(4) }
        ],
        centralSales: []
      };

      const before = computeHubStock(history);
      const after = computeHubStock({
        ...history,
        additions: [...history.additions, { addition_id: 2, quantity_added: 50, date_added: at(5) }]
      });
      expect(after - before).toBe(50);
    }
  });
});
