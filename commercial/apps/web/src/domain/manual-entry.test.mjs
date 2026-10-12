import {test} from 'node:test';
import assert from 'node:assert/strict';
import {optionalEntryNumber,manualSeedTime} from './manual-entry.ts';
test('lane zero is valid, blanks stay null, invalid ranges/fractions are rejected',()=>{
 assert.equal(optionalEntryNumber('0',0,9),0);assert.equal(optionalEntryNumber('',0,9),null);
 for(const x of ['10','-1','1.2','abc'])assert.throws(()=>optionalEntryNumber(x,0,9));
 assert.throws(()=>optionalEntryNumber('0',1,999));
});
test('invalid non-empty seed time is rejected rather than saved as absent',()=>{
 assert.equal(manualSeedTime('',()=>null),null);assert.equal(manualSeedTime('42"07',()=>42070),42070);
 for(const n of [null,0,-1,NaN,1.5])assert.throws(()=>manualSeedTime('invalid',()=>n));
});
