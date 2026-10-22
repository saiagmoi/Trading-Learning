/* eslint-disable @typescript-eslint/no-require-imports -- Run the shared competition service without a web server. */
const path = require('node:path');
const root = path.resolve(__dirname, '..');
process.chdir(root);
require('@next/env').loadEnvConfig(root);
require('./register-typescript.cjs');
const { exclusive, readCompetition, writeCompetition } = require('../src/lib/competition/storage.ts');
const { review } = require('../src/lib/competition/service.ts');

exclusive(async () => {
  const c = await readCompetition();
  if (!c) { console.log('Sin ronda: iniciá la competencia desde la web cuando quieras.'); return; }
  try {
    await review(c);
    console.log(c.notice);
  } catch {
    // Avoid secrets or provider response bodies in unattended logs.
    c.notice = 'La actualización automática no pudo obtener los datos o completar la conexión. Se conserva la cartera; se reintentará en la próxima ejecución.';
    await writeCompetition(c);
    console.error(c.notice);
    process.exitCode = 1;
  }
}).catch(() => { console.error('No se pudo acceder al registro local de competencia.'); process.exitCode = 1; });
