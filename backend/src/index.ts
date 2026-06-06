import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { buildOrdersForTrade, summarizeOrders } from './copyEngine.js';
import { followers, leaderTrades } from './fixtures.js';
import { LeaderTrade } from './types.js';

const app = express();
app.use(cors());
app.use(express.json());

const tradeSchema = z.object({
  symbol: z.enum(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.number({ invalid_type_error: 'Quantity must be a number' }).positive('Quantity must be greater than 0'),
  price: z.number({ invalid_type_error: 'Price must be a number' }).positive('Price must be greater than 0'),
  leverage: z
    .number({ invalid_type_error: 'Leverage must be a number' })
    .int('Leverage must be a whole number')
    .positive('Leverage must be greater than 0')
    .max(125, 'Leverage must be 125x or lower')
});

app.get('/api/leader-trades', (_req, res) => res.json(leaderTrades));
app.get('/api/followers', (_req, res) => res.json(followers));

app.post('/api/simulate-copy', (req, res) => {
  const parsed = tradeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Invalid leader trade',
      fields: parsed.error.flatten().fieldErrors
    });
  }

  const trade: LeaderTrade = {
    id: `lt_${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...parsed.data
  };

  const orders = buildOrdersForTrade(trade, followers);

  return res.json({
    trade,
    slippageBps: 15,
    orders,
    summary: summarizeOrders(orders)
  });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`Copy trading test API running on http://localhost:${port}`));
