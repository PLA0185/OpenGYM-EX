import guides from '../data/china-guides.json'
import { builtInPrograms,guidelinePrograms } from './programs.js'
import { clone } from './nutrition.js'
import { needsPartner } from './solo-exercises.js'
import { KNOWLEDGE_EXERCISES } from './knowledge-exercises.js'
import activityReference from '../data/activity-reference.json'
import { programFilters } from './program-filters.js'
export function knowledgePrograms(exercises){
  const built=builtInPrograms(exercises),base=guidelinePrograms(exercises),china=base[0],plans=[...base]
  const timed=(id,minutes)=>({exerciseId:id,originalText:exercises.find(e=>e.id===id)?.nameZh||id,mappingStatus:'exact',sets:1,durationSec:minutes*60,restSec:0,weight:0,weightUnit:'kg',estimatedFields:['durationSec'],notes:'活动计时，0表示不额外负重；没有伪造动作示范。'})
  const make=(guide,key,name,days,lists,notes,category)=>({id:'knowledge-'+guide.id+'-'+key,nameZh:name,nameEn:'',sourceType:'guideline-derived',sourceGuideId:guide.id,sourceName:guide.publisher+'《'+guide.title+'》',sourceUrl:guide.url,originalTitle:guide.title,knowledgeCategory:category,progression:'off',notes:notes+'；具体动作和星期为应用整理，公斤数为个人记录或首次试练值，并非机构发布的固定课程。',days:days.map((weekday,i)=>({weekday,dayName:name+' '+(i+1),exerciseItems:clone(lists[i%lists.length])}))})
  for(const guide of guides){
    if(guide.id==='china-fitness-2017'){
      const aerobic=new Set(['walking','jogging','cycling','hiking','stairs','swimming','running','fast-cycling','aerobics','fitness-dance'])
      const traditional=new Set(['taichi','baduanjin','taichi-sword','mulan','mulan-sword','wushu','wuqinxi','yijinjing','liuzijue'])
      const mobility=new Set(['dynamic-stretch','yoga','balance'])
      for(const ex of KNOWLEDGE_EXERCISES){
        const key=ex.id.replace('knowledge-',''),category=aerobic.has(key)?'有氧训练':traditional.has(key)?'中国传统体育':mobility.has(key)?'柔韧与平衡':'球类与协调'
        const minutes=key==='walking'?15:mobility.has(key)?10:20
        plans.push(make(guide,key,ex.nameZh,[1,3,5],[[timed(ex.id,minutes)]],'计时安排与单人技能练习为应用编排；需要该项目基础。仅提供练习入口和来源，不声称替代专项教学',category))
      }
      const stretches=['hamstring stretch','overhead triceps stretch','upper back stretch'].map(name=>{const e=exercises.find(e=>e.n===name);if(!e)throw new Error('Missing knowledge stretch: '+name);return {exerciseId:e.id,originalText:e.n,mappingStatus:'exact',sets:2,durationSec:20,restSec:20,weight:0,estimatedFields:['sets','durationSec','restSec']}})
      plans.push(make(guide,'stretch','柔韧 · 全身静态拉伸',[1,2,3,4,5],[stretches],'指南建议初期优先静态牵拉；这里采用可编辑的2组20秒，无同伴辅助','柔韧与放松'))
      for(const [key,index,name] of [['full3',1,'力量 · 全身三练'],['upperlower',2,'力量 · 上下肢四练'],['home',5,'力量 · 居家全身三练']])plans.push(make(guide,key,name,built[index].days.map(d=>d.weekday),built[index].days.map(d=>d.exerciseItems.map(e=>({...e,sets:3,reps:10,restSec:120}))),'依据中等力量负荷范围整理，休息120秒','力量与增肌'))
      for(const [key,name,sets,reps,restSec] of [['endurance','力量 · 肌肉耐力',2,21,60],['strength','力量 · 最大力量基础',3,5,180]])plans.push(make(guide,key,name,[1,4],built[0].days.map(d=>d.exerciseItems.map(e=>({...e,sets,reps,restSec}))),key==='strength'?'需已有力量基础；5次和具体动作是应用选择，首次试练重量不代表已达到最大重复负荷':'依据轻负荷、多次重复原则编排；21次是应用选择','力量与增肌'))
      for(const [key,name,days,minutes,index] of [['initial','阶段 · 初期适应',[1,3,5],15,5],['middle','阶段 · 中期提高',[1,2,4,5],30,0],['stable','阶段 · 长期稳定',[1,2,3,4,5],40,1]]){
        const lists=days.map((_,i)=>[timed('knowledge-walking',minutes),...(i%2===0?built[index].days[0].exerciseItems.map(e=>({...e,sets:key==='initial'?1:2,reps:10,restSec:120})):[]),...clone(stretches)])
        plans.push(make(guide,key,name,days,lists,'按阶段逐渐增加活动量；时间与天数不是自动进阶指令，结合完成情况和恢复后再调整','阶段训练方案'))
      }
    }else{
      const military=guide.id.startsWith('military-'),category=military?'军体原则与基础体能':'健康与体重管理'
      plans.push(make(guide,'gym',military?'军体原则 · 单人基础力量':'有氧配合抗阻 · 健身房',[1,3,5],china.days.map(d=>[...d.exerciseItems,timed('knowledge-walking',15)]),guide.summary+' '+guide.application,category))
      plans.push(make(guide,'home',military?'军体原则 · 居家基础体能':'有氧配合徒手 · 居家',[1,3,5],built[5].days.map(d=>[...d.exerciseItems,timed('knowledge-walking',15)]),guide.summary+' '+guide.application,category))
    }
  }
  for(const p of built){p.sourceGuideId='china-fitness-2017';p.sourceUrl=guides[0].url;p.knowledgeCategory='常见力量分化';p.notes='分化形式和参数为应用编排，关联全民健身指南的循序渐进与力量原则，不声称为官方原始课程。';plans.push(p)}
  const acsm=base.find(p=>p.sourceName.includes('ACSM'))
  const hypertrophy=clone(acsm);hypertrophy.id='knowledge-acsm-hypertrophy';hypertrophy.nameZh='ACSM 2026 · 增肌训练量';hypertrophy.notes='依据每肌群约10组/周的增肌原则整理，采用全身两练、每动作5组。具体动作、10次和120秒休息为应用编排；有训练基础后使用，按恢复调整。'
  hypertrophy.days=hypertrophy.days.map(d=>({...d,exerciseItems:[...d.exerciseItems,...clone([built[3].days[1].exerciseItems.at(-1),built[3].days[2].exerciseItems[1],built[3].days[2].exerciseItems.at(-1)])].map(e=>({...e,sets:5,reps:10,restSec:120,percent1RM:null,sourceFields:[],estimatedFields:['sets','reps','restSec']}))}));plans.push(hypertrophy)
  const power=clone(acsm);power.id='knowledge-acsm-power';power.nameZh='ACSM 2026 · 爆发力基础';power.notes='依据30–70%1RM和向心阶段快速发力的原则，应用选择50%、3组5次和180秒休息；需已掌握动作并有力量基础，不能用首次试练重量冒充50%1RM。无基线时先作轻负重技术练习，不以速度牺牲控制。';power.days=power.days.map(d=>({...d,exerciseItems:d.exerciseItems.map(e=>({...e,percent1RM:50,notes:'需要动作基础：上举阶段有控制地快速发力，回程稳定。'}))}));plans.push(power)
  const cdc=base.find(p=>p.sourceName.includes('CDC'))
  for(const [key,combined] of [['aerobic',false],['combined',true]]){const p=clone(cdc);p.id='knowledge-cdc-'+key;p.nameZh=combined?'成人活动指南 · 有氧配合力量':'成人活动指南 · 每周有氧';p.notes='按每周至少150分钟中等强度有氧、至少两次主要肌群力量的原则编排；具体星期和健步走为应用选择，需要逐渐达到，不用于新手首周强制达标。';p.days=[1,2,3,4,5].map(weekday=>({weekday,dayName:'健步走'+(combined&&[1,4].includes(weekday)?'与全身力量':''),exerciseItems:[timed('knowledge-walking',30),...(combined&&[1,4].includes(weekday)?clone(cdc.days[0].exerciseItems):[])]}));plans.push(p)}
  for(const id of ['china-literacy-2024','china-weight-2024']){const guide=guides.find(g=>g.id===id),minutes=id==='china-weight-2024'?50:30;const days=[1,2,3,4,5],lists=days.map(weekday=>[timed('knowledge-walking',minutes),...([1,4].includes(weekday)?clone(china.days[0].exerciseItems):[])]);plans.push(make(guide,'weekly',id==='china-weight-2024'?'体重管理 · 渐进有氧与抗阻':'健康素养 · 有氧与抗阻一周',days,lists,id==='china-weight-2024'?'有体重管理需要、已有基础并完成适用性评估后逐渐达到活动量；不是所有新手的默认量':'周活动目标参考，先根据现有能力逐渐增加','健康与体重管理'))}
  for(const activity of activityReference.activities){
    const p=clone(built[activity.code==='02056'||activity.code==='02057'?5:0]),vigorous=[6,6.5,7.5].includes(activity.met)
    p.id='knowledge-met-'+activity.code;p.nameZh=activity.nameZh;p.sourceGuideId='activity-compendium-2024';p.sourceType='guideline-derived';p.sourceName='2024 Adult Compendium · '+activity.code;p.sourceUrl=activityReference.sourceUrl;p.activityCode=activity.code;p.knowledgeCategory='活动能耗参考';p.notes='对应已加载活动类型与MET；具体训练日和动作由应用编排。MET是人群估计，不是个人实测。高强度方案需要训练基础，不用于新手默认。';p.days=p.days.map(d=>({...d,exerciseItems:d.exerciseItems.map(e=>({...e,sets:3,reps:vigorous?8:12,restSec:activity.code==='02040'?30:90}))}));plans.push(p)
  }
  for(const p of plans){p.sourceGuideId??=p.sourceName.includes('ACSM')?'acsm-resistance-2026':p.sourceName.includes('CDC')?'cdc-adults':'china-fitness-2017';p.knowledgeCategory??=p.sourceName.includes('ACSM')?'ACSM 抗阻指南':p.sourceName.includes('CDC')?'国际成人活动指南':'力量与增肌';p.days=p.days.map(d=>({...d,exerciseItems:d.exerciseItems.filter(e=>!needsPartner(exercises.find(x=>x.id===e.exerciseId)))}))}
  return plans.map(p=>({...p,filters:programFilters(p,exercises)}))
}
