import { Capacitor, registerPlugin } from '@capacitor/core'
const secure = registerPlugin('XunlianCredential')
let sessionKey = ''
export async function getCredential() {
  if(sessionKey)return sessionKey
  if(window.xunlianDesktop) return window.xunlianDesktop.credentialGet()
  if(Capacitor.isNativePlatform()) return (await secure.get()).value || ''
  return sessionKey
}
export async function setCredential(value) {
  if(value.length>512)throw new Error('Credential too long')
  sessionKey=''
  try {
    if(window.xunlianDesktop) return await window.xunlianDesktop.credentialSet(value)
    if(Capacitor.isNativePlatform()) {await secure.set({value});return 'secure'}
  } catch(e) {if(!value)throw e;sessionKey=value;return 'session'}
  sessionKey=value;return 'session'
}
export async function clearCredential(){ await setCredential('') }
