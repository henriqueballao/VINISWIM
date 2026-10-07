import test from "node:test";import assert from "node:assert/strict";import {classifyImportFailure,FAILURE_CODES,retryState} from "./failure-states.mjs";
test("Gate 5 classifies TLS distinctly",()=>assert.equal(classifyImportFailure({message:"TLS handshake failed"}).code,FAILURE_CODES.TLS));
test("Gate 5 classifies timeout distinctly",()=>assert.equal(classifyImportFailure({message:"The signal has been aborted"}).code,FAILURE_CODES.TIMEOUT));
test("Gate 5 classifies missing document distinctly",()=>assert.equal(classifyImportFailure({httpStatus:404}).code,FAILURE_CODES.DOCUMENT_MISSING));
test("Gate 5 classifies HTML changes distinctly",()=>assert.equal(classifyImportFailure({htmlChanged:true}).code,FAILURE_CODES.HTML_CHANGED));
test("Gate 5 classifies parser no-match distinctly",()=>assert.equal(classifyImportFailure({parserMatched:false}).code,FAILURE_CODES.PARSER_NO_MATCH));
test("Gate 5 retry is code-driven, not manual job editing",()=>{const f=classifyImportFailure({message:"timeout"});assert.deepEqual(retryState(f,2),{status:"pending",attempts:2,lastError:null,failureCode:"timeout"})});
