import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
const src=fs.readFileSync("../../supabase/functions/monitor-runner/index.ts","utf8");
test("production importer has no athlete diagnostic execution hook",()=>{assert.equal(src.includes("force_athlete_id"),false)});
test("current SwimSystem discovery has no arbitrary first-20 cap",()=>{assert.equal(src.includes("].slice(0,20)"),false)});
test("legacy persistence honors document result date",()=>{assert.equal(src.includes("const date=r.resultDate||m.start_date"),true)});
test("legacy ResultList cache is canonical historical input",()=>{assert.equal(src.includes("historical_document_text_cache"),true);assert.equal(src.includes("document:'ResultList'"),true)});
test("production importer contains no Vini-specific branch",()=>{assert.equal(/legacy-vini|vinicius|422692/i.test(src),false)});

test("current discovery is resumable across the full catalog",()=>{assert.equal(src.includes("current_discovery_cursor"),true);assert.equal(src.includes("nextCursor>=ids.length"),true)});
test("SwimSystem identity is not rebound to a single meet URL",()=>{assert.equal(src.includes("source_url:raw"),false)});
test("current discovery batch is bounded",()=>{assert.equal(src.includes("const id=ids[cursor]"),true)});
test("current discovery scopes to upcoming meets",()=>{assert.equal(src.includes("split(/Competições anteriores/i)[0]"),true)});
test("current discovery bounds official document fetches",()=>{assert.equal(src.includes("pdfLinks.slice(pdfCursor,pdfCursor+2)"),true)});
test("current discovery resumes within a meet",()=>{assert.equal(src.includes("current_discovery_pdf_cursor"),true);assert.equal(src.includes("current_discovery_meet_id"),true)});
test("current discovery persists resumable metadata",()=>{assert.equal(src.includes("...(scan.metadata||{})"),true)});
// Production cutover structural gate.
