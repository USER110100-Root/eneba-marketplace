import {useLocale,useTranslation,formatMoney} from './i18n'
import {useRef,useState,type ReactNode} from 'react'
import {ArrowRight,ChevronLeft,ChevronRight,Heart,Share2,Star} from 'lucide-react'
import {type Product} from './ProductCard'

export type Offer={id:number;sellerId:number;seller:string;rating:number;reviews:number;price:number;old:number;discount:number;cashback:string;platform:string;region:string;edition:string;availability:string}
type Review={id:number;flag:string;user:string;date:string;rating:number;text:string;helpful:number;translated?:boolean}
export type Details={rating:number;count:number;scores:Record<string,number>;genres:string[];description:string;included:string[];features:string[];facts:Record<string,string>;requirements:string[][];related:string[];reviews:Review[]}

export function MarketplaceFooter(){
 const t=useTranslation()
 const columns=[['About Eneba','Marketplace demo','#/about'],['Buy','Browse products','#/store'],['Help','Activation and orders','#/help'],['Community','Wishlist','#/wishlist'],['Business','Marketplace information','https://www.eneba.com/sell-with-eneba'],['Follow us','Eneba on Instagram','https://www.instagram.com/eneba/'],['Download the App','Find the Eneba app','https://play.google.com/store/apps/details?id=com.eneba.app']]
 return <footer className="market-footer">{columns.map(([title,label,href])=><div key={title}><strong>{t(title)}</strong><a href={href}>{t(label)}</a></div>)}<small>{t("Internship demo · Simulated purchases")}</small></footer>
}

export function ProductDetailsPage({product,details,offers,related,saved,toggle,add,notice,card}:{product:Product;details?:Details|null;offers:Offer[];related:Product[];saved:boolean;toggle:()=>void;add:(offer:Offer)=>void;notice:(text:string)=>void;card:(product:Product)=>ReactNode}){
 const t=useTranslation()
 const locale=useLocale()
 const money=(cents:number)=>formatMoney(cents,locale)
 const [activationPlatform,setActivationPlatform]=useState('')
 const platforms=[...new Set(offers.map(offer=>offer.platform))]
 const matching=offers.filter(offer=>offer.platform===activationPlatform&&offer.availability==='In stock')
 const compatible=matching.filter(offer=>['EU','Europe'].includes(offer.region)).sort((a,b)=>a.price-b.price)[0]
 const activationMessage=compatible
  ? `${compatible.seller} · ${money(compatible.price)} · ${compatible.platform} · ${t(compatible.region)}`
  : matching.some(offer=>!['United States','Latin America','Argentina'].includes(offer.region))
    ? (locale==='lt'?'Aktyvinimas Lietuvoje nepatvirtintas.':'Activation in Lithuania isn’t confirmed.')
    : (locale==='lt'?'Nėra tinkamų pasiūlymų Lietuvai.':'No in-stock offers matched Lithuania.')
 const [region,setRegion]=useState('')
 const [platform,setPlatform]=useState('')
 const [sort,setSort]=useState('asc')
 const [selected,setSelected]=useState<number>()
 const [reviewSort,setReviewSort]=useState('helpful')
 const [limit,setLimit]=useState(3)
 const [votes,setVotes]=useState<number[]>([])
 const rail=useRef<HTMLDivElement>(null)
 const filtered=offers.filter(o=>(!region||o.region===region)&&(!platform||o.platform===platform)).sort((a,b)=>(a.price-b.price)*(sort==='desc'?-1:1))
 const reviews=details?.reviews.slice().sort((a,b)=>reviewSort==='recent'?b.date.localeCompare(a.date):reviewSort==='high'?b.rating-a.rating:reviewSort==='low'?a.rating-b.rating:b.helpful-a.helpful)||[]
 return <div className="product-page">
  <nav className="crumbs" aria-label={t("Breadcrumb")}><a href="#/">{t("Home")}</a><ChevronRight size={14}/><a href="#/store">{t("Store")}</a><ChevronRight size={14}/><span>{product.title}</span></nav>
  <section className="panel detail-overview">
   <div className="detail-cover">{product.art?<img src={product.art} onError={({currentTarget})=>{if(product.fallbackArt && currentTarget.getAttribute('src')!==product.fallbackArt) currentTarget.src=product.fallbackArt}} alt={product.title+' cover'}/>:<strong>{product.title}</strong>}</div>
   <div><div className="chips"><span>{product.platform}</span><span>{t(product.region)}</span></div><h1>{product.title}</h1>
    {details&&<p className="rating"><Star size={18}/> <strong>{details.rating.toFixed(2)} / 5</strong> · {details.count} {t('ratings')}</p>}
    {details&&<div className="chips">{details.genres.map(g=><span key={g}>{t(g)}</span>)}</div>}
    <div className="detail-actions"><a className="primary" href="#available-offers" onClick={e=>{e.preventDefault();document.getElementById('available-offers')?.scrollIntoView()}}>View offers <ArrowRight size={16}/></a><button className="secondary" aria-pressed={saved} onClick={toggle}><Heart size={17} fill={saved?'currentColor':'none'}/> {t("Wishlist")}</button><button className="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(location.href);notice('Product link copied')}catch{notice('Copy this product link from the address bar')}}}><Share2 size={17}/> {t("Share")}</button></div>
   </div>
  </section>
  <section className="panel" id="available-offers"><h2>{t("Available Offers")}</h2><p className="muted">{t("Demonstration sellers and example prices")}</p>
   <details className="activation-assistant">
    <summary>{locale==='lt'?'Ar šį raktą galima aktyvinti Lietuvoje?':'Will this key work in Lithuania?'}</summary>
    <label>{t('Platform')} <select value={activationPlatform} onChange={event=>setActivationPlatform(event.target.value)}>
     <option value="">{locale==='lt'?'Pasirinkite platformą':'Choose a platform'}</option>
     {platforms.map(name=><option key={name}>{name}</option>)}
    </select></label>
    <p role="status">{activationPlatform&&activationMessage}</p>
    <small>{locale==='lt'?'Patikra pagal demonstracinių pasiūlymų regionus.':'Based on the activation regions in the demo catalog.'}</small>
   </details>
   <div className="filters"><label>{t("Activation region")}<select value={region} onChange={e=>setRegion(e.target.value)}><option value="">{t("All regions")}</option>{[...new Set(offers.map(o=>o.region))].map(x=><option key={x} value={x}>{t(x)}</option>)}</select></label><label>{t("Platform")}<select value={platform} onChange={e=>setPlatform(e.target.value)}><option value="">{t("All platforms")}</option>{[...new Set(offers.map(o=>o.platform))].map(x=><option key={x} value={x}>{t(x)}</option>)}</select></label><label>{t("Sort by")}<select value={sort} onChange={e=>setSort(e.target.value)}><option value="asc">{t("Lowest price")}</option><option value="desc">{t("Highest price")}</option></select></label></div>
   {filtered.map(o=><div className={'offer-row '+(selected===o.id?'selected':'')} key={o.id}><label><input type="radio" name="offer" checked={selected===o.id} onChange={()=>setSelected(o.id)}/><strong>{o.seller}</strong><small>★ {o.rating} · {o.reviews.toLocaleString()} {t('reviews')}</small></label><div>{o.platform} · {t(o.region)}<small>{t(o.edition)} · {t(o.availability)}</small></div><div className="offer-price"><strong>{money(o.price)}</strong>{o.old>0&&<small><del>{money(o.old)}</del> · −{o.discount}%</small>}{o.cashback&&<small className="rating">{o.cashback}</small>}</div><button className="primary" onClick={()=>{setSelected(o.id);add(o)}}>{t("Add to cart")}</button></div>)}
   {!filtered.length&&<p>{t("No offers match these filters.")}</p>}
  </section>
  <section className="shelf related"><div className="section-title"><h2>{t("Gamers also viewed")}</h2><div className="detail-actions"><button aria-label={t("Previous products")} onClick={()=>rail.current?.scrollBy({left:-390,behavior:'smooth'})}><ChevronLeft/></button><button aria-label={t("Next products")} onClick={()=>rail.current?.scrollBy({left:390,behavior:'smooth'})}><ChevronRight/></button></div></div><div className="rail" ref={rail}>{related.map(card)}</div></section>
  <section className="panel"><h2>{t("Reviews")}</h2>{details?<><p className="muted">{t("Demonstration ratings and reviews")}</p><div className="chips"><span>{t('Overall')} {details.rating} / 5 · {details.count} {t('ratings')}</span>{Object.entries(details.scores).map(([k,v])=><span key={k}>{t(k)} {v} / 5</span>)}</div><label className="review-sort">{t("Sort reviews")} <select value={reviewSort} onChange={e=>{setReviewSort(e.target.value);setLimit(3)}}><option value="helpful">{t("Most helpful")}</option><option value="recent">{t("Most recent")}</option><option value="high">{t("Highest rated")}</option><option value="low">{t("Lowest rated")}</option></select></label>
   {reviews.slice(0,limit).map(r=><article className="review" key={r.id}><strong>{r.flag} {r.user}</strong><small>{r.date} · ★ {r.rating} / 5{r.translated?' · '+t('Auto-translated'):''}</small><details><summary>{t("Read more")}</summary><p>{r.text}</p></details><button aria-pressed={votes.includes(r.id)} onClick={()=>setVotes(v=>v.includes(r.id)?v.filter(x=>x!==r.id):[...v,r.id])}>{t('Helpful')} ({r.helpful+Number(votes.includes(r.id))})</button></article>)}
   {limit<reviews.length&&<button className="secondary" onClick={()=>setLimit(n=>n+3)}>{t("Load more")}</button>}</>:<p>{t("No reviews available.")}</p>}</section>
  <section className="panel"><h2>{t("Product Details")}</h2>{details?<><p className="rating">★ {details.rating} / 5</p><p>{details.description}</p><details><summary>{t("Read more")}</summary><h3>{t("Included games and content")}</h3><ul>{details.included.map(x=><li key={x}>{x}</li>)}</ul><h3>{t("Key features")}</h3><ul>{details.features.map(x=><li key={x}>{x}</li>)}</ul><p>{details.genres.join(' · ')}</p><p>{details.facts.Developer} · {details.facts.Publisher}</p></details></>:<p>{product.title} {t('is a digital product for')} {product.platform}. {t('Check the activation region on the seller offer before checkout.')}</p>}</section>
  {!["Gaming eCards","eGift Cards"].includes(product.category)&&<section className="panel"><h2>{t("System Requirements")}</h2>{details?<details open><summary>{t("Minimum and recommended specifications")}</summary><p className="muted">{t("Sample PC specifications for Arkham Knight. Requirements vary by title in the collection.")}</p><div className="table-scroll"><table><thead><tr><th scope="col">{t("Specification")}</th><th scope="col">{t("Minimum")}</th><th scope="col">{t("Recommended")}</th></tr></thead><tbody>{details.requirements.map(([label,min,rec])=><tr key={label}><th scope="row">{t(label)}</th><td>{min}</td><td>{rec}</td></tr>)}</tbody></table></div></details>:<p>{t("System specifications are unavailable for this listing.")}</p>}</section>}
  <section className="panel"><h2>{t("Other Details")}</h2><dl>{Object.entries({'Platform':product.platform,'Activation region':product.region,...details?.facts}).map(([k,v])=><div key={k}><dt>{t(k)}</dt><dd>{v}</dd></div>)}</dl></section>
  <MarketplaceFooter/>
 </div>
}
