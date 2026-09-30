import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { uid } from '../lib/format.js'
import { localDate } from '../lib/nutrition.js'
import { allFoods,mealSlots,nutritionLine,NutritionValues } from './Nutrition.jsx'
import { t } from '../lib/i18n.js'
import { createDeepSeek } from '../lib/deepseek.js'
import { getCredential } from '../lib/credentials.js'
import { useAIRequest } from '../lib/useAIRequest.js'
import { requireAI,aiErrorMessage } from '../lib/ai-errors.js'
import { FOOD_PHOTO_PROMPT,photoFoods,photoMeal,prepareMealPhoto,recordPhotoMeal,replacePhotoPlan } from '../lib/food-photo.js'
import { Section,Row,TextField,TextArea,SelectRow,Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'

export default function PhotoMeal(){
  const S=useStore(s=>s.S),update=useStore(s=>s.update),nav=useNavigate(),[query]=useSearchParams(),ai=useAIRequest(),selection=useRef(0),analysisId=useRef(uid()),planRevision=useRef(null)
  const [image,setImage]=useState(''),[loading,setLoading]=useState(false),[description,setDescription]=useState(''),[date,setDate]=useState(query.get('date')||localDate()),[slot,setSlot]=useState('lunch'),[result,setResult]=useState(null),[question,setQuestion]=useState(''),[error,setError]=useState(''),[choice,setChoice]=useState(''),[expectedIds,setExpectedIds]=useState([])
  async function pick(file){if(!file)return;const version=++selection.current;setLoading(true);setError('');try{const next=await prepareMealPhoto(file);if(version===selection.current){setImage(next);setResult(null);setQuestion('');setChoice('');analysisId.current=uid()}}catch(e){if(version===selection.current)setError(e.message)}finally{if(version===selection.current)setLoading(false)}}
  const analyze=()=>ai.run(async signal=>{setError('');setQuestion('');try{
    requireAI(S);const candidates=photoFoods(allFoods(S),description),metadata={id:analysisId.current,date,slot,description},version=selection.current
    let meal
    const data=await createDeepSeek({credential:getCredential,model:'deepseek-flash'}).generateStructured('foodPhoto',{task:FOOD_PHOTO_PROMPT,description,foods:candidates.map(f=>({id:f.id,nameZh:f.nameZh,nameEn:f.nameEn,foodType:f.foodType}))},{signal,imageDataURL:image,validate:r=>{meal=photoMeal(r,candidates,metadata)}})
    if(signal.aborted||version!==selection.current)return
    if(!meal){setQuestion(data.question||'请补充食物数量、大小或重量后重试。');return}
    const current=useStore.getState().S
    setExpectedIds(current.xunlian.meals.filter(m=>m.date===date&&m.slot===slot).map(m=>m.id))
    update(s=>{recordPhotoMeal(s,meal);return {balanceDeferred:true}});planRevision.current=useStore.getState().S.xunlian.revision;setResult(meal);setChoice('');useUI.getState().toast('已记录实际摄入（照片估算）')
  }catch(e){setError(e.code?aiErrorMessage(e):e.message)}})
  const replace=()=>{try{update(s=>replacePhotoPlan(s,result,expectedIds,planRevision.current));setChoice('已替换这餐计划，已按当前目标检查剩余餐食；调整内容见顶部联动说明。')}catch(e){setError(e.message)}}
  const busy=ai.busy||loading
  return <div className="narrow feature-page"><div className="hdr"><button className="iconbtn" aria-label="返回饮食" onClick={()=>nav('/nutrition')}><Icon name="chevronLeft"/></button><h1>拍照记录饮食</h1></div><p className="sect-f">照片与描述用于估算，无法测出隐藏的油、糖和真实重量。点击识别后，压缩图片与描述会发送到支持看图的 DeepSeek Flash，共用已配置密钥；照片不写入本地记录或备份。</p>
    <div className="photo-pickers"><label className={'btn tinted'+(busy?' disabled':'')}>拍照<input disabled={busy} type="file" accept="image/*" capture="environment" onChange={e=>{pick(e.target.files?.[0]);e.target.value=''}}/></label><label className={'btn tinted'+(busy?' disabled':'')}>相册 / 文件<input disabled={busy} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{pick(e.target.files?.[0]);e.target.value=''}}/></label></div>
    {loading&&<p role="status">正在处理图片…</p>}{image&&<img className="meal-photo-preview" src={image} alt="准备识别的餐食"/>}
    {!result&&<><Section><Row title="记录日期"><TextField disabled={busy} type="date" value={date} onChange={e=>setDate(e.target.value)}/></Row><SelectRow title="餐次" value={slot} onChange={v=>{if(!busy)setSlot(v)}} options={mealSlots.map(value=>({value,label:t(value)}))}/></Section><TextArea disabled={busy} maxLength={1500} aria-label="食物与分量描述" value={description} placeholder="可选，例如：猪肉包子三个，比我一个拳头小，全部吃完了" onChange={e=>setDescription(e.target.value)}/><Button variant="primary" disabled={busy||!image||!date} onClick={analyze}>{ai.busy?'正在识别…':'识别并记录实际摄入'}</Button></>}
    {ai.busy&&<Button onClick={ai.cancel}>取消识别</Button>}{question&&<p className="notice" role="status">{question} 未写入摄入记录。</p>}{error&&<p className="notice" role="alert">{error}</p>}
    {result&&<><Section title={result.nameZh+' · 已记录'} footer="这是实际摄入的估算；计划餐未自动替换。"><p>{result.date} · {t(result.slot)}</p><p>{nutritionLine(result.nutritionSnapshot)}</p><p className="notice">估算热量：{Math.floor(result.photoAnalysis.kcalMin)}–{Math.ceil(result.photoAnalysis.kcalMax)} kcal，区间不是统计置信区间。可信度：{result.photoAnalysis.confidence==='low'?'较低':'中等'}。</p><details><summary>估算食材、分量与假设</summary>{result.ingredientsSnapshot.map(i=><p className="sect-f" key={i.foodId}>{i.originalText} · 约 {Math.round(i.grams)} g（{Math.round(i.gramsMin)}–{Math.round(i.gramsMax)} g）</p>)}{result.photoAnalysis.notes.map((note,i)=><p key={i} className="sect-f">{note}</p>)}</details></Section>
      {!choice?<Section title={expectedIds.length?'是否替换这餐原有饮食计划？':'是否将这餐加入饮食计划？'} footer="替换所选日期的该餐，并检查当天剩余餐食是否需要平衡。实际摄入已保存，不会再记一次。"><Button variant="primary" onClick={replace}>{expectedIds.length?'替换该餐计划':'加入该餐计划'}</Button><Button onClick={()=>setChoice('仅保存实际摄入，保留原计划。')}>只记录已吃，保留计划</Button></Section>:<p className="notice" role="status">{choice}</p>}
      <Button disabled={!choice} onClick={()=>{selection.current++;setResult(null);setImage('');setDescription('');setQuestion('');setChoice('');setError('');analysisId.current=uid()}}>继续记录下一餐</Button><Button onClick={()=>nav('/nutrition')}>查看饮食记录</Button><details><summary>完整营养估算</summary><NutritionValues n={result.nutritionSnapshot}/></details></>}
    <Button onClick={()=>nav('/settings')}>AI 连接设置</Button></div>
}
