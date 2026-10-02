#!/usr/bin/env node
/**
 * VINISWIM source probe — READ ONLY.
 *
 * Fetches an official/public results URL and emits normalized JSON.
 * It never connects to Supabase and never writes athlete/results data.
 *
 * Usage:
 *   node source-probe.mjs --url "https://..." [--athlete-id 422692] [--athlete-name "Nome"]
 *
 * For client-rendered pages, pass --dynamic. This requires Playwright to be
 * installed locally; static/API requests use Node's built-in fetch.
 */
import process from "node:process";

function arg(name) {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 ? process.argv[i + 1] : null;
}
const url = arg("url");
const athleteId = arg("athlete-id") || "";
const athleteName = arg("athlete-name") || "";
const dynamic = process.argv.includes("--dynamic");
if (!url) {
  console.error("Usage: node source-probe.mjs --url <url> [--athlete-id id] [--athlete-name name] [--dynamic]");
  process.exit(2);
}

const normalize = (s="") => String(s).normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase().replace(/\s+/g," ").trim();

export function parseTime(value) {
  const raw = String(value ?? "").trim().replace(",", ".").replace(/[”″]/g, '"').replace(/[’′]/g, "'");
  if (!raw) return null;
  let m = raw.match(/^(\d+):(\d{1,2})(?:\.(\d{1,2}))?$/);
  if (m) return { text: `${m[1]}:${m[2].padStart(2,"0")}.${(m[3]||"00").padEnd(2,"0")}`, seconds: +(Number(m[1])*60+Number(m[2])+Number("0."+(m[3]||"0"))).toFixed(2) };
  m = raw.match(/^(\d+)['’](\d{1,2})["”]?(\d{1,2})?$/);
  if (m) return { text: `${m[1]}:${m[2].padStart(2,"0")}.${(m[3]||"00").padEnd(2,"0")}`, seconds: +(Number(m[1])*60+Number(m[2])+Number("0."+(m[3]||"0"))).toFixed(2) };
  m = raw.match(/^(\d{1,3})["”](\d{1,2})$/) || raw.match(/^(\d{1,3})(?:\.(\d{1,2}))?$/);
  if (m) {
    const sec = +(Number(m[1])+Number("0."+(m[2]||"0"))).toFixed(2);
    return { text: `${Math.floor(sec/60)}:${String(Math.floor(sec%60)).padStart(2,"0")}.${String(Math.round((sec%1)*100)).padStart(2,"0")}`, seconds: sec };
  }
  return null;
}

function statusOf(s) {
  const x=normalize(s);
  if (/\bdns\b|nao compareceu/.test(x)) return "dns";
  if (/\bdql\b|\bdsq\b|\bdq\b|desclassific/.test(x)) return "dsq";
  if (/\bdnf\b|nao completou|abandonou/.test(x)) return "dnf";
  return "valid";
}
function eventOf(s) {
  const m=String(s).match(/((?:\d+x)?\d{2,4})\s*m?\s+(Livre|Costas|Peito|Borboleta|Medley)/i);
  return m ? m[1]+" "+m[2] : null;
}
function dateOf(s) {
  const m=String(s).match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  return m ? `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}` : null;
}
function athleteMatches(s) {
  const x=normalize(s);
  if (athleteId && x.includes(normalize(athleteId))) return true;
  if (athleteName && x.includes(normalize(athleteName))) return true;
  return !athleteId && !athleteName;
}

async function fetchText(target) {
  const r=await fetch(target,{headers:{"user-agent":"VINISWIM Source Probe/1.0","accept":"text/html,application/json,text/plain,*/*"}});
  if(!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
  return {text:await r.text(), contentType:r.headers.get("content-type")||""};
}
async function fetchDynamic(target) {
  let chromium;
  try { ({chromium}=await import("playwright")); }
  catch { throw new Error("Playwright não instalado. Instale no ambiente de diagnóstico ou rode sem --dynamic."); }
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.goto(target,{waitUntil:"domcontentloaded",timeout:30000});
    await page.waitForSelector("table, [role=table], tbody",{timeout:15000});
    return {text:await page.content(),contentType:"text/html"};
  } finally { await browser.close(); }
}

function extractFromJson(obj) {
  const out=[];
  const visit=(v)=>{
    if(Array.isArray(v)) return v.forEach(visit);
    if(!v || typeof v!=="object") return;
    const flat=JSON.stringify(v);
    if(athleteMatches(flat)){
      const timeValue=v.time ?? v.result_time ?? v.resultTime ?? v.tempo ?? v.mark ?? v.result;
      const parsed=parseTime(timeValue);
      const event=v.event ?? v.event_name ?? v.eventName ?? v.prova ?? null;
      if(parsed || /dns|dnf|dsq|dql/i.test(flat)) out.push({
        event_label:event ? String(event) : eventOf(flat),
        result_date:v.date ?? v.result_date ?? v.resultDate ?? dateOf(flat),
        course:v.course ?? v.pool ?? null,
        status:statusOf(v.status ?? flat),
        time_text:parsed?.text ?? null,
        time_seconds:parsed?.seconds ?? null,
        time_ms:parsed ? Math.round(parsed.seconds*1000) : null,
        source_url:url,
        raw:v
      });
    }
    Object.values(v).forEach(visit);
  };
  visit(obj); return out;
}
function htmlText(fragment="") {
  return String(fragment).replace(/<script\\b[\\s\\S]*?<\\/script>/gi," ").replace(/<style\\b[\\s\\S]*?<\\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/\\s+/g," ").trim();
}
function extractFromHtml(html) {
  // Strict diagnostic rule: parse only the RESULT column, never the seed/
  // "Inscrição" column. A row like "55.90 | —" must produce zero results.
  const pageText=htmlText(html);
  const pageDate=dateOf(pageText);
  const pageCourse=/Piscina Curta|\\b25\\s*m\\b/i.test(pageText)?"SCM":/Piscina Longa|\\b50\\s*m\\b/i.test(pageText)?"LCM":null;
  const pageEvent=eventOf(pageText);
  const out=[];
  const matches=[...html.matchAll(/<tr\\b[^>]*>([\\s\\S]*?)<\\/tr>/gi)];
  let currentHeaders=[];
  for(const rm of matches){
    const raw=rm[1], row=htmlText(raw);
    const th=[...raw.matchAll(/<th\\b[^>]*>([\\s\\S]*?)<\\/th>/gi)].map(m=>normalize(htmlText(m[1])));
    if(th.length){ currentHeaders=th; continue; }
    if(!athleteMatches(row)) continue;
    const cells=[...raw.matchAll(/<td\\b[^>]*>([\\s\\S]*?)<\\/td>/gi)].map(m=>htmlText(m[1]));
    if(!cells.length) continue;
    const event=eventOf(row)||pageEvent;
    if(!event) continue;
    let resultIndex=currentHeaders.findIndex(h=>/resultado|tempo final|marca/.test(h));
    if(resultIndex<0) continue; // never guess a result column
    const resultCell=cells[resultIndex]||"";
    const status=statusOf(resultCell);
    const parsed=status==="valid"?parseTime(resultCell):null;
    if(!parsed && status==="valid") continue; // dash/blank/NT is not a result
    out.push({
      event_label:event,
      result_date:dateOf(row)||pageDate,
      course:/\\b25\\s*m\\b/i.test(row)?"SCM":/\\b50\\s*m\\b/i.test(row)?"LCM":pageCourse,
      status,
      time_text:parsed?.text ?? null,
      time_seconds:parsed?.seconds ?? null,
      time_ms:parsed ? Math.round(parsed.seconds*1000) : null,
      source_url:url,
      raw_row:row,
      provenance:{result_column:resultIndex,result_cell:resultCell}
    });
  }
  return out;
}

const fetched=dynamic ? await fetchDynamic(url) : await fetchText(url);
let mode="html", data;
try {
  if (/json/i.test(fetched.contentType) || /^[\s]*[\[{]/.test(fetched.text)) {
    data=extractFromJson(JSON.parse(fetched.text)); mode="json";
  } else data=extractFromHtml(fetched.text);
} catch(e) {
  if (/json/i.test(fetched.contentType)) throw e;
  data=extractFromHtml(fetched.text);
}
console.log(JSON.stringify({
  probe_version:1,
  read_only:true,
  mode,
  source_url:url,
  athlete_filter:{external_id:athleteId||null,name:athleteName||null},
  count:data.length,
  results:data
},null,2));
