// PDF geometry is used only to preserve the publisher's text lines, never to
// infer swimming times. Rows remain evidence excerpts for the source parser.
export function pdfTextLines(items){
 const text=items.filter(item=>typeof item.str==='string'&&item.str.trim()&&Array.isArray(item.transform));
 text.sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4]);
 const lines=[];
 for(const item of text){
  const y=item.transform[5],last=lines.at(-1);
  if(last&&Math.abs(last.y-y)<=1.5)last.items.push(item);
  else lines.push({y,items:[item]});
 }
 return lines.map(line=>line.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(item=>item.str.trim()).join(' '));
}
