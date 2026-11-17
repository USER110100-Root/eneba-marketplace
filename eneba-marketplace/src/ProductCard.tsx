import {applyFallbackArtwork,productHref} from './productUtils'
import {useLocale,useTranslation,formatMoney} from './i18n'
import { Gamepad2, Heart } from 'lucide-react'
export type Product = {id:string; title:string; platform:string; region:string; price:number; old?:number; badge?:string; cashback?:string; category:string; group:string; art?:string; fallbackArt?:string}
export function ProductCard({product:p,saved,toggle,addToCart,platformIcon:PlatformIcon=Gamepad2}:{product:Product;saved:boolean;toggle:()=>void;addToCart?:()=>void;platformIcon?:typeof Gamepad2}) {
  const t=useTranslation()
  const locale=useLocale()
  const money=(cents:number)=>formatMoney(cents,locale)
  const productUrl=productHref(p.id)
  return <article className="product">
    <div className="cover" data-platform={p.platform} data-product={p.id}>
      <a href={productUrl} aria-hidden="true" tabIndex={-1}>{p.art ? <img src={p.art} onError={({currentTarget})=>applyFallbackArtwork(currentTarget,p.fallbackArt)} alt="" loading="lazy"/> : <span className="cover-title">{p.title}</span>}</a>
      <button className="heart" aria-label={t(saved?'Remove from wishlist':'Add to wishlist')} aria-pressed={saved} onClick={toggle}><Heart size={19} fill={saved?'currentColor':'none'}/></button>
      <div className="badges">{p.badge&&<span>{t(p.badge)}</span>}{p.cashback&&<span className="cashback">{p.cashback}</span>}</div>
      <div className="product-actions">
        {addToCart&&<button type="button" onClick={addToCart}>{t('Add to cart')}</button>}
        <a href={productUrl}>{t('View offers')}</a>
      </div>
    </div>
    <div className="product-info">
      <a data-testid={'product-'+p.id} className="product-title" href={productUrl} title={p.title}>{p.title}</a>
      <div className="product-meta"><PlatformIcon size={14} aria-hidden="true"/>{p.platform}<span>│</span>{t(p.region)}</div>
      <div className="price"><strong>{money(p.price)}</strong>{typeof p.old==='number'&&p.old>p.price&&<del>{money(p.old)}</del>}</div>
    </div>
  </article>
}
