/* eslint-disable @typescript-eslint/no-require-imports -- Isolated offline tests replace the cloud SDK before loading server modules. */
const assert = require('node:assert/strict');
const Module = require('node:module');
require('./register-typescript.cjs');
const objects = new Map();
let version = 0;
const mockBlob = {
  async get(path, options) {
    assert.equal(options.access, 'private'); assert.equal(options.useCache, false);
    const object = objects.get(path); if (!object) return null;
    return { stream: new Response(object.body).body, blob: { etag: object.etag } };
  },
  async put(path, body, options) {
    assert.equal(options.access, 'private'); assert.equal(options.addRandomSuffix, false);
    const old = objects.get(path);
    if (old && !options.allowOverwrite) throw new Error('Already exists');
    if (options.ifMatch && old?.etag !== options.ifMatch) throw new Error('Precondition failed');
    const object = { body, etag: `etag-${++version}` }; objects.set(path, object); return { etag: object.etag };
  },
  async del(path, options) {
    if (objects.get(path)?.etag !== options.ifMatch) throw new Error('Precondition failed');
    objects.delete(path);
  },
};
const load = Module._load;
Module._load = function(name, ...args) { return name === '@vercel/blob' ? mockBlob : load.call(this, name, ...args); };
process.env.VERCEL = '1'; process.env.OPENAI_API_KEY = 'offline-test'; process.env.OPENAI_MODEL = 'test-model';
process.env.COMPETITION_ACCESS_TOKEN = 'owner-test'; process.env.CRON_SECRET = 'cron-test';
global.fetch = async () => { throw new Error('Network calls forbidden in offline tests'); };
const { NextRequest } = require('next/server');
const storage = require('../src/lib/competition/storage.ts');
const { createCompetition } = require('../src/lib/competition/engine.ts');
const access = require('../src/lib/competition/access.ts');
const route = require('../src/app/api/competition/route.ts');
const cron = require('../src/app/api/competition/cron/route.ts');
function req(method = 'GET', body, token, origin = 'https://trading-learning-plum.vercel.app') {
 return new NextRequest('https://trading-learning-plum.vercel.app/api/competition', { method, headers: { host: 'trading-learning-plum.vercel.app', ...(origin ? { origin } : {}), ...(token ? { 'x-competition-token': token } : {}), 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
(async () => {
  delete process.env.BLOB_READ_WRITE_TOKEN;
  let response = await route.GET(req()); let data = await response.json();
  assert.equal(response.status, 200); assert.equal(data.setup.storageReady, false); assert.equal(data.competition, null);
  await assert.rejects(() => storage.readCompetition(), /Vercel Blob/);
  console.log('✓ Hosted readiness renders without local-only errors or writes to ephemeral disk');
  assert.equal(access.canMutate(req('POST', {}, undefined)), false);
  assert.equal(access.canMutate(req('POST', {}, 'owner-test', 'https://attacker.example')), false);
  assert.equal(access.canMutate(req('POST', {}, 'owner-test')), true);
  assert.equal((await cron.GET(req())).status, 401);
  assert.equal((await route.POST(req('POST', { action: 'start', capital: 10000 }))).status, 403);
  console.log('✓ Cloud writes require owner authentication and same origin; cron needs its own secret');
  process.env.BLOB_READ_WRITE_TOKEN = 'test-blob-token';
  const c = createCompetition(10000, 'test-model', 'yahoo');
  await storage.exclusive(async () => { assert.equal(await storage.readCompetition(), null); await storage.writeCompetition(c); c.notice = 'Updated'; await storage.writeCompetition(c); });
  assert.equal((await storage.readCompetition()).notice, 'Updated'); assert.equal(objects.has('competition/lease.json'), false);
  console.log('✓ Private storage persists state and intermediate saves using consistent reads and ETags');
  let start; const entered = new Promise((r) => start = r); let release; const barrier = new Promise((r) => release = r);
  const first = storage.exclusive(async () => { start(); await barrier; }); await entered;
  await assert.rejects(() => storage.exclusive(async () => {}), /actualizando/); release(); await first;
  console.log('✓ Concurrent serverless invocations cannot both acquire the lease');
  await assert.rejects(() => storage.exclusive(async () => { const state = await storage.readCompetition(); objects.get('competition/state.json').etag = 'external-writer'; await storage.writeCompetition(state); }), /Precondition/);
  objects.set('competition/lease.json', { body: JSON.stringify({ expiresAt: Date.now() - 1 }), etag: 'old' });
  await storage.exclusive(async () => { assert.ok(await storage.readCompetition()); });
  console.log('✓ Stale writes fail safely and expired leases can be reclaimed');
  assert.equal((await route.GET(req('GET', undefined, 'wrong'))).status, 401);
  data = await (await route.GET(req())).json(); assert.equal(data.competition, null);
  data = await (await route.GET(req('GET', undefined, 'owner-test'))).json(); assert.equal(data.competition.id, c.id);
  console.log('✓ Public visitors cannot read the owner portfolio or private decision evidence');
  objects.clear();
  response = await route.POST(req('POST', { action: 'start', capital: 10000 }, 'owner-test'));
  assert.equal(response.status, 200); data = await response.json(); assert.ok(data.competition.scheduledFor);
  assert.equal(data.competition.portfolios.spy.trades.length, 0);
  const cronReq = new NextRequest('https://trading-learning-plum.vercel.app/api/competition/cron', { headers: { authorization: 'Bearer cron-test' } });
  response = await cron.GET(cronReq); assert.equal(response.status, 200);
  assert.equal((await storage.readCompetition()).portfolios.spy.trades.length, 0);
  console.log('✓ Cloud start and authenticated cron respect tomorrow’s start without model calls');
  console.log('\n7 grupos de pruebas de Vercel aprobados, sin red ni credenciales reales.');
})().catch((e) => { console.error(e); process.exitCode = 1; });
