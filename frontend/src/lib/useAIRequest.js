import { useRef, useEffect, useState } from 'react'
export function useAIRequest() {
  const controller=useRef(null),[busy,setBusy]=useState(false)
  useEffect(()=>()=>controller.current?.abort(),[])
  return {busy,cancel:()=>controller.current?.abort(),async run(task){
    controller.current?.abort();const current=new AbortController();controller.current=current;setBusy(true)
    try{return await task(current.signal)}finally{if(controller.current===current){controller.current=null;setBusy(false)}}
  }}
}
