import {LocaleContext,formatMoney,translate,type Locale} from './i18n'
import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {ArrowRight,ChevronLeft,ChevronRight,CircleHelp,CreditCard,Download,Gamepad2,Gift,Heart,LayoutGrid,Search,Settings,ShoppingCart,Store,Tag,User,Wallet,Zap} from 'lucide-react'
import {ProductCard,type Product} from './ProductCard'
import {MarketplaceFooter,ProductDetailsPage,type Offer,type Details} from './ProductDetailsPage'
import './style.css'
import './details.css'

type Item={id:string;offer:number;sellerId?:number;price?:number;platform?:string;region?:string;seller?:string}
type Order={id:string;total:number;items:{title:string;price:number;key:string;seller:string}[]}
type Snapshot={products:Product[];offers:Record<string,Offer[]>;details:Record<string,Details>}
type HomeContent={slides:{id:string;headline:string;artwork:string;eyebrow:string;supporting:string;cta:string;destination:string}[];shelves:{id:string;title:string;order:number;products:Product[];destination:string}[]}
const shortcuts=[['Games',Gamepad2],['Gaming eCards',Wallet],['eGift Cards',Gift],['Steam',Gamepad2],['Steam Gift Cards',CreditCard],['PSN',Gamepad2],['Xbox',Gamepad2],['FIFA',Gamepad2],['Fortnite',Gamepad2],['Amazon',Gift]] as const
const shop=(key='category',value='')=>'#/store'+(value?'?'+new URLSearchParams({[key]:value}):'')
const shortcutLink=(name:string)=>['Games','Gaming eCards','eGift Cards'].includes(name)?shop('category',name):name==='Steam Gift Cards'?'#/search?q=steam+gift':['PSN','Xbox','Steam','Amazon'].includes(name)?shop('platform',name):'#/search?q='+encodeURIComponent(name==='FIFA'?'EA Sports FC':name)
const nav=[
 [['Categories',LayoutGrid,'#categories'],['Cheap Games',Tag,"#/store?category=Games&sort=asc"],['Software',LayoutGrid,shop('category','Software')],['eGift Cards',Gift,shop('category','eGift Cards')],['Eneba Gift Cards',CreditCard,'#/product/eneba'],['FM27',Gamepad2,'#/product/fm'],['GTA VI',Gamepad2,'#/product/gta']],
 [['Wishlist',Heart,'#/wishlist'],['Library',Gamepad2,'#/orders'],['Store',Store,'#/store']],
 [['Help',CircleHelp,'#/help'],['Settings',Settings,'#/account']]
] as const
const readLocal=<T,>(key:string,fallback:T):T=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function useLocal<T>(key:string,value:T) {
 const [state,setState]=useState<T>(()=>readLocal(key,value))
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(state))}catch{/* Embedded previews may disable storage. */}},[key,state])
 return [state,setState] as const
}
async function api<T>(path:string,body?:unknown):Promise<T> {
 const response=await fetch('/api/'+path,body===undefined?{headers:{Accept:'application/json'}}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
 if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The PHP service is unavailable in this preview.')
 const data=await response.json()
 if(!response.ok) throw new Error(data.error || 'Request failed')
 return data
}
function useRequest<T>(path:string,enabled=true):{data?:T;error?:string}{
 const [state,setState]=useState<{path:string;data?:T;error?:string}>({path:''})
 useEffect(()=>{
  if(!enabled)return
  let active=true
  api<T>(path).then(data=>{if(active)setState({path,data})},error=>{if(active)setState({path,error:error.message})})
  return ()=>{active=false}
 },[path,enabled])
 return state.path===path?state:{}
}
function matches(title:string,query:string) {
 const words=title.toLowerCase().split(/\s+/)
 return query.toLowerCase().trim().split(/\s+/).every(term=>words.some(word=>{
  if(word.startsWith(term))return true
  if(term.length<3||Math.abs(word.length-term.length)>1)return false
  let i=0,j=0,edits=0
  while(i<word.length&&j<term.length){
   if(word[i]===term[j]){i++;j++;continue}
   if(++edits>1)return false
   if(word.length>=term.length)i++
   if(term.length>=word.length)j++
  }
  return edits+(word.length-i)+(term.length-j)<=1
 }))
}
function App(){
 const [route,setRoute]=useState(location.hash.slice(1)||'/')
 const [email,setEmail]=useState<string|null>(null)
 const [backend,setBackend]=useState(false)
 const [snapshot,setSnapshot]=useState<Snapshot>()
 const [saved,setSaved]=useLocal<string[]>('eneba-saved',[])
 const [cart,setCart]=useLocal<Item[]>('eneba-cart',[])
 const [toast,setToast]=useState('')
 const [order,setOrder]=useState<Order>()
 const [slide,setSlide]=useState(0)
 const [busy,setBusy]=useState(false)
 const [menu,setMenu]=useState(false)
 const [locale,setLocale]=useLocal<Locale>('eneba-language','en')
 const t=(text:string)=>translate(locale,text)
 const money=(cents:number)=>formatMoney(cents,locale)
 useEffect(()=>{document.documentElement.lang=locale},[locale])
 const orderNonce=useRef('')
 const pendingScroll=useRef<{y:number;rails:number[]}|null>(window.history.state?.marketScroll ?? null)
 const scrollAreas=()=>Array.from(document.querySelectorAll<HTMLElement>('.shortcuts,.rail'))
 const saveScroll=()=>{
  if(pendingScroll.current)return
  try{window.history.replaceState({...window.history.state,marketScroll:{y:window.scrollY,rails:scrollAreas().map(area=>area.scrollLeft)}},'')}catch{/* Sandboxed previews may restrict history. */}
 }
 const navigate=(next:string)=>{
  if(next===route)return
  saveScroll()
  pendingScroll.current={y:0,rails:[]}
  try{window.history.pushState(null,'','#'+next)}catch{location.hash=next}
  setRoute(next)
  setMenu(false)
 }
 useEffect(()=>{
  const browserHistory=window.history
  const previous=browserHistory.scrollRestoration
  browserHistory.scrollRestoration='manual'
  let observedHash=location.hash
  const change=(event:Event)=>{
   if(event.type==='hashchange'&&observedHash===location.hash)return
   observedHash=location.hash
   const next=location.hash.slice(1)||'/'
   if(next==='categories'){document.getElementById('categories')?.scrollIntoView();return}
   pendingScroll.current=browserHistory.state?.marketScroll ?? {y:0,rails:[]}
   setRoute(next)
   setMenu(false)
  }
  window.addEventListener('popstate',change)
  window.addEventListener('hashchange',change)
  window.addEventListener('scroll',saveScroll,{capture:true,passive:true})
  api<{email:string|null}>('session').then(data=>{setEmail(data.email);setBackend(true)},()=>{})
  api<Snapshot>('catalog').then(setSnapshot,()=>setToast('Could not load the catalog'))
  return ()=>{window.removeEventListener('hashchange',change);window.removeEventListener('popstate',change);window.removeEventListener('scroll',saveScroll,true);browserHistory.scrollRestoration=previous}
 },[])
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),4800);return()=>clearTimeout(timer)},[toast])
 useLayoutEffect(()=>{
  const position=pendingScroll.current
  if(!position||(!snapshot&&position.y>0))return
  pendingScroll.current=null
  scrollAreas().forEach((area,index)=>{area.scrollLeft=position.rails[index]??0})
  window.scrollTo(0,position.y)
 },[route,snapshot])
 const [page,qs='']=route.split('?')
 const params=new URLSearchParams(qs)
 const query=params.get('q')||''
 const [term,setTerm]=useState(query)
 useEffect(()=>setTerm(query),[query,page])
 const products=snapshot?.products||[]
 const collection=params.get('collection')
 const category=params.get('category')
 const platform=params.get('platform')
 const home=useRequest<HomeContent>('home?locale='+locale,page==='/'||(page==='/store'&&!!collection))
 const collectionTitle=home.data?.shelves.find(shelf=>shelf.id===collection)?.title
 const catalogTitle=collectionTitle || (category==='Games'&&params.get('sort')==='asc' ? t('Cheap Games') : t(category||platform||'Store catalog'))
 const list=useRequest<Product[]>('products?'+qs,backend&&(page==='/store'||page==='/search'))
 const slug=page.match(/^\/products?\/([^/]+)$/)?.[1] || ''
 const detailId=({'cyberpunk-2077':'cyberpunk','elden-ring':'elden','red-dead-redemption-2':'redead'} as Record<string,string>)[slug] || slug
 const detail=useRequest<{product:Product;offers:Offer[];details?:Details|null}>('products/'+detailId,backend&&!!detailId)
 const history=useRequest<Order[]>('orders',backend&&!!email&&page==='/orders')
 const selected=detail.data?.product||products.find(p=>p.id===detailId)
 const details=detail.data?.details ?? snapshot?.details?.[detailId]
 const related=(details?.related?.length?details.related.map(id=>products.find(p=>p.id===id)).filter((p):p is Product=>!!p):products.filter(p=>p.id!==detailId&&p.category===selected?.category).slice(0,8))
 const offers=(id:string)=>snapshot?.offers?.[id]||[]
 const cartLines=cart.flatMap((item,index)=>{
  const product=products.find(p=>p.id===item.id),offer=offers(item.id).find(o=>o.id===item.offer)
  return product&&offer?[{product,offer:item.sellerId?{...offer,price:item.price!,seller:item.seller!,platform:item.platform!,region:item.region!}:offer,index}]:[]
 })
 const total=cartLines.reduce((sum,item)=>sum+item.offer.price,0)
 const toggle=(id:string)=>setSaved(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id])
 const card=(p:Product)=>{
  const offer=offers(p.id).reduce<Offer|undefined>((lowest,current)=>!lowest||current.price<lowest.price?current:lowest,undefined)
  return <ProductCard key={p.id} product={p} saved={saved.includes(p.id)} toggle={()=>toggle(p.id)} addToCart={offer?()=>add(p.id,offer):undefined}/>
 }
 const update=(key:string,value:string)=>{const next=new URLSearchParams(qs);if(value)next.set(key,value);else next.delete(key);navigate(page+'?'+next)}
 const visible=list.data||(params.has('collection')?[]:products).filter(p=>matches(p.title,query)&&['platform','category','region'].every(k=>!params.get(k)||params.get(k)===p[k as 'platform'|'category'|'region']||(k==='category'&&params.get(k)==='eGift Cards'&&p.category==='Gaming eCards'))&&(!params.get('max')||p.price<=Number(params.get('max'))*100)).sort((a,b)=>params.get('sort')==='asc'?a.price-b.price:params.get('sort')==='desc'?b.price-a.price:0)
 const add=(id:string,offer:Offer)=>{if(cart.length>=30){setToast('Your cart is full');return}orderNonce.current='';setCart(c=>[...c,{id,offer:offer.id,sellerId:offer.sellerId,price:offer.price,seller:offer.seller,platform:offer.platform,region:offer.region}]);setToast('Added to cart')}
 const checkout=async()=>{
  setBusy(true)
  try{
   orderNonce.current||=crypto.randomUUID()
   const placed=await api<Order>('orders',{items:cart,nonce:orderNonce.current})
   setOrder(placed);setCart([]);orderNonce.current='';navigate('/confirmation')
  }catch(e){setToast((e as Error).message)}finally{setBusy(false)}
 }
 const renderOrders=(orders:Order[])=>orders.length?orders.map(o=><section className="panel" key={o.id}><h2>{t("Order")} {o.id}</h2>{o.items.map(i=><div className="line" key={i.key}><span>{i.title}<small>{i.seller}</small></span><code>{i.key}</code><strong>{money(i.price)}</strong></div>)}<strong>{t("Total")} {money(o.total)}</strong></section>):<p>{t("No orders yet.")}</p>
 const slides=home.data?.slides??[]
 const feature=slides[slide]
 return <LocaleContext.Provider value={locale}><div className="app" onClick={event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return
  const href=(event.target as Element).closest('a')?.getAttribute('href')
  if(!href?.startsWith('#/'))return
  saveScroll()
 }}>
  <aside className={'sidebar '+(menu?'opened':'')}>
   <a className="brand" href="#/" aria-label="Eneba homepage"><img src="/assets/logo.png" alt="Eneba"/></a>
   <nav>{nav.map((group,i)=><div className="nav-group" key={i}>{group.map(([label,Icon,url])=><a className={(label==='Categories'?page==='/':url==='#'+route)?'active':''} href={label==='Categories'&&page!=='/'?'#/':url} key={label}><Icon size={21}/>{t(label)}{label==='Categories'&&<ChevronRight className="push" size={15}/>}</a>)}</div>)}</nav>
   <a className="gift-promo" href="#/product/eneba"><img src="/assets/gift.png" alt=""/><span><strong>Eneba<br/>Gift Card</strong><small>{t("The perfect gift for gamers")}</small></span><ArrowRight size={17}/></a>
  </aside>
  <main className={page==='/'?'main home':'main inner'}>
   <header className="header">
    <button className="mobile-menu" aria-label={t("Toggle navigation")} aria-expanded={menu} onClick={()=>setMenu(v=>!v)}><LayoutGrid/></button>
    <form role="search" onSubmit={e=>{e.preventDefault();navigate('/search?'+new URLSearchParams({q:term.trim()}))}}><button aria-label={t("Search")}><Search size={24}/></button><input aria-label={t("Search for games, top-ups and more")} placeholder={t("Search for games, top-ups and more")} value={term} onChange={e=>setTerm(e.target.value)}/></form>
    <div className="locale"><select aria-label={locale==='lt'?'Kalba':'Language'} value={locale} onChange={e=>setLocale(e.target.value as Locale)}><option value="en">English</option><option value="lt">Lietuvių</option></select><span>EUR</span></div>
    <div className="actions"><a href="#/wishlist" aria-label={t("Wishlist")}><Heart/></a><a href="#/cart" aria-label={t('Cart items')+': '+cart.length}><ShoppingCart/>{cart.length>0&&<b>{cart.length}</b>}</a><a href={email?'#/account':'#/login'} aria-label={email?t('Account'):t('Log in or register')}><User/><span>{email?t('Account'):t('Log in | Register')}</span></a></div>
   </header>
   {page==='/'?<>{feature?<section className={'hero slide-'+slide} data-feature={feature.id} aria-label={feature.headline}>
    <div className="hero-plate" style={{backgroundImage:'url('+feature.artwork+')'}}/>
    <div className="hero-copy"><div className="kicker">{feature.eyebrow}</div><h1 className={feature.id==='gta'?'hero-title-artwork':undefined}>{feature.headline}</h1>{feature.supporting&&<p>{feature.supporting}</p>}<div className="hero-buttons"><a className="primary" href={feature.destination}><ShoppingCart size={21}/> {feature.cta} <ArrowRight size={19}/></a></div></div>
    <button aria-label={t("Previous feature")} className="hero-arrow prev" onClick={()=>setSlide((slide+slides.length-1)%slides.length)}><ChevronLeft/></button><button aria-label={t("Next feature")} className="hero-arrow next" onClick={()=>setSlide((slide+1)%slides.length)}><ChevronRight/></button>
    <div className="dots">{slides.map((s,i)=><button className={i===slide?'chosen':''} aria-label={s.headline} aria-pressed={i===slide} key={s.id} onClick={()=>setSlide(i)}/>)}</div>
   </section>:<p className="content" role="status">{t(home.error?"Could not load the homepage.":home.data?"No features available.":"Loading homepage…")}</p>}<div className="content">
    <nav className="shortcuts" aria-label={t("Gaming categories")}>{shortcuts.map(([name,Icon])=><a key={name} href={shortcutLink(name)}><Icon size={29}/><span>{t(name)}</span></a>)}</nav>
    {home.data?.shelves.map(shelf=><section className="shelf" key={shelf.id}><div className="section-title"><h2>{shelf.title}</h2><a href={shelf.destination}>{t('See all')} <ArrowRight size={17}/></a></div><div className="rail">{shelf.products.map(card)}</div>{!shelf.products.length&&<p>{t('No products in this collection.')}</p>}</section>)}
    <section id="categories" className="shelf"><div className="section-title"><h2>{t("Categories")}</h2></div><div className="category-grid">{shortcuts.slice(0,8).map(([name,Icon])=><a key={name} href={shortcutLink(name)}><Icon size={28}/>{t(name)}<ArrowRight size={16}/></a>)}</div></section>
    <section className="payment-strip" aria-label={t("Payment methods")}>
     <span className="payment-visa">VISA</span>
     <span className="payment-mastercard"><i aria-hidden="true"/>Mastercard</span>
     <span className="payment-paypal">Pay<b>Pal</b></span>
     <span className="payment-apple"><i aria-hidden="true"></i> Apple Pay</span>
    </section>
    <section className="newsletter panel"><div><h2>{t("Get the latest game deals")}</h2><p>{t("Sign up for updates and special offers.")}</p></div><form onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;try{await api('newsletter',{email:new FormData(form).get('email')});form.reset();setToast('You’re subscribed')}catch(error){setToast((error as Error).message)}}}><input type="email" name="email" required aria-label={t("Email address")} placeholder={t("Email address")}/><button className="primary">{t("Subscribe")}</button></form></section>
    <MarketplaceFooter/>
   </div></>:<div className="content page">
    {(page==='/store'||page==='/search')&&<><div className="catalog-heading"><h1>{page==='/search'?(query?t('Search results')+' · “'+query+'”':t('Search results')):catalogTitle}</h1><details className="catalog-filters" key={page}><summary>{t("Filters")}</summary><div className="filters">{(['platform','region','category'] as const).map(key=><label key={key}>{t(key)}<select value={params.get(key)||''} onChange={e=>update(key,e.target.value)}><option value="">{t("All")}</option>{Array.from(new Set(products.map(p=>p[key]))).map(v=><option key={v} value={v}>{t(v)}</option>)}</select></label>)}<label>{t("Max price (€)")}<input key={qs} type="number" min="0" defaultValue={params.get('max')||''} onBlur={e=>update('max',e.target.value)}/></label><label>{t("Sort by")}<select value={params.get('sort')||''} onChange={e=>update('sort',e.target.value)}><option value="">{t("Featured")}</option><option value="asc">{t("Price low to high")}</option><option value="desc">{t("Price high to low")}</option></select></label></div></details></div><p className="catalog-count">{visible.length} {t('results')}</p><div className="catalog-grid">{visible.map(card)}</div>{visible.length===0&&<p>{t("Try a different search or clear your filters.")}</p>}</>}
    {detailId&&(selected?<ProductDetailsPage key={selected.id} product={selected} details={details} related={related} offers={detail.data?.offers||offers(selected.id)} saved={saved.includes(selected.id)} toggle={()=>toggle(selected.id)} add={offer=>add(selected.id,offer)} notice={setToast} card={card}/>:<p>{snapshot?t('Product unavailable.'):t('Loading product…')}</p>)}
    {page==='/wishlist'&&<><h1>{t("Wishlist")}</h1><div className="catalog-grid">{products.filter(p=>saved.includes(p.id)).map(card)}</div>{!saved.length&&<p>{t("Save products with the heart button to find them here.")}</p>}</>}
    {(page==='/cart'||page==='/checkout')&&<><h1>{page==='/cart'?t('Shopping cart'):t('Checkout')}</h1>{cartLines.length?<section className="panel">{cartLines.map(({product,offer,index})=><div className="line" key={index}><a href={'#/product/'+product.id}>{product.title}<small>{offer.seller} · {offer.platform} · {t(offer.region)}</small></a><b>{money(offer.price)}</b>{page==='/cart'&&<button onClick={()=>{orderNonce.current='';setCart(c=>c.filter((_,i)=>i!==index))}}>{t("Remove")}</button>}</div>)}<div className="line"><strong>{t("Total")}</strong><strong>{money(total)}</strong></div>{page==='/cart'?<a className="primary" href="#/checkout">{t("Continue to checkout")}</a>:email?<button disabled={busy} className="primary" onClick={checkout}>{busy?t('Placing order…'):t('Place simulated order')}</button>:<a className="primary" href="#/login?next=checkout">{t("Log in to checkout")}</a>}</section>:<p>{t("Your cart is empty.")} <a href="#/store">{t("Browse the store")}</a></p>}{page==='/checkout'&&<p>{t("Simulated payment. No card details are required.")}</p>}</>}
    {(page==='/login'||page==='/register')&&<section className="panel auth"><h1>{page==='/login'?t('Log in'):t('Register')}</h1>{!backend&&<p>{t("Account access is available when the PHP service is running.")}</p>}<form onSubmit={async e=>{e.preventDefault();setBusy(true);try{const data=Object.fromEntries(new FormData(e.currentTarget));const account=await api<{email:string}>(page.slice(1),data);setEmail(account.email);navigate(params.get('next')==='checkout'?'/checkout':'/account')}catch(error){setToast((error as Error).message)}finally{setBusy(false)}}}><label>{t("Email")}<input name="email" type="email" autoComplete="email" required/></label><label>{t("Password")}<input name="password" type="password" minLength={8} maxLength={72} required autoComplete={page==='/login'?'current-password':'new-password'}/></label><button className="primary" disabled={busy||!backend}>{page==='/login'?t('Log in'):t('Create account')}</button></form><a href={(page==='/login'?'#/register':'#/login')+(qs?'?'+qs:'')}>{page==='/login'?t('Create an account'):t('Already registered? Log in')}</a></section>}
    {page==='/account'&&<><h1>{t("Account")}</h1>{email?<section className="panel"><p>{email}</p><a className="secondary" href="#/orders">{t("Order history")}</a> <button className="primary" onClick={async()=>{try{await api('logout',{});setEmail(null);setOrder(undefined);navigate('/')}catch(error){setToast((error as Error).message)}}}>{t("Log out")}</button></section>:<a className="primary" href="#/login">{t("Log in or register")}</a>}</>}
    {page==='/orders'&&<><h1>{t("Order history")}</h1>{email?history.data?renderOrders(history.data):<p>{t(history.error||'Loading orders…')}</p>:<a className="primary" href="#/login">{t("Log in to see orders")}</a>}</>}
    {page==='/confirmation'&&<><h1>{t("Order confirmed")}</h1>{email&&order?renderOrders([order]):<p>{t("Find previous purchases in your")} <a href="#/orders">order history</a>.</p>}</>}
    {page==='/about'&&<><h1>{t("Marketplace demo")}</h1><section className="panel"><p>{locale==='lt'?'Tai neoficialus praktikos projektas, kuriame galite naršyti prekes, palyginti pardavėjų pasiūlymus ir išbandyti pirkimą. Mokėjimai ir aktyvinimo raktai yra demonstraciniai.':'This unofficial internship project lets you browse products, compare seller offers and try checkout. Payments and activation keys are simulated.'}</p><a className="primary" href="#/store">{t("Browse products")}</a></section></>}
    {page==='/help'&&<><h1>{t("Help")}</h1><section className="panel"><h2>{t("How do digital keys work?")}</h2><p>{t("Compare the platform and activation region on the product page. After simulated checkout, find your demo key in Order history.")}</p></section></>}
   </div>}
  </main>{toast&&<div className="toast" role="status">{t(toast)}{toast==='Added to cart'&&<> · <a href="#/cart">{t("View cart")}</a></>}</div>}
 </div></LocaleContext.Provider>
}
createRoot(document.getElementById('root')!).render(<App/>)
