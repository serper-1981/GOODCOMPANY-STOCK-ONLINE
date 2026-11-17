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
const national=x=>!imported(x);
// Prioridad visual: NUEVA TEMPORADA al comienzo, sin alterar los datos de MASTER.
const newSeason=x=>/NUEVA\s+TEMPORADA/i.test([x.category,x.description,x.code,x.line].join(' '));
// Orden fijo solicitado: no generar ni ordenar opciones automáticamente.
// Los nombres del selector se muestran exactamente en mayúsculas.
const CATEGORY_OPTIONS = [
  ['NUEVA TEMPORADA','season'],
  ['LINEA NACIONAL','national'],
  ['BANDOLERAS','BANDOLERAS'],
  ['BOLSOS','BOLSOS'],
  ['CARTERAS','CARTERAS'],
  ['GONDOLAS','GONDOLAS'],
  ['MOCHILAS','MOCHILAS'],
  ['PORTA CELULARES','PORTA CELULARES'],
  ['PORTA COSMETICOS','PORTA COSMETICOS'],
  ['RIÑONERAS','RIÑONERAS'],
  ['IMPORTADOS','imported'],
  ['BILLETERAS IMPORTADAS','BILLETERAS IMPORTADAS'],
  ['CARTERAS IMPORTADAS','CARTERAS IMPORTADAS'],
  ['PARAGAS IMPORTADAS','PARAGAS IMPORTADAS'],
  ['PARAGUAS IMPORTADOS','PARAGUAS IMPORTADOS'],
  ['JENBACH','jenbach'],
  ['OFERTAS','offers']
];
// Variaciones ortográficas de MASTER: no duplicar opciones en el selector.
const canonicalCategory=x=>normalized(x).replace(/\bPARAGAS\b/g,'PARAGUAS').replace(/\bPORTA\s*COSMETICOS\b/g,'PORTACOSMETICOS').replace(/\bPORTA\s*CELULARES\b/g,'PORTACELULARES');
function matchesCategory(x,f){
  if(f==='all')return true;
  if(f==='season')return newSeason(x);
  if(f==='national')return national(x);
  if(f==='imported')return imported(x);
  if(f==='jenbach')return jenbach(x);
  if(f==='offers')return offer(x);
  const cat=canonicalCategory(categoryOf(x));
  const wanted=canonicalCategory(f);
  const base=canonicalCategory(baseCategory(x));
  return cat===wanted || base===wanted || cat.includes(wanted+' JENBACH') || cat.includes(wanted+' OFERTA');
}
function updateCategories(){
  const selected=filter.value;
  filter.replaceChildren();
  const add=(value,label)=>{const option=document.createElement('option');option.value=value;option.textContent=label;filter.append(option)};
  // CATEGORÍA conserva la vista de todo el catálogo sin agregar otra categoría a la lista.
  if(window.matchMedia('(max-width:768px)').matches){
    add('all','CATEGORÍA');
    add('__todos_categoria__','TODOS');
  }else{
    add('all','TODOS');
  }
  for(const [label,value] of CATEGORY_OPTIONS)add(value,label);
  filter.value=[...filter.options].some(o=>o.value===selected)?selected:'all';
}
// Colores tomados únicamente de artículos publicados con STOCK=SI.
// Normalizamos tildes, mayúsculas y espacios, sin perder el nombre mostrado en ADMIN.
function availableColors(x){
 const fromNames=Array.isArray(x.colors)?x.colors:[];
 const fromImages=Array.isArray(x.colorImages)?x.colorImages.map(c=>c.name):[];
 return [...fromNames,...fromImages].map(c=>String(c||'').trim()).filter(Boolean);
}
function updateColorFilter(){
 const selected=colorFilter.value;
 const names=new Map();
 for(const x of products.filter(national))for(const name of availableColors(x)){
   const key=normalized(name);
   if(key&&!names.has(key))names.set(key,name);
 }
 colorFilter.replaceChildren();
 const mobile=window.matchMedia('(max-width:768px)').matches;
  const first=document.createElement('option');first.value='';first.textContent=mobile?'COLORES':'TODOS';colorFilter.append(first);
  if(mobile){const reset=document.createElement('option');reset.value='__todos_colores__';reset.textContent='TODOS';colorFilter.append(reset);}
 for(const [key,name] of [...names.entries()].sort((a,b)=>a[1].localeCompare(b[1],'es',{sensitivity:'base'}))){
   const option=document.createElement('option');option.value=key;option.textContent=name.toUpperCase();colorFilter.append(option);
 }
 colorFilter.value=names.has(selected)?selected:'';
}
function render(){root.replaceChildren();const q=search.value.trim().toLocaleLowerCase('es'),f=filter.value,c=colorFilter.value;const matches=products.filter(x=>(q ? true : matchesCategory(x,f))&&(!c||(national(x)&&availableColors(x).some(name=>normalized(name)===c)))&&[x.code,x.description,x.line,x.category,...(x.colors||[])].join(' ').toLocaleLowerCase('es').includes(q)).sort((a,b)=>{
 const group=x=>newSeason(x)?'NUEVA TEMPORADA':(!imported(x)?'LÍNEA NACIONAL':categoryOf(x));
 const order=x=>{const g=group(x);const n=categoryOrder.indexOf(g);if(n>=0)return n;if(categoryOrder.length)return 999;return g==='NUEVA TEMPORADA'?0:g==='LÍNEA NACIONAL'?1:999};
 const diff=order(a)-order(b);if(diff)return diff;
 const g=group(a).localeCompare(group(b),'es');if(g)return g;
 return String(a.code||'').localeCompare(String(b.code||''),'es',{numeric:true});
 });if(!matches.length){root.append(el('p','empty','No se encontraron artículos.'));return}let previous='';for(const x of matches){const group=newSeason(x)?'NUEVA TEMPORADA':(imported(x)?categoryOf(x):'LÍNEA NACIONAL');if(group!==previous){root.append(el('h2','group',group));previous=group}const article=el('article','item');const visual=el('div','visual');const img=el('img','photo');img.src=x.image||'';img.alt='Artículo '+x.code;img.loading='lazy';img.decoding='async';visual.append(img);article.append(visual);const details=el('div','details');if(jenbach(x)){const logo=el('img','jenbach-logo');logo.src='/jenbach-logo-blanco.png';logo.alt='Jenbach';logo.loading='lazy';details.append(logo);details.classList.add('has-jenbach-logo')}details.append(el('div','line',x.line||x.category||''),el('h3','code',x.code),el('p','desc',(x.description||'Sin descripción').replace(/\s*Medidas\s*$/i,'').trim()));if(x.offerPrices?.normal&&x.offerPrices?.discounted){const promo=el('div','offer-pricing');promo.append(el('div','offer-tag','OFERTA'));const old=el('div','old-price');old.append(el('span','','Precio normal: '));const oldAmount=el('s','old-price-amount',formatMoney(x.offerPrices.normal));old.append(oldAmount,el('span','iva-note','+ IVA'));promo.append(old);const sale=el('div','sale-price');sale.append(el('span','sale-label','Precio con descuento: '));amountWithIva(sale,x.offerPrices.discounted,'sale-amount');promo.append(sale);details.append(promo)}else if(x.price){const normal=el('div','price');amountWithIva(normal,x.price,'normal-amount');details.append(normal)}const dims=x.measurements||{};const measure=[dims.alto,dims.ancho,dims.profundidad].filter(Boolean).map(v=>v.replace(/\s*cm/i,'')).join(' × ');if(measure)details.append(el('div','measure','Medidas ('+[['Alto',dims.alto],['Ancho',dims.ancho],['Profundidad',dims.profundidad]].filter(p=>p[1]).map(p=>p[0]+' '+p[1]).join(', ')+')'));details.append(el('div','subtitle','COLORES DISPONIBLES'));const colors=el('div','colors');const colorData=(x.colorImages&&x.colorImages.length?x.colorImages:(x.colors||[]).map(name=>({name,image:null})));for(const c of colorData){const swatch=el('div','swatch');if(c.image){const colorImage=el('img','swatch-image');colorImage.src=c.image;colorImage.alt='';colorImage.loading='lazy';colorImage.onerror=()=>{colorImage.remove();swatch.classList.add('swatch-fallback')};swatch.append(colorImage)}else swatch.classList.add('swatch-fallback');swatch.append(el('span','swatch-label',c.name));colors.append(swatch)}details.append(colors);article.append(details);root.append(article)}}
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
load();setInterval(()=>{if(!refresh.disabled)load()},15*60*1000);

// Botón lupa exclusivo de móvil; escritorio usa lupa dentro del buscador.
const searchToggle=document.querySelector('#search-toggle');
if(searchToggle)searchToggle.addEventListener('click',()=>{
 const opened=document.body.classList.toggle('mobile-search-open');
 searchToggle.setAttribute('aria-expanded',String(opened));
 if(opened)search.focus();
});


