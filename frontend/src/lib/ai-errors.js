import { t } from './i18n.js'
export function requireAI(S,{target=false}={}) {
  if(!S.xunlian.ai.enabled)throw Object.assign(new Error('disabled'),{code:'disabled'})
  if(target&&!S.xunlian.target)throw Object.assign(new Error('target'),{code:'target'})
}
export function aiErrorMessage(error){
  const code=error?.code||(['credential','target','disabled'].includes(error?.message)?error.message:'input')
  const message=t('AI '+code)
  return t('AI error: {0}',message)+(error?.detail?' '+error.detail:'')
}
