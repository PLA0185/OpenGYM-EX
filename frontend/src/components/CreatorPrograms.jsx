import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { matchingCreatorPrograms } from '../lib/creator-programs.js'
import { goalLabels,intensityLabels,bodyLabels } from '../lib/program-filters.js'
import { Button,TextField } from './ui.jsx'
export default function CreatorPrograms({onImport}){
  const [params,setParams]=useSearchParams(),[search,setSearch]=useState(''),[filters,setFilters]=useState({goal:'',intensity:'',duration:'',body:''})
  const creator=params.get('creator')||'',category=params.get('courseType')||'',matching=matchingCreatorPrograms(filters,search),byCreator=matching.filter(p=>p.creator===creator),visible=byCreator.filter(p=>p.category===category)
  const enter=(creator='',category='')=>setParams({...creator&&{creator},...category&&{courseType:category}})
  const select=(key,label,options)=><label className="program-filter"><span>{label}</span><select aria-label={label} value={filters[key]} onChange={e=>setFilters({...filters,[key]:e.target.value})}><option value="">全部</option>{Object.entries(options).map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></label>
  return <div className="creator-library">
    <p className="sect-f">原作者公开课程与计划目录。单次课、课程库和付费计划介绍分别标明；导入实际参数后才成为可执行周计划。</p>
    <div className="program-filters">{select('goal','训练目标',goalLabels)}{select('intensity','明确标注的强度',intensityLabels)}{select('duration','主体训练时间',{short:'30 分钟以内',medium:'31–60 分钟',long:'60 分钟以上'})}{select('body','训练部位',bodyLabels)}</div>
    <TextField aria-label="搜索博主或课程" placeholder="搜索博主、课程或训练类型" value={search} onChange={e=>setSearch(e.target.value)}/>
    {(search||Object.values(filters).some(Boolean))&&<Button size="sm" onClick={()=>{setSearch('');setFilters({goal:'',intensity:'',duration:'',body:''})}}>清除筛选</Button>}
    <nav className="program-crumbs" aria-label="博主课程层级"><button onClick={()=>enter()}>博主来源</button>{creator&&<><span>›</span><button onClick={()=>enter(creator)}>{creator}</button></>}{category&&<><span>›</span><span>{category}</span></>}</nav>
    <p className="sect-f">明确时长或强度未取得的课程不参与该项筛选。时长可能不含热身与放松；完整细节以原作者当前版本为准。</p>
    <section className="program-browser">
      {!creator?[...new Set(matching.map(p=>p.creator))].map(name=><button key={name} className="program-card creator-source-card" onClick={()=>enter(name)}><h3>{name}</h3><p>{matching.filter(p=>p.creator===name).length} 项公开参考 · 查看分类</p></button>):!category?[...new Set(byCreator.map(p=>p.category))].map(name=><button key={name} className="program-card creator-category-card" onClick={()=>enter(creator,name)}><h3>{name}</h3><p>查看课程与来源</p></button>):visible.map(p=><article key={p.id} className="program-card creator-course-card"><h3>{p.name}</h3><p className="program-meta">{p.period&&<span>{p.period}</span>}<span>{p.minutesMax?'主体最长 '+p.minutesMax+' 分钟':'完整时长待核对'}</span><span>{p.access==='paid'?'付费原方案介绍':p.access==='mixed'?'含原App或付费内容':'公开内容'}</span></p>{p.equipment&&<p>{p.equipment}</p>}<p className="sect-f">{p.summary}</p><a href={p.url} target="_blank" rel="noreferrer">查看原作者方案</a><Button size="sm" onClick={()=>onImport(p)}>导入原方案参数</Button></article>)}
      {(!creator&&!matching.length||creator&&!category&&!byCreator.length||category&&!visible.length)&&<p className="notice">当前筛选下没有课程，请调整条件或返回其他博主。</p>}
    </section>
  </div>
}
