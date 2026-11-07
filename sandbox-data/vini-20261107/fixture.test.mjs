import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const data=JSON.parse(readFileSync(new URL('./fixture.json',import.meta.url),'utf8'));

test('dataset is isolated, scoped to two distinct athletes',()=>{
  assert.equal(data.kind,'isolated_fixture_not_live_db');
  assert.equal(data.accounts.length,2);
  assert.equal(new Set(data.accounts.map(a=>a.athlete_id)).size,2);
  for(const a of data.accounts) {
    assert.equal(a.records.length,34);
    assert.ok(a.records.every(r=>r.athlete_id===a.athlete_id));
    assert.equal(a.records.filter(r=>r.status==='result').length,32);
    assert.equal(a.records.filter(r=>r.seed_time_ms!==undefined).length,4);
    assert.equal(a.records.filter(r=>r.status==='entry_only').length,2);
    assert.ok(a.records.filter(r=>r.status==='entry_only').every(r=>r.time_ms===null&&r.result_time===null));
    assert.equal(a.records.find(r=>r.key==='2026-11-08-83').lane,0);
    assert.equal(a.records.find(r=>r.key==='2026-11-07-47').time_ms,99680);
    assert.equal(a.records.find(r=>r.key==='2026-11-06-11').time_ms,48490);
    assert.equal(new Set(a.records.map(r=>r.key)).size,34);
  }
});
