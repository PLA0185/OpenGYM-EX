import { useState } from 'react'
import { imgSrc, gifSrc } from '../lib/exercises.js'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import hqMedia from '../data/exercise-hq.json'
import hdMedia from '../data/exercise-hd.json'
const mediaAvailable = import.meta.env.VITE_MOBILE !== '1' || import.meta.env.VITE_OFFLINE_MEDIA === 'bundled'

// Big autoplaying animation; tap toggles to the still frame. `compact` shrinks it (superset cards).
// Custom exercises have no media — the animation stays blank by design (issue #11).
// `minimizable` (workout view) adds a persistent minimize/expand control so the animation stops
// eating the screen; the chosen size is saved to settings and carries across exercises and
// future workouts (issue #12).
export default function Media({ ex, id, compact, minimizable }) {
  const [playing, setPlaying] = useState(true)
  const [photo,setPhoto]=useState(true),[frame,setFrame]=useState(0)
  const hd=hdMedia[ex.id],hq=hqMedia[ex.id],usingPhoto=!hd&&photo&&!!hq
  const gifSize = useStore(s => s.S.gifSize)
  const update = useStore(s => s.update)
  if (!ex.gif) return null
  if (!mediaAvailable) return <p className="sect-f">{t('Offline exercise animation pending media license; text instructions are available.')}</p>
  const mini = minimizable && gifSize === 'mini'
  const toggleSize = e => { e.stopPropagation(); update(s => { s.gifSize = mini ? 'full' : 'mini' }) }
  return (
    <div className={'exmedia' + (compact ? ' compact' : '') + (mini ? ' mini' : '') + (usingPhoto?' photo':hd?'':' original-resolution')} id={id} onClick={() => usingPhoto?setFrame(v=>1-v):setPlaying(p => !p)}>
      <img decoding="async" src={usingPhoto?hq.images[frame]:playing ? gifSrc(ex) : imgSrc(ex)} alt={(ex.nameZh||ex.n)+(usingPhoto?' · 高清动作分解':'')} />
      {!mini&&<div className="media-source" onClick={e=>e.stopPropagation()}>{hq&&!hd&&<button onClick={()=>setPhoto(v=>!v)}>{usingPhoto?'查看原始动画':'查看高清分解'}</button>}<span>{usingPhoto?`${hq.dimensions[frame].width}×${hq.dimensions[frame].height} · ${frame?'结束':'起始'}姿势`:hd?`${hd[playing?'animation':'image'].width}×${hd[playing?'animation':'image'].height} · 高清${playing?'动画':'图片'}`:'原始素材 180×180'}</span></div>}
      {minimizable && (
        <button className="giftoggle" onClick={toggleSize}>
          <Icon name={mini ? 'expand' : 'minimize'} />{mini ? t('Expand') : t('Minimize')}
        </button>
      )}
      {!mini && (
        <span className="gifhint">
          <Icon name={usingPhoto?'chevronRight':playing ? 'pause' : 'play'} />{usingPhoto?'点击切换姿势':playing ? t('tap to pause') : t('tap to play')}
        </span>
      )}
    </div>
  )
}

export function Thumb({ ex }) {
  if (!ex.img || !mediaAvailable) return <div className="thumb thumb-x"><Icon name="dumbbell" /></div>
  return <img className="thumb" loading="lazy" decoding="async" src={hdMedia[ex.id]?imgSrc(ex):hqMedia[ex.id]?.images[0]||imgSrc(ex)} alt="" />
}
