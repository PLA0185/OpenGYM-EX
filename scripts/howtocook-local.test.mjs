import { test } from 'node:test'
import assert from 'node:assert/strict'
import { kitchenServer } from './howtocook-local.mjs'
import { createKitchenAPI,kitchenRecipe } from '../frontend/src/lib/howtocook-api.js'
test('real local HTTP service matches the app adapter and preserves unknown portions',async()=>{
  const server=kitchenServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  try{const base='http://127.0.0.1:'+server.address().port,api=createKitchenAPI(base),health=await api.health();assert.equal(health.recipes,373);const list=await api.search('鸡蛋');assert.ok(list.recipes.length>0);const detail=await api.detail(list.recipes[0].id),recipe=kitchenRecipe(detail,base);assert.equal(recipe.servingsBasis,'unknown-needs-review');assert.ok(recipe.originalText);assert.ok(recipe.ingredients.every(i=>i.grams===null));assert.equal((await fetch(base+'/api/recipes',{method:'POST'})).status,405);assert.equal((await fetch(base+'/api/recipes/invented')).status,404)}finally{await new Promise(resolve=>server.close(resolve))}
})
