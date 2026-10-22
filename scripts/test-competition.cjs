/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS loader transpiles TypeScript and isolates server dependencies for offline tests. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const ts = require('typescript');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...args) {
  return originalResolve.call(this, request.startsWith('@/') ? path.join(process.cwd(), 'src', request.slice(2)) : request, parent, ...args);
};
require.extensions['.ts'] = function (module, filename) {
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, resolveJsonModule: true } }).outputText;
  module._compile(code, filename);
};
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'competition-test-'));
process.env.COMPETITION_DATA_DIR = temp;
const fixtureHours = require('../src/lib/market/hours.ts');
const realMarketHours = fixtureHours.getMarketHours;
fixtureHours.getMarketHours = () => ({ isOpen: true });
const e = require('../src/lib/competition/engine.ts');
const { askAgent } = require('../src/lib/competition/agent.ts');
const storage = require('../src/lib/competition/storage.ts');
const ALL = ['SPY', 'QQQ', 'DIA', 'IWM', 'AAPL', 'MSFT', 'NVDA'];
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('✓', name); }
function quote(symbol, price = 100) { return { symbol, currency: 'USD', price, provider: 'yahoo', lastUpdated: new Date().toISOString() }; }
function competition() { const c = e.createCompetition(10000, 'test-model', 'yahoo'); c.quotes = ALL.map((s) => quote(s)); return c; }
(async () => {
  test('Five independent accounts start with equal capital', () => {
    const c = competition(); for (const id of e.PARTICIPANTS) assert.equal(c.portfolios[id].cash.USD, 10000);
    c.portfolios.you.cash.USD = 0; assert.equal(c.portfolios.patient.cash.USD, 10000);
    assert.equal(new Date(c.endsAt) - new Date(c.startedAt), 42 * 86400000);
  });
  test('Invalid capital and stale or zero quotes are rejected', () => {
    for (const capital of [NaN, Infinity, -10, 0, 99, 1000001]) assert.throws(() => e.createCompetition(capital, 'm', 'yahoo'));
    assert.equal(e.freshQuote(quote('SPY', 0)), false);
    const q = quote('SPY'); q.lastUpdated = new Date(Date.now() - 31 * 60000).toISOString(); assert.equal(e.freshQuote(q), false);
    const c = competition(); c.quotes = [q]; assert.throws(() => e.trade(c, 'you', 'SPY', 'buy', 1, 'test'));
    assert.throws(() => e.trade(competition(), 'you', 'SPY', 'buy', NaN, 'test'));
  });
  test('All three agents can wait with 100% cash without any trade', () => {
    for (const id of ['patient', 'momentum', 'analyst']) {
      const c = competition(); const p = e.validateProposal(id, { action: 'hold', reason: 'No hay evidencia suficiente.', allocations: [] }, ALL, []);
      e.applyProposal(c, id, p); assert.equal(c.portfolios[id].cash.USD, 10000); assert.equal(c.portfolios[id].trades.length, 0); assert.equal(c.decisions[0].action, 'hold');
    }
  });
  test('Strategy boundaries reject wrong assets, overweight, duplicates and invalid hold', () => {
    const alloc = (symbol, weight = 0.2) => ({ action: 'allocate', reason: 'test', allocations: [{ symbol, weight }] });
    assert.throws(() => e.validateProposal('patient', alloc('AAPL'), ALL, []));
    assert.throws(() => e.validateProposal('analyst', alloc('SPY'), ALL, []));
    assert.throws(() => e.validateProposal('momentum', alloc('AAPL'), ALL, []));
    assert.throws(() => e.validateProposal('analyst', alloc('AAPL', 0.21), ALL, []));
    assert.throws(() => e.validateProposal('analyst', alloc('AAPL', NaN), ALL, []));
    assert.throws(() => e.validateProposal('analyst', { action: 'hold', reason: 'test', allocations: [{ symbol: 'AAPL', weight: 0.1 }] }, ALL, []));
    assert.throws(() => e.validateProposal('analyst', { action: 'allocate', reason: 'test', allocations: [{ symbol: 'AAPL', weight: 0.1 }, { symbol: 'AAPL', weight: 0.1 }] }, ALL, []));
  });
  test('Patient keeps cash reserve and skips rebalance below drift threshold', () => {
    const c = competition(); const p = { action: 'allocate', reason: 'Diversifico.', allocations: ['SPY','QQQ','DIA','IWM'].map((symbol) => ({ symbol, weight: 0.2 })) };
    e.applyProposal(c, 'patient', e.validateProposal('patient', p, ALL, []));
    assert.ok(c.portfolios.patient.cash.USD >= 2000); assert.equal(c.portfolios.patient.positions.length, 4);
    const trades = c.portfolios.patient.trades.length;
    e.applyProposal(c, 'patient', p); assert.equal(c.portfolios.patient.trades.length, trades); assert.equal(c.decisions[0].action, 'hold');
  });
  test('An agent can keep existing holdings by waiting and later exit to cash', () => {
    const c = competition(); e.applyProposal(c, 'analyst', { action: 'allocate', reason: 'tesis', allocations: [{ symbol: 'AAPL', weight: 0.2 }] });
    const quantity = c.portfolios.analyst.positions[0].quantity;
    e.applyProposal(c, 'analyst', { action: 'hold', reason: 'mantengo', allocations: [] });
    assert.equal(c.portfolios.analyst.positions[0].quantity, quantity);
    e.applyProposal(c, 'analyst', { action: 'allocate', reason: 'tesis invalidada', allocations: [] });
    assert.equal(c.portfolios.analyst.positions.length, 0); assert.ok(c.portfolios.analyst.cash.USD < 10000);
  });
  test('Entry and exit fees reconcile realized P&L to cash loss', () => {
    const c = competition(); c.commission.spreadBps = 0; c.commission.slippageBps = 0;
    e.trade(c, 'you', 'AAPL', 'buy', 1, 'comprar'); assert.equal(c.portfolios.you.positions[0].averagePrice, 101);
    e.trade(c, 'you', 'AAPL', 'sell', 1, 'vender');
    assert.equal(c.portfolios.you.cash.USD, 9998); assert.equal(c.portfolios.you.trades[0].realizedPnl, -2);
  });
  test('Partial rebalance failure leaves original portfolio and diary unchanged', () => {
    const c = competition(); e.trade(c, 'analyst', 'AAPL', 'buy', 10, 'test');
    const before = JSON.stringify(c);
    assert.throws(() => e.applyProposal(c, 'analyst', { action: 'allocate', reason: 'test', allocations: [{ symbol: 'MISSING', weight: 0.2 }] }));
    assert.equal(JSON.stringify(c), before);
  });
  test('Momentum needs sufficient history, positive return and SMA50 filter', () => {
    const rising = Array.from({ length: 70 }, (_, i) => ({ close: 100 + i }));
    const falling = Array.from({ length: 70 }, (_, i) => ({ close: 200 - i }));
    assert.deepEqual(e.momentumCandidates({ AAPL: rising, MSFT: falling, NVDA: rising.slice(0, 50) }).map((x) => x.symbol), ['AAPL']);
  });
  test('Snapshots preserve daily history and measure observed drawdown', () => {
    const c = competition(); e.snapshot(c, new Date('2026-01-01T15:00:00Z'));
    c.portfolios.you.cash.USD = 9000; e.snapshot(c, new Date('2026-01-02T15:00:00Z')); e.snapshot(c, new Date('2026-01-02T16:00:00Z'));
    assert.equal(c.snapshots.length, 2); assert.ok(Math.abs(e.maxDrawdown(c, 'you') + 10) < 1e-8);
  });
  const c = competition();
  await storage.writeCompetition(c); assert.deepEqual(await storage.readCompetition(), c);
  let sequence = []; await Promise.all([storage.exclusive(async () => { await new Promise((r) => setTimeout(r, 15)); sequence.push(1); }), storage.exclusive(async () => sequence.push(2))]);
  assert.deepEqual(sequence, [1, 2]); passed++; console.log('✓ Atomic persistence survives reload and serializes mutations');
  const realFetch = global.fetch;
  process.env.OPENAI_API_KEY = 'test-key-never-sent';
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body); assert.equal(body.text.format.type, 'json_schema'); assert.equal(body.store, false);
    return { ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ action: 'hold', reason: 'Prefiero esperar.', allocations: [] }) }] }] }) };
  };
  const result = await askAgent('analyst', competition(), { observedAt: new Date().toISOString(), quotes: ALL.map((s) => quote(s)), histories: {}, news: {} });
  assert.equal(result.proposal.action, 'hold');
  global.fetch = async () => ({ ok: false, status: 429 });
  await assert.rejects(() => askAgent('patient', competition(), { observedAt: '', quotes: [], histories: {}, news: {} }), /429/);
  global.fetch = realFetch; delete process.env.OPENAI_API_KEY; passed++; console.log('✓ Structured AI response and provider failures are handled without external calls');
  const schedule = require('../src/lib/competition/schedule.ts');
  fixtureHours.getMarketHours = realMarketHours;
  test('Closed-market creation schedules the next trading day at noon, skipping weekends and holidays', () => {
    assert.equal(schedule.nextTradingEvaluation(new Date('2026-10-22T22:00:00Z')).toISOString(), '2026-10-23T15:00:00.000Z');
    assert.equal(schedule.nextTradingEvaluation(new Date('2026-10-23T22:00:00Z')).toISOString(), '2026-10-26T15:00:00.000Z');
    assert.equal(schedule.nextTradingEvaluation(new Date('2026-11-25T22:00:00Z')).toISOString(), '2026-11-27T15:00:00.000Z');
    assert.equal(schedule.dailyWindowOpen(new Date('2026-10-23T14:59:00Z')), false);
    assert.equal(schedule.dailyWindowOpen(new Date('2026-10-23T15:00:00Z')), true);
  });
  const reviewTime = new Date(`${schedule.argentinaDay(new Date())}T12:00:00-03:00`);
  // Review orchestration: no calls while closed, duplicate attempts, or after the end.
  const hours = require('../src/lib/market/hours.ts'); const actualHours = realMarketHours; const factory = require('../src/lib/market/factory.ts');
  const agentModule = require('../src/lib/competition/agent.ts'); const service = require('../src/lib/competition/service.ts');
  process.env.OPENAI_API_KEY = 'test'; process.env.OPENAI_MODEL = 'test-model';
  hours.getMarketHours = () => ({ isOpen: false });
  const closed = competition(); closed.lastCheckedAt = new Date(0).toISOString(); await service.review(closed, reviewTime); assert.equal(closed.decisions.length, 0);
  let calls = 0; hours.getMarketHours = () => ({ isOpen: true });
  factory.getMarketDataProvider = () => ({ id: 'yahoo', getQuotes: async () => ({ quotes: ALL.map((s) => quote(s)) }), getHistory: async () => ({ bars: [] }), getNews: async () => ({ items: [] }) });
  agentModule.askAgent = async () => { calls++; return { proposal: { action: 'hold', reason: 'Esperar.', allocations: [] }, evidence: {} }; };
  const active = competition(); active.lastCheckedAt = new Date(0).toISOString(); await service.review(active, reviewTime); assert.equal(calls, 3); assert.equal(active.portfolios.spy.trades.length, 1);
  active.lastCheckedAt = new Date(0).toISOString(); await service.review(active, reviewTime); assert.equal(calls, 3); assert.equal(active.portfolios.spy.trades.length, 1);
  const ended = competition(); ended.endsAt = new Date(0).toISOString(); await service.review(ended, reviewTime); assert.equal(ended.status, 'finished'); assert.equal(calls, 3);
  const failed = competition(); failed.lastCheckedAt = new Date(0).toISOString(); agentModule.askAgent = async () => { calls++; throw new Error('test failure'); };
  await service.review(failed, reviewTime); assert.equal(calls, 6); assert.equal(failed.portfolios.analyst.cash.USD, 10000);
  failed.lastCheckedAt = new Date(0).toISOString(); await service.review(failed, reviewTime); assert.equal(calls, 6); passed++; console.log('✓ Daily cadence, error cooldown, market closure and end-of-round avoid unintended execution');
  const queued = competition(); queued.scheduledFor = new Date(reviewTime.getTime() + 86400000).toISOString();
  await service.review(queued, reviewTime); assert.equal(queued.portfolios.spy.trades.length, 0); assert.equal(calls, 6);
  const nextDay = new Date(reviewTime.getTime() + 86400000);
  agentModule.askAgent = async () => { calls++; return { proposal: { action: 'hold', reason: 'Sigo esperando.', allocations: [] }, evidence: {} }; };
  active.lastCheckedAt = new Date(0).toISOString(); await service.review(active, nextDay); assert.equal(calls, 9);
  active.lastCheckedAt = new Date(0).toISOString(); await service.review(active, nextDay); assert.equal(calls, 9);
  passed++; console.log('✓ Scheduled rounds do not invest early; daily decisions are idempotent across calendar days');
  // Creating a round after hours must not fetch prices or invoke a model.
  fs.unlinkSync(path.join(temp, 'competition.json'));
  hours.getMarketHours = (market, now) => now ? actualHours(market, now) : { isOpen: false };
  const { NextRequest } = require('next/server');
  const route = require('../src/app/api/competition/route.ts');
  const beforeCalls = calls;
  const response = await route.POST(new NextRequest('http://localhost:3000/api/competition', {
    method: 'POST', headers: { origin: 'http://localhost:3000', host: 'localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'start', capital: 10000 }),
  }));
  assert.equal(response.status, 200);
  const created = (await response.json()).competition;
  assert.ok(new Date(created.scheduledFor).getTime() > Date.now());
  assert.equal(new Date(created.endsAt) - new Date(created.scheduledFor), 42 * 86400000);
  assert.equal(created.portfolios.spy.trades.length, 0); assert.equal(calls, beforeCalls);
  passed++; console.log('✓ API starts after hours without buying SPY or calling AI, with six weeks from the scheduled start');
  const { spawn } = require('node:child_process');
  const counter = path.join(temp, 'counter'); fs.writeFileSync(counter, '0');
  const childCode = `require('./scripts/register-typescript.cjs'); const fs=require('node:fs'); const s=require('./src/lib/competition/storage.ts'); s.exclusive(async()=>{const n=Number(fs.readFileSync(${JSON.stringify(counter)},'utf8')); await new Promise(r=>setTimeout(r,50));fs.writeFileSync(${JSON.stringify(counter)},String(n+1));}).catch(()=>process.exitCode=1);`;
  await Promise.all([1, 2].map(() => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', childCode], { cwd: process.cwd(), env: process.env, stdio: 'ignore' });
    child.on('error', reject); child.on('exit', (code) => code === 0 ? resolve() : reject(new Error('Child lock test failed')));
  })));
  assert.equal(fs.readFileSync(counter, 'utf8'), '2');
  passed++; console.log('✓ Separate web and automation processes cannot overwrite each other');
  console.log(`\n${passed} grupos de pruebas aprobados. Sin llamadas de red ni costos de API.`);
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => fs.rmSync(temp, { recursive: true, force: true }));
