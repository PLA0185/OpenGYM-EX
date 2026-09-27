// Keep routing and sheet behavior testable independently of Android hardware.
export function createAndroidBackHandler({getUI,getPath,getIndex,navigate,minimize,now=Date.now}) {
  let exitArmedAt=null
  return ()=>{
    const ui=getUI(),top=ui.sheets.at(-1)
    if(top){exitArmedAt=null;if(!top.locked)ui.closeSheet(top.id);else ui.toast('请先完成或取消当前操作');return 'sheet'}
    if(getPath()!=='/home'){
      exitArmedAt=null
      if(getIndex()>0)navigate(-1)
      else {const path=getPath();navigate(path.startsWith('/nutrition/')?'/nutrition':path.startsWith('/plan/')?'/plan':path.startsWith('/coach/')?'/coach':'/home',{replace:true})}
      return 'route'
    }
    const time=now()
    if(exitArmedAt!==null&&time-exitArmedAt<=2000){exitArmedAt=null;minimize();return 'minimize'}
    exitArmedAt=time;ui.toast('再返回一次回到桌面');return 'confirm'
  }
}
