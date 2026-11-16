import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const appUrl = (process.env.APP_URL || `http://localhost:${port}`).replace(/\/$/, '');
const bankDetails = {
  bank_name: process.env.BANK_NAME || 'First City Monument Bank',
  account_name: process.env.BANK_ACCOUNT_NAME || 'As Accessories',
  account_number: process.env.BANK_ACCOUNT_NUMBER || '2007454151'
};
const orderFile = path.join(here, 'data', 'orders.json');
const catalog = [
  { id:'mask', name:'Hair Mask', category:'Scalp care', description:'A clarifying scalp ritual for dandruff and product build-up.', details:'Apply to the scalp on damp hair. Massage gently, then rinse thoroughly with lukewarm water. Follow with shampoo.', image:'hair-mask.jpeg', sizes:{'250ml':6500} },
  { id:'shampoo', name:'3-in-1 Clarifying Shampoo', category:'Cleanse', description:'A moisturizing, volumizing cleanse for a fresh scalp.', details:'Deep cleanses hair and scalp. Apply to wet scalp, massage gently and rinse thoroughly. Repeat if needed.', image:'shampoo.jpeg', sizes:{'100g refill':3000,'250g refill':6500,'500g refill':11000,'150ml bottle':4000,'250ml bottle':8000,'500ml bottle':14000} },
  { id:'conditioner', name:'Protein Deep Conditioner', category:'Condition', description:'A strengthening moisture boost for fragile strands.', details:'Apply generously to freshly washed hair. Cover and steam for 30–60 minutes, or cover overnight for 3–8 hours.', image:'deep-conditioner.jpeg', sizes:{'100g refill':3000,'250ml jar':6000,'500ml jar':9000} },
  { id:'leavein', name:'Silky Moisture Leave-In', category:'Moisturize', description:'Softens, detangles and moisturizes dry hair.', details:'Apply evenly to damp hair and style as desired. Can also be used for daily styling.', image:'leave-in.jpeg', sizes:{'100g refill':3000,'250g refill':6500,'500g refill':11000,'150ml bottle':4000,'250ml bottle':8000,'500ml bottle':14000} },
  { id:'cream', name:'Hair Cream', category:'Style', description:'A softening, hydrating cream for styling hair strands.', details:'Apply to damp hair strands. Use with Hydrating Hair Mist for better absorption. Do not apply directly to the scalp.', image:'hair-cream.jpeg', sizes:{'100ml':3500,'250ml':6000} },
  { id:'butter', name:'Hair Butter', category:'Style', description:'A rich, nourishing butter for soft, moisturized strands.', details:'Work a small amount through hair strands as part of your styling routine.', image:'hair-cream.jpeg', sizes:{'100ml':5000,'250ml':9000} },
  { id:'oil', name:'Hot Treatment Oil', category:'Treatment', description:'A nourishing oil for a warm, restorative hair ritual.', details:'Use as part of your treatment routine. Massage gently into scalp and hair, following the product label.', image:'hot-treatment-oil.jpeg', sizes:{'50ml':4000,'100ml':8000} },
  { id:'mist', name:'Hydrating Hair Mist', category:'Hydrate', description:'A refreshing spritz for dry hair and scalp.', details:'Spray onto scalp and hair strands for hydration, 3–4 times a week or as needed.', image:'leave-in.jpeg', sizes:{'250ml':5000} },
  { id:'beard', name:'Anti-Bald & Beard Oil', category:'Targeted care', description:'Daily nourishment for beard and scalp care.', details:'Apply daily to a clean beard or scalp and massage gently. Contact us for current price.', image:'hot-treatment-oil.jpeg', sizes:{} }
];
const mime = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpeg':'image/jpeg','.jpg':'image/jpeg','.png':'image/png' };
let writeQueue = Promise.resolve();

async function loadOrders() { try { return JSON.parse(await readFile(orderFile,'utf8')); } catch { return {}; } }
function saveOrders(orders) {
  writeQueue = writeQueue.then(async () => {
    await mkdir(path.dirname(orderFile), { recursive:true });
    const temp = orderFile + '.tmp';
    await writeFile(temp, JSON.stringify(orders,null,2), 'utf8');
    await rename(temp, orderFile);
  });
  return writeQueue;
}
function send(res,status,data) { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); }
async function bodyJson(req) { let raw=''; for await(const chunk of req){ raw+=chunk; if(raw.length>24000) throw new Error('Request too large.'); } return JSON.parse(raw||'{}'); }
async function handle(req,res) {
  const url=new URL(req.url,appUrl);
  if(req.method==='GET'&&url.pathname==='/api/products') return send(res,200,catalog);
  if(req.method==='GET'&&url.pathname==='/api/store-config') return send(res,200,{bank:bankDetails,bank_transfer_configured:Boolean(bankDetails.bank_name&&bankDetails.account_name&&bankDetails.account_number)});
  if(req.method==='POST'&&url.pathname==='/api/orders/create') {
    try {
      const form=await bodyJson(req); const email=String(form.email||'').trim().toLowerCase();
      const name=String(form.name||'').trim().slice(0,120), phone=String(form.phone||'').trim().slice(0,40);
      const address=String(form.address||'').trim().slice(0,250), city=String(form.city||'').trim().slice(0,100);
      const country=String(form.country||'Nigeria').trim().slice(0,100), note=String(form.note||'').trim().slice(0,500);
      const items=Array.isArray(form.items)?form.items:[];
      if(!/^\S+@\S+\.\S+$/.test(email)||!name||!phone||!address||!city||items.length<1||items.length>30) return send(res,400,{error:'Complete all required contact and delivery details.'});
      const orderItems=[]; let total=0;
      for(const item of items){const product=catalog.find(p=>p.id===String(item.id));const size=String(item.size||'');const quantity=Math.max(1,Math.min(20,Number(item.quantity)||1));const price=product?.sizes[size];if(!price)return send(res,400,{error:'A selected product or size has no online price. Remove it from your bag and try again.'});total+=price*quantity;orderItems.push({id:product.id,name:product.name,size,quantity,unit_price:price,line_total:price*quantity});}
      const ref=`as_${randomUUID().replaceAll('-','')}`;
      const order={reference:ref,status:'awaiting_transfer',currency:'NGN',amount:total,email,name,phone,address,city,country,note,items:orderItems,created_at:new Date().toISOString()};
      const orders=await loadOrders();orders[ref]=order;await saveOrders(orders);
      return send(res,201,{reference:ref,status:order.status,amount:total,currency:'NGN'});
    }catch(error){return send(res,400,{error:error instanceof SyntaxError?'Invalid checkout details.':error.message||'Could not start checkout.'});}
  }
  if(req.method==='POST'&&url.pathname==='/api/orders/transfer-reference') {
    try {
      const form=await bodyJson(req);const reference=String(form.reference||'');const email=String(form.email||'').trim().toLowerCase();const transferReference=String(form.transfer_reference||'').trim().slice(0,100);
      if(!/^as_[A-Za-z0-9_-]{12,100}$/.test(reference)||!/^\S+@\S+\.\S+$/.test(email)||!transferReference)return send(res,400,{error:'Enter the order reference, checkout email, and transfer reference.'});
      const orders=await loadOrders();const order=orders[reference];if(!order||order.email!==email)return send(res,404,{error:'We could not find an order with those details.'});
      if(order.status==='paid')return send(res,409,{error:'This order has already been marked paid.'});
      order.transfer_reference=transferReference;order.status='transfer_submitted';order.transfer_submitted_at=new Date().toISOString();await saveOrders(orders);
      return send(res,200,{reference,status:order.status});
    } catch(error) { return send(res,400,{error:error instanceof SyntaxError?'Invalid transfer details.':error.message||'Could not record transfer reference.'}); }
  }
  if(req.method==='GET'&&url.pathname==='/api/orders/lookup') {
    const reference=url.searchParams.get('reference')||'';const email=(url.searchParams.get('email')||'').trim().toLowerCase();const orders=await loadOrders();const order=orders[reference];
    if(!order||order.email!==email)return send(res,404,{error:'No order matched those details.'});
    return send(res,200,{reference:order.reference,status:order.status,amount:order.amount,currency:order.currency,items:order.items,city:order.city,transfer_reference:order.transfer_reference||null,created_at:order.created_at});
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'Method not allowed.'});
  let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{return send(res,400,{error:'Invalid path.'});}
  if(pathname==='/')pathname='/index.html';
  const allowed=new Set(['/index.html','/about.html','/shop.html','/product.html','/cart.html','/checkout.html','/orders.html','/order-confirmation.html','/styles.css','/app.js']);
  if(!allowed.has(pathname)&&!pathname.startsWith('/assets/'))return send(res,404,{error:'Not found.'});
  const file=path.resolve(here,`.${pathname}`);if(!file.startsWith(here+path.sep))return send(res,403,{error:'Forbidden.'});
  if(pathname.startsWith('/assets/')&&!file.startsWith(path.join(here,'assets')+path.sep))return send(res,403,{error:'Forbidden.'});
  try{const info=await stat(file);if(!info.isFile())return send(res,404,{error:'Not found.'});res.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});if(req.method==='HEAD')return res.end();res.end(await readFile(file));}catch{return send(res,404,{error:'Not found.'});}
}

http.createServer((req,res)=>{handle(req,res).catch(()=>send(res,500,{error:'Unexpected server error.'}));}).listen(port,()=>console.log(`Storefront running at ${appUrl}`));
