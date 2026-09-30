import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { Section,Row,NumberField,SelectRow,TextField,Button,Switch } from '../components/ui.jsx'
import { clone,targets,validateTarget } from '../lib/nutrition.js'
export default function Onboarding({onDone}){
  const S=useStore(s=>s.S),update=useStore(s=>s.update),[p,setP]=useState({...clone(S.xunlian.profile),fitnessLevel:S.xunlian.profile.fitnessLevel||'inactive'}),[error,setError]=useState('')
  const change=(k,v)=>setP({...p,[k]:v})
  const save=()=>{if(!Number.isInteger(p.age)||p.age<12||p.age>100||!Number.isFinite(p.weightKg)||p.weightKg<25||p.weightKg>350){setError('请填写有效年龄和体重。');return}
    update(s=>{s.xunlian.profile={...p,onboardingCompleted:true};if(!s.xunlian.target){try{const n=targets(p,p.weightKg);validateTarget(n);s.xunlian.target=n}catch{/* manual nutrition targets remain available */}}s.xunlian.revision++});onDone?.()}
  return <div className="narrow feature-page"><h1>先了解你的运动基础</h1><p className="sect-f">用于首次训练预填。导入方案里的明确数值和你的近期完成记录优先；所有初始值都可以修改。</p><Section>
    <Row title="年龄"><NumberField decimal={false} nullable value={p.age} onChange={v=>change('age',v)}/></Row><Row title="体重（公斤）"><NumberField nullable value={p.weightKg} onChange={v=>change('weightKg',v)}/></Row><Row title="身高（厘米，可选）"><NumberField nullable value={p.heightCm} onChange={v=>change('heightCm',v)}/></Row>
    <SelectRow title="性别（用于估算营养目标，可选）" value={p.sex||''} onChange={v=>change('sex',v)} options={[{value:'',label:'暂不填写'},{value:'male',label:'男'},{value:'female',label:'女'}]}/>
    <SelectRow title="运动基础" value={p.fitnessLevel} onChange={v=>change('fitnessLevel',v)} options={[{value:'inactive',label:'不经常运动 / 刚开始'},{value:'occasional',label:'偶尔运动'},{value:'trained',label:'有运动基础'},{value:'regular',label:'经常健身，熟悉工作重量'}]}/>
    <SelectRow title="目标" value={p.goal} onChange={v=>change('goal',v)} options={[{value:'maintain',label:'保持健康'},{value:'lose',label:'减脂'},{value:'gain',label:'增肌'}]}/>
    <SelectRow title="全天活动水平（含工作、生活与训练）" value={[1.5,1.75,2].includes(p.activity)?p.activity:1.5} onChange={v=>change('activity',v)} options={[{value:1.5,label:'低 · 多数时间坐着'},{value:1.75,label:'中 · 工作生活活动较多'},{value:2,label:'高 · 全天活动量很大'}]}/><Row title="需避开的动作或伤病"><TextField value={p.limitations||''} placeholder="没有可留空" onChange={e=>change('limitations',e.target.value)}/></Row><Row title="孕期、疾病或特殊饮食需求"><Switch checked={p.specialDiet} onChange={v=>change('specialDiet',v)}/></Row>
    </Section><p className="notice">重量是应用提供的保守试练起点，不是力量测试结果。哑铃按每只、杠铃按含杆总重记录。首组仍须确认实际器材和动作；有基础可以直接改成自己的工作重量。特殊情况、未成年人和无法可靠设定的器材仍需自行确认。</p>{error&&<p className="notice">{error}</p>}<Button variant="primary" onClick={save}>保存，开始使用</Button></div>
}
