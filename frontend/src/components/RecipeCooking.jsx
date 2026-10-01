import { useState } from 'react'
import { Section, Button } from './ui.jsx'
import { recipeText } from '../lib/recipe-guide.js'
export function RecipeQuantities({text}){
  const blocks=String(text).split(/\n\s*\n/).filter(Boolean)
  return <>{blocks.map((block,i)=>{const lines=block.trim().split('\n');if(lines.every(line=>line.trim().startsWith('|'))){const rows=lines.filter(line=>!/^\s*\|[\s:|\-]+\|\s*$/.test(line)).map(line=>line.trim().replace(/^\||\|$/g,'').split('|').map(recipeText));return <div className="recipe-table" key={i}><table><tbody>{rows.map((row,j)=><tr key={j}>{row.map((cell,k)=>j===0?<th key={k}>{cell}</th>:<td key={k}>{cell}</td>)}</tr>)}</tbody></table></div>}return <p key={i} className="recipe-quantities">{recipeText(block)}</p>})}</>
}
export default function RecipeCooking({recipe,foods,servings=1}){
  const [checked,setChecked]=useState({}),[cooking,setCooking]=useState(false),[step,setStep]=useState(0)
  const steps=(recipe.steps||[]).map(recipeText).filter(Boolean),unknown=recipe.servingsBasis==='unknown-needs-review',factor=unknown?1:servings/recipe.servings
  const images=[...new Set([recipe.image,...(recipe.images||[])].filter(Boolean))]
  return <div className="recipe-guide">
    {recipe.quantityText&&<Section title="原方份数与用量计算"><RecipeQuantities text={recipe.quantityText}/></Section>}
    <Section title="食材与用量" footer={unknown?'以下保留原方用量与份数，尚未审核，不按当前份数自动缩放。':'已按当前份数换算材料重量。时间和火候不能直接乘以份数。'}>
      {recipe.ingredients.map((i,j)=>{const food=foods.find(f=>f.id===i.foodId),amount=Number.isFinite(i.grams)?Math.round(i.grams*factor*10)/10+' 克':'按原方用量',state=food?.foodType==='cooked'?'熟重':food?.foodType==='raw'?'生可食重':'';return <label className={'recipe-ingredient'+(checked[j]?' prepared':'')} key={j}><input type="checkbox" checked={!!checked[j]} onChange={e=>setChecked({...checked,[j]:e.target.checked})}/><span><strong>{recipeText(i.originalText)||food?.nameZh||'原料'}</strong>{food&&!unknown&&<small>{food.nameZh} · {state||'按对应食材条目'}{i.estimated?' · 建议用量':''}</small>}</span><b>{unknown?'原方':amount}</b></label>})}
    </Section>
    {!!recipe.tools?.length&&<Section title="需要的工具"><p>{recipe.tools.map(recipeText).join('、')}</p></Section>}
    {steps.length>0?<><Section title="怎么做"><ol className="steps-list">{steps.map((text,i)=><li key={i}>{text}</li>)}</ol></Section><Button variant="tinted" onClick={()=>{setCooking(!cooking);setStep(0)}}>{cooking?'收起逐步做菜':'开始逐步做菜'}</Button></>:<p className="notice">该记录没有做法。可查看原来源或编辑副本补充。</p>}
    {cooking&&<Section title={'第 '+(step+1)+' / '+steps.length+' 步'}><p className="cooking-current" aria-live="polite">{steps[step]}</p><div className="row"><Button disabled={step===0} onClick={()=>setStep(step-1)}>上一步</Button><Button variant="primary" onClick={()=>step===steps.length-1?setCooking(false):setStep(step+1)}>{step===steps.length-1?'做完了':'下一步'}</Button></div></Section>}
    {!!recipe.tips?.length&&<Section title="细节与注意事项"><ul className="steps-list">{recipe.tips.map((tip,i)=><li key={i}>{recipeText(tip)}</li>)}</ul></Section>}
    {recipe.notes&&<p className="sect-f">{recipe.notes}</p>}
    {images.length>0&&<Section title="原方图片"><div className="recipe-gallery">{images.map((src,i)=><figure key={src}><img loading="lazy" src={src} alt={recipe.nameZh+' 原方图 '+(i+1)}/><figcaption>原方图 {i+1}</figcaption></figure>)}</div></Section>}
    {recipe.originalText&&<details className="recipe-original"><summary>查看完整原方（含补充和变化）</summary><pre className="recipe-source-text">{recipe.originalText}</pre></details>}
  </div>
}
