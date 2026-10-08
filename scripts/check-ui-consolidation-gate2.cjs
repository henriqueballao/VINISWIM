#!/usr/bin/env node
/**
 * VINISWIM: gate de regressão da consolidação da Visão Geral.
 * Somente leitura. Não acessa Supabase nem altera resultados.
 * Uso: node scripts/check-ui-consolidation-gate2.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const indexFile = path.resolve(__dirname, '../app/index.html');
const index = fs.readFileSync(indexFile, 'utf8');
const assets = [...index.matchAll(/src=["']\.\/assets\/([^"']+\.js)["']/g)];
assert.equal(assets.length, 1, 'O app deve referenciar exatamente um bundle JS principal');
const bundlePath = path.resolve(__dirname, '../app/assets', assets[0][1]);
const js = fs.readFileSync(bundlePath, 'utf8');
const checks = [
  ['Painel unificado no menu', /"dashboard","Visão Geral"/.test(js)],
  ['Resultados mantidos', /"results","Resultados"/.test(js)],
  ['Evolução mantida', /"evolution","Evolução"/.test(js)],
  ['Configurações mantidas', /"settings","Configurações"/.test(js)],
  ['Remover destino Campeonatos do menu', !/"meets","Campeonatos"/.test(js)],
  ['Remover destino Expectativas do menu', !/"expectations","Expectativas"/.test(js)],
  ['Preservar busca V2', js.includes('request_result_refresh_v2')],
  ['Preservar inscrição / balizamento', js.includes('seed_time_ms') && js.includes('meet_entries')],
  ['Preservar projeções', js.includes('Expectativas de tempo') && js.includes('Média recente')],
  ['Preservar ação Buscar campeonatos', js.includes('Buscar campeonatos')],
  ['Preservar ação Novo campeonato', js.includes('Novo campeonato')],
  ['Preservar vínculo de origem oficial', js.includes('official_url')],
  ['Link de prova para fonte oficial com rótulo identificável', js.includes('Abrir fonte oficial da competição')],
  ['Preservar campo meet.venue', js.includes('venue,city,name')],
];
let fails = 0;
for (const [label, ok] of checks) {
  process.stdout.write((ok ? 'PASS ' : 'FAIL ') + label + '\n');
  if (!ok) fails++;
}
console.log(`Gate 2: ${checks.length - fails}/${checks.length} verificações; ${fails} pendências.`);
if (fails) process.exitCode = 1;
