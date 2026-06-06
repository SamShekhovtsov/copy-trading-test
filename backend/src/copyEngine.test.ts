import { describe, expect, it } from 'vitest';
import { applySlippage, buildCopiedOrder, roundDownToStep, summarizeOrders } from './copyEngine.js';
import { FollowerAccount, LeaderTrade } from './types.js';

const follower: FollowerAccount = {
  id: 'f_test',
  name: 'Test Follower',
  equity: 10000,
  availableBalance: 5000,
  copyRatio: 0.5,
  maxLeverage: 5,
  maxNotionalPerTrade: 10000,
  allowedSymbols: ['BTCUSDT', 'ETHUSDT']
};

const trade: LeaderTrade = {
  id: 'lt_test',
  symbol: 'BTCUSDT',
  side: 'BUY',
  quantity: 0.1234,
  price: 68000,
  leverage: 5,
  timestamp: new Date().toISOString()
};

describe('copy trading engine', () => {
  it('applies worse price slippage for BUY and SELL', () => {
    expect(applySlippage(100, 'BUY', 50)).toBe(100.5);
    expect(applySlippage(100, 'SELL', 50)).toBe(99.5);
  });

  it('rounds quantities down to exchange step size', () => {
    expect(roundDownToStep(0.1239, 0.001)).toBe(0.123);
    expect(roundDownToStep(5.678, 0.1)).toBe(5.6);
  });

  it('creates an accepted copied order with proportional quantity and margin', () => {
    const order = buildCopiedOrder(trade, follower, 10);
    expect(order.status).toBe('ACCEPTED');
    expect(order.followerName).toBe('Test Follower');
    expect(order.quantity).toBe(0.061);
    expect(order.estimatedFillPrice).toBe(68068);
    expect(order.notional).toBe(4152.15);
    expect(order.marginRequired).toBeCloseTo(830.43, 2);
  });

  it('rejects trades where the symbol is not allowed', () => {
    const order = buildCopiedOrder({ ...trade, symbol: 'SOLUSDT' }, follower);
    expect(order.status).toBe('REJECTED');
    expect(order.rejectionReason).toContain('Symbol');
  });

  it('rejects trades above follower leverage limits', () => {
    const order = buildCopiedOrder({ ...trade, leverage: 20 }, follower);
    expect(order.status).toBe('REJECTED');
    expect(order.rejectionReason).toContain('leverage');
  });

  it('rejects copied orders above follower max notional per trade', () => {
    const cappedFollower = { ...follower, maxNotionalPerTrade: 1000 };
    const order = buildCopiedOrder(trade, cappedFollower);
    expect(order.status).toBe('REJECTED');
    expect(order.rejectionReason).toContain('Notional');
  });

  it('rejects trades requiring more margin than available balance', () => {
    const lowBalanceFollower = { ...follower, availableBalance: 10 };
    const order = buildCopiedOrder(trade, lowBalanceFollower);
    expect(order.status).toBe('REJECTED');
    expect(order.rejectionReason).toContain('Margin');
  });

  it('summarizes accepted notional, required margin, and rejected counts', () => {
    const orders = [
      buildCopiedOrder(trade, follower, 10),
      buildCopiedOrder({ ...trade, leverage: 20 }, follower, 10)
    ];
    expect(summarizeOrders(orders)).toEqual({
      acceptedCount: 1,
      rejectedCount: 1,
      totalAcceptedNotional: 4152.15,
      totalMarginRequired: 830.43
    });
  });
});
