import test from 'node:test';import assert from 'node:assert/strict';
import {pdfTextLines} from './pdf-lines.mjs';
const item=(str,x,y)=>({str,transform:[1,0,0,1,x,y]});
test('source PDF rows retain registration, heat/lane, date and time without neighboring-row merge',()=>{
 const lines=pdfTextLines([item('700002',120,50),item('00:34.56',200,50),item('700001',120,60),item('00:35.67',200,60),item('1',10,60),item('SYNTHETIC A',30,60),item('2',10,50),item('SYNTHETIC B',30,50),{type:'beginMarkedContent'}]);
 assert.deepEqual(lines,['1 SYNTHETIC A 700001 00:35.67','2 SYNTHETIC B 700002 00:34.56']);
});
