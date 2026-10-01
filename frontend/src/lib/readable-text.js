// Rendered units prevent single-character lines while preserving the exact text
// for accessibility, copying, search and exercise-name matching. No zero-width
// characters are inserted into saved user data or AI input.
export function readableUnits(text){
  const units=[]
  for(const token of String(text).match(/[\p{Script=Han}]+|[^\p{Script=Han}\s\p{P}·]+|[\s\p{P}·]+/gu)||[]){
    if(/^\p{Script=Han}+$/u.test(token)){
      const chars=[...token];while(chars.length){const size=chars.length===3?3:Math.min(2,chars.length);units.push(chars.splice(0,size).join(''))}
    }else if(/^[\s\p{P}·]+$/u.test(token)&&units.length)units[units.length-1]+=token
    else units.push(token)
  }
  for(let i=0;i<units.length;i++){
    if(units[i].replace(/[\s\p{P}·]/gu,'').length<=1&&units.length>1){
      if(i>0){units[i-1]+=units[i];units.splice(i--,1)}else{units[1]=units[0]+units[1];units.shift();i--}
    }
  }
  return units
}
