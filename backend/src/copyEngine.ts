import { CopiedOrder, CopySimulationSummary, FollowerAccount, LeaderTrade } from './types.js';

const SYMBOL_STEP_SIZE: Record<string, number> = {
  BTCUSDT: 0.001,
  ETHUSDT: 0.01,
  SOLUSDT: 0.1
};

export function applySlippage(price: number, side: LeaderTrade['side'], slippageBps: number): number {
  const multiplier = side === 'BUY' ? 1 + slippageBps / 10_000 : 1 - slippageBps / 10_000;
  return Number((price * multiplier).toFixed(2));
}

export function roundDownToStep(quantity: number, stepSize: number): number {
  const stepDecimals = (stepSize.toString().split('.')[1] ?? '').length;
  return Number((Math.floor(quantity / stepSize) * stepSize).toFixed(stepDecimals));
}

/**
 * CANDIDATE TASK:
 * This function intentionally contains incomplete/weak business logic.
 * Improve it so that tests pass and the UI shows sensible copy orders.
 *
 * Trading rules expected:
 * 1. Quantity should be leader quantity * follower copyRatio.
 * 2. Estimated fill price must include slippage. BUY pays more, SELL receives less.
 * 3. Quantity must be rounded down to the symbol step size.
 * 4. Reject if symbol is not allowed for that follower.
 * 5. Reject if leader leverage exceeds follower maxLeverage.
 * 6. Reject if notional exceeds follower maxNotionalPerTrade.
 * 7. Reject if marginRequired exceeds availableBalance.
 * 8. Never return negative or zero quantity accepted orders.
 */
export function buildCopiedOrder(
  trade: LeaderTrade,
  follower: FollowerAccount,
  slippageBps = 15
): CopiedOrder {
  const estimatedFillPrice = applySlippage(trade.price, trade.side, slippageBps);
  const rawQuantity = trade.quantity * follower.copyRatio;
  const quantity = Number(roundDownToStep(rawQuantity, SYMBOL_STEP_SIZE[trade.symbol]).toFixed(8));
  const notional = Number((quantity * estimatedFillPrice).toFixed(2));
  const marginRequired = Number((notional / trade.leverage).toFixed(2));

  if (!follower.allowedSymbols.includes(trade.symbol)) {
    return reject(
      trade,
      follower,
      quantity,
      estimatedFillPrice,
      notional,
      marginRequired,
      `Symbol ${trade.symbol} is not enabled for ${follower.name}`
    );
  }

  if (trade.leverage > follower.maxLeverage) {
    return reject(
      trade,
      follower,
      quantity,
      estimatedFillPrice,
      notional,
      marginRequired,
      `Leader leverage ${trade.leverage}x exceeds ${follower.name}'s ${follower.maxLeverage}x limit`
    );
  }

  if (quantity <= 0) {
    return reject(
      trade,
      follower,
      quantity,
      estimatedFillPrice,
      notional,
      marginRequired,
      `Copied quantity ${rawQuantity} rounds below the ${trade.symbol} step size`
    );
  }

  if (notional > follower.maxNotionalPerTrade) {
    return reject(
      trade,
      follower,
      quantity,
      estimatedFillPrice,
      notional,
      marginRequired,
      `Notional $${notional.toLocaleString()} exceeds ${follower.name}'s $${follower.maxNotionalPerTrade.toLocaleString()} trade limit`
    );
  }

  if (marginRequired > follower.availableBalance) {
    return reject(
      trade,
      follower,
      quantity,
      estimatedFillPrice,
      notional,
      marginRequired,
      `Margin $${marginRequired.toLocaleString()} exceeds ${follower.name}'s $${follower.availableBalance.toLocaleString()} available balance`
    );
  }

  return {
    followerId: follower.id,
    followerName: follower.name,
    leaderTradeId: trade.id,
    symbol: trade.symbol,
    side: trade.side,
    quantity,
    estimatedFillPrice,
    notional,
    marginRequired,
    status: 'ACCEPTED'
  };
}

function reject(
  trade: LeaderTrade,
  follower: FollowerAccount,
  quantity: number,
  estimatedFillPrice: number,
  notional: number,
  marginRequired: number,
  rejectionReason: string
): CopiedOrder {
  return {
    followerId: follower.id,
    followerName: follower.name,
    leaderTradeId: trade.id,
    symbol: trade.symbol,
    side: trade.side,
    quantity,
    estimatedFillPrice,
    notional,
    marginRequired,
    status: 'REJECTED',
    rejectionReason
  };
}

export function buildOrdersForTrade(trade: LeaderTrade, followers: FollowerAccount[]): CopiedOrder[] {
  return followers.map((follower) => buildCopiedOrder(trade, follower));
}

export function summarizeOrders(orders: CopiedOrder[]): CopySimulationSummary {
  return orders.reduce<CopySimulationSummary>(
    (summary, order) => {
      if (order.status === 'ACCEPTED') {
        summary.acceptedCount += 1;
        summary.totalAcceptedNotional += order.notional;
        summary.totalMarginRequired += order.marginRequired;
      } else {
        summary.rejectedCount += 1;
      }

      summary.totalAcceptedNotional = Number(summary.totalAcceptedNotional.toFixed(2));
      summary.totalMarginRequired = Number(summary.totalMarginRequired.toFixed(2));
      return summary;
    },
    {
      acceptedCount: 0,
      rejectedCount: 0,
      totalAcceptedNotional: 0,
      totalMarginRequired: 0
    }
  );
}
