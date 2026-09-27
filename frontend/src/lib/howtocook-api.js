export function kitchenBase(value){
  const url=new URL(value)
  if(url.username||url.password||url.search||url.hash||!['https:','http:'].includes(url.protocol))throw new Error('请填写完整的 HowToCook API 地址。')
  if(url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('远程接口需使用 HTTPS。')
  return url.href.replace(/\/$/,'').replace(/\/api$/,'')
}
export function createKitchenAPI(base,{fetcher=fetch}={}){
  const root=kitchenBase(base)
  const get=async(path,signal)=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000)
    const cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true})
    try{if(signal?.aborted)throw new Error('请求已取消。');const response=await fetcher(root+'/api/'+path,{signal:controller.signal,credentials:'omit',redirect:'error',headers:{Accept:'application/json'}})
      if(!response.ok)throw new Error('菜谱接口返回 HTTP '+response.status)
      const body=await response.text();if(body.length>2000000)throw new Error('接口结果过大。')
      const json=JSON.parse(body);if(json.error||!Object.hasOwn(json,'data'))throw new Error('接口格式不匹配，请使用 HowToCook-API 兼容服务。');return json.data
    }catch(e){if(e.name==='AbortError')throw new Error(signal?.aborted?'请求已取消。':'菜谱接口请求超时。');throw e}finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel)}
  }
  return {search:(query,signal)=>get('recipes?q='+encodeURIComponent(query)+'&page_size=30',signal),detail:(id,signal)=>get('recipes/'+encodeURIComponent(id),signal),health:signal=>get('health',signal)}
}
export function kitchenRecipe(data,base){
  if(!data||typeof data.id!=='string'||typeof data.title!=='string'||!data.title.trim())throw new Error('菜谱缺少名称或 ID。')
  const ingredientData=Array.isArray(data.ingredients)?data.ingredients:[]
  const steps=(Array.isArray(data.steps)?data.steps:[]).map(s=>typeof s==='string'?s:s.text||s.content||'').filter(Boolean)
  const originalText=String(data.markdown||'').slice(0,200000)
  if(!steps.length&&!originalText)throw new Error('菜谱缺少步骤。')
  return {id:'htc-api-'+data.id,nameZh:data.title.slice(0,200),nameEn:'',servings:Number.isFinite(data.servings)&&data.servings>0?data.servings:1,
    servingsBasis:Number.isFinite(data.servings)&&data.servings>0?'source-explicit':'unknown-needs-review',
    ingredients:ingredientData.map(i=>({originalText:(typeof i==='string'?i:i.raw||i.name||'').slice(0,1000),foodId:null,grams:null,mappingStatus:'unmapped',estimated:false})),
    steps:steps.length?steps.map(s=>s.slice(0,4000)):[originalText],originalText,source:'HowToCook community API',sourceUrl:kitchenBase(base)+'/api/recipes/'+encodeURIComponent(data.id),sourceRelease:String(data.updated_at||'online-import'),license:'Unlicense (HowToCook community content)',revision:1,verified:false,
    notes:'在线原方：份数、食材对应和可食克数需审核。适量、个数、调料及原文卡路里不自动转换成精确营养。'}
}
