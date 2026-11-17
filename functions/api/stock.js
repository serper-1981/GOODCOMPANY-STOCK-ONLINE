export async function onRequestGet({env}) {
 if(!env.STOCK_KV)return new Response(JSON.stringify({error:'Falta configurar STOCK_KV'}),{status:503,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
 const raw=await env.STOCK_KV.get('catalogo');
 if(!raw)return new Response(JSON.stringify({error:'Catálogo todavía no publicado'}),{status:503,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
 return new Response(raw,{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
