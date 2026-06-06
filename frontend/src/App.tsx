import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Side = 'BUY' | 'SELL';
type SymbolCode = 'BTCUSDT' | 'ETHUSDT' | 'SOLUSDT';

type Order = {
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
};

type Follower = {
  id: string;
  name: string;
  equity: number;
  availableBalance: number;
  copyRatio: number;
  maxLeverage: number;
  maxNotionalPerTrade: number;
  allowedSymbols: SymbolCode[];
};

type Summary = {
  acceptedCount: number;
  rejectedCount: number;
  totalAcceptedNotional: number;
  totalMarginRequired: number;
};

type SimulationResult = {
  slippageBps: number;
  orders: Order[];
  summary: Summary;
};

type FieldErrors = Partial<Record<'symbol' | 'side' | 'quantity' | 'price' | 'leverage', string[]>>;

const API_URL = 'http://localhost:4000/api';

function App() {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [form, setForm] = useState({ symbol: 'BTCUSDT' as SymbolCode, side: 'BUY' as Side, quantity: 0.5, price: 68000, leverage: 5 });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    fetch(`${API_URL}/followers`).then((res) => res.json()).then(setFollowers);
  }, []);

  async function simulateTrade(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setFieldErrors({});

    const localErrors = validateForm(form);
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      setError('Fix the highlighted leader trade fields.');
      return;
    }

    const response = await fetch(`${API_URL}/simulate-copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const payload = await response.json();
    if (!response.ok) {
      setFieldErrors(payload.fields ?? {});
      setError(payload.message ?? 'Please check quantity, price, and leverage.');
      return;
    }
    setResult(payload);
  }

  const orders = result?.orders ?? [];
  const summary = result?.summary ?? { acceptedCount: 0, rejectedCount: 0, totalAcceptedNotional: 0, totalMarginRequired: 0 };

  return (
    <main className="page">
      <section className="hero">
        <h1>Copy Trading Simulator</h1>
        <p className="subtitle">Simulate how a leader order is copied across follower accounts with slippage, leverage, symbol, notional, and margin checks.</p>
      </section>

      <section className="grid">
        <form className="panel" onSubmit={simulateTrade}>
          <h2>Leader trade</h2>
          <label>Symbol<select value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value as SymbolCode })}><option>BTCUSDT</option><option>ETHUSDT</option><option>SOLUSDT</option></select></label>
          <label>Side<select value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value as Side })}><option>BUY</option><option>SELL</option></select></label>
          <Field label="Quantity" error={fieldErrors.quantity?.[0]}><input type="number" min="0" step="0.001" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></Field>
          <Field label="Price" error={fieldErrors.price?.[0]}><input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></Field>
          <Field label="Leverage" error={fieldErrors.leverage?.[0]}><input type="number" min="1" max="125" step="1" value={form.leverage} onChange={(e) => setForm({ ...form, leverage: Number(e.target.value) })} /></Field>
          <button>Run simulation</button>
          {error && <p className="error">{error}</p>}
        </form>

        <section className="panel">
          <h2>Followers</h2>
          <div className="followers">
            {followers.map((follower) => (
              <article key={follower.id} className="follower">
                <div>
                  <strong>{follower.name}</strong>
                  <span>{follower.allowedSymbols.join(', ')}</span>
                </div>
                <dl>
                  <dt>Balance</dt><dd>{formatCurrency(follower.availableBalance)}</dd>
                  <dt>Ratio</dt><dd>{follower.copyRatio}x</dd>
                  <dt>Max lev</dt><dd>{follower.maxLeverage}x</dd>
                  <dt>Max trade</dt><dd>{formatCurrency(follower.maxNotionalPerTrade)}</dd>
                </dl>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="summary" aria-label="Simulation summary">
        <div className="metric"><span>Accepted</span><strong>{summary.acceptedCount}</strong></div>
        <div className="metric"><span>Rejected</span><strong>{summary.rejectedCount}</strong></div>
        <div className="metric"><span>Total notional</span><strong>{formatCurrency(summary.totalAcceptedNotional)}</strong></div>
        <div className="metric"><span>Total margin</span><strong>{formatCurrency(summary.totalMarginRequired)}</strong></div>
      </section>

      <section className="risk-note">
        <p>Slippage is applied against the follower: BUY fills above leader price, SELL fills below it. Accepted orders use notional = quantity x fill price and margin = notional / leverage.</p>
        {result && <span>{result.slippageBps} bps slippage was applied to this simulation.</span>}
      </section>

      <section className="panel table-panel">
        <h2>Copied orders</h2>
        <table>
          <thead><tr><th>Follower</th><th>Symbol</th><th>Side</th><th>Qty</th><th>Fill price</th><th>Notional</th><th>Margin</th><th>Status</th></tr></thead>
          <tbody>
            {orders.map((order) => (
              <tr key={`${order.followerId}-${order.leaderTradeId}`}>
                <td><strong>{order.followerName}</strong><small>{order.followerId}</small></td><td>{order.symbol}</td><td>{order.side}</td><td>{order.quantity}</td><td>{formatCurrency(order.estimatedFillPrice)}</td><td>{formatCurrency(order.notional)}</td><td>{formatCurrency(order.marginRequired)}</td>
                <td><span className={order.status === 'ACCEPTED' ? 'accepted' : 'rejected'}>{order.status}</span>{order.rejectionReason && <small>{order.rejectionReason}</small>}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={8} className="empty">No results yet. Run a simulation.</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className={error ? 'invalid' : ''}>
      {label}
      {children}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

function validateForm(form: { quantity: number; price: number; leverage: number }): FieldErrors {
  const errors: FieldErrors = {};

  if (!Number.isFinite(form.quantity) || form.quantity <= 0) {
    errors.quantity = ['Quantity must be greater than 0'];
  }

  if (!Number.isFinite(form.price) || form.price <= 0) {
    errors.price = ['Price must be greater than 0'];
  }

  if (!Number.isInteger(form.leverage) || form.leverage <= 0 || form.leverage > 125) {
    errors.leverage = ['Leverage must be a whole number from 1 to 125'];
  }

  return errors;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}

createRoot(document.getElementById('root')!).render(<App />);
