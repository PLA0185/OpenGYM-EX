import { describe,it,expect,vi } from 'vitest'
import { createAndroidBackHandler } from './android-back.js'

function fixture(){let path='/assistant',index=1,time=0;const ui={sheets:[],closeSheet:vi.fn(),toast:vi.fn()},navigate=vi.fn(),minimize=vi.fn();return {ui,navigate,minimize,set:(p,i=1,t=0)=>{path=p;index=i;time=t},back:createAndroidBackHandler({getUI:()=>ui,getPath:()=>path,getIndex:()=>index,navigate,minimize,now:()=>time})}}
describe('Android system back',()=>{
  it('closes only the top unlocked sheet, without navigating or minimizing',()=>{const f=fixture();f.ui.sheets=[{id:'base'},{id:'top'}];expect(f.back()).toBe('sheet');expect(f.ui.closeSheet).toHaveBeenCalledWith('top');expect(f.navigate).not.toHaveBeenCalled();expect(f.minimize).not.toHaveBeenCalled()})
  it('consumes back on a locked dialog',()=>{const f=fixture();f.ui.sheets=[{id:'locked',locked:true}];f.back();expect(f.ui.closeSheet).not.toHaveBeenCalled();expect(f.minimize).not.toHaveBeenCalled()})
  it('uses router history on normal inner pages',()=>{const f=fixture();expect(f.back()).toBe('route');expect(f.navigate).toHaveBeenCalledWith(-1);expect(f.minimize).not.toHaveBeenCalled()})
  it.each([['/nutrition/week','/nutrition'],['/plan/r/routine','/plan'],['/assistant','/home']])('deep-linked %s returns to %s', (page,parent)=>{const f=fixture();f.set(page,0);f.back();expect(f.navigate).toHaveBeenCalledWith(parent,{replace:true})})
  it('requires two home gestures within two seconds, and resets after other navigation',()=>{const f=fixture();f.set('/home',0,1000);expect(f.back()).toBe('confirm');expect(f.minimize).not.toHaveBeenCalled();f.set('/home',0,3500);expect(f.back()).toBe('confirm');f.set('/home',0,4000);expect(f.back()).toBe('minimize');expect(f.minimize).toHaveBeenCalledTimes(1);f.set('/home',0,5000);f.back();f.set('/settings',1,5100);f.back();f.set('/home',0,5200);expect(f.back()).toBe('confirm')})
})
