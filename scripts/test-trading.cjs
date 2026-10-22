/* eslint-disable @typescript-eslint/no-require-imports -- Offline integration tests share the production TypeScript engine. */
require('./register-typescript.cjs');
const assert = require('node:assert/strict');
const engine = require('../src/lib/simulation/engine.ts');
const { assertExecutableQuote } = require('../src/lib/simulation/execution.ts');
const { getMarketHours } = require('../src/lib/market/hours.ts');
const now = new Date('2026-10-22T15:00:00Z');
const zero = { usPercent: 0, usMin: 0, arPercent: 0, arMin: 0, spreadBps: 0, slippageBps: 0 };
const costs = { ...zero, usMin: 1, spreadBps: 20, slippageBps: 10 };
const quote = (symbol = 'AAPL', price = 100, at = now) => ({ symbol, currency: symbol === 'GGAL' ? 'ARS' : 'USD', price, lastUpdated: at.toISOString(), provider: 'yahoo', freshness: 'delayed' });
const empty = () => engine.emptyPortfolio({ USD: 10000, ARS: 100000 });
const execute = (p, side, qty, q = quote(), config = zero, clock = now) => engine.executeMarket(p, q.symbol, side, qty, q.price, config, 'realistic', { quote: q, now: clock });
const limit = (p, side, qty, price, config = zero) => engine.placeWorkingOrder(p, { symbol: 'AAPL', side, type: 'limit', quantity: qty, limitPrice: price }, config);
let passed = 0;
function test(name, fn) { fn(); console.log('✓', name); passed++; }
test('Market buys and sells are blocked after close, on weekends, holidays and early closes', () => {
 for (const at of ['2026-10-22T22:00:00Z', '2026-10-24T15:00:00Z', '2026-11-26T15:00:00Z', '2026-11-27T18:00:00Z', '2026-12-24T18:00:00Z']) {
   const clock = new Date(at); const p = empty();
   assert.throws(() => execute(p, 'buy', 1, quote('AAPL', 100, clock), zero, clock), /cerrado/);
   p.positions.push({ symbol: 'AAPL', quantity: 1, currency: 'USD', averagePrice: 100 });
   assert.throws(() => execute(p, 'sell', 1, quote('AAPL', 100, clock), zero, clock), /cerrado/);
 }
 assert.equal(getMarketHours('US', new Date('2026-11-27T17:59:00Z')).isOpen, true);
 assert.equal(getMarketHours('US', new Date('2026-11-02T14:29:00Z')).isOpen, false);
 assert.equal(getMarketHours('US', new Date('2026-11-02T14:30:00Z')).isOpen, true);
 assert.equal(getMarketHours('AR', new Date('2026-10-22T13:29:00Z')).isOpen, false);
 assert.equal(getMarketHours('AR', new Date('2026-10-22T13:30:00Z')).isOpen, true);
});
test('Old, future, invalid and premarket quotes cannot fill orders', () => {
 for (const q of [quote('AAPL', 0), quote('AAPL', NaN), quote('AAPL', 100, new Date('2026-10-21T15:00:00Z')), quote('AAPL', 100, new Date('2026-10-22T15:05:00Z'))]) assert.throws(() => assertExecutableQuote('AAPL', q, now));
 assert.throws(() => assertExecutableQuote('AAPL', quote('AAPL', 100, new Date('2026-10-22T13:25:00Z')), new Date('2026-10-22T13:35:00Z')));
 for (const n of [NaN, Infinity, -1, 0]) assert.throws(() => execute(empty(), 'buy', n));
});
test('Market orders use the simulated execution price and charge entry and exit costs', () => {
 const bought = execute(empty(), 'buy', 1, quote(), costs);
 assert.ok(Math.abs(bought.trade.price - 100.2) < 1e-8);
 const sold = execute(bought.portfolio, 'sell', 1, quote(), costs);
 assert.ok(Math.abs(sold.trade.realizedPnl - (sold.portfolio.cash.USD - 10000)) < 1e-8);
});
test('Buy limits never fill above the limit, including spread and slippage', () => {
 const pending = limit(empty(), 'buy', 10, 100, costs);
 let matched = engine.matchPendingOrders(pending, [quote()], costs, 'realistic', now);
 assert.equal(matched.orders[0].status, 'pending'); assert.equal(matched.trades.length, 0);
 matched = engine.matchPendingOrders(matched, [quote('AAPL', 99)], costs, 'realistic', now);
 assert.equal(matched.orders[0].status, 'filled'); assert.ok(matched.trades[0].price <= 100);
 assert.equal(matched.trades[0].orderId, pending.orders[0].id);
 assert.equal(matched.orders.length, 1);
});
test('Sell limits never fill below the limit and commission stays separate', () => {
 const held = execute(empty(), 'buy', 10).portfolio;
 let pending = limit(held, 'sell', 10, 100, costs);
 assert.equal(engine.matchPendingOrders(pending, [quote()], costs, 'realistic', now).trades.length, 1);
 pending = engine.matchPendingOrders(pending, [quote('AAPL', 101)], costs, 'realistic', now);
 assert.equal(pending.orders[0].status, 'filled'); assert.ok(pending.trades[0].price >= 100); assert.equal(pending.trades[0].commission, 1);
});
test('Queued limits remain pending while closed and require a new valid session quote', () => {
 const p = limit(empty(), 'buy', 1, 110);
 const closed = new Date('2026-10-22T22:00:00Z');
 assert.equal(engine.matchPendingOrders(p, [quote('AAPL', 100, closed)], zero, 'realistic', closed).trades.length, 0);
 const tomorrow = new Date('2026-10-23T15:00:00Z');
 assert.equal(engine.matchPendingOrders(p, [quote()], zero, 'realistic', tomorrow).trades.length, 0);
 assert.equal(engine.matchPendingOrders(p, [quote('AAPL', 100, tomorrow)], zero, 'realistic', tomorrow).trades.length, 1);
});
test('Pending buys reserve cash and cancellation releases it', () => {
 const p = limit(empty(), 'buy', 90, 100);
 assert.equal(engine.reservedCash(p, 'USD', zero), 9000);
 assert.throws(() => limit(p, 'buy', 11, 100), /insuficiente/);
 assert.throws(() => execute(p, 'buy', 11), /insuficiente/);
 const cancelled = engine.cancelOrder(p, p.orders[0].id);
 assert.equal(engine.reservedCash(cancelled, 'USD', zero), 0);
 assert.equal(execute(cancelled, 'buy', 11).trade.quantity, 11);
});
test('Pending sells reserve units and cannot sell the same holding twice', () => {
 const held = execute(empty(), 'buy', 10).portfolio;
 const p = limit(held, 'sell', 8, 110);
 assert.equal(engine.availableQuantity(p, 'AAPL'), 2);
 assert.throws(() => limit(p, 'sell', 3, 110), /insuficientes/);
 assert.throws(() => execute(p, 'sell', 3), /suficientes/);
});
test('Invalid limits and unsupported protective buys never become orders', () => {
 for (const price of [0, -1, NaN, Infinity]) assert.throws(() => limit(empty(), 'buy', 1, price), /válido/);
 assert.throws(() => engine.placeWorkingOrder(empty(), { symbol: 'AAPL', side: 'buy', quantity: 1, type: 'take_profit', limitPrice: 100 }, zero));
});
test('Stop loss can execute worse than its trigger after a gap', () => {
 const held = execute(empty(), 'buy', 1).portfolio;
 const p = engine.placeWorkingOrder(held, { symbol: 'AAPL', side: 'sell', quantity: 1, type: 'stop', stopPrice: 90 }, costs);
 const filled = engine.matchPendingOrders(p, [quote('AAPL', 80)], costs, 'realistic', now);
 assert.equal(filled.orders[0].status, 'filled'); assert.ok(filled.trades[0].price < 90);
});
console.log(`\n${passed} grupos de pruebas de órdenes aprobados. Sin red ni dinero real.`);
