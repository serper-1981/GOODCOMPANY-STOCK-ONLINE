const {spawn} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const required=['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_KV_NAMESPACE_ID','CLOUDFLARE_API_TOKEN'];
for(const name of required)if(!process.env[name])throw Error('Falta secreto: '+name);
const port=Number(process.env.PORT||3100);
const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port)},stdio:'inherit'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
// Esperar el cierre real del servidor local. Si SIGTERM no alcanza,
// forzar SIGKILL para no dejar la ejecución de Actions colgada.
async function stopServer(){
 if(child.exitCode!==null || child.signalCode!==null)return;
 await new Promise(resolve=>{
  let done=false;
  const finish=()=>{if(done)return;done=true;clearTimeout(timer);resolve();};
  child.once('exit',finish);
  const timer=setTimeout(()=>{
   if(child.exitCode===null && child.signalCode===null)child.kill('SIGKILL');
   // Si el proceso ya no existe pero no llegó el evento, no bloquear Actions.
   setTimeout(finish,1000).unref();
  },5000);
  child.kill('SIGTERM');
 });
}
async function run(){
 try{
  let started=false;
  for(let i=0;i<180;i++){
   if(child.exitCode!==null)throw Error('Servidor finalizó antes de completar la sincronización');
   try{
    const r=await fetch(`http://127.0.0.1:${port}/api/stock`);
    const d=await r.json();
    if(d.sync?.running)started=true;
    if(started && !d.sync?.running){
     if(d.sync?.success===true)break;
     if(d.sync?.success===false)throw Error('Sincronización ADMIN falló; se conserva el catálogo anterior');
    }
   }catch(e){if(/falló/.test(e.message))throw e;}
   await delay(2000);
   if(i===179)throw Error('Tiempo de espera agotado; no se publicó ningún cambio');
  }
  const saved=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/catalogo.json'),'utf8'));
  if(!Array.isArray(saved.products)||!saved.products.length||!saved.savedAt)throw Error('Catálogo inválido');
  const payload=JSON.stringify({updatedAt:saved.savedAt,products:saved.products,refreshMinutes:15,error:null,diagnostic:null});
  const url=`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${process.env.CLOUDFLARE_KV_NAMESPACE_ID}/values/catalogo`;
  const result=await fetch(url,{method:'PUT',headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/json'},body:payload});
  if(!result.ok)throw Error('Cloudflare rechazó la publicación: HTTP '+result.status+' '+(await result.text()).slice(0,500));
  console.log('[PUBLICACIÓN] Catálogo publicado:',saved.products.length,'artículos;',saved.savedAt);
 }finally{await stopServer();}
}
run().catch(e=>{console.error('[PUBLICACIÓN ERROR]',e.message);process.exitCode=1;});
