import { useState,useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { matchingCreatorPrograms } from '../lib/creator-programs.js'
import { goalLabels,intensityLabels,bodyLabels } from '../lib/program-filters.js'
import { Button,TextField } from './ui.jsx'
export default function CreatorPrograms({onImport,onShow,onGenerate,catalog}){
  const [params,setParams]=useSearchParams(),[search,setSearch]=useState(''),[filters,setFilters]=useState({goal:'',intensity:'',duration:'',body:''})
  const creator=params.get('creator')||'',category=params.get('courseType')||'',matching=useMemo(()=>matchingCreatorPrograms(filters,search,catalog),[filters,search,catalog]),byCreator=matching.filter(p=>p.creator===creator),visible=byCreator.filter(p=>p.category===category)
  const enter=(creator='',category='')=>setParams({...creator&&{creator},...category&&{courseType:category}})
  const select=(key,label,options)=><label className="program-filter"><span>{label}</span><select aria-label={label} value={filters[key]} onChange={e=>setFilters({...filters,[key]:e.target.value})}><option value="">全部</option>{Object.entries(options).map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></label>
  return <div className="creator-library">
    <p className="sect-f">选择方案，按已有档案生成本机可执行的训练与饮食。已核对的动作表可直接查看组次、休息和预填重量；替代动作与应用编排会说明。</p>
    <div className="program-filters">{select('goal','训练目标',goalLabels)}{select('intensity','明确标注的强度',intensityLabels)}{select('duration','主体训练时间',{short:'30 分钟以内',medium:'31–60 分钟',long:'60 分钟以上'})}{select('body','训练部位',bodyLabels)}</div>
    <TextField aria-label="搜索博主或课程" placeholder="搜索博主、课程或训练类型" value={search} onChange={e=>setSearch(e.target.value)}/>
    {(search||Object.values(filters).some(Boolean))&&<Button size="sm" onClick={()=>{setSearch('');setFilters({goal:'',intensity:'',duration:'',body:''})}}>清除筛选</Button>}
    <nav className="program-crumbs" aria-label="博主课程层级"><button onClick={()=>enter()}>博主来源</button>{creator&&<><span>›</span><button onClick={()=>enter(creator)}>{creator}</button></>}{category&&<><span>›</span><span>{category}</span></>}</nav>
    <p className="sect-f">原表和个人适配分开说明。未取得完整原课的内容按内置指南编排，不冒充原作者固定方案；生成会核对个人时间、限制及恢复。</p>
    <section className="program-browser">
      {!creator?[...new Set(matching.map(p=>p.creator))].map(name=><button key={name} className="program-card creator-source-card" onClick={()=>enter(name)}><h3>{name}</h3><p>{matching.filter(p=>p.creator===name).length} 项训练安排 · 查看分类</p></button>):!category?[...new Set(byCreator.map(p=>p.category))].map(name=><button key={name} className="program-card creator-category-card" onClick={()=>enter(creator,name)}><h3>{name}</h3><p>查看可用方案</p></button>):visible.map(p=><article key={p.id} className="program-card creator-course-card"><h3>{p.name}</h3><p className="program-meta">{p.period&&<span>{p.period}</span>}{p.minutesMax&&<span>{p.estimatedMinutes?'含休息预计最长':'主体最长'} {p.minutesMax} 分钟</span>}<span>{p.tableKey?p.applicationArrangement?'教学动作 · 应用编排':'已核对原动作表':p.access==='paid'?'原课付费 · 可生成个人适配':'个人适配参考'}</span></p>{p.equipment&&<p>{p.equipment}</p>}<p className="sect-f">{p.summary}</p><Button variant="primary" size="sm" onClick={()=>onGenerate(p)}>生成个人训练与饮食</Button>{p.tableKey&&<Button size="sm" onClick={()=>onShow(p)}>查看动作和预填计划</Button>}<details><summary>来源与原文补充</summary><a href={p.url} target="_blank" rel="noreferrer">核对原作者来源</a><Button size="sm" onClick={()=>onImport(p)}>补充导入原文参数</Button></details></article>)}
      {(!creator&&!matching.length||creator&&!category&&!byCreator.length||category&&!visible.length)&&<p className="notice">当前筛选下没有课程，请调整条件或返回其他博主。</p>}
    </section>
  </div>
}
