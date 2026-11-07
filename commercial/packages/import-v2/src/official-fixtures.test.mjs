import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {parseSeededStartlist} from './swimsystem-seeded.mjs';
import {parseModernResultBook} from './swimsystem-modern-results.mjs';
const root=new URL('../fixtures/official-20261011/',import.meta.url);
const provenance=JSON.parse(fs.readFileSync(new URL('provenance.json',root)));
function document(name){const meta=provenance.documents.find(d=>d.fixture===name),text=fs.readFileSync(new URL(name,root),'utf8');assert.equal(createHash('sha256').update(text).digest('hex'),meta.textHash);return {...meta,text,sourceUrl:meta.url};}
test('official captured startlist recovers all four Vini heats, lanes and Brasilia times',()=>{
 const entries=parseSeededStartlist({...document('seeded.txt'),identity:{externalId:'422692'}});
 assert.deepEqual(entries.map(e=>[e.event,e.heat,e.lane,e.scheduledAt]),[['100 Costas',1,5,'2026-10-10T19:59:00.000Z'],['50 Livre',1,5,'2026-10-10T20:50:00.000Z'],['50 Costas',2,8,'2026-10-11T12:38:00.000Z'],['100 Livre',1,5,'2026-10-11T14:26:00.000Z']]);
 assert.deepEqual(entries.map(e=>e.seedTimeMs),[106090,null,50240,95180]);
 for(const e of entries){assert.equal(e.kind,'seeded_entry');assert.match(e.rawHash,/^[a-f0-9]{64}$/);assert.ok(e.sourceBlock.includes('422692'));}
});
test('captured official results remain separate from inscription times and preserve exact identity',()=>{
 const doc=document('results.txt'),meet={sourceCode:'swimsystem',externalMeetId:provenance.meetId};
 const vini=parseModernResultBook({...doc,meet,identity:{externalId:'422692'}}),lorenzo=parseModernResultBook({...doc,meet,identity:{externalId:'399680'}});
 assert.deepEqual(vini.map(r=>[r.event,r.timeMs]),[['100 Costas',103910],['50 Livre',43780]]);
 assert.deepEqual(lorenzo.map(r=>[r.event,r.timeMs]),[['100 Borboleta',102710],['50 Livre',33380]]);
 assert.equal(parseModernResultBook({...doc,meet,identity:{externalId:'393259'}}).length,0);
 assert.equal(parseModernResultBook({...doc,meet,identity:{externalId:'42269'}}).length,0);
 assert.equal(parseSeededStartlist({...doc,identity:{externalId:'422692'}}).length,0);
});
test('official startlist reprocessing is deterministic and supports lane zero',()=>{
 const input={...document('seeded.txt'),identity:{externalId:'399680'}};
 const entries=parseSeededStartlist(input);
 assert.deepEqual(entries,parseSeededStartlist(input));assert.equal(entries.length,5);assert.equal(entries.find(e=>e.event==='100 Borboleta').lane,0);
 assert.equal(parseSeededStartlist({...input,identity:{externalId:'39968'}}).length,0);
});
