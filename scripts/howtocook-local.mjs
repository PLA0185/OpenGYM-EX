// Optional read-only compatibility service. Personal apps remain fully offline.
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const root=resolve(import.meta.dirname,'..')
export function kitchenServer(recipes=JSON.parse(readFileSync(resolve(root,'frontend/src/data/recipes.json'),'utf8'))){
  const source=recipes.filter(r=>r.source==='HowToCook'),index=new Map(source.map(r=>[r.id,r]))
  return createServer((req,res)=>{
    const origin=req.headers.origin
    if(origin&&/^(?:https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?|capacitor:\/\/localhost)$/.test(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin')}
    const send=(status,data,error)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(error?{error}:{data}))}
    if(req.method!=='GET'){send(405,null,'read-only service');return}
    try{
      const url=new URL(req.url,'http://127.0.0.1'),query=(url.searchParams.get('q')||'').trim()
      if(query.length>120){send(400,null,'query too long');return}
      if(url.pathname==='/api/health'){send(200,{status:'ok',recipes:source.length,source:'pinned local HowToCook snapshot',version:source[0]?.sourceRelease});return}
      if(url.pathname==='/api/recipes'){const matches=source.filter(r=>[r.nameZh,...r.ingredients.map(i=>i.originalText)].some(s=>s.toLowerCase().includes(query.toLowerCase())));send(200,{recipes:matches.slice(0,30).map(r=>({id:r.id,title:r.nameZh})),total:matches.length});return}
      if(url.pathname.startsWith('/api/recipes/')){const id=decodeURIComponent(url.pathname.slice(13)),r=index.get(id);if(!r){send(404,null,'unknown recipe');return}send(200,{id:r.id,title:r.nameZh,ingredients:r.ingredients.map(i=>({raw:i.originalText})),steps:r.steps,markdown:r.originalText,servings:r.servingsBasis==='unknown-needs-review'?null:r.servings,updated_at:r.sourceRelease,source_url:r.sourceUrl});return}
      send(404,null,'unknown endpoint')
    }catch{send(400,null,'invalid request')}
  })
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const port=Number(process.env.HOWTOCOOK_PORT||3999)
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid HOWTOCOOK_PORT')
  kitchenServer().listen(port,'127.0.0.1',()=>process.stdout.write('Read-only HowToCook compatibility service: http://127.0.0.1:'+port+'\n'))
}
