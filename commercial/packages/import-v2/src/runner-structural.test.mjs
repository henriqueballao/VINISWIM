import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src=fs.readFileSync("../../supabase/functions/import-v2-runner/index.ts","utf8");

test("V2 historical scan is full, not capped by existing max result date",()=>{
 assert.equal(src.includes("const cutoff=maxDate"),false);
 assert.equal(src.includes("const archives=aq.data||[];"),true);
});

test("V2 may promote only a same-competition legacy row backed by official candidate",()=>{
 assert.equal(src.includes('external===archiveKey||external.endsWith(":sw-"+archiveKey)'),true);
 assert.equal(src.includes('result_date:c.resultDate'),true);
 assert.equal(src.includes('result_fingerprint:fp'),true);
});

test("V2 production runner has no athlete-specific branch",()=>{
 assert.equal(/vinicius|422692|andre|393259|lorenzo|399680/i.test(src),false);
});

test("V2 persists official provenance after insert or promotion",()=>{
 assert.equal(src.includes('from("result_sources").upsert'),true);
 assert.equal(src.includes('parser_version:c.parserVersion'),true);
});
