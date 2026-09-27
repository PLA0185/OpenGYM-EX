import { Capacitor } from '@capacitor/core'
import { Clipboard } from '@capacitor/clipboard'

// Read only after an explicit click; never persist clipboard contents.
export async function readClipboardText() {
  if (Capacitor.isNativePlatform()) {
    const result = await Clipboard.read()
    if (result.type !== 'text/plain') throw new Error('剪贴板里不是文字，请复制密钥后重试。')
    return result.value
  }
  if (!navigator.clipboard?.readText) throw new Error('此环境无法读取剪贴板，请点显示密钥后长按粘贴。')
  try { return await navigator.clipboard.readText() }
  catch { throw new Error('未能读取剪贴板，请点显示密钥后长按粘贴。') }
}
