import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateAdapter } from './contract.mjs';

test('an investigated provider can remain unavailable without promising operations', () => {
  const adapter = { provider: 'swimsystem', capabilities: [] };
  assert.equal(validateAdapter(adapter), adapter);
});

test('a file adapter may expose reads without advertising updates or an API', () => {
  const adapter = {
    provider: 'synthetic-file',
    capabilities: ['getResults', 'getEvidence'],
    getResults() {},
    getEvidence() {},
  };
  assert.equal(validateAdapter(adapter), adapter);
  assert.equal(adapter.getUpdates, undefined);
});

test('declared and implemented operations must agree', () => {
  assert.throws(() => validateAdapter({ provider: 'test', capabilities: ['getStartlists'] }),
    /CAPABILITY_METHOD_MISMATCH: getStartlists/);
  assert.throws(() => validateAdapter({ provider: 'test', capabilities: [], getUpdates() {} }),
    /CAPABILITY_METHOD_MISMATCH: getUpdates/);
});

test('a data operation must expose provenance', () => {
  assert.throws(() => validateAdapter({ provider: 'test', capabilities: ['getResults'], getResults() {} }),
    /SOURCE_EVIDENCE_REQUIRED/);
});

test('unknown and duplicate capabilities are rejected', () => {
  for (const capabilities of [['scrape'], ['getEvidence', 'getEvidence']]) {
    assert.throws(() => validateAdapter({ provider: 'test', capabilities }),
      /INVALID_PROVIDER_CAPABILITIES/);
  }
});
