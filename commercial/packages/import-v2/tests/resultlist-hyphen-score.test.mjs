import test from 'node:test';
import assert from 'node:assert/strict';
import {parseResultList} from '../src/resultlist-parser.mjs';

const meet={sourceCode:'fdap',externalMeetId:'38330',course:'SCM'};
const identity={externalId:'399680',canonicalName:'Lorenzo De Fortes'};
const metadata={identity,meet,sourceUrl:'https://swimsystem.swimtimebrasil.com/38330/ResultList_8.pdf',retrievedAt:'2026-10-09T12:00:00Z'};

test('ResultList parses real legacy hyphen-score format without inventing marks',()=>{
 const text='Campeonato Superparanaense 2024 Prova 8 Masculino, 50m Costas Mirim 07/12/2024 Resultados Col. S/R Nome Reg. Nasc. Entidade Tempo % Pts. AQUA 4. 3 / 2 Outro Atleta 111111 2015 Curitibano 46.50 - 98 5. 7 / 1 Lorenzo De Fortes 399680 2015 Curitibano 47.99 - 97 6. 2 / 3 Proximo Atleta 222222 2015 Curitibano 48.46 - 94';
 const out=parseResultList({text,...metadata});
 assert.equal(out.length,1);
 assert.equal(out[0].timeMs,47990);
 assert.equal(out[0].status,'valid');
 assert.equal(out[0].event,'50 Costas');
 assert.equal(out[0].resultDate,'2024-12-07');
});

test('N/C is absent/DNS, never disqualified or a fabricated time',()=>{
 const text='Campeonato Superparanaense 2024 Prova 998 Masculino, 50m Livre Mirim 08/12/2024 Resultados Col. S/R Nome Reg. Nasc. Entidade Tempo N/C 5 / 6 Lorenzo De Fortes 399680 2015 Curitibano -N/C 2 / 6 Outro Atleta 222222 2015 Curitibano -';
 const out=parseResultList({text,...metadata});
 assert.equal(out.length,1);
 assert.equal(out[0].status,'dns');
 assert.equal(out[0].timeMs,null);
});
