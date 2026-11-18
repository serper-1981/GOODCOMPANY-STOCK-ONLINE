let categoryOrder=[];let products=[];const root=document.querySelector('#catalog'),status=document.querySelector('#status'),search=document.querySelector('#search'),filter=document.querySelector('#filter'),colorFilter=document.querySelector('#color-filter'),refresh={disabled:false};
const imported=x=>/IMPORTAD/i.test((x.line||'')+' '+(x.motivo||'')) || /\bJENBACH\b/i.test([x.category,x.description,x.code].join(' '));
// JENBACH es una marca, no un sinónimo de IMPORTADO.
// Se identifica por las categorías explícitas de MASTER (MOCHILAS JENBACH,
// BILLETERAS JENBACH, OFERTA JENBACH), nunca solo por el motivo IMPORTADO.
const jenbach=x=>/\bJENBACH\b/i.test([x.category,x.description,x.code,x.line].join(' '));
const offer=x=>Boolean(x.offerPrices?.normal&&x.offerPrices?.discounted)||/\bOFERTAS?\b|\d+\s*%\s*OFF|PROMOCI[ÓO]N/i.test([x.code,x.category,x.line,x.description].join(' '));
// Formato visual argentino: no altera los importes guardados en MASTER.
function formatMoney(value){
  const raw=String(value??'').replace(/[^\d.,]/g,'').trim();
  if(!raw)return String(value??'');
  // Los precios de MASTER se expresan en pesos enteros con puntos de miles.
  const digits=raw.replace(/\D/g,'');
  return '$'+digits.replace(/\B(?=(\d{3})+(?!\d))/g,'.');
}
function amountWithIva(container,price,priceClass){
  container.append(el('span',priceClass,formatMoney(price)),el('span','iva-note','+ IVA'));
}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
// Filtros basados en categorías reales de MASTER, sin excluir productos JENBACH.
const normalized=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
const categoryOf=x=>normalized(x.category)||'SIN CATEGORIA';
const baseCategory=x=>categoryOf(x).replace(/\bJENBACH\b/g,'').replace(/\bOFERTAS?\b/g,'').replace(/\s+/g,' ').trim();
const national=x=>!imported(x)&&!jenbach(x);
const lineGroup=x=>jenbach(x)?'jenbach':(imported(x)?'imported':'national');
// Prioridad visual: NUEVA TEMPORADA al comienzo, sin alterar los datos de MASTER.
const newSeason=x=>/NUEVA\s+TEMPORADA/i.test([x.category,x.description,x.code,x.line].join(' '));
// Secciones dinámicas: nacional primero, importado después y ofertas al final.
// Cada opción guarda la línea para evitar mezclar categorías con el mismo nombre.
const canonicalCategory=x=>normalized(x).replace(/\bPARAGAS\b/g,'PARAGUAS').replace(/\bPORTA\s*COSMETICOS\b/g,'PORTACOSMETICOS').replace(/\bPORTA\s*CELULARES\b/g,'PORTACELULARES');
function matchesCategory(x,f){
  if(f==='all')return true;
  if(f==='season')return national(x)&&newSeason(x);
  if(f==='offers')return offer(x);
  if(f==='national'||f==='imported'||f==='jenbach')return lineGroup(x)===f;
  if(f.startsWith('offers:'))return offer(x)&&lineGroup(x)===f.slice(7);
  if(f.startsWith('cat:')){
    const parts=f.split(':');
    if(parts.length!==3||lineGroup(x)!==parts[1])return false;
    return canonicalCategory(categoryOf(x))===parts[2];
  }
  return false;
}
function updateCategories(){
  const selected=filter.value;
  filter.replaceChildren();
  const add=(parent,value,label)=>{const option=document.createElement('option');option.value=value;option.textContent=label;parent.append(option)};
  const mobile=window.matchMedia('(max-width:768px)').matches;
  add(filter,'all',mobile?'CATEGORÍA':'VER TODOS');
  if(mobile)add(filter,'__todos_categoria__','VER TODOS');
  const categories={national:new Map(),imported:new Map(),jenbach:new Map()};
  for(const x of products){
    const category=categoryOf(x);
    if(category==='SIN CATEGORIA')continue;
    const key=canonicalCategory(category);
    const destination=categories[lineGroup(x)];
    // Las ofertas permanecen también en su categoría habitual cuando MASTER la informa.
    // Si MASTER solo dice OFERTAS, aparecen en OFERTAS de su línea.
    if(!destination.has(key)&&!/^OFERTAS?(?: NACIONAL| IMPORTADO| IMPORTADAS| JENBACH)?$/.test(key))destination.set(key,category);
  }
  const section=(title,value,withSeason=false)=>{
    const group=document.createElement('optgroup');group.label=title;
    add(group,value,'TODOS · '+title);
    if(withSeason&&products.some(x=>national(x)&&newSeason(x)))add(group,'season','NUEVA TEMPORADA');
    for(const [key,label] of [...categories[value]].sort((a,b)=>a[1].localeCompare(b[1],'es',{sensitivity:'base'}))){
      if(withSeason&&key==='NUEVA TEMPORADA')continue;
      add(group,'cat:'+value+':'+key,label);
    }
    filter.append(group);
  };
  section('LÍNEA NACIONAL','national',true);
  section('LÍNEA IMPORTADA','imported');
  section('LÍNEA JENBACH','jenbach');
  if(products.some(offer)){
    const group=document.createElement('optgroup');group.label='OFERTAS';
    add(group,'offers','OFERTAS');
    filter.append(group);
  }
  filter.value=[...filter.querySelectorAll('option')].some(o=>o.value===selected)?selected:'all';
}
// Filtro de colores: exclusivamente artículos de LÍNEA NACIONAL publicados con STOCK=SI.
// Normalizamos tildes, mayúsculas y espacios, sin perder el nombre mostrado en ADMIN.
function availableColors(x){
 const fromNames=Array.isArray(x.colors)?x.colors:[];
 const fromImages=Array.isArray(x.colorImages)?x.colorImages.map(c=>c.name):[];
 return [...fromNames,...fromImages].map(c=>String(c||'').trim()).filter(Boolean);
}
// Los nombres originales de MASTER se conservan como valores del filtro.
// Un nombre de una sola palabra es PU. Para nombres compuestos se detecta
// el material como prefijo, sin una lista cerrada de materiales.
const COMPOUND_COLORS=new Set(['AZUL MARINO','VERDE MILITAR','VERDE AGUA','ROSA VIEJO','ROSA PALO','GRIS TOPO','GRIS PERLA','BLANCO HUESO','MARRON CHOCOLATE','MARRÓN CHOCOLATE','NATURAL CLARO','NATURAL OSCURO','NEGRO MATE','NEGRO BRILLO','BEIGE CLARO','BEIGE OSCURO','AZUL FRANCIA','AZUL PETROLEO','AZUL PETRÓLEO','VERDE BOTELLA','VERDE OLIVA','ROJO BORDO','ROJO BORDÓ']);
function materialAndColor(name){
 const value=normalized(name);
 const words=value.split(' ').filter(Boolean);
 if(words.length<=1)return {material:'PU',color:value};
 if(COMPOUND_COLORS.has(value))return {material:'PU',color:value};
 // Para materiales nuevos como REPTIL, GAMUZA, etc., no hay lista fija.
 return {material:words[0],color:words.slice(1).join(' ')};
}
function updateColorFilter(){
 const selected=colorFilter.value;
 const names=new Map();
 for(const x of products.filter(national))for(const name of availableColors(x)){
   const key=normalized(name);
   if(key&&!names.has(key))names.set(key,materialAndColor(name));
 }
 colorFilter.replaceChildren();
 const mobile=window.matchMedia('(max-width:768px)').matches;
 const add=(value,label)=>{const option=document.createElement('option');option.value=value;option.textContent=label;colorFilter.append(option)};
 add('',mobile?'COLORES':'TODOS');
 if(mobile)add('__todos_colores__','TODOS');
 const entries=[...names.entries()].sort((a,b)=>{
   const ma=a[1].material,mb=b[1].material;
   if(ma!==mb){if(ma==='PU')return -1;if(mb==='PU')return 1;return ma.localeCompare(mb,'es',{sensitivity:'base'});}
   return a[1].color.localeCompare(b[1].color,'es',{sensitivity:'base'});
 });
 for(const [key,{material,color}] of entries)add(key,material+' '+color);
 colorFilter.value=names.has(selected)?selected:'';
}
// El orden configurado desde ELEGIR ORDEN DE VISTA es la prioridad.
// OFERTAS es un filtro, no una categoría que pueda desplazar artículos.
const offerCategory=x=>/^OFERTAS?(?: NACIONAL| IMPORTADO| IMPORTADAS| JENBACH)?$/.test(categoryOf(x));
const codeCompare=(a,b)=>String(a.code||'').replace(/\s+\d+%\s*OFF.*$/i,'').localeCompare(String(b.code||'').replace(/\s+\d+%\s*OFF.*$/i,''),'es',{numeric:true});
const lineRank={national:0,imported:1,jenbach:2};
const orderedName=x=>lineGroup(x)==='national'?(newSeason(x)?'NUEVA TEMPORADA':'LÍNEA NACIONAL'):categoryOf(x);
function savedPosition(name){return categoryOrder.findIndex(v=>normalized(v)===normalized(name));}
function fallbackPosition(x){
 const group=lineGroup(x);
 const base=group==='national'?'LÍNEA NACIONAL':group==='imported'?'CARTERAS IMPORTADAS':'BILLETERAS JENBACH';
 const pos=savedPosition(base);
 return pos>=0?pos+0.5:categoryOrder.length+lineRank[group];
}
function normalPosition(x){const pos=savedPosition(orderedName(x));return pos>=0?pos:fallbackPosition(x);}
function render(){root.replaceChildren();const q=search.value.trim().toLocaleLowerCase('es'),f=filter.value,c=colorFilter.value;
 const matches=products.filter(x=>(q ? true : matchesCategory(x,f))&&(!c||(national(x)&&availableColors(x).some(name=>normalized(name)===c)))&&[x.code,x.description,x.line,x.category,...(x.colors||[])].join(' ').toLocaleLowerCase('es').includes(q));
 // Para una oferta sin categoría de origen en MASTER, usar la posición de
 // su artículo vecino por código dentro de la misma línea. No crear bloque OFERTAS.
 const positions=new Map();
 for(const x of matches){
   if(!offerCategory(x)){positions.set(x,normalPosition(x));continue;}
   const peers=products.filter(y=>lineGroup(y)===lineGroup(x)&&!offerCategory(y));
   // Buscar el vecino numérico inmediato (el anterior, o el siguiente).
   const before=peers.filter(y=>codeCompare(y,x)<=0).sort((a,b)=>codeCompare(b,a))[0];
   const after=peers.filter(y=>codeCompare(y,x)>0).sort(codeCompare)[0];
   const nearest=before||after;
   positions.set(x,nearest?normalPosition(nearest):fallbackPosition(x));
 }
 matches.sort((a,b)=>{
   if(f==='offers')return lineRank[lineGroup(a)]-lineRank[lineGroup(b)]||codeCompare(a,b);
   const pa=positions.get(a),pb=positions.get(b);
   return pa-pb||codeCompare(a,b);
 });
 if(!matches.length){root.append(el('p','empty','No se encontraron artículos.'));return}let previous='';for(const x of matches){const group=f==='offers'?(lineGroup(x)==='national'?'LÍNEA NACIONAL':lineGroup(x)==='imported'?'LÍNEA IMPORTADA':'LÍNEA JENBACH'):(national(x)&&newSeason(x)?'NUEVA TEMPORADA':(national(x)?'LÍNEA NACIONAL':offerCategory(x)?(lineGroup(x)==='jenbach'?'LÍNEA JENBACH':'LÍNEA IMPORTADA'):categoryOf(x)));if(group!==previous){root.append(el('h2','group',group));previous=group}const article=el('article','item');const visual=el('div','visual');const img=el('img','photo');img.src=x.image||'';img.alt='Artículo '+x.code;img.loading='lazy';img.decoding='async';visual.append(img);
const buy=el('button','gc-buy','COMPRAR');buy.type='button';buy.setAttribute('aria-label','Comprar artículo '+x.code);buy.addEventListener('click',()=>gcOpenProduct(x));visual.append(buy);article.append(visual);const details=el('div','details');{const isJenbach=jenbach(x);const logo=el('img',isJenbach?'jenbach-logo':'gc-product-logo');logo.src=isJenbach?'/jenbach-logo-blanco.png':'/goodcompany-logo-transparente-blanco.png';logo.alt=isJenbach?'Jenbach':'Good Company';logo.loading='lazy';details.append(logo);details.classList.add('has-product-logo');if(isJenbach)details.classList.add('has-jenbach-logo')}details.append(el('div','line',x.line||x.category||''),el('h3','code',x.code),el('p','desc',(x.description||'Sin descripción').replace(/\s*Medidas\s*$/i,'').trim()));if(x.offerPrices?.normal&&x.offerPrices?.discounted){const promo=el('div','offer-pricing');promo.append(el('div','offer-tag','OFERTA'));const old=el('div','old-price');old.append(el('span','','Precio normal: '));const oldAmount=el('s','old-price-amount',formatMoney(x.offerPrices.normal));old.append(oldAmount,el('span','iva-note','+ IVA'));promo.append(old);const sale=el('div','sale-price');sale.append(el('span','sale-label','Precio con descuento: '));amountWithIva(sale,x.offerPrices.discounted,'sale-amount');promo.append(sale);details.append(promo)}else if(x.price){const normal=el('div','price');amountWithIva(normal,x.price,'normal-amount');details.append(normal)}const dims=x.measurements||{};const measure=[dims.alto,dims.ancho,dims.profundidad].filter(Boolean).map(v=>v.replace(/\s*cm/i,'')).join(' × ');if(measure)details.append(el('div','measure','Medidas ('+[['Alto',dims.alto],['Ancho',dims.ancho],['Profundidad',dims.profundidad]].filter(p=>p[1]).map(p=>p[0]+' '+p[1]).join(', ')+')'));details.append(el('div','subtitle','COLORES DISPONIBLES'));const colors=el('div','colors');const colorData=(x.colorImages&&x.colorImages.length?x.colorImages:(x.colors||[]).map(name=>({name,image:null})));for(const c of colorData){const swatch=el('div','swatch');if(c.image){const colorImage=el('img','swatch-image');colorImage.src=c.image;colorImage.alt='';colorImage.loading='lazy';colorImage.onerror=()=>{colorImage.remove();swatch.classList.add('swatch-fallback')};swatch.append(colorImage)}else swatch.classList.add('swatch-fallback');swatch.append(el('span','swatch-label',c.name));colors.append(swatch)}details.append(colors);article.append(details);root.append(article)}}
colorFilter.addEventListener('change',()=>{if(colorFilter.value==='__todos_colores__')colorFilter.value='';render();window.scrollTo({top:0,behavior:'instant'});});search.addEventListener('input',render);filter.addEventListener('change',()=>{if(filter.value==='__todos_categoria__')filter.value='all';render();window.scrollTo({top:0,behavior:'instant'});});
async function load(){
 refresh.disabled=true;
 status.textContent='Consultando último stock publicado…';
 try{
  const response=await fetch('/api/stock',{cache:'no-store'});
  if(!response.ok)throw Error('No se pudo consultar el catálogo publicado');
  const data=await response.json();products=data.products||[];
  if(!products.length)throw Error('El catálogo todavía no fue publicado');
  const time=data.updatedAt?new Date(data.updatedAt).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'}):'sin fecha';
  try{const r=await fetch('/category-order.json?v='+Date.now(),{cache:'no-store'});if(r.ok){const c=await r.json();categoryOrder=Array.isArray(c.order)?c.order:[]}}catch(e){}
  updateCategories();updateColorFilter();
  status.textContent=`${products.length} artículos disponibles`; 
  render();
 }catch(e){status.textContent='No se pudo consultar el último stock publicado: '+e.message;if(!products.length)root.replaceChildren()}
 finally{refresh.disabled=false}
}
load();setInterval(()=>{if(!refresh.disabled)load()},5*60*1000);

// Botón lupa exclusivo de móvil; escritorio usa lupa dentro del buscador.
const searchToggle=document.querySelector('#search-toggle');
if(searchToggle)searchToggle.addEventListener('click',()=>{
 const opened=document.body.classList.toggle('mobile-search-open');
 searchToggle.setAttribute('aria-expanded',String(opened));
 if(opened)search.focus();
});




/* GOOD COMPANY - Etapa 1: carrito local, sin envíos ni cambios en stock. */
const GC_CART_KEY='gc-carrito-prueba-v1';
let gcCart=[];
try{const saved=JSON.parse(localStorage.getItem(GC_CART_KEY)||'[]');if(Array.isArray(saved))gcCart=saved.filter(i=>i&&typeof i.code==='string'&&typeof i.color==='string'&&Number.isInteger(i.qty)&&i.qty>0)}catch(_){}
const gcModal=document.querySelector('#gc-product-modal');
const gcCartModal=document.querySelector('#gc-cart-modal');
const gcCartCount=document.querySelector('#gc-cart-count');
const gcCartList=document.querySelector('#gc-cart-list');
const gcMoney=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
function gcPrice(p){const raw=p.offerPrices?.discounted||p.price||'';const digits=String(raw).replace(/[^\d]/g,'');return Number(digits)||0}
function gcStore(){try{localStorage.setItem(GC_CART_KEY,JSON.stringify(gcCart))}catch(_){}gcUpdateBadge()}
function gcUpdateBadge(){const count=gcCart.reduce((s,i)=>s+i.qty,0);gcCartCount.textContent=String(count);document.querySelector('#gc-cart-button').setAttribute('aria-label','Ver pedido, '+count+' unidades')}
function gcColors(p){const raw=p.colorImages?.length?p.colorImages.map(c=>c.name):(p.colors||[]).map(c=>typeof c==='string'?c:c?.name||c?.color);return [...new Set(raw.map(x=>String(x||'').trim()).filter(Boolean))]}
function gcOpenProduct(p){
 const box=document.querySelector('#gc-product-content');box.replaceChildren();
 box.append(el('h2','','Artículo '+p.code),el('p','gc-muted',p.description||''));
 const price=gcPrice(p);box.append(el('p','gc-unit-price',price?gcMoney(price)+' + IVA':'Precio a confirmar'));
 const colors=gcColors(p);const selected=new Map();
 if(!colors.length){box.append(el('p','gc-muted','Este artículo no tiene colores publicados.'));return gcModal.showModal()}
 for(const color of colors){
  const line=el('div','gc-quantity-row'),name=el('span','gc-cart-color-swatch swatch'),controls=el('div','gc-stepper');
  const colorData=(p.colorImages||[]).find(c=>String(c?.name||'').trim()===color);
  if(colorData?.image){
   const image=el('img','swatch-image');image.src=colorData.image;image.alt='';image.onerror=()=>{image.remove();name.classList.add('swatch-fallback')};name.append(image);
  }else{name.classList.add('swatch-fallback')}
  name.append(el('span','swatch-label',color));
  const minus=el('button','','−'),amount=el('span','gc-quantity','0'),plus=el('button','','+');
  minus.type=plus.type='button';minus.setAttribute('aria-label','Quitar una unidad de '+color);plus.setAttribute('aria-label','Agregar una unidad de '+color);
  const change=delta=>{const n=Math.max(0,(selected.get(color)||0)+delta);selected.set(color,n);amount.textContent=String(n);gcUpdateSelection()};
  minus.onclick=()=>change(-1);plus.onclick=()=>change(1);controls.append(minus,amount,plus);line.append(name,controls);box.append(line)
 }
 const summary=el('p','gc-selection-total'),add=el('button','gc-add','AGREGAR AL PEDIDO');add.type='button';
 function gcUpdateSelection(){const n=[...selected.values()].reduce((a,b)=>a+b,0);summary.textContent=n+' unidades · '+(price?gcMoney(n*price)+' + IVA':'Precio a confirmar');add.disabled=n===0}
 add.onclick=()=>{for(const [color,qty] of selected){if(!qty)continue;const code=String(p.code);const existing=gcCart.find(i=>i.code===code&&i.color===color);if(existing){existing.qty+=qty;existing.price=price;existing.description=p.description||''}else gcCart.push({code,color,qty,price,description:p.description||''})}gcStore();gcModal.close();gcShowCart()};
 box.append(summary,add);gcUpdateSelection();gcModal.showModal()
}
function gcShowCart(){gcCartList.replaceChildren();if(!gcCart.length){gcCartList.append(el('p','gc-muted','Todavía no agregaste artículos.'))}
 for(const item of gcCart){const row=el('div','gc-cart-row'),info=el('div','gc-cart-info');info.append(el('strong','','Art. '+item.code+' · '+item.color),el('span','gc-muted',item.price?gcMoney(item.price)+' c/u + IVA':'Precio a confirmar'));
 const controls=el('div','gc-stepper'),minus=el('button','','−'),qty=el('span','gc-quantity',String(item.qty)),plus=el('button','','+');minus.type=plus.type='button';minus.onclick=()=>{item.qty--;if(item.qty===0)gcCart=gcCart.filter(x=>x!==item);gcStore();gcShowCart()};plus.onclick=()=>{item.qty++;gcStore();gcShowCart()};controls.append(minus,qty,plus);row.append(info,controls);gcCartList.append(row)}
 const units=gcCart.reduce((s,i)=>s+i.qty,0),total=gcCart.reduce((s,i)=>s+i.qty*i.price,0);
 document.querySelector('#gc-cart-summary').textContent=units+' unidades · '+gcMoney(total)+' + IVA';document.querySelector('#gc-cart-cancel').disabled=!gcCart.length;document.querySelector('#gc-cart-whatsapp').disabled=!gcCart.length;if(!gcCartModal.open)gcCartModal.showModal()
}
document.querySelector('#gc-cart-button').addEventListener('click',gcShowCart);
document.querySelector('#gc-product-close').addEventListener('click',()=>gcModal.close());
document.querySelector('#gc-cart-close').addEventListener('click',()=>gcCartModal.close());
document.querySelector('#gc-cart-continue').addEventListener('click',()=>gcCartModal.close());
gcUpdateBadge();

// Etapa 2: anulación segura. El botón de WhatsApp permanece deshabilitado
// hasta disponer de un destino configurable y validado por superusuario.
const gcCancelModal=document.querySelector('#gc-cancel-modal');
document.querySelector('#gc-cart-cancel').addEventListener('click',()=>{
 if(!gcCart.length)return;
 gcCancelModal.showModal();
});
document.querySelector('#gc-cancel-back').addEventListener('click',()=>gcCancelModal.close());
document.querySelector('#gc-cancel-yes').addEventListener('click',()=>{
 gcCancelModal.close();
 gcCart=[];gcStore();
 gcCartModal.close();
});


/* GOOD COMPANY - Envío de pedidos: destino directo o mayorista. */
const gcDestinationModal=document.querySelector('#gc-destination-modal');
const gcSentModal=document.querySelector('#gc-sent-modal');
const gcDirectButton=document.querySelector('#gc-send-direct');
const gcDirectStatus=document.querySelector('#gc-direct-status');
let gcSalesNumber='';
let gcSalesLoading=null;
async function gcLoadSalesNumber(){
 if(gcSalesLoading)return gcSalesLoading;
 gcSalesLoading=(async()=>{
  try{
   const response=await fetch('https://site--good-company--67kh6wphfl9d.code.run/api/public/stock-pedidos-config',{cache:'no-store'});
   if(!response.ok)throw Error('No se pudo consultar el número de ventas');
   const data=await response.json();
   const number=String(data.whatsapp||'').replace(/\D/g,'');
   if(!data.success||!/^549\d{10}$/.test(number))throw Error('El número de ventas todavía no está configurado');
   gcSalesNumber=number;gcDirectButton.disabled=false;gcDirectStatus.textContent='Disponible para clientes registrados.';
  }catch(e){gcSalesNumber='';gcDirectButton.disabled=true;gcDirectStatus.textContent=e.message+'. Podés enviar a tu mayorista.';}
  finally{gcSalesLoading=null;}
 })();return gcSalesLoading;
}
function gcOrderText(customer){
 const units=gcCart.reduce((sum,i)=>sum+i.qty,0);
 const total=gcCart.reduce((sum,i)=>sum+i.qty*i.price,0);
 const now=new Date();
 const date=now.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'});
 const time=now.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
 const orderId='GC-'+String(now.getFullYear()).slice(-2)+String(now.getMonth()+1).padStart(2,'0')+String(now.getDate()).padStart(2,'0')+'-'+String(now.getHours()).padStart(2,'0')+String(now.getMinutes()).padStart(2,'0')+String(now.getSeconds()).padStart(2,'0');
 const lines=['*PEDIDO - GOOD COMPANY*','*Fecha:* '+date,'*Hora:* '+time,'*Pedido:* '+orderId];
 if(customer){lines.push('','*CLIENTE:* '+customer.name);}
 lines.push('','Artículos:');
 for(const item of gcCart){
  lines.push('• Art. '+item.code+' - '+item.color+' - '+item.qty+' unidad'+(item.qty===1?'':'es')+(item.price?' - '+gcMoney(item.price)+' c/u':''));
 }
 lines.push('','*TOTAL: '+units+' unidades · '+gcMoney(total)+' + IVA*');
 return lines.join('\n');
}
function gcIsDesktop(){return !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)}
function gcShowSentConfirmation(){
 gcDestinationModal.close();gcCartModal.close();gcSentModal.showModal();
}
document.querySelector('#gc-cart-whatsapp').addEventListener('click',()=>{
 if(!gcCart.length)return;
 gcCartModal.close();gcDestinationModal.showModal();gcLoadSalesNumber();
});
function gcReturnToCart(){gcDestinationModal.close();gcShowCart()}
document.querySelector('#gc-destination-close').addEventListener('click',gcReturnToCart);
document.querySelector('#gc-destination-back').addEventListener('click',gcReturnToCart);
let gcSendingDirect=false;
gcDirectButton.addEventListener('click',()=>{
 if(!gcCart.length||!gcSalesNumber||gcSendingDirect)return;
 gcSendingDirect=true;setTimeout(()=>{gcSendingDirect=false},1500);
 const url=(gcIsDesktop()?'https://web.whatsapp.com/send?phone=':'https://wa.me/')+gcSalesNumber+(gcIsDesktop()?'&text=':'?text=')+encodeURIComponent(gcOrderText());
 // Mantener el catálogo abierto: nunca usar location.href como respaldo.
 // En móvil, abrir wa.me en otra pestaña permite volver a esta confirmación.
 if(!gcIsDesktop()){
  const link=document.createElement('a');
  link.href=url;
  link.target='_blank';
  link.rel='noopener noreferrer';
  document.body.append(link);
  link.click();
  link.remove();
  gcShowSentConfirmation();
  return;
 }
 // PC: una sola pestaña reutilizable, sin fallback que duplique WhatsApp.
 const win=window.open(url,'gc_whatsapp_goodcompany');
 if(!win){
  gcSendingDirect=false;
  gcDirectStatus.textContent='El navegador bloqueó WhatsApp. Permití ventanas emergentes e intentá nuevamente.';
  return;
 }
 try{win.focus()}catch(_){}
 gcShowSentConfirmation();
});
const gcCustomerName=document.querySelector('#gc-customer-name');
const gcCustomerError=document.querySelector('#gc-customer-error');
try{gcCustomerName.value=localStorage.getItem('gc-customer-name')||''}catch(_){}
gcCustomerName.addEventListener('input',()=>{gcCustomerError.hidden=true});
let gcSendingWholesale=false;
document.querySelector('#gc-send-wholesale').addEventListener('click',async()=>{
 if(!gcCart.length||gcSendingWholesale)return;
 const name=gcCustomerName.value.trim().replace(/\s+/g,' ');
 if(!name){gcCustomerError.hidden=false;gcCustomerName.focus();return}
 gcCustomerError.hidden=true;
 try{localStorage.setItem('gc-customer-name',name)}catch(_){}
 gcSendingWholesale=true;setTimeout(()=>{gcSendingWholesale=false},1500);
 const message=gcOrderText({name});
 // Web Share abre el selector del dispositivo; el usuario elige WhatsApp y el contacto.
 if(navigator.share){
  try{await navigator.share({text:message});gcShowSentConfirmation();return}
  catch(e){if(e.name==='AbortError')return;}
 }
 // En equipos sin Web Share, WhatsApp abre la selección de conversación.
 const url=(gcIsDesktop()?'https://web.whatsapp.com/send?text=':'https://api.whatsapp.com/send?text=')+encodeURIComponent(message);
 const win=window.open(url,'_blank','noopener,noreferrer');
 if(!win){window.location.href=url;return;}
 gcShowSentConfirmation();
});
document.querySelector('#gc-sent-no').addEventListener('click',()=>{gcSentModal.close();gcShowCart()});
document.querySelector('#gc-sent-yes').addEventListener('click',()=>{
 gcCart=[];gcStore();gcSentModal.close();
});
