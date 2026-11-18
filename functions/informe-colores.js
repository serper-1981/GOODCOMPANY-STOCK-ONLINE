const htmlEscape = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
function printColorsHtml(products) {
  const sortCodes=(a,b)=>String(a.code||'').localeCompare(String(b.code||''),'es',{numeric:true});
  const national=[],imported=new Map(),offers=[];
  for(const p of products){
    const line=String(p.line||'').toUpperCase(),cat=String(p.category||'').trim();
    const joined=(line+' '+cat).toUpperCase();
    const isImported=/IMPORTAD|JENBACH|\bOFERTAS?\b/.test(joined);
    if(!isImported){national.push(p);continue;}
    // OFERTAS: un único apartado para promociones importadas, incluidas JENBACH.
    // Usar tanto la clasificación administrativa como los precios promocionales.
    const isOffer=/\bOFERTAS?\b/i.test(joined) || !!(p.offerPrices?.discounted);
    if(isOffer){offers.push(p);continue;}
    const jenbach=/JENBACH/i.test(joined);
    let section=cat.toUpperCase()
      .replace(/\bIMPORTAD[AO]S?\b/g,'')
      .replace(/\bOFERTAS?\b/g,'')
      .replace(/[—–-]+/g,' ')
      .replace(/\s+/g,' ').trim();
    if(jenbach)section='JENBACH';
    else if(!section)section='OTROS IMPORTADOS';
    if(!imported.has(section))imported.set(section,[]);
    imported.get(section).push(p);
  }
  const colors=p=>[...new Set((Array.isArray(p.colors)?p.colors:[]).map(c=>typeof c==='string'?c.trim():String(c?.name||c?.color||'').trim()).filter(Boolean))];
  const table=(title,items)=>{
    const COLOR_COLUMNS=Math.max(1,...items.map(p=>colors(p).length));
    const rows=items.sort(sortCodes).map(p=>{
      const available=colors(p);
      const cells=Array.from({length:COLOR_COLUMNS},(_,j)=>`<td class="color-cell">${available[j]?htmlEscape(available[j]):'&nbsp;'}</td>`).join('');
      return `<tr><td class="article-cell">${htmlEscape(p.code)}</td>${cells}</tr>`;
    }).join('');
    return `<section><h2>${htmlEscape(title)} <small>(${items.length} artículos)</small></h2><table style="--color-width:${(88/COLOR_COLUMNS).toFixed(4)}%"><colgroup><col class="article-column">${'<col class="color-column">'.repeat(COLOR_COLUMNS)}</colgroup><thead><tr><th>ARTÍCULO</th><th colspan="${COLOR_COLUMNS}">COLORES DISPONIBLES</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  };
  const importedSections=[...Array.from(imported.entries()).sort(([a],[b])=>a.localeCompare(b,'es')).map(([name,items])=>table('MERCADERÍA IMPORTADA — '+name,items))];
  if(offers.length)importedSections.push(table('MERCADERÍA IMPORTADA — OFERTAS',offers));
  const sections=table('MERCADERÍA NACIONAL',national)+(importedSections.length?`<div class="imported-start">${importedSections.join('')}</div>`:'');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GOOD COMPANY - Informe para imprimir</title><style>
  @page{size:A4 portrait;margin:8mm}
  *{box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#111;background:white;margin:0;padding:8mm}
  .print-logo{display:block;width:235px;max-width:65%;height:auto;max-height:52px;object-fit:contain;margin:0 auto 5px}
  .sub{text-align:center;font-size:11px;margin:0 0 10px}
  .toolbar{display:flex;gap:10px;margin-bottom:12px}
  button{background:#153c5e;color:white;border:0;padding:10px 15px;border-radius:5px;cursor:pointer;font-size:14px}
  section{margin-bottom:13px}
  .imported-start{break-before:page;page-break-before:always}
  h2{font-size:13px;background:#ddd;padding:5px 7px;margin:0 0 3px;break-after:avoid;page-break-after:avoid}
  small{font-size:10px;font-weight:normal}
  table{border-collapse:collapse;width:100%;font-size:10px;table-layout:fixed}
  thead{display:table-header-group}
  tr{break-inside:avoid;page-break-inside:avoid}
  th,td{border:.65px solid #555;padding:3px 2px;text-align:center;vertical-align:middle;line-height:1.08;overflow-wrap:break-word}
  th{background:#e8e8e8;font-size:10px;padding:4px 2px}
  .article-column{width:12%}.color-column{width:var(--color-width)}
  th:first-child,td:first-child{font-weight:800}
  .article-cell{font-size:11px;white-space:nowrap}
  .color-cell{font-size:9px;font-weight:600;word-break:normal;hyphens:none}
  @media print{body{padding:0}.toolbar{display:none}.imported-start{break-before:page;page-break-before:always}h2,th{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body><div class="toolbar"><button onclick="window.print()">IMPRIMIR A4 VERTICAL</button><button onclick="window.close()">Cerrar</button></div><img class="print-logo" src="https://raw.githubusercontent.com/serper-1981/LOGOS/9c6587df170a9f27634b3ba05e01eabc4de636a2/NUEVO%20LOGO%20GC.png" alt="GOOD COMPANY"><p class="sub">ARTÍCULOS Y COLORES DISPONIBLES · ${products.length} artículos · ${new Date().toLocaleDateString('es-AR')}</p>${sections}</body></html>`;
}

export async function onRequestGet({env}) {
 if(!env.STOCK_KV)return new Response('Falta configurar STOCK_KV',{status:503});
 const raw=await env.STOCK_KV.get('catalogo');
 if(!raw)return new Response('No hay catálogo publicado',{status:503});
 const data=JSON.parse(raw);
 if(!Array.isArray(data.products)||!data.products.length)return new Response('Catálogo vacío',{status:503});
 return new Response(printColorsHtml(data.products),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
}
