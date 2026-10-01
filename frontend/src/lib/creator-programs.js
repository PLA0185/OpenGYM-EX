// Verified source tables, attributed app arrangements and personal adaptation references.
import {brucePlanTables,dongPlanTables,creatorPlanTables} from './creator-plan-tables.js'
import {needsPartner} from './solo-exercises.js'
import {programFilters} from './program-filters.js'
const course=(id,creator,name,url,category,goals,bodyParts,extra={})=>({id:'creator-'+id,creator,name,url,category,goals,bodyParts,region:'international',checkedAt:'2026-10-01',access:'public',minutesMax:null,intensity:null,...extra})
export const creatorPrograms=[
  course('pam-beginner','Pamela Reif','20分钟新手全身徒手课','https://www.youtube.com/watch?v=UItWltVZZmE','居家跟练',['lose','maintain'],['full'],{minutesMax:20,equipment:'无需负重器材',summary:'原作者公开的新手版全身课程；按视频实际节奏与个人能力跟练。',aliases:['帕梅拉','pamela','pamela reif']}),
  course('heria-begin','Chris Heria','Begin Your Fitness Journey · 徒手入门','https://www.heriapro.com/programs','徒手力量',['lose','gain','maintain'],['full'],{access:'mixed',equipment:'具体器材按原课程核对',summary:'原作者目录的Beginner分级入门计划；完整动作参数需在原App核对，不能当作已取得全套免费内容。',aliases:['chris heria','克里斯','heria']}),
  course('heria-core','Chris Heria','8分钟核心训练 · 2026','https://chrisheria.com/blogs/news/1-3','核心训练',['maintain'],['waist'],{minutesMax:8,equipment:'自重',summary:'原页提供不同基础的计时选择：初级30秒动作/30秒休息，中级40/20，高级45/15。动作细节仍按原课；不因标题而默认每天高努力训练。',aliases:['chris heria','克里斯','heria']}),
  course('rowan-home','Rowan Row','20分钟居家无器械训练参考','https://www.rowanrow.com/videos','居家跟练',['lose','maintain'],['full'],{equipment:'无需负重器材',summary:'原官网列出的公开训练视频。标题为20分钟，但目录播放器时长为4:56，可能是示范短片；完整计时与组次待核对，不按标题硬填。',aliases:['rowan row','rowan']}),
  course('rowan-shred','Rowan Row','SHRED · 减脂计划介绍','https://www.rowanrow.com/fitness-plans','付费方案介绍',['lose'],['full'],{access:'paid',summary:'原作者付费方案目录；当前仅收录介绍与来源，未取得完整动作表。',aliases:['rowan row','rowan']}),
  course('rowan-bulk','Rowan Row','BULKING · 增肌计划介绍','https://www.rowanrow.com/fitness-plans','付费方案介绍',['gain'],['full'],{access:'paid',summary:'原作者付费增肌方案入口；购买后的实际参数可用原文导入审核。',aliases:['rowan row','rowan']}),
  course('chloe-daily20','Chloe Ting','2024 Daily 20 · 忙碌日徒手计划','https://chloeting.com/program/2024/daily-20-challenge','居家跟练',['lose','maintain'],['full'],{minutesMax:24,period:'19天',equipment:'训练垫',summary:'每次主体20–24分钟，热身与放松另计；来源允许按能力调整。',aliases:['chloe ting','chloe']}),
  course('chloe-weight','Chloe Ting','2024 Weight Loss · 减脂挑战','https://chloeting.com/program/2024/weight-loss-challenge','居家跟练',['lose'],['full','waist'],{minutesMax:43,period:'25天',equipment:'训练垫',summary:'原目录的新手友好计划，每次22–43分钟；实际日程、低冲击替代与休息以原方案为准。',aliases:['chloe ting','chloe']}),
  course('chloe-toned','Chloe Ting','2026 Get Toned · 全身抗阻','https://chloeting.com/program/2026/get-toned-challenge','哑铃力量',['gain','maintain'],['full'],{minutesMax:41,period:'20天',equipment:'哑铃、训练垫',summary:'原作者全身抗阻计划，每次21–41分钟；博主演示公斤数不作为用户默认负重。',aliases:['chloe ting','chloe']}),
  course('caroline-epic','Caroline Girvan','EPIC · 公开力量系列','https://carolinegirvan.com/programs/epic','哑铃力量',['gain','maintain'],['full'],{minutesMax:50,period:'10周',equipment:'哑铃、训练垫',summary:'原系列每周5次、每次约30–50分钟；按上下肢分配，有公开YouTube版本。初学者先选基础课程，不直接套进阶训练量。',aliases:['caroline girvan','caroline','卡罗琳']}),
  course('caroline-iron','Caroline Girvan','IRON · 六周公开增肌系列','https://carolinegirvan.com/programs/iron','哑铃力量',['gain','maintain'],['full'],{minutesMax:30,period:'6周公开版',equipment:'哑铃、训练垫、臀部弹力带',summary:'约30分钟/次、每周5次，六周YouTube版与十周CGX版内容不同；当前收录六周公开版介绍。',aliases:['caroline girvan','caroline','卡罗琳']}),
  course('heather-12week','Heather Robertson','HR12WEEK · 十二周公开计划指南','https://heatherrobertson.com/wp-content/uploads/HR_12_WEEK_WORKOUT_PLAN_GUIDE_Master.pdf','综合体能',['lose','gain','maintain'],['full'],{period:'12周',equipment:'按原指南具体课次核对',summary:'原作者公开的训练指南入口；课程参数需按对应版本核对，新App订阅方案不当作免费原计划。',aliases:['heather robertson','heather']}),
  course('anna-hiit','Growingannanas / Anna','HIIT IT HARD · 28天挑战','https://shop.growwithanna.com/pages/hiitithard','综合体能',['lose','maintain'],['full','cardio'],{intensity:'high',period:'28天',equipment:'哑铃、训练垫、弹力带；部分课次需稳固椅子',summary:'原作者混合抗阻、徒手、HIIT与柔韧的高强度挑战，YouTube有公开课；器材示范重量不当作个人处方，缺基础优先其他入门课程。',aliases:['growingannanas','grow with anna','anna engelschall','安娜']}),
  course('madfit-youtube','MadFit','MadFit · 公开跟练课程库','https://madfit.co/','居家跟练',['lose','maintain'],['full'],{summary:'原官网提供YouTube课程入口，涵盖力量、HIIT、瑜伽与普拉提；这是课程库，不是一套已核对完整参数的周计划。',aliases:['madfit','maddie lymburner']}),
  course('jeremy-fullbody','Jeremy Ethier','2026 · 每周三次全身训练参考','https://www.youtube.com/watch?v=n_YW24F5HGc','器械力量',['gain','maintain'],['full'],{equipment:'健身房器械，按原课核对',summary:'原作者公开讲解的每周三次全身训练思路；具体动作、组次与个人适配按原课核对。',aliases:['jeremy ethier','jeremy','杰里米']}),
  course('jeff-pure','Jeff Nippard','Pure Bodybuilding · 分化增肌计划介绍','https://jeffnippard.com/products/the-pure-bodybuilding-program','付费方案介绍',['gain'],['full'],{access:'paid',period:'10周',equipment:'健身房，按所选分化核对',summary:'原作者付费方案公开介绍，提供全身、上下肢与推拉腿版本；当前没有收录未取得的付费动作表。',aliases:['jeff nippard','nippard','杰夫尼帕德']})
]
creatorPrograms.unshift(...brucePlanTables.map(t=>course('bruce-'+t.key,'北美运动学博士Bruce_PhD',t.name,'https://www.bilibili.com/video/BV1vUd1YAEcv/?t='+t.seconds,t.category,['gain','maintain'],['full'],{region:'china',tableKey:t.key,intensity:'high',equipment:'健身房；替代动作会逐项说明',summary:'已逐表核对原视频动作、组次和百分比负荷。查看本机动作映射及预填值，或按已有档案生成个人适配方案。原课休息未明确写在表里，采用标明来源的应用预设。',aliases:['北美运动学博士','bruce_phd','bruce phd','bruce']})))
creatorPrograms.unshift(...dongPlanTables.map(t=>course(t.key,'烧毁一切就是美',t.name,'https://www.bilibili.com/video/BV1Si6PYKEdE/',t.category,['lose','gain','maintain'],['full'],{region:'china',tableKey:t.key,applicationArrangement:true,intensity:'moderate',equipment:'哑铃、可调训练凳',summary:'已核对原作者全身哑铃教学中的动作；视频不是固定周计划，星期、组次与休息由应用依据内置指南编排。可直接查看本机动作及预填参数，再按个人档案生成适配计划。',aliases:['烧毁一切就是美','东哥']})))
// Explicit mappings and substitutions. A similar exercise is never labelled as
// the author's exact variant when the local catalogue lacks that variant.
const moves={
 '深蹲':['0043'],'卧推':['0025'],'硬拉':['0032'],'腿弯举':['0599'],'腿屈伸':['0585'],'坐姿腿内收':['0598'],'引体向上':['0652'],'哑铃交替弯举':['0285'],
 '绳索三头下压':['0200'],'绳索下压':['0200'],'侧平举':['0334'],'高位下拉':['0150'],'牧师凳弯举':['0372'],'杠铃推肩':['0091'],
 '无腿窄距卧推':['0030','原文为无腿窄距卧推，本库用标准杠铃窄距卧推替代，示范不含无腿变式。'],
 '颈后臂屈伸':['2188'],'颈前深蹲':['0042'],'哑铃推肩':['0405'],'坐姿哑铃推肩':['0405'],
 '海豹划船':['0327','本库无平凳海豹划船，替代为胸部支撑上斜哑铃划船；角度不同。'],'俯身飞鸟':['0378'],
 '宽握硬拉':['0032','本库无已核对的宽握硬拉示范，替代为标准杠铃硬拉，握距不同。'],
 '单腿哑铃臀桥':['1409','本库无该单腿负重示范，替代为双腿杠铃臀桥；不冒充单腿版本。'],'坐姿腿外展':['0597'],'坐姿外展':['0597'],
 '直臂下压':['0199'],'支臂下压':['0199'],'哑铃罗马尼亚硬拉':['1459'],'哑铃罗拉':['1459'],'山羊挺身':['0489'],
 '坐姿器械推胸':['0577'],'坐姿绳索划船':['0861'],'龙门架夹胸':['0188'],'哑铃箭步走':['0336','本库使用原地哑铃箭步蹲替代箭步走，保留单侧次数。'],
 '史密斯臀推':['3562','本库无史密斯臀推示范，替代为凳上双腿杠铃臀桥；器械与负重单位需重新核对。'],
 '上斜绳索飞鸟':['0171'],'碎颅者':['0060'],'上斜哑铃划船':['0327'],'杠铃弯举':['0031'],
 '腿举':['2287','原表未说明腿举器械，应用选择可逐侧执行的杠杆器械腿举；每侧次数与阻力需在场馆核对。'],'保加利亚分腿蹲':['0410'],'上斜哑铃卧推':['0314'],'双杠臂屈伸':['0814'],'器械夹胸':['0596'],
 '绳索三头后伸展':['0194'],'对握下拉':['0150','本库标准高位下拉替代对握下拉，握把不同。'],
 '绳索弯举':['0868'],'史密斯推肩':['0405','本库使用坐姿哑铃推肩替代史密斯推肩；公斤数按每只哑铃。'],
 '哑铃卧推':['0289'],'站姿哑铃划船':['0293'],'高脚杯深蹲':['1760'],'哑铃直腿硬拉':['0432'],'哑铃箭步蹲':['0336'],'哑铃侧平举':['0334'],'哑铃弯举':['0294'],
 '对握推肩':['0427'],'前平举':['0310'],'肩前平举':['0310'],'单臂哑铃划船':['0292'],'EZ杠弯举':['0447'],
 '垂式弯举':['0313'],'坐姿器械划船':['1350'],'EZ杠碎颅者':['0060','本库用直杠仰卧臂屈伸替代EZ杠碎颅者，杠型不同。'],'上斜哑铃弯举':['0315']
}
export function creatorMappedProgram(course,catalog){
 const table=creatorPlanTables.find(t=>t.key===course?.tableKey)
 if(!table)return null
 const days=table.days.map((d,i)=>({weekday:d.weekday,dayName:table.name+' '+(i+1),exerciseItems:d.rows.map(r=>{
  const mapping=moves[r.move],ex=catalog.find(e=>e.id===mapping?.[0])
  if(!ex||needsPartner(ex))throw new Error('博主动作尚未匹配到可单人执行的动作：'+r.move)
  const setRange=String(r.sets).split('–').map(Number),repRange=String(r.reps).split('–').map(Number),failure=r.reps==='力竭',restSec=ex.eq==='barbell'?180:90
  const item={exerciseId:ex.id,originalText:r.move,mappingStatus:mapping[1]?'high-confidence':'exact',sets:setRange[0],reps:failure?12:repRange[0],restSec,estimatedFields:['restSec',...(setRange.length>1?['sets']:[]),...(failure?['reps']:[])],notes:[mapping[1],setRange.length>1?'原表组数 '+r.sets+'；应用先取下限。':'',failure?'原表写力竭；应用先预填12次并保留余力，完成能力不同请调整，不冒充原课固定次数。':'','休息为应用预设，原计划表未写明秒数。'].filter(Boolean).join(' ')}
  if(repRange.length>1){item.repsMin=repRange[0];item.repsMax=repRange[1]}
  if(r.percent)item.percent1RM=r.percent
  if(failure)item.rir=3
  if(table.key==='full-3'&&i===3&&['腿屈伸','腿弯举'].includes(r.move)){item.supersetGroup='bruce-leg-pair';item.notes+=' 原表用&连接，按超级组编排；可在编辑页拆开。'}
  if(course.applicationArrangement){item.restSec=120;item.estimatedFields=[...new Set([...item.estimatedFields,'sets','reps'])];item.notes+=' 动作取自作者教学，组次与休息为应用编排，并非作者固定周课表。'}
  return item
 })}))
 const p={id:course.id,nameZh:course.creator+' · '+table.name,nameEn:'',sourceType:'creator-derived',sourceGuideId:course.id,sourceName:course.creator+(course.applicationArrangement?'（教学动作与应用编排）':'（原表映射与明确替代）'),sourceUrl:course.url,originalTitle:table.name,originalText:JSON.stringify(table.days),knowledgeCategory:table.category,progression:'off',level:course.applicationArrangement?'beginner':'advanced',notes:course.applicationArrangement?'核对原作者教学后使用本机对应动作；星期、组次和休息为应用编排，不是原作者发布的固定周计划。负重按真实近期记录或轻负重试练起点预填，可按个人条件生成调整。':'原视频计划表已核对，百分比指个人1RM，非体重百分比。此原表属进阶安排；组间休息和缺失变式的替代由应用设定。无近期基线只预填轻负重试练，不冒充已达到原课负荷。按个人时间、基础、限制和恢复调整，请用生成个人计划。',days}
 p.filters=programFilters(p,catalog);return p
}
export function creatorRequest(course){return '参考 '+course.creator+' 的「'+course.name+'」，结合我的已有档案、目标、可用器材、时间和恢复安排，生成软件内可执行的训练计划与配套饮食。每个动作必须对应提供的真实动作ID，预填组次或时长、重量和休息；未核对的原课程参数请按内置官方指南做个人适配并说明，不能只给视频链接。已有档案不重复询问。'}
export function selectedCreatorKnowledge(id,catalog){
 const c=creatorPrograms.find(p=>p.id===id);if(!c)return null
 const p=creatorMappedProgram(c,catalog)
 return {source:{id:c.id,creator:c.creator,title:c.creator+' · '+c.name,url:c.url,summary:c.summary,kind:'creator-reference',scope:c.applicationArrangement?'教学动作已核对；星期、组次、休息为应用编排，需按个人条件调整。':p?'原表数字已核对；本机缺少的变式及应用默认值另有说明，生成时需根据个人能力、恢复、限制调整。':'原作者公开摘要，不是完整原课处方；使用内置指南和真实动作生成个人适配，不能声称完整复刻。'},presets:p?[{id:p.id,name:p.nameZh,notes:p.notes,days:p.days.map(d=>({weekday:d.weekday,items:d.exerciseItems.map(e=>({...e,name:catalog.find(x=>x.id===e.exerciseId)?.nameZh||catalog.find(x=>x.id===e.exerciseId)?.n}))}))}]:[]}
}
export function matchingCreatorPrograms(filters={},search='',catalog=[]){
  const q=search.trim().toLowerCase()
  return creatorPrograms.map(c=>{const p=c.tableKey&&catalog.length?creatorMappedProgram(c,catalog):null;return p?{...c,minutesMax:p.filters.minutes,bodyParts:p.filters.bodyParts,estimatedMinutes:true}:c}).filter(p=>(!filters.goal||p.goals.includes(filters.goal))&&(!filters.intensity||p.intensity===filters.intensity)&&(!filters.body||p.bodyParts.includes(filters.body))&&(!filters.duration||(Number.isFinite(p.minutesMax)&&(filters.duration==='short'?p.minutesMax<=30:filters.duration==='medium'?p.minutesMax>30&&p.minutesMax<=60:p.minutesMax>60)))&&(!q||[p.creator,p.name,p.category,...p.aliases].join(' ').toLowerCase().includes(q)))
}
export function creatorKnowledge(request=''){
  const text=request.toLowerCase()
  return creatorPrograms.filter(p=>p.aliases.some(a=>text.includes(a))).slice(0,8).map(p=>({id:p.id,creator:p.creator,title:p.creator+' · '+p.name,url:p.url,summary:p.summary,kind:'creator-reference',scope:p.applicationArrangement?'已核对教学动作；星期与组次为应用编排，个人生成需按档案调整。':p.tableKey?'原动作表已核对；缺少变式需说明替代，休息与首次公斤数为应用预设，个人生成遵守恢复和营养规则。':'博主公开目录摘要，非官方标准；完整动作/组次未核对，不能编造原课程。按现有动作库重编须说明为应用适配，并遵守官方恢复与营养规则。'}))
}
