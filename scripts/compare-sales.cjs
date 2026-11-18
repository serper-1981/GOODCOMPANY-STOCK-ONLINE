const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const port=3187;
const catalogUrl=process.env.GC_PUBLISHED_STOCK_URL||'https://goodcompany-stock-online.pages.dev/api/stock';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,GC_AUDIT_ONLY:'1',PORT:String(port)},stdio:'inherit'});
const save=result=>{fs.mkdirSync(path.resolve(__dirname,'../report'),{recursive:true});fs.writeFileSync(path.resolve(__dirname,'../report/comparacion.json'),JSON.stringify(result,null,2))};
(async()=>{
 try{
  const response=await fetch(catalogUrl,{signal:AbortSignal.timeout(30000),headers:{'Cache-Control':'no-cache'}});
  if(!response.ok)throw Error(`No se pudo leer catálogo publicado: HTTP ${response.status}`);
  const catalog=await response.json();
  if(!Array.isArray(catalog.products)||!catalog.products.length)throw Error('El catálogo publicado no contiene artículos');
  const codes=[...new Set(catalog.products.map(p=>String(p.code||'').trim().toUpperCase()).filter(Boolean))];
  if(codes.length!==catalog.products.length)throw Error('Hay artículos sin código o códigos duplicados en catálogo publicado');
  const updatedAt=catalog.updatedAt||catalog.savedAt;
  if(!updatedAt||!Number.isFinite(Date.parse(updatedAt)))throw Error('El catálogo publicado no informa una fecha válida de actualización');
  let result;
  for(let i=0;i<20;i++){
   try{
    const r=await fetch(`http://127.0.0.1:${port}/api/auditoria-ventas-ejecutar`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({codes,updatedAt}),signal:AbortSignal.timeout(300000)});
    result=await r.json();
    if(!r.ok)throw Error(result.note||`HTTP ${r.status}`);
    break;
   }catch(e){if(e.name==='TimeoutError'||i===19)throw e;await sleep(1500)}
  }
  save(result);
  console.log('[COMPARACIÓN]',result.status,'CATÁLOGO:',result.adminStockSi,'VENTAS:',result.publicCount,'NOTA:',result.note);
  if(result.status==='verificado')console.log('[FALTANTES CONFIRMADOS]',result.missingFromSales.join(', ')||'Ninguno');
  else console.log('[COMPARACIÓN INCOMPLETA] No se confirman faltantes.');
 }catch(e){save({status:'error',note:e.message,missingFromSales:[],checkedAt:new Date().toISOString()});console.error('[COMPARACIÓN ERROR]',e.message);process.exitCode=1}
 finally{child.kill('SIGTERM');setTimeout(()=>child.kill('SIGKILL'),3000).unref()}
})().catch(e=>{console.error(e);process.exitCode=1});
