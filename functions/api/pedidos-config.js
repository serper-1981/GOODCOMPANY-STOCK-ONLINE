// Proxy público de solo lectura: evita CORS y no expone credenciales.
export async function onRequestGet(){
 try{
  const r=await fetch('https://pedidosgoodcompany.com.ar/api/public/stock-pedidos-config',{headers:{'Accept':'application/json'},redirect:'error'});
  if(!r.ok)throw new Error('Servidor de pedidos no disponible');
  const d=await r.json();
  return Response.json({success:d.success===true,whatsapp:String(d.whatsapp||'').replace(/\D/g,'')},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({success:false,error:'No se pudo consultar el número de ventas'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
