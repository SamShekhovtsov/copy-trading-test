export type Side = 'BUY' | 'SELL';

export type SymbolCode = 'BTCUSDT' | 'ETHUSDT' | 'SOLUSDT';

export interface LeaderTrade {
  id: string;
  symbol: SymbolCode;
  side: Side;
  quantity: number;
  price: number;
  leverage: number;
  timestamp: string;
}

export interface FollowerAccount {
  id: string;
  name: string;
  equity: number;
  availableBalance: number;
  copyRatio: number;
  maxLeverage: number;
  maxNotionalPerTrade: number;
  allowedSymbols: SymbolCode[];
}

export interface CopiedOrder {
  followerId: string;
  followerName: string;
  leaderTradeId: string;
  symbol: SymbolCode;
  side: Side;
  quantity: number;
  estimatedFillPrice: number;
  notional: number;
  marginRequired: number;
  status: 'ACCEPTED' | 'REJECTED';
  rejectionReason?: string;
}

export interface CopySimulationSummary {
  acceptedCount: number;
  rejectedCount: number;
  totalAcceptedNotional: number;
  totalMarginRequired: number;
}
