import test from "node:test";
import assert from "node:assert/strict";
import {parseResultList} from "./resultlist-parser.mjs";
test("legacy two-digit date",()=>{const r=parseResultList({text:"Prova 40 Masculino, 50m Livre Mirim 6/4/25 - 11:52 Resultados\n20. 3 / 7 Atleta Teste 700001 2015 Clube 53.09 118% - 54",identity:{externalId:"700001"},meet:{sourceCode:"swimsystem",externalMeetId:"x",course:"SCM"},sourceUrl:"fixture://x",retrievedAt:"2026-10-07T00:00:00Z"});assert.equal(r.length,1);assert.equal(r[0].resultDate,"2025-04-06");assert.equal(r[0].timeMs,53090);});